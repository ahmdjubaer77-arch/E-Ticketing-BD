import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import Operator from "../models/Operator.js";
import Vehicle from "../models/Vehicle.js";
import { sanitizeText } from "../auth/security.js";
import { deleteCloudinaryImage, detectImageContentType, uploadCloudinaryImage } from "../media/cloudinary.js";

const vehicleFields = "name registrationNumber transport operatorId image seatCapacity status createdAt updatedAt";
const createFields = new Set(["name", "registrationNumber", "transport", "operatorId", "image", "seatCapacity", "status"]);
const updateFields = new Set(["name", "registrationNumber", "transport", "operatorId", "image", "seatCapacity"]);
const transports = new Set(["Bus", "Train", "Launch"]);
const statuses = new Set(["active", "inactive", "maintenance"]);

export function isVehicleObjectId(value) {
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

function validateImage(value) {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 2048) return null;
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname ? url.toString() : null;
  } catch {
    return null;
  }
}

export function validateVehicleFields(body, { creating }) {
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
  if (creating || Object.hasOwn(body, "name")) {
    values.name = sanitizeText(body.name);
    if (values.name.length < 2 || values.name.length > 100) {
      errors.name = "Vehicle name must be between 2 and 100 characters.";
    }
  }
  if (creating || Object.hasOwn(body, "registrationNumber")) {
    values.registrationNumber = sanitizeText(body.registrationNumber).replace(/\s+/g, " ").toUpperCase();
    if (values.registrationNumber.length < 2 || values.registrationNumber.length > 50) {
      errors.registrationNumber = "Registration number must be between 2 and 50 characters.";
    }
  }
  if (creating || Object.hasOwn(body, "transport")) {
    values.transport = body.transport;
    if (!transports.has(values.transport)) errors.transport = "Transport must be Bus, Train, or Launch.";
  }
  if (creating || Object.hasOwn(body, "operatorId")) {
    values.operatorId = body.operatorId;
    if (!isVehicleObjectId(values.operatorId)) errors.operatorId = "Choose a valid operator.";
  }
  if (Object.hasOwn(body, "image")) {
    values.image = validateImage(body.image);
    if (values.image === null) errors.image = "Vehicle image must be a valid HTTPS URL.";
  }
  if (creating || Object.hasOwn(body, "seatCapacity")) {
    values.seatCapacity = body.seatCapacity;
    if (!Number.isInteger(values.seatCapacity) || values.seatCapacity < 1 || values.seatCapacity > 1000) {
      errors.seatCapacity = "Seat capacity must be a whole number between 1 and 1000.";
    }
  }
  if (creating && body.status !== undefined) {
    values.status = body.status;
    if (!statuses.has(values.status)) errors.status = "Status must be active, inactive, or maintenance.";
  }
  if (!creating && !Object.keys(body).length) errors.body = "Provide at least one vehicle field to update.";
  return { errors, values };
}

function vehicleResponse(vehicle) {
  const operator = vehicle.operatorId && typeof vehicle.operatorId === "object"
    ? {
        id: String(vehicle.operatorId._id),
        name: vehicle.operatorId.name,
        email: vehicle.operatorId.email,
        status: vehicle.operatorId.status,
      }
    : null;
  return {
    id: vehicle.id ?? String(vehicle._id),
    name: vehicle.name,
    registrationNumber: vehicle.registrationNumber,
    transport: vehicle.transport,
    operatorId: operator?.id ?? String(vehicle.operatorId),
    operator,
    image: vehicle.image || "",
    seatCapacity: vehicle.seatCapacity,
    status: vehicle.status,
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
  };
}

function duplicateRegistration(response) {
  return response.status(409).json({
    success: false,
    message: "A vehicle with this registration number already exists.",
    errors: { registrationNumber: "Registration number is already in use." },
  });
}

async function validateOperator(values, existingVehicle, response) {
  const operatorId = values.operatorId ?? existingVehicle?.operatorId;
  const transport = values.transport ?? existingVehicle?.transport;
  if (!operatorId || !transport) return true;

  const operator = await Operator.findOne({ _id: operatorId, deletedAt: null })
    .select("transport status")
    .lean();
  if (!operator) {
    response.status(400).json({ success: false, message: "The selected operator does not exist or is archived.", errors: { operatorId: "Choose an available operator." } });
    return false;
  }
  if (operator.transport !== transport) {
    response.status(400).json({ success: false, message: "Vehicle transport must match the selected operator.", errors: { transport: "Transport type does not match the operator." } });
    return false;
  }
  if (operator.status !== "active" && (!existingVehicle || String(existingVehicle.operatorId) !== String(operatorId))) {
    response.status(400).json({ success: false, message: "New vehicles must be assigned to an active operator.", errors: { operatorId: "Choose an active operator." } });
    return false;
  }
  return true;
}

