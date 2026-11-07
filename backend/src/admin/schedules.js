import { Router } from "express";
import mongoose from "mongoose";
import Operator from "../models/Operator.js";
import Route from "../models/Route.js";
import Schedule from "../models/Schedule.js";
import Vehicle from "../models/Vehicle.js";
import { sanitizeText } from "../auth/security.js";

const scheduleFields = "operatorId vehicleId routeId transport departureAt arrivalAt totalSeats availableSeats fare status createdAt updatedAt";
const createFields = new Set(["operatorId", "vehicleId", "routeId", "transport", "departureAt", "arrivalAt", "totalSeats", "availableSeats", "fare", "status"]);
const updateFields = new Set(["operatorId", "vehicleId", "routeId", "transport", "departureAt", "arrivalAt", "totalSeats", "availableSeats", "fare"]);
const statuses = new Set(["scheduled", "active", "completed", "cancelled"]);
const transports = new Set(["Bus", "Train", "Launch"]);

export function isScheduleObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

function parseBoundedInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

export function parseDate(value, endOfDay = false) {
  if (typeof value !== "string") return null;
  const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
  const date = dayPattern.test(value)
    ? new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (dayPattern.test(value) && date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function validateScheduleFields(body, { creating }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: { body: "A JSON object is required." }, values: {} };
  }
  const allowedFields = creating ? createFields : updateFields;
  const unexpected = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unexpected.length) {
    return { errors: { body: `Unsupported fields: ${unexpected.join(", ")}.` }, values: {} };
  }

  const errors = {};
  const values = {};
  for (const field of ["operatorId", "vehicleId", "routeId"]) {
    if (!creating && !Object.hasOwn(body, field)) continue;
    values[field] = body[field];
    if (!isScheduleObjectId(values[field])) errors[field] = `Choose a valid ${field.replace("Id", "").toLowerCase()}.`;
  }
  if (creating || Object.hasOwn(body, "transport")) {
    values.transport = body.transport;
    if (!transports.has(values.transport)) errors.transport = "Transport must be Bus, Train, or Launch.";
  }
  for (const field of ["departureAt", "arrivalAt"]) {
    if (!creating && !Object.hasOwn(body, field)) continue;
    values[field] = parseDate(body[field]);
    if (!values[field]) errors[field] = `${field === "departureAt" ? "Departure" : "Arrival"} must be a valid date and time.`;
  }
  if (values.departureAt && values.arrivalAt && values.departureAt >= values.arrivalAt) {
    errors.arrivalAt = "Arrival time must be after departure time.";
  }
  for (const field of ["totalSeats", "availableSeats"]) {
    if (!creating && !Object.hasOwn(body, field)) continue;
    values[field] = body[field];
    if (!Number.isInteger(values[field]) || values[field] < (field === "availableSeats" ? 0 : 1) || values[field] > 1000) {
      errors[field] = `${field === "totalSeats" ? "Total" : "Available"} seats must be a whole number between ${field === "availableSeats" ? "0" : "1"} and 1000.`;
    }
  }
  if (values.totalSeats !== undefined && values.availableSeats !== undefined && values.availableSeats > values.totalSeats) {
    errors.availableSeats = "Available seats cannot exceed total seats.";
  }
  if (creating || Object.hasOwn(body, "fare")) {
    values.fare = body.fare;
    if (typeof values.fare !== "number" || !Number.isFinite(values.fare) || values.fare < 0 || values.fare > 100_000_000) {
      errors.fare = "Ticket fare must be a number between 0 and 100,000,000.";
    }
  }
  if (creating && body.status !== undefined) {
    values.status = body.status;
    if (!statuses.has(values.status)) errors.status = "Status must be scheduled, active, completed, or cancelled.";
  }
  if (!creating && !Object.keys(body).length) errors.body = "Provide at least one schedule field to update.";
  return { errors, values };
}

export function hasScheduleOverlap(candidate, schedules) {
  return schedules.some((schedule) =>
    String(schedule.vehicleId) === String(candidate.vehicleId)
    && schedule.status !== "cancelled"
    && schedule.deletedAt == null
    && new Date(schedule.departureAt) < new Date(candidate.arrivalAt)
    && new Date(schedule.arrivalAt) > new Date(candidate.departureAt));
}

