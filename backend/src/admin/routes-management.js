import { Router } from "express";
import mongoose from "mongoose";
import Route from "../models/Route.js";
import { sanitizeText } from "../auth/security.js";

const routeFields = "departure destination distanceKm estimatedDurationMinutes transport startingFare description status createdAt updatedAt";
const createFields = new Set(["departure", "destination", "distanceKm", "estimatedDurationMinutes", "transport", "startingFare", "description", "status"]);
const updateFields = new Set(["departure", "destination", "distanceKm", "estimatedDurationMinutes", "transport", "startingFare", "description"]);
const transports = new Set(["Bus", "Train", "Launch", "Event"]);
const statuses = new Set(["active", "inactive"]);

export function isRouteObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBoundedInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

export function validateRouteFields(body, { creating }) {
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
  for (const field of ["departure", "destination"]) {
    if (!creating && !Object.hasOwn(body, field)) continue;
    values[field] = sanitizeText(body[field]).replace(/\s+/g, " ");
    if (values[field].length < 2 || values[field].length > 120) {
      errors[field] = `${field === "departure" ? "Departure" : "Destination"} must be between 2 and 120 characters.`;
    }
  }
  if ((creating || Object.hasOwn(body, "departure") || Object.hasOwn(body, "destination"))
      && values.departure && values.destination
      && values.departure.toLocaleLowerCase("en") === values.destination.toLocaleLowerCase("en")) {
    errors.destination = "Departure and destination must be different.";
  }
  if (creating || Object.hasOwn(body, "distanceKm")) {
    values.distanceKm = body.distanceKm;
    if (typeof values.distanceKm !== "number" || !Number.isFinite(values.distanceKm) || values.distanceKm < 0.1 || values.distanceKm > 50_000) {
      errors.distanceKm = "Distance must be a number between 0.1 and 50,000 km.";
    }
  }
  if (creating || Object.hasOwn(body, "estimatedDurationMinutes")) {
    values.estimatedDurationMinutes = body.estimatedDurationMinutes;
    if (!Number.isInteger(values.estimatedDurationMinutes) || values.estimatedDurationMinutes < 1 || values.estimatedDurationMinutes > 10_080) {
      errors.estimatedDurationMinutes = "Estimated duration must be a whole number between 1 and 10,080 minutes.";
    }
  }
  if (creating || Object.hasOwn(body, "transport")) {
    values.transport = body.transport;
    if (!transports.has(values.transport)) errors.transport = "Transport must be Bus, Train, Launch, or Event.";
  }
  if (creating || Object.hasOwn(body, "startingFare")) {
    values.startingFare = body.startingFare;
    if (typeof values.startingFare !== "number" || !Number.isFinite(values.startingFare) || values.startingFare < 0 || values.startingFare > 100_000_000) {
      errors.startingFare = "Starting fare must be a number between 0 and 100,000,000.";
    }
  }
  if (Object.hasOwn(body, "description")) {
    values.description = sanitizeText(body.description);
    if (values.description.length > 2000) errors.description = "Description must not exceed 2,000 characters.";
  }
  if (creating && body.status !== undefined) {
    values.status = body.status;
    if (!statuses.has(values.status)) errors.status = "Status must be active or inactive.";
  }
  if (!creating && !Object.keys(body).length) errors.body = "Provide at least one route field to update.";
  return { errors, values };
}

function routeResponse(route) {
  return {
    id: route.id ?? String(route._id),
    departure: route.departure,
    destination: route.destination,
    distanceKm: route.distanceKm,
    estimatedDurationMinutes: route.estimatedDurationMinutes,
    transport: route.transport,
    startingFare: route.startingFare,
    description: route.description || "",
    status: route.status,
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
  };
}

function duplicateRoute(response) {
  return response.status(409).json({
    success: false,
    message: "A route with the same departure, destination, and transport already exists.",
    errors: { destination: "This route is already registered for the selected transport." },
  });
}

