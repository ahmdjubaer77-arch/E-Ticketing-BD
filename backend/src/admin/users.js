import { Router } from "express";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "../models/User.js";
import {
  isValidEmail,
  normalizeEmail,
  sanitizeText,
  validatePassword,
} from "../auth/security.js";

const listFields = "fullName email phone profileImage role isActive isEmailVerified emailVerifiedAt createdAt updatedAt";
const detailFields = `${listFields} profileImage`;
const allowedCreateFields = new Set(["fullName", "email", "phone", "password"]);
const allowedUpdateFields = new Set(["fullName", "email", "phone", "password"]);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBoundedInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

export function isObjectId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}

function parseDate(value, endOfDay = false) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function validateUserFields(body, { creating }) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: { body: "A JSON object is required." } };
  }

  const allowedFields = creating ? allowedCreateFields : allowedUpdateFields;
  const unexpected = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unexpected.length) {
    return { errors: { body: `Unsupported fields: ${unexpected.join(", ")}.` } };
  }

  const errors = {};
  const values = {};
  if (creating || Object.hasOwn(body, "fullName")) {
    values.fullName = sanitizeText(body.fullName);
    if (values.fullName.length < 2 || values.fullName.length > 100) {
      errors.fullName = "Full name must be between 2 and 100 characters.";
    }
  }
  if (creating || Object.hasOwn(body, "email")) {
    values.email = normalizeEmail(body.email);
    if (!isValidEmail(values.email)) errors.email = "Enter a valid email address.";
  }
  if (Object.hasOwn(body, "phone")) {
    values.phone = sanitizeText(body.phone);
    if (values.phone.length > 24 || (values.phone && !/^\+?[0-9\s()-]{7,20}$/.test(values.phone))) {
      errors.phone = "Enter a valid phone number.";
    }
  }
  if (creating || Object.hasOwn(body, "password")) {
    values.password = body.password;
    const passwordError = validatePassword(values.password);
    if (passwordError) errors.password = passwordError;
  }
  if (!creating && !Object.keys(body).length) errors.body = "Provide at least one user field to update.";
  return { errors, values };
}