function scheduleResponse(schedule) {
  function reference(value) {
    if (!value) return null;
    if (typeof value !== "object") return { id: String(value) };
    return {
      id: String(value._id),
      name: value.name ?? value.departure,
      email: value.email,
      phone: value.phone,
      status: value.status,
      transport: value.transport,
      ...(value.destination ? { destination: value.destination } : {}),
      ...(value.registrationNumber ? { registrationNumber: value.registrationNumber } : {}),
      ...(value.seatCapacity !== undefined ? { seatCapacity: value.seatCapacity } : {}),
    };
  }
  return {
    id: String(schedule._id),
    operatorId: reference(schedule.operatorId)?.id,
    vehicleId: reference(schedule.vehicleId)?.id,
    routeId: reference(schedule.routeId)?.id,
    operator: reference(schedule.operatorId),
    vehicle: reference(schedule.vehicleId),
    route: reference(schedule.routeId),
    transport: schedule.transport,
    departureAt: schedule.departureAt,
    arrivalAt: schedule.arrivalAt,
    totalSeats: schedule.totalSeats,
    availableSeats: schedule.availableSeats,
    fare: schedule.fare,
    status: schedule.status,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

async function validateReferences(values, existing, response) {
  const operatorId = values.operatorId ?? existing?.operatorId;
  const vehicleId = values.vehicleId ?? existing?.vehicleId;
  const routeId = values.routeId ?? existing?.routeId;
  const transport = values.transport ?? existing?.transport;
  if (!operatorId || !vehicleId || !routeId || !transport) return true;

  const [operator, vehicle, route] = await Promise.all([
    Operator.findOne({ _id: operatorId, deletedAt: null }).select("transport status").lean(),
    Vehicle.findOne({ _id: vehicleId, deletedAt: null }).select("operatorId transport seatCapacity status").lean(),
    Route.findOne({ _id: routeId, deletedAt: null }).select("transport status").lean(),
  ]);
  if (!operator) {
    response.status(400).json({ success: false, message: "Selected operator does not exist or is archived.", errors: { operatorId: "Choose an available operator." } });
    return false;
  }
  if (!vehicle) {
    response.status(400).json({ success: false, message: "Selected vehicle does not exist or is archived.", errors: { vehicleId: "Choose an available vehicle." } });
    return false;
  }
  if (!route) {
    response.status(400).json({ success: false, message: "Selected route does not exist or is archived.", errors: { routeId: "Choose an available route." } });
    return false;
  }
  if (operator.status !== "active" || vehicle.status !== "active" || route.status !== "active") {
    response.status(400).json({ success: false, message: "Operator, vehicle, and route must all be active." });
    return false;
  }
  if (String(vehicle.operatorId) !== String(operator._id)) {
    response.status(400).json({ success: false, message: "Vehicle is not assigned to the selected operator.", errors: { vehicleId: "Choose a vehicle assigned to this operator." } });
    return false;
  }
  if (operator.transport !== transport || vehicle.transport !== transport || route.transport !== transport) {
    response.status(400).json({ success: false, message: "Schedule transport must match operator, vehicle, and route." });
    return false;
  }

  if (values.totalSeats !== undefined && values.totalSeats !== vehicle.seatCapacity) {
    response.status(400).json({ success: false, message: "Total seats must match the vehicle seat capacity.", errors: { totalSeats: `Selected vehicle capacity is ${vehicle.seatCapacity}.` } });
    return false;
  }
  const totalSeats = values.totalSeats ?? existing?.totalSeats ?? vehicle.seatCapacity;
  if (totalSeats !== vehicle.seatCapacity) {
    response.status(400).json({ success: false, message: "Total seats must match the vehicle seat capacity.", errors: { totalSeats: `Selected vehicle capacity is ${vehicle.seatCapacity}.` } });
    return false;
  }
  const availableSeats = values.availableSeats ?? existing?.availableSeats ?? totalSeats;
  if (availableSeats > totalSeats) {
    response.status(400).json({ success: false, message: "Available seats cannot exceed total seats.", errors: { availableSeats: "Reduce available seats to the total vehicle capacity or less." } });
    return false;
  }
  return true;
}

async function conflictsWithSchedule(values, scheduleId = null) {
  const vehicleId = values.vehicleId;
  const departureAt = values.departureAt;
  const arrivalAt = values.arrivalAt;
  if (!vehicleId || !departureAt || !arrivalAt) return false;
  const filter = {
    vehicleId,
    deletedAt: null,
    status: { $ne: "cancelled" },
    departureAt: { $lt: arrivalAt },
    arrivalAt: { $gt: departureAt },
  };
  if (scheduleId) filter._id = { $ne: scheduleId };
  return Boolean(await Schedule.exists(filter));
}

function duplicateSchedule(response) {
  return response.status(409).json({
    success: false,
    message: "The vehicle already has a schedule that overlaps this time range.",
    errors: { departureAt: "Choose a time that does not overlap another schedule for this vehicle." },
  });
}

export function hasReservedSeats(schedule) {
  return schedule.availableSeats < schedule.totalSeats;
}

function rejectReservedScheduleMutation(response) {
  return response.status(409).json({
    success: false,
    message: "This schedule has reserved seats. Cancel active bookings before making changes that could affect passengers.",
    code: "SCHEDULE_HAS_RESERVED_SEATS",
    bookingValidationAvailable: true,
  });
}

const populateRelations = [
  { path: "operatorId", select: "name email phone status transport", match: { deletedAt: null } },
  { path: "vehicleId", select: "name registrationNumber transport seatCapacity status", match: { deletedAt: null } },
  { path: "routeId", select: "departure destination transport status", match: { deletedAt: null } },
];

export function createAdminSchedulesRouter() {
  const router = Router();

  router.get("/", async (request, response, next) => {
    try {
      const page = parseBoundedInteger(request.query.page, 1, 1_000_000);
      const limit = parseBoundedInteger(request.query.limit, 20, 100);
      if (!page || !limit) {
        return response.status(400).json({ success: false, message: "Page must be positive and limit must be between 1 and 100." });
      }
      const status = request.query.status;
      if (status !== undefined && !statuses.has(status)) {
        return response.status(400).json({ success: false, message: "Status must be scheduled, active, completed, or cancelled." });
      }
      const transport = request.query.transport;
      if (transport !== undefined && !transports.has(transport)) {
        return response.status(400).json({ success: false, message: "Transport must be Bus, Train, or Launch." });
      }
      const operatorId = request.query.operatorId;
      if (operatorId !== undefined && !isScheduleObjectId(operatorId)) {
        return response.status(400).json({ success: false, message: "Operator ID must be a valid MongoDB ObjectId." });
      }
      const dateFrom = request.query.date === undefined ? undefined : parseDate(request.query.date);
      if (request.query.date !== undefined && !dateFrom) {
        return response.status(400).json({ success: false, message: "Date must use YYYY-MM-DD or a valid ISO date-time." });
      }
      const from = request.query.from === undefined ? undefined : parseDate(request.query.from);
      const to = request.query.to === undefined ? undefined : parseDate(request.query.to, /^\d{4}-\d{2}-\d{2}$/.test(request.query.to));
      if ((request.query.from !== undefined && !from) || (request.query.to !== undefined && !to)) {
        return response.status(400).json({ success: false, message: "Date range must use YYYY-MM-DD or valid ISO date-time values." });
      }
      if (from && to && from > to) {
        return response.status(400).json({ success: false, message: "Start date must not be after end date." });
      }

      const sort = request.query.sort ?? "departure_asc";
      const sortOptions = {
        departure_asc: { departureAt: 1, _id: 1 },
        departure_desc: { departureAt: -1, _id: -1 },
        newest: { createdAt: -1, _id: -1 },
        oldest: { createdAt: 1, _id: 1 },
      };
      if (!Object.hasOwn(sortOptions, sort)) {
        return response.status(400).json({ success: false, message: "Sort must be departure_asc, departure_desc, newest, or oldest." });
      }

      const filter = { deletedAt: null };
      if (status) filter.status = status;
      if (transport) filter.transport = transport;
      if (operatorId) filter.operatorId = operatorId;
      if (dateFrom) {
        const start = new Date(`${request.query.date.slice(0, 10)}T00:00:00.000Z`);
        const end = new Date(`${request.query.date.slice(0, 10)}T23:59:59.999Z`);
        filter.departureAt = { $gte: start, $lte: end };
      } else if (from || to) {
        filter.departureAt = {};
        if (from) filter.departureAt.$gte = from;
        if (to) filter.departureAt.$lte = to;
      }
      const search = typeof request.query.search === "string" ? sanitizeText(request.query.search).slice(0, 120) : "";
      if (search) {
        const pattern = new RegExp(escapeRegex(search), "i");
        const [operatorIds, routeIds] = await Promise.all([
          Operator.find({ name: pattern, deletedAt: null }).distinct("_id"),
          Route.find({ deletedAt: null, $or: [{ departure: pattern }, { destination: pattern }] }).distinct("_id"),
        ]);
        filter.$or = [
          { operatorId: { $in: operatorIds } },
          { routeId: { $in: routeIds } },
        ];
        if (isScheduleObjectId(search)) filter.$or.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      const [schedules, total, statistics] = await Promise.all([
        Schedule.find(filter)
          .select(scheduleFields)
          .populate(populateRelations)
          .sort(sortOptions[sort])
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Schedule.countDocuments(filter),
        Schedule.aggregate([
          { $match: { deletedAt: null } },
          { $group: {
            _id: null,
            total: { $sum: 1 },
            upcoming: { $sum: { $cond: [
              { $and: [
                { $in: ["$status", ["scheduled", "active"]] },
                { $gte: ["$departureAt", new Date()] },
              ] },
              1,
              0,
            ] } },
            completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          } },
          { $project: { _id: 0, total: 1, upcoming: 1, completed: 1, cancelled: 1 } },
        ]),
      ]);

      return response.json({
        success: true,
        message: "Schedules retrieved.",
        data: {
          schedules: schedules.map(scheduleResponse),
          statistics: statistics[0] ?? { total: 0, upcoming: 0, completed: 0, cancelled: 0 },
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
          bookingValidationAvailable: true,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      if (!isScheduleObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Schedule ID must be a valid MongoDB ObjectId." });
      }
      const schedule = await Schedule.findOne({ _id: request.params.id, deletedAt: null })
        .select(scheduleFields)
        .populate(populateRelations)
        .lean();
      if (!schedule) return response.status(404).json({ success: false, message: "Schedule not found." });
      return response.json({
        success: true,
        message: "Schedule details retrieved.",
        data: { schedule: scheduleResponse(schedule), bookingValidationAvailable: true },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const { errors, values } = validateScheduleFields(request.body, { creating: true });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }
      if (!await validateReferences(values, null, response)) return;
      if (await conflictsWithSchedule(values)) return duplicateSchedule(response);
      const schedule = await Schedule.create({ ...values, status: values.status || "scheduled" });
      await schedule.populate(populateRelations);
      return response.status(201).json({
        success: true,
        message: "Schedule created.",
        data: { schedule: scheduleResponse(schedule), bookingValidationAvailable: true },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.put("/:id", async (request, response, next) => {
    try {
      if (!isScheduleObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Schedule ID must be a valid MongoDB ObjectId." });
      }
      const { errors, values } = validateScheduleFields(request.body, { creating: false });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }
      const schedule = await Schedule.findOne({ _id: request.params.id, deletedAt: null });
      if (!schedule) return response.status(404).json({ success: false, message: "Schedule not found." });
      if (hasReservedSeats(schedule)) return rejectReservedScheduleMutation(response);
      const candidate = { ...schedule.toObject(), ...values };
      if (candidate.availableSeats > candidate.totalSeats) {
        return response.status(400).json({ success: false, message: "Available seats cannot exceed total seats.", errors: { availableSeats: "Reduce available seats to the total number of seats or less." } });
      }
      if (!await validateReferences(values, schedule, response)) return;
      if (await conflictsWithSchedule(candidate, schedule._id)) return duplicateSchedule(response);
      for (const [field, value] of Object.entries(values)) schedule[field] = value;
      await schedule.save();
      await schedule.populate(populateRelations);
      return response.json({ success: true, message: "Schedule updated.", data: { schedule: scheduleResponse(schedule), bookingValidationAvailable: true } });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:id/status", async (request, response, next) => {
    try {
      if (!isScheduleObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Schedule ID must be a valid MongoDB ObjectId." });
      }
      const status = request.body?.status;
      if (!statuses.has(status)) {
        return response.status(400).json({ success: false, message: "Status must be scheduled, active, completed, or cancelled." });
      }
      const current = await Schedule.findOne({ _id: request.params.id, deletedAt: null });
      if (!current) return response.status(404).json({ success: false, message: "Schedule not found." });
      if (status === "cancelled" && hasReservedSeats(current)) return rejectReservedScheduleMutation(response);
      const schedule = await Schedule.findOneAndUpdate(
        { _id: request.params.id, deletedAt: null },
        { $set: { status } },
        { new: true, runValidators: true },
      ).populate(populateRelations);
      if (!schedule) return response.status(404).json({ success: false, message: "Schedule not found." });
      return response.json({
        success: true,
        message: `Schedule marked ${status}.`,
        data: { schedule: scheduleResponse(schedule), bookingValidationAvailable: true },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:id", async (request, response, next) => {
    try {
      if (!isScheduleObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Schedule ID must be a valid MongoDB ObjectId." });
      }
      const current = await Schedule.findOne({ _id: request.params.id, deletedAt: null });
      if (!current) return response.status(404).json({ success: false, message: "Schedule not found." });
      if (hasReservedSeats(current)) return rejectReservedScheduleMutation(response);
      const schedule = await Schedule.findOneAndUpdate(
        { _id: request.params.id, deletedAt: null },
        { $set: { status: "cancelled", deletedAt: new Date() } },
        { new: true, runValidators: true },
      ).populate(populateRelations);
      if (!schedule) return response.status(404).json({ success: false, message: "Schedule not found." });
      return response.json({
        success: true,
        message: "Schedule cancelled and archived; its record has been retained.",
        data: { schedule: scheduleResponse(schedule), deleted: false, archived: true, bookingValidationAvailable: true },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
