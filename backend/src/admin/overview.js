import { Router } from "express";
import Operator from "../models/Operator.js";
import Route from "../models/Route.js";
import Schedule from "../models/Schedule.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";

const periods = new Set([7, 30, 90]);
const scheduleStatuses = ["scheduled", "active", "completed", "cancelled"];
const transports = ["Bus", "Train", "Launch"];

export function parseOverviewDays(value) {
  if (value === undefined) return 30;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const days = Number(value);
  return periods.has(days) ? days : null;
}

export function createOverviewTrend(start, days, groupedCounts) {
  const countsByDate = new Map(groupedCounts.map(({ _id, count }) => [_id, count]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      count: countsByDate.get(key) ?? 0,
    };
  });
}

async function countsByDate(model, start, end, extraMatch = {}) {
  return model.aggregate([
    { $match: { ...extraMatch, createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
        count: { $sum: 1 },
      },
    },
  ]);
}

function countMap(rows, keys) {
  return Object.fromEntries(keys.map((key) => [key, rows.find((row) => row._id === key)?.count ?? 0]));
}

function toScheduleResponse(schedule) {
  return {
    id: String(schedule._id),
    operator: schedule.operatorId ? { id: String(schedule.operatorId._id), name: schedule.operatorId.name } : null,
    vehicle: schedule.vehicleId
      ? { id: String(schedule.vehicleId._id), name: schedule.vehicleId.name, registrationNumber: schedule.vehicleId.registrationNumber }
      : null,
    route: schedule.routeId
      ? { id: String(schedule.routeId._id), departure: schedule.routeId.departure, destination: schedule.routeId.destination }
      : null,
    transport: schedule.transport,
    departureAt: schedule.departureAt,
    arrivalAt: schedule.arrivalAt,
    totalSeats: schedule.totalSeats,
    availableSeats: schedule.availableSeats,
    status: schedule.status,
    createdAt: schedule.createdAt,
  };
}

export function createAdminOverviewRouter() {
  const router = Router();

  router.get("/", async (request, response, next) => {
    try {
      const days = parseOverviewDays(request.query.days);
      if (!days) {
        return response.status(400).json({ success: false, message: "Days must be 7, 30, or 90." });
      }

      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      start.setUTCDate(start.getUTCDate() - days + 1);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + days);
      const userFilter = { role: "user" };
      const activeRecordFilter = { deletedAt: null };
      const scheduleRangeFilter = { deletedAt: null, departureAt: { $gte: start, $lt: end } };
      const createdScheduleRangeFilter = { deletedAt: null };

      const [
        totalUsers,
        totalOperators,
        activeOperators,
        totalVehicles,
        totalRoutes,
        activeRoutes,
        totalSchedules,
        upcomingSchedules,
        userTrend,
        operatorTrend,
        scheduleTrend,
        scheduleStatusRows,
        transportRows,
        recentSchedules,
      ] = await Promise.all([
        User.countDocuments(userFilter),
        Operator.countDocuments(activeRecordFilter),
        Operator.countDocuments({ ...activeRecordFilter, status: "active" }),
        Vehicle.countDocuments(activeRecordFilter),
        Route.countDocuments(activeRecordFilter),
        Route.countDocuments({ ...activeRecordFilter, status: "active" }),
        Schedule.countDocuments(activeRecordFilter),
        Schedule.countDocuments({
          ...activeRecordFilter,
          departureAt: { $gte: now },
          status: { $in: ["scheduled", "active"] },
        }),
        countsByDate(User, start, end, userFilter),
        countsByDate(Operator, start, end, activeRecordFilter),
        countsByDate(Schedule, start, end, createdScheduleRangeFilter),
        Schedule.aggregate([
          { $match: scheduleRangeFilter },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Schedule.aggregate([
          { $match: scheduleRangeFilter },
          { $group: { _id: "$transport", count: { $sum: 1 } } },
        ]),
        Schedule.find({ ...activeRecordFilter, createdAt: { $gte: start, $lt: end } })
          .select("operatorId vehicleId routeId transport departureAt arrivalAt totalSeats availableSeats status createdAt")
          .sort({ createdAt: -1, _id: -1 })
          .limit(10)
          .populate({ path: "operatorId", select: "name" })
          .populate({ path: "vehicleId", select: "name registrationNumber" })
          .populate({ path: "routeId", select: "departure destination" })
          .lean(),
      ]);

      const dailyTrend = (rows) => createOverviewTrend(start, days, rows);
      const userCounts = dailyTrend(userTrend);
      const operatorCounts = dailyTrend(operatorTrend);
      const scheduleCounts = dailyTrend(scheduleTrend);

      return response.json({
        success: true,
        message: "Overview retrieved from the database.",
        data: {
          period: { days, from: start, to: new Date(end.getTime() - 1) },
          statistics: {
            users: { total: totalUsers, newInPeriod: userCounts.reduce((sum, item) => sum + item.count, 0) },
            operators: { total: totalOperators, active: activeOperators },
            vehicles: { total: totalVehicles },
            routes: { total: totalRoutes, active: activeRoutes },
            schedules: { total: totalSchedules, upcoming: upcomingSchedules },
          },
          trend: userCounts.map((item, index) => ({
            date: item.date,
            users: item.count,
            operators: operatorCounts[index].count,
            schedules: scheduleCounts[index].count,
          })),
          scheduleStatuses: countMap(scheduleStatusRows, scheduleStatuses),
          schedulesByTransport: countMap(transportRows, transports),
          recentSchedules: recentSchedules.map(toScheduleResponse),
          availability: {
            bookingAnalytics: false,
            revenueAnalytics: false,
            message: "Booking and revenue analytics are unavailable because booking and payment models are not configured in this backend.",
          },
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
