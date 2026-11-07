import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import Operator from "../models/Operator.js";
import { isValidEmail, normalizeEmail, sanitizeText } from "../auth/security.js";
import { deleteCloudinaryImage, detectImageContentType, uploadCloudinaryImage } from "../media/cloudinary.js";

const operatorFields = "name logo email phone address transport status createdAt updatedAt";
const createFields = new Set(["name", "logo", "email", "phone", "address", "transport", "status"]);
const updateFields = new Set(["name", "logo", "email", "phone", "address", "transport"]);
const transports = new Set(["Bus", "Train", "Launch", "Event"]);
const statuses = new Set(["active", "inactive", "pending"]);

export function isOperatorObjectId(value) {
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

function validateLogo(value) {
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

export function validateOperatorFields(body, { creating }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: { body: "A JSON object is required." }, values: {} };
  }
  const allowed = creating ? createFields : updateFields;
  const unexpected = Object.keys(body).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    return { errors: { body: `Unsupported fields: ${unexpected.join(", ")}.` }, values: {} };
  }

  const errors = {};
  const values = {};
  if (creating || Object.hasOwn(body, "name")) {
    values.name = sanitizeText(body.name);
    if (values.name.length < 2 || values.name.length > 120) {
      errors.name = "Operator name must be between 2 and 120 characters.";
    }
  }
  if (creating || Object.hasOwn(body, "email")) {
    values.email = normalizeEmail(body.email);
    if (!isValidEmail(values.email)) errors.email = "Enter a valid email address.";
  }
  if (creating || Object.hasOwn(body, "phone")) {
    values.phone = sanitizeText(body.phone);
    if (values.phone.length > 24 || !/^\+?[0-9\s()-]{7,20}$/.test(values.phone)) {
      errors.phone = "Enter a valid phone number.";
    }
  }
  if (creating || Object.hasOwn(body, "address")) {
    values.address = sanitizeText(body.address);
    if (values.address.length < 4 || values.address.length > 300) {
      errors.address = "Address must be between 4 and 300 characters.";
    }
  }
  if (creating || Object.hasOwn(body, "transport")) {
    values.transport = body.transport;
    if (!transports.has(values.transport)) errors.transport = "Transport must be Bus, Train, Launch, or Event.";
  }
  if (Object.hasOwn(body, "logo")) {
    values.logo = validateLogo(body.logo);
    if (values.logo === null) errors.logo = "Logo must be a valid HTTPS image URL.";
  }
  if (creating && body.status !== undefined) {
    values.status = body.status;
    if (!statuses.has(values.status)) errors.status = "Status must be active, inactive, or pending.";
  }
  if (!creating && !Object.keys(body).length) errors.body = "Provide at least one operator field to update.";
  return { errors, values };
}

function operatorResponse(operator) {
  return {
    id: operator.id ?? String(operator._id),
    name: operator.name,
    logo: operator.logo || "",
    email: operator.email,
    phone: operator.phone,
    address: operator.address,
    transport: operator.transport,
    status: operator.status,
    createdAt: operator.createdAt,
    updatedAt: operator.updatedAt,
  };
}

function duplicateEmail(response) {
  return response.status(409).json({
    success: false,
    message: "An operator with this email already exists.",
    errors: { email: "Email address is already registered." },
  });
}

