import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import Operator from "../models/Operator.js";
import Route from "../models/Route.js";
import Schedule from "../models/Schedule.js";
import Vehicle from "../models/Vehicle.js";
import Booking from "../models/Booking.js";
import { expirePendingBookings } from "../bookings/expiration.js";

const transports = new Set(["Bus", "Train", "Launch", "Event"]);
const maxSchedules = 1000;

function normalizeLocation(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function parseTravelDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const utcDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(utcDate.getTime()) || utcDate.toISOString().slice(0, 10) !== value) return null;

  const start = new Date(`${value}T00:00:00.000+06:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function parsePublicScheduleQuery(query) {
  const errors = {};
  const from = typeof query.from === "string" ? query.from.trim().replace(/\s+/g, " ") : "";
  const to = typeof query.to === "string" ? query.to.trim().replace(/\s+/g, " ") : "";
  const dateRange = parseTravelDate(query.date);
  const transport = query.transport;

  if (!from || from.length > 120) errors.from = "Departure must be between 1 and 120 characters.";
  if (!to || to.length > 120) errors.to = "Destination must be between 1 and 120 characters.";
  if (from && to && normalizeLocation(from) === normalizeLocation(to)) {
    errors.to = "Choose a destination different from the departure.";
  }
  if (!dateRange) errors.date = "Travel date must be a valid date in YYYY-MM-DD format.";
  if (typeof transport !== "string" || !transports.has(transport)) {
    errors.transport = "Transport must be Bus, Train, Launch, or Event.";
  }

  return { errors, values: { from, to, dateRange, transport } };
}

export function publicScheduleResponse(schedule, bookedSeats = []) {
  return {
    id: String(schedule._id),
    operator: schedule.operatorId.name,
    transport: schedule.transport,
    departure: schedule.routeId.departure,
    destination: schedule.routeId.destination,
    departureAt: schedule.departureAt,
    arrivalAt: schedule.arrivalAt,
    totalSeats: schedule.totalSeats,
    availableSeats: schedule.availableSeats,
    fare: schedule.fare,
    coach: schedule.vehicleId.name,
    bookedSeats,
  };
}

export function createPublicSchedulesRouter() {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });

  router.get("/", limiter, async (request, response, next) => {
    try {
      await expirePendingBookings();
      const { errors, values } = parsePublicScheduleQuery(request.query);
      if (Object.keys(errors).length) {
        return response.status(400).json({
          success: false,
          message: "Please provide a valid journey search.",
          errors,
        });
      }

      const { from, to, dateRange, transport } = values;
      const [routes, operators] = await Promise.all([
        Route.find({
          departureKey: normalizeLocation(from),
          destinationKey: normalizeLocation(to),
          transport,
          status: "active",
          deletedAt: null,
        }).distinct("_id"),
        Operator.find({ transport, status: "active", deletedAt: null }).distinct("_id"),
      ]);
      if (!routes.length || !operators.length) {
        return response.json({
          success: true,
          message: "Available schedules retrieved.",
          data: { schedules: [], total: 0 },
        });
      }

      if (transport === "Event") {
        return response.json({
          success: true,
          message: "Available schedules retrieved.",
          data: { schedules: [], total: 0 },
        });
      }

      const vehicles = await Vehicle.find({
        operatorId: { $in: operators },
        transport,
        status: "active",
        deletedAt: null,
      }).distinct("_id");
      if (!vehicles.length) {
        return response.json({
          success: true,
          message: "Available schedules retrieved.",
          data: { schedules: [], total: 0 },
        });
      }

      const scheduleFilter = {
        routeId: { $in: routes },
        operatorId: { $in: operators },
        vehicleId: { $in: vehicles },
        transport,
        departureAt: {
          $gte: new Date(Math.max(dateRange.start.getTime(), Date.now())),
          $lt: dateRange.end,
        },
        status: { $in: ["scheduled", "active"] },
        availableSeats: { $gt: 0 },
        deletedAt: null,
      };
      const [schedules, total] = await Promise.all([
        Schedule.find(scheduleFilter)
          .select("operatorId vehicleId routeId transport departureAt arrivalAt totalSeats availableSeats fare")
          .populate({ path: "operatorId", select: "name" })
          .populate({ path: "vehicleId", select: "name" })
          .populate({ path: "routeId", select: "departure destination" })
          .sort({ departureAt: 1, _id: 1 })
          .limit(maxSchedules)
          .lean(),
        Schedule.countDocuments(scheduleFilter),
      ]);
      const validSchedules = schedules.filter(
        (schedule) => schedule.operatorId && schedule.vehicleId && schedule.routeId,
      );
      const activeBookings = validSchedules.length
        ? await Booking.find({
            scheduleId: { $in: validSchedules.map((schedule) => schedule._id) },
            status: { $in: ["pending", "confirmed"] },
          }).select("scheduleId seatNumbers").lean()
        : [];
      const seatsBySchedule = new Map();
      for (const booking of activeBookings) {
        const key = String(booking.scheduleId);
        seatsBySchedule.set(key, [...(seatsBySchedule.get(key) || []), ...booking.seatNumbers]);
      }

      return response.json({
        success: true,
        message: "Available schedules retrieved.",
        data: {
          schedules: validSchedules.map((schedule) =>
            publicScheduleResponse(schedule, seatsBySchedule.get(String(schedule._id)) || [])),
          total,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id/seats", limiter, async (request, response, next) => {
    try {
      await expirePendingBookings();
      if (!/^[a-f\d]{24}$/i.test(request.params.id)) {
        return response.status(400).json({ success: false, message: "Schedule ID must be a valid MongoDB ObjectId." });
      }
      const schedule = await Schedule.findOne({
        _id: request.params.id,
        transport: "Bus",
        status: { $in: ["scheduled", "active"] },
        departureAt: { $gt: new Date() },
        deletedAt: null,
      }).select("totalSeats availableSeats").lean();
      if (!schedule) return response.status(404).json({ success: false, message: "Upcoming bus schedule not found." });

      const activeBookings = await Booking.find({
        scheduleId: schedule._id,
        status: { $in: ["pending", "confirmed"] },
      }).select("seatNumbers").lean();
      return response.json({
        success: true,
        message: "Live seat availability retrieved.",
        data: {
          totalSeats: schedule.totalSeats,
          availableSeats: schedule.availableSeats,
          bookedSeats: [...new Set(activeBookings.flatMap((booking) => booking.seatNumbers))],
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