export function createAdminVehiclesRouter(config) {
  const router = Router();
  const imageLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({ success: false, message: "Too many image changes. Please try again later." }),
  });

  router.post("/:id/image", imageLimiter, async (request, response, next) => {
    try {
      if (!isVehicleObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Vehicle ID must be a valid MongoDB ObjectId." });
      }
      const buffer = request.body;
      const contentType = detectImageContentType(buffer, request.get("content-type"));
      if (!contentType) return response.status(Buffer.isBuffer(buffer) && buffer.length ? 415 : 400).json({ success: false, message: "Upload a valid JPEG, PNG, or WebP image." });
      if (buffer.length > 2 * 1024 * 1024) return response.status(413).json({ success: false, message: "Vehicle images must be 2 MB or smaller." });
      const vehicle = await Vehicle.findOne({ _id: request.params.id, deletedAt: null }).select("+imagePublicId");
      if (!vehicle) return response.status(404).json({ success: false, message: "Vehicle not found." });
      const uploaded = await uploadCloudinaryImage(config, {
        buffer,
        contentType,
        publicId: `vehicles/${vehicle.id}/image`,
      });
      vehicle.image = uploaded.secureUrl;
      vehicle.imagePublicId = uploaded.publicId;
      await vehicle.save();
      await vehicle.populate({ path: "operatorId", select: "name email status transport" });
      return response.json({ success: true, message: "Vehicle image uploaded.", data: { vehicle: vehicleResponse(vehicle) } });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:id/image", imageLimiter, async (request, response, next) => {
    try {
      if (!isVehicleObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Vehicle ID must be a valid MongoDB ObjectId." });
      }
      const vehicle = await Vehicle.findOne({ _id: request.params.id, deletedAt: null }).select("+imagePublicId");
      if (!vehicle) return response.status(404).json({ success: false, message: "Vehicle not found." });
      if (vehicle.imagePublicId) await deleteCloudinaryImage(config, vehicle.imagePublicId);
      vehicle.image = "";
      vehicle.imagePublicId = "";
      await vehicle.save();
      await vehicle.populate({ path: "operatorId", select: "name email status transport" });
      return response.json({ success: true, message: "Vehicle image removed.", data: { vehicle: vehicleResponse(vehicle) } });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/", async (request, response, next) => {
    try {
      const page = parseBoundedInteger(request.query.page, 1, 1_000_000);
      const limit = parseBoundedInteger(request.query.limit, 20, 100);
      if (!page || !limit) {
        return response.status(400).json({ success: false, message: "Page must be positive and limit must be between 1 and 100." });
      }
      const transport = request.query.transport;
      if (transport !== undefined && !transports.has(transport)) {
        return response.status(400).json({ success: false, message: "Transport must be Bus, Train, or Launch." });
      }
      const status = request.query.status;
      if (status !== undefined && !statuses.has(status)) {
        return response.status(400).json({ success: false, message: "Status must be active, inactive, or maintenance." });
      }
      const operatorId = request.query.operatorId;
      if (operatorId !== undefined && !isVehicleObjectId(operatorId)) {
        return response.status(400).json({ success: false, message: "Operator ID must be a valid MongoDB ObjectId." });
      }

      const sort = request.query.sort ?? "newest";
      const sortOptions = {
        newest: { createdAt: -1, _id: -1 },
        oldest: { createdAt: 1, _id: 1 },
        name_asc: { name: 1, _id: 1 },
        name_desc: { name: -1, _id: -1 },
      };
      if (!Object.hasOwn(sortOptions, sort)) {
        return response.status(400).json({ success: false, message: "Sort must be newest, oldest, name_asc, or name_desc." });
      }

      const filter = { deletedAt: null };
      if (transport) filter.transport = transport;
      if (status) filter.status = status;
      if (operatorId) filter.operatorId = operatorId;
      const search = typeof request.query.search === "string" ? request.query.search.trim().slice(0, 120) : "";
      if (search) {
        const pattern = new RegExp(escapeRegex(search), "i");
        filter.$or = [{ name: pattern }, { registrationNumber: pattern }];
        if (isVehicleObjectId(search)) filter.$or.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      const [vehicles, total, statistics] = await Promise.all([
        Vehicle.find(filter)
          .select(vehicleFields)
          .populate({ path: "operatorId", select: "name email status transport", match: { deletedAt: null } })
          .sort(sortOptions[sort])
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Vehicle.countDocuments(filter),
        Vehicle.aggregate([
          { $match: { deletedAt: null } },
          { $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
            inactive: { $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] } },
            maintenance: { $sum: { $cond: [{ $eq: ["$status", "maintenance"] }, 1, 0] } },
          } },
          { $project: { _id: 0, total: 1, active: 1, inactive: 1, maintenance: 1 } },
        ]),
      ]);

      return response.json({
        success: true,
        message: "Vehicles retrieved.",
        data: {
          vehicles: vehicles.map(vehicleResponse),
          statistics: statistics[0] ?? { total: 0, active: 0, inactive: 0, maintenance: 0 },
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      if (!isVehicleObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Vehicle ID must be a valid MongoDB ObjectId." });
      }
      const vehicle = await Vehicle.findOne({ _id: request.params.id, deletedAt: null })
        .select(vehicleFields)
        .populate({ path: "operatorId", select: "name email phone address status transport", match: { deletedAt: null } })
        .lean();
      if (!vehicle) return response.status(404).json({ success: false, message: "Vehicle not found." });
      return response.json({ success: true, message: "Vehicle details retrieved.", data: { vehicle: vehicleResponse(vehicle) } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const { errors, values } = validateVehicleFields(request.body, { creating: true });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }
      if (!await validateOperator(values, null, response)) return;
      const vehicle = await Vehicle.create({
        ...values,
        image: values.image || "",
        status: values.status || "active",
      });
      await vehicle.populate({ path: "operatorId", select: "name email status transport" });
      return response.status(201).json({ success: true, message: "Vehicle created.", data: { vehicle: vehicleResponse(vehicle) } });
    } catch (error) {
      if (error?.code === 11000) return duplicateRegistration(response);
      return next(error);
    }
  });

  router.put("/:id", async (request, response, next) => {
    try {
      if (!isVehicleObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Vehicle ID must be a valid MongoDB ObjectId." });
      }
      const { errors, values } = validateVehicleFields(request.body, { creating: false });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }
      const existing = await Vehicle.findOne({ _id: request.params.id, deletedAt: null }).select("operatorId transport").lean();
      if (!existing) return response.status(404).json({ success: false, message: "Vehicle not found." });
      if (!await validateOperator(values, existing, response)) return;
      const vehicle = await Vehicle.findOneAndUpdate(
        { _id: request.params.id, deletedAt: null },
        { $set: values },
        { new: true, runValidators: true, context: "query" },
      ).populate({ path: "operatorId", select: "name email status transport" });
      return response.json({ success: true, message: "Vehicle updated.", data: { vehicle: vehicleResponse(vehicle) } });
    } catch (error) {
      if (error?.code === 11000) return duplicateRegistration(response);
      return next(error);
    }
  });

  router.patch("/:id/status", async (request, response, next) => {
    try {
      if (!isVehicleObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Vehicle ID must be a valid MongoDB ObjectId." });
      }
      const status = request.body?.status;
      if (!statuses.has(status)) {
        return response.status(400).json({ success: false, message: "Status must be active, inactive, or maintenance." });
      }
      const vehicle = await Vehicle.findOneAndUpdate(
        { _id: request.params.id, deletedAt: null },
        { $set: { status } },
        { new: true, runValidators: true },
      ).populate({ path: "operatorId", select: "name email status transport" });
      if (!vehicle) return response.status(404).json({ success: false, message: "Vehicle not found." });
      return response.json({ success: true, message: `Vehicle marked ${status}.`, data: { vehicle: vehicleResponse(vehicle) } });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:id", async (request, response, next) => {
    try {
      if (!isVehicleObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Vehicle ID must be a valid MongoDB ObjectId." });
      }
      const vehicle = await Vehicle.findOneAndUpdate(
        { _id: request.params.id, deletedAt: null },
        { $set: { status: "inactive", deletedAt: new Date() } },
        { new: true, runValidators: true },
      ).populate({ path: "operatorId", select: "name email status transport" });
      if (!vehicle) return response.status(404).json({ success: false, message: "Vehicle not found." });
      return response.json({
        success: true,
        message: "Vehicle deactivated and archived; its record has been retained.",
        data: { vehicle: vehicleResponse(vehicle), deleted: false, archived: true },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