function userResponse(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    profileImage: user.profileImage || "",
    role: user.role,
    isActive: user.isActive,
    accountStatus: user.isActive ? "active" : "blocked",
    isEmailVerified: user.isEmailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function isDuplicateKey(error) {
  return error?.code === 11000;
}

export function createAdminUsersRouter() {
  const router = Router();

  router.get("/", async (request, response, next) => {
    try {
      const page = parseBoundedInteger(request.query.page, 1, 1_000_000);
      const limit = parseBoundedInteger(request.query.limit, 20, 100);
      if (!page || !limit) {
        return response.status(400).json({ success: false, message: "Page must be positive and limit must be between 1 and 100." });
      }

      const status = request.query.status;
      if (status !== undefined && !["active", "blocked"].includes(status)) {
        return response.status(400).json({ success: false, message: "Status must be active or blocked." });
      }
      const sort = request.query.sort ?? "newest";
      if (!["newest", "oldest"].includes(sort)) {
        return response.status(400).json({ success: false, message: "Sort must be newest or oldest." });
      }

      const from = request.query.from === undefined ? undefined : parseDate(request.query.from);
      const to = request.query.to === undefined ? undefined : parseDate(request.query.to, true);
      if ((request.query.from !== undefined && !from) || (request.query.to !== undefined && !to)) {
        return response.status(400).json({ success: false, message: "Registration dates must use YYYY-MM-DD format." });
      }
      if (from && to && from > to) {
        return response.status(400).json({ success: false, message: "The registration start date must not be after the end date." });
      }

      const filter = {};
      if (status) filter.isActive = status === "active";
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = from;
        if (to) filter.createdAt.$lte = to;
      }

      const search = typeof request.query.search === "string" ? request.query.search.trim().slice(0, 120) : "";
      if (search) {
        const pattern = new RegExp(escapeRegex(search), "i");
        const conditions = [
          { fullName: pattern },
          { email: pattern },
          { phone: pattern },
        ];
        if (isObjectId(search)) conditions.push({ _id: new mongoose.Types.ObjectId(search) });
        filter.$or = conditions;
      }

      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      const [users, total, statistics] = await Promise.all([
        User.find(filter)
          .select(listFields)
          .sort({ createdAt: sort === "newest" ? -1 : 1, _id: sort === "newest" ? -1 : 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        User.countDocuments(filter),
        User.aggregate([
          { $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: { $sum: { $cond: ["$isActive", 1, 0] } },
            blockedUsers: { $sum: { $cond: ["$isActive", 0, 1] } },
            newThisMonth: { $sum: { $cond: [{ $gte: ["$createdAt", monthStart] }, 1, 0] } },
          } },
          { $project: { _id: 0, totalUsers: 1, activeUsers: 1, blockedUsers: 1, newThisMonth: 1 } },
        ]),
      ]);

      return response.json({
        success: true,
        message: "Users retrieved.",
        data: {
          users: users.map(userResponse),
          statistics: statistics[0] ?? { totalUsers: 0, activeUsers: 0, blockedUsers: 0, newThisMonth: 0 },
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      if (!isObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "User ID must be a valid MongoDB ObjectId." });
      }
      const user = await User.findById(request.params.id).select(detailFields).lean();
      if (!user) return response.status(404).json({ success: false, message: "User not found." });
      return response.json({
        success: true,
        message: "User details retrieved.",
        data: { user: userResponse(user), bookingHistory: [], bookingHistoryAvailable: false },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const { errors, values } = validateUserFields(request.body, { creating: true });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }

      const password = await bcrypt.hash(values.password, 12);
      const user = await User.create({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone || "",
        password,
        role: "user",
        isActive: true,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      });
      return response.status(201).json({
        success: true,
        message: "User created.",
        data: { user: userResponse(user) },
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        return response.status(409).json({ success: false, message: "A user with this email already exists.", errors: { email: "Email address is already registered." } });
      }
      return next(error);
    }
  });

  router.put("/:id", async (request, response, next) => {
    try {
      if (!isObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "User ID must be a valid MongoDB ObjectId." });
      }
      const { errors, values } = validateUserFields(request.body, { creating: false });
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }

      const user = await User.findById(request.params.id).select("+password");
      if (!user) return response.status(404).json({ success: false, message: "User not found." });
      if (user.role === "admin" && Object.hasOwn(values, "password")) {
        return response.status(403).json({ success: false, message: "Administrator passwords cannot be changed through user management." });
      }

      if (Object.hasOwn(values, "fullName")) user.fullName = values.fullName;
      if (Object.hasOwn(values, "email") && user.email !== values.email) {
        user.email = values.email;
        user.tokenVersion += 1;
      }
      if (Object.hasOwn(values, "phone")) user.phone = values.phone;
      if (Object.hasOwn(values, "password")) {
        user.password = await bcrypt.hash(values.password, 12);
        user.tokenVersion += 1;
      }
      await user.save();
      return response.json({ success: true, message: "User updated.", data: { user: userResponse(user) } });
    } catch (error) {
      if (isDuplicateKey(error)) {
        return response.status(409).json({ success: false, message: "A user with this email already exists.", errors: { email: "Email address is already registered." } });
      }
      return next(error);
    }
  });

  router.patch("/:id/status", async (request, response, next) => {
    try {
      if (!isObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "User ID must be a valid MongoDB ObjectId." });
      }
      const isActive = request.body?.status === "active" ? true : request.body?.status === "blocked" ? false : null;
      if (isActive === null) {
        return response.status(400).json({ success: false, message: "Status must be active or blocked." });
      }
      const user = await User.findById(request.params.id);
      if (!user) return response.status(404).json({ success: false, message: "User not found." });
      if (user.role === "admin") {
        return response.status(403).json({ success: false, message: "Administrator accounts cannot be blocked or unblocked through user management." });
      }
      user.isActive = isActive;
      if (!isActive) user.tokenVersion += 1;
      await user.save();
      return response.json({ success: true, message: `User ${isActive ? "unblocked" : "blocked"}.`, data: { user: userResponse(user) } });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:id", async (request, response, next) => {
    try {
      if (!isObjectId(request.params.id)) {
        return response.status(400).json({ success: false, message: "User ID must be a valid MongoDB ObjectId." });
      }
      if (request.params.id === request.user.id) {
        return response.status(403).json({ success: false, message: "You cannot delete your own administrator account." });
      }
      const user = await User.findById(request.params.id);
      if (!user) return response.status(404).json({ success: false, message: "User not found." });
      if (user.role === "admin") {
        return response.status(403).json({ success: false, message: "Administrator accounts cannot be deleted through user management." });
      }
      user.isActive = false;
      user.tokenVersion += 1;
      await user.save();
      return response.json({
        success: true,
        message: "User deactivated. The account record and any related data have been retained.",
        data: { user: userResponse(user), deleted: false, deactivated: true },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