export function createAdminRoutesManagementRouter() {
  const router = Router();

  router.get("/", async (request, response, next) => {
    try {
      const page = parseBoundedInteger(request.query.page, 1, 1_000_000);
      const limit = parseBoundedInteger(request.query.limit, 20, 100);
      if (!page || !limit) {
        return response.status(400).json({ success: false, message: "Page must be positive and limit must be between 1 and 100." });
      }
      const transport = request.query.transport;
      if (transport !== undefined && !transports.has(transport)) {
        return response.status(400).json({ success: false, message: "Transport must be Bus, Train, Launch, or Event." });
      }
      const status = request.query.status;
      if (status !== undefined && !statuses.has(status)) {
        return response.status(400).json({ success: false, message: "Status must be active or inactive." });
      }
      const sort = request.query.sort ?? "newest";
      const sortOptions = {
        newest: { createdAt: -1, _id: -1 },
        oldest: { createdAt: 1, _id: 1 },
        departure_asc: { departure: 1, destination: 1, _id: 1 },
        departure_desc: { departure: -1, destination: -1, _id: -1 },
        fare_asc: { startingFare: 1, _id: 1 },
        fare_desc: { startingFare: -1, _id: -1 },
      };
      if (!Object.hasOwn(sortOptions, sort)) {
        return response.status(400).json({ success: false, message: "Sort must be newest, oldest, departure_asc, departure_desc, fare_asc, or fare_desc." });
      }

      const filter = { deletedAt: null };
      if (transport) filter.transport = transport;
      if (status) filter.status = status;
      const search = typeof request.query.search === "string" ? request.query.search.trim().slice(0, 120) : "";
      const location = typeof request.query.location === "string" ? sanitizeText(request.query.location).trim().slice(0, 120) : "";
      const searchConditions = [];
      if (search) {
        const pattern = new RegExp(escapeRegex(search), "i");
        const searchMatch = [{ departure: pattern }, { destination: pattern }];
        if (isRouteObjectId(search)) searchMatch.push({ _id: new mongoose.Types.ObjectId(search) });
        searchConditions.push({ $or: searchMatch });
      }
      if (location) {
        const pattern = new RegExp(`^${escapeRegex(location)}$`, "i");
        searchConditions.push({ $or: [{ departure: pattern }, { destination: pattern }] });
      }
      if (searchConditions.length) filter.$and = searchConditions;

      const [routes, total, statistics] = await Promise.all([
        Route.find(filter)
          .select(routeFields)
          .sort(sortOptions[sort])
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Route.countDocuments(filter),
        Route.aggregate([
          { $match: { deletedAt: null } },
          { $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
            inactive: { $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] } },
          } },
          { $project: { _id: 0, total: 1, active: 1, inactive: 1 } },
        ]),
      ]);
      const counts = statistics[0] ?? { total: 0, active: 0, inactive: 0 };

      return response.json({
        success: true,
        message: "Routes retrieved.",
        data: {
          routes: routes.map(routeResponse),
          statistics: { ...counts, popular: 0, popularAvailable: false },
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
          relatedSchedulesAvailable: false,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      if (!isRouteObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Route ID must be a valid MongoDB ObjectId." });
      }
      const route = await Route.findOne({ _id: request.params.id, deletedAt: null }).select(routeFields).lean();
      if (!route) return response.status(404).json({ success: false, message: "Route not found." });
      return response.json({
        success: true,
        message: "Route details retrieved.",
        data: { route: routeResponse(route), schedules: [], schedulesAvailable: false },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const { errors, values } = validateRouteFields(request.body, { creating: true });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }
      const route = await Route.create({ ...values, status: values.status || "active" });
      return response.status(201).json({ success: true, message: "Route created.", data: { route: routeResponse(route) } });
    } catch (error) {
      if (error?.code === 11000) return duplicateRoute(response);
      return next(error);
    }
  });

  router.put("/:id", async (request, response, next) => {
    try {
      if (!isRouteObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Route ID must be a valid MongoDB ObjectId." });
      }
      const { errors, values } = validateRouteFields(request.body, { creating: false });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }
      const route = await Route.findOne({ _id: request.params.id, deletedAt: null });
      if (!route) return response.status(404).json({ success: false, message: "Route not found." });
      for (const [field, value] of Object.entries(values)) route[field] = value;
      await route.save();
      return response.json({ success: true, message: "Route updated.", data: { route: routeResponse(route) } });
    } catch (error) {
      if (error?.code === 11000) return duplicateRoute(response);
      return next(error);
    }
  });

  router.patch("/:id/status", async (request, response, next) => {
    try {
      if (!isRouteObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Route ID must be a valid MongoDB ObjectId." });
      }
      const status = request.body?.status;
      if (!statuses.has(status)) {
        return response.status(400).json({ success: false, message: "Status must be active or inactive." });
      }
      const route = await Route.findOneAndUpdate(
        { _id: request.params.id, deletedAt: null },
        { $set: { status } },
        { new: true, runValidators: true },
      );
      if (!route) return response.status(404).json({ success: false, message: "Route not found." });
      return response.json({ success: true, message: `Route ${status === "active" ? "activated" : "deactivated"}.`, data: { route: routeResponse(route) } });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:id", async (request, response, next) => {
    try {
      if (!isRouteObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Route ID must be a valid MongoDB ObjectId." });
      }
      const route = await Route.findOneAndUpdate(
        { _id: request.params.id, deletedAt: null },
        { $set: { status: "inactive", deletedAt: new Date() } },
        { new: true, runValidators: true },
      );
      if (!route) return response.status(404).json({ success: false, message: "Route not found." });
      return response.json({
        success: true,
        message: "Route deactivated and archived; its record has been retained.",
        data: { route: routeResponse(route), deleted: false, archived: true },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