export function createAdminOperatorsRouter(config) {
  const router = Router();
  const imageLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({ success: false, message: "Too many image changes. Please try again later." }),
  });

  router.post("/:id/logo", imageLimiter, async (request, response, next) => {
    try {
      if (!isOperatorObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Operator ID must be a valid MongoDB ObjectId." });
      }
      const buffer = request.body;
      const contentType = detectImageContentType(buffer, request.get("content-type"));
      if (!contentType) return response.status(Buffer.isBuffer(buffer) && buffer.length ? 415 : 400).json({ success: false, message: "Upload a valid JPEG, PNG, or WebP logo." });
      if (buffer.length > 2 * 1024 * 1024) return response.status(413).json({ success: false, message: "Operator logos must be 2 MB or smaller." });
      const operator = await Operator.findOne({ _id: request.params.id, deletedAt: null }).select("+logoPublicId");
      if (!operator) return response.status(404).json({ success: false, message: "Operator not found." });
      const uploaded = await uploadCloudinaryImage(config, {
        buffer,
        contentType,
        publicId: `operators/${operator.id}/logo`,
      });
      operator.logo = uploaded.secureUrl;
      operator.logoPublicId = uploaded.publicId;
      await operator.save();
      return response.json({ success: true, message: "Operator logo uploaded.", data: { operator: operatorResponse(operator) } });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:id/logo", imageLimiter, async (request, response, next) => {
    try {
      if (!isOperatorObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Operator ID must be a valid MongoDB ObjectId." });
      }
      const operator = await Operator.findOne({ _id: request.params.id, deletedAt: null }).select("+logoPublicId");
      if (!operator) return response.status(404).json({ success: false, message: "Operator not found." });
      if (operator.logoPublicId) await deleteCloudinaryImage(config, operator.logoPublicId);
      operator.logo = "";
      operator.logoPublicId = "";
      await operator.save();
      return response.json({ success: true, message: "Operator logo removed.", data: { operator: operatorResponse(operator) } });
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
        return response.status(400).json({ success: false, message: "Transport must be Bus, Train, Launch, or Event." });
      }
      const status = request.query.status;
      if (status !== undefined && !statuses.has(status)) {
        return response.status(400).json({ success: false, message: "Status must be active, inactive, or pending." });
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
      const search = typeof request.query.search === "string" ? request.query.search.trim().slice(0, 120) : "";
      if (search) {
        const pattern = new RegExp(escapeRegex(search), "i");
        filter.$or = [{ name: pattern }, { email: pattern }];
        if (isOperatorObjectId(search)) filter.$or.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      const [operators, total, statistics] = await Promise.all([
        Operator.find(filter)
          .select(operatorFields)
          .sort(sortOptions[sort])
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Operator.countDocuments(filter),
        Operator.aggregate([
          { $match: { deletedAt: null } },
          { $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
            inactive: { $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          } },
          { $project: { _id: 0, total: 1, active: 1, inactive: 1, pending: 1 } },
        ]),
      ]);

      return response.json({
        success: true,
        message: "Operators retrieved.",
        data: {
          operators: operators.map(operatorResponse),
          statistics: statistics[0] ?? { total: 0, active: 0, inactive: 0, pending: 0 },
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
          relatedDataAvailable: false,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      if (!isOperatorObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Operator ID must be a valid MongoDB ObjectId." });
      }
      const operator = await Operator.findOne({ _id: request.params.id, deletedAt: null }).select(operatorFields).lean();
      if (!operator) return response.status(404).json({ success: false, message: "Operator not found." });
      return response.json({
        success: true,
        message: "Operator details retrieved.",
        data: {
          operator: operatorResponse(operator),
          relationships: { available: false, vehicles: null, routes: null, schedules: null },
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const { errors, values } = validateOperatorFields(request.body, { creating: true });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }
      const operator = await Operator.create({
        ...values,
        logo: values.logo || "",
        status: values.status || "pending",
      });
      return response.status(201).json({
        success: true,
        message: "Operator created.",
        data: { operator: operatorResponse(operator), relationships: { available: false } },
      });
    } catch (error) {
      if (error?.code === 11000) return duplicateEmail(response);
      return next(error);
    }
  });

  router.put("/:id", async (request, response, next) => {
    try {
      if (!isOperatorObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Operator ID must be a valid MongoDB ObjectId." });
      }
      const { errors, values } = validateOperatorFields(request.body, { creating: false });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }
      const operator = await Operator.findOneAndUpdate(
        { _id: request.params.id, deletedAt: null },
        { $set: values },
        { new: true, runValidators: true, context: "query" },
      );
      if (!operator) return response.status(404).json({ success: false, message: "Operator not found." });
      return response.json({ success: true, message: "Operator updated.", data: { operator: operatorResponse(operator) } });
    } catch (error) {
      if (error?.code === 11000) return duplicateEmail(response);
      return next(error);
    }
  });

  router.patch("/:id/status", async (request, response, next) => {
    try {
      if (!isOperatorObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Operator ID must be a valid MongoDB ObjectId." });
      }
      const status = request.body?.status;
      if (!["active", "inactive"].includes(status)) {
        return response.status(400).json({ success: false, message: "Status must be active or inactive." });
      }
      const operator = await Operator.findOneAndUpdate(
        { _id: request.params.id, deletedAt: null },
        { $set: { status } },
        { new: true, runValidators: true },
      );
      if (!operator) return response.status(404).json({ success: false, message: "Operator not found." });
      return response.json({ success: true, message: `Operator ${status === "active" ? "activated" : "deactivated"}.`, data: { operator: operatorResponse(operator) } });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:id", async (request, response, next) => {
    try {
      if (!isOperatorObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "Operator ID must be a valid MongoDB ObjectId." });
      }
      const operator = await Operator.findOneAndUpdate(
        { _id: request.params.id, deletedAt: null },
        { $set: { status: "inactive", deletedAt: new Date() } },
        { new: true, runValidators: true },
      );
      if (!operator) return response.status(404).json({ success: false, message: "Operator not found." });
      return response.json({
        success: true,
        message: "Operator archived. Its record has been retained.",
        data: { operator: operatorResponse(operator), deleted: false, archived: true },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
