import { Router } from "express";
import bcrypt from "bcrypt";
import { rateLimit } from "express-rate-limit";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { createAuthMiddleware } from "../auth/middleware.js";
import { clearAuthCookie, setAuthCookie } from "../auth/cookies.js";
import {
  deleteCloudinaryImage,
  detectImageContentType,
  uploadCloudinaryImage,
} from "../media/cloudinary.js";
import {
  generateOtp,
  hashSecret,
  isValidEmail,
  normalizeEmail,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  otpResendAvailable,
  sanitizeText,
  secureStringEqual,
  validatePassword,
} from "../auth/security.js";

function responseUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    profileImage: user.profileImage || "",
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}

async function recordSecurityNotification(userId, title, message) {
  try {
    await Notification.create({ userId, category: "security", title, message });
    return true;
  } catch {
    console.error("A security notification could not be recorded.");
    return false;
  }
}

function requireImageBuffer(request, response, next) {
  const buffer = request.body;
  const type = request.get("content-type");
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return response.status(400).json({ success: false, message: "Choose an image to upload." });
  }
  if (buffer.length > 400 * 1024) {
    return response.status(413).json({ success: false, message: "Profile images must be 400 KB or smaller." });
  }

  const contentType = detectImageContentType(buffer, type);
  if (!contentType) {
    return response.status(415).json({ success: false, message: "Upload a valid JPEG, PNG, or WebP image." });
  }
  request.profileImageBuffer = buffer;
  request.profileImageContentType = contentType;
  return next();
}

function createLimiter(windowMs, limit, message) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({ success: false, message }),
  });
}

export function createUserRouter({ config, mailer }) {
  const router = Router();
  const { requireAuth } = createAuthMiddleware(config);
  const profileLimiter = createLimiter(15 * 60 * 1000, 20, "Too many profile changes. Please try again later.");
  const sensitiveLimiter = createLimiter(15 * 60 * 1000, 5, "Too many security changes. Please try again later.");

  router.use(requireAuth);

  router.get("/me", async (request, response, next) => {
    try {
      const user = await User.findById(request.user._id).select("+profileImage");
      if (!user) return response.status(401).json({ success: false, message: "Authentication required." });
      return response.json({ success: true, message: "Profile loaded.", data: { user: responseUser(user) } });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/me", profileLimiter, async (request, response, next) => {
    try {
      const hasFullName = Object.hasOwn(request.body || {}, "fullName");
      const hasPhone = Object.hasOwn(request.body || {}, "phone");
      if (!hasFullName && !hasPhone) {
        return response.status(400).json({ success: false, message: "Provide at least one profile field to update." });
      }
      const fullName = hasFullName ? sanitizeText(request.body.fullName) : request.user.fullName;
      const phone = hasPhone ? sanitizeText(request.body.phone) : request.user.phone;
      const errors = {};
      if (hasFullName && (fullName.length < 2 || fullName.length > 100)) errors.fullName = "Name must be between 2 and 100 characters.";
      if (hasPhone && (phone.length > 24 || (phone && !/^\+?[0-9\s()-]{7,20}$/.test(phone)))) errors.phone = "Enter a valid phone number.";
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }

      const user = await User.findById(request.user._id);
      if (!user) return response.status(401).json({ success: false, message: "Authentication required." });
      if (hasFullName) user.fullName = fullName;
      if (hasPhone) user.phone = phone;
      await user.save();
      return response.json({ success: true, message: "Profile updated.", data: { user: responseUser(user) } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/me/avatar", profileLimiter, requireImageBuffer, async (request, response, next) => {
    try {
      const user = await User.findById(request.user._id);
      if (!user) return response.status(401).json({ success: false, message: "Authentication required." });
      const uploaded = await uploadCloudinaryImage(config, {
        buffer: request.profileImageBuffer,
        contentType: request.profileImageContentType,
        publicId: `users/${user.id}/profile`,
      });
      user.profileImage = uploaded.secureUrl;
      user.profileImagePublicId = uploaded.publicId;
      await user.save();
      return response.json({ success: true, message: "Profile picture updated.", data: { user: responseUser(user) } });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/me/avatar", profileLimiter, async (request, response, next) => {
    try {
      const user = await User.findById(request.user._id).select("+profileImagePublicId");
      if (!user) return response.status(401).json({ success: false, message: "Authentication required." });
      if (user.profileImagePublicId) await deleteCloudinaryImage(config, user.profileImagePublicId);
      user.profileImage = "";
      user.profileImagePublicId = "";
      await user.save();
      return response.json({ success: true, message: "Profile picture removed.", data: { user: responseUser(user) } });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/change-password", sensitiveLimiter, async (request, response, next) => {
    try {
      const { currentPassword, password, confirmPassword } = request.body || {};
      const errors = {};
      const passwordError = validatePassword(password);
      if (typeof currentPassword !== "string" || !currentPassword) errors.currentPassword = "Enter your current password.";
      if (passwordError) errors.password = passwordError;
      if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
      if (!Object.keys(errors).length && currentPassword === password) {
        errors.password = "Choose a password different from your current password.";
      }
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }

      const user = await User.findById(request.user._id).select("+password");
      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        return response.status(400).json({
          success: false,
          message: "Current password is incorrect.",
          errors: { currentPassword: "Current password is incorrect." },
        });
      }
      user.password = await bcrypt.hash(password, 12);
      user.tokenVersion += 1;
      await user.save();
      setAuthCookie(response, user, config);
      const notificationRecorded = await recordSecurityNotification(
        user._id,
        "Password changed",
        "Your account password was updated.",
      );
      return response.json({
        success: true,
        message: notificationRecorded
          ? "Password changed successfully."
          : "Password changed, but the security notification could not be recorded.",
        data: { notificationRecorded },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/change-email", sensitiveLimiter, async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email);
      const password = request.body?.currentPassword;
      if (!isValidEmail(email)) {
        return response.status(400).json({ success: false, message: "Enter a valid email address.", errors: { email: "Enter a valid email address." } });
      }
      if (typeof password !== "string" || !password) {
        return response.status(400).json({ success: false, message: "Enter your current password.", errors: { currentPassword: "Enter your current password." } });
      }
      if (email === request.user.email) {
        return response.status(400).json({ success: false, message: "That is already your verified email address." });
      }
      const user = await User.findById(request.user._id).select("+password +pendingEmail +pendingEmailOtpLastSentAt");
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return response.status(400).json({ success: false, message: "Current password is incorrect.", errors: { currentPassword: "Current password is incorrect." } });
      }
      if (!otpResendAvailable(user.pendingEmailOtpLastSentAt)) {
        const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - user.pendingEmailOtpLastSentAt.getTime())) / 1000);
        return response.status(429).json({ success: false, message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`, data: { retryAfterSeconds } });
      }
      if (await User.exists({ email })) {
        return response.status(409).json({ success: false, message: "An account with this email already exists.", errors: { email: "Email address is already registered." } });
      }
      const now = new Date();
      const cutoff = new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS);
      const otp = generateOtp();
      const pendingUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          $or: [
            { pendingEmailOtpLastSentAt: null },
            { pendingEmailOtpLastSentAt: { $lte: cutoff } },
          ],
        },
        {
          $set: {
            pendingEmail: email,
            pendingEmailOtpHash: hashSecret(otp, config.jwtSecret),
            pendingEmailOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
            pendingEmailOtpLastSentAt: now,
          },
        },
        { new: true },
      ).select("+pendingEmail");
      if (!pendingUser) {
        return response.status(429).json({ success: false, message: "Please wait before requesting another verification code." });
      }
      try {
        await mailer.sendOtp({ email, fullName: pendingUser.fullName, otp, purpose: "email-change" });
      } catch {
        await User.updateOne(
          { _id: pendingUser._id, pendingEmailOtpHash: hashSecret(otp, config.jwtSecret) },
          { $set: { pendingEmailOtpHash: null, pendingEmailOtpExpiresAt: null } },
        );
        return response.status(503).json({ success: false, message: "We could not send the verification email. Please try again." });
      }
      return response.json({ success: true, message: "Verification code sent to your new email.", data: { email, expiresInSeconds: OTP_TTL_MS / 1000, resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000 } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/resend-email-verification", sensitiveLimiter, async (request, response, next) => {
    try {
      const currentUser = await User.findById(request.user._id).select("+pendingEmail +pendingEmailOtpLastSentAt");
      if (!currentUser?.pendingEmail) return response.status(404).json({ success: false, message: "No pending email change was found." });
      if (!otpResendAvailable(currentUser.pendingEmailOtpLastSentAt)) {
        const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - currentUser.pendingEmailOtpLastSentAt.getTime())) / 1000);
        return response.status(429).json({ success: false, message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`, data: { retryAfterSeconds } });
      }
      const now = new Date();
      const cutoff = new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS);
      const otp = generateOtp();
      const user = await User.findOneAndUpdate(
        {
          _id: currentUser._id,
          pendingEmail: currentUser.pendingEmail,
          $or: [
            { pendingEmailOtpLastSentAt: null },
            { pendingEmailOtpLastSentAt: { $lte: cutoff } },
          ],
        },
        {
          $set: {
            pendingEmailOtpHash: hashSecret(otp, config.jwtSecret),
            pendingEmailOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
            pendingEmailOtpLastSentAt: now,
          },
        },
        { new: true },
      ).select("+pendingEmail");
      if (!user) return response.status(429).json({ success: false, message: "Please wait before requesting another verification code." });
      try {
        await mailer.sendOtp({ email: user.pendingEmail, fullName: user.fullName, otp, purpose: "email-change" });
      } catch {
        await User.updateOne(
          { _id: user._id, pendingEmailOtpHash: hashSecret(otp, config.jwtSecret) },
          { $set: { pendingEmailOtpHash: null, pendingEmailOtpExpiresAt: null } },
        );
        return response.status(503).json({ success: false, message: "We could not send the verification email. Please try again." });
      }
      return response.json({ success: true, message: "A new verification code was sent.", data: { expiresInSeconds: OTP_TTL_MS / 1000, resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000 } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/verify-new-email", sensitiveLimiter, async (request, response, next) => {
    try {
      const otp = typeof request.body?.otp === "string" ? request.body.otp.trim() : "";
      if (!/^\d{6}$/.test(otp)) return response.status(400).json({ success: false, message: "Enter the 6-digit verification code." });
      const user = await User.findById(request.user._id)
        .select("+pendingEmail +pendingEmailOtpHash +pendingEmailOtpExpiresAt");
      if (!user?.pendingEmail || !user.pendingEmailOtpHash || !user.pendingEmailOtpExpiresAt ||
          user.pendingEmailOtpExpiresAt.getTime() <= Date.now() ||
          !secureStringEqual(hashSecret(otp, config.jwtSecret), user.pendingEmailOtpHash)) {
        return response.status(400).json({ success: false, message: "The verification code is incorrect or expired." });
      }
      const newEmail = user.pendingEmail;
      let updatedUser;
      try {
        updatedUser = await User.findOneAndUpdate(
          {
            _id: user._id,
            pendingEmail: newEmail,
            pendingEmailOtpHash: user.pendingEmailOtpHash,
            pendingEmailOtpExpiresAt: { $gt: new Date() },
          },
          {
            $set: {
              email: newEmail,
              emailVerifiedAt: new Date(),
              pendingEmail: null,
              pendingEmailOtpHash: null,
              pendingEmailOtpExpiresAt: null,
              pendingEmailOtpLastSentAt: null,
            },
            $inc: { tokenVersion: 1 },
          },
          { new: true, runValidators: true },
        );
      } catch (error) {
        if (error?.code === 11000) return response.status(409).json({ success: false, message: "An account with this email already exists." });
        throw error;
      }
      if (!updatedUser) return response.status(400).json({ success: false, message: "The verification code is incorrect or expired." });
      setAuthCookie(response, updatedUser, config);
      const notificationRecorded = await recordSecurityNotification(
        updatedUser._id,
        "Email address changed",
        "Your verified account email address was changed.",
      );
      return response.json({
        success: true,
        message: notificationRecorded
          ? "Email address updated and verified."
          : "Email address updated, but the security notification could not be recorded.",
        data: { user: responseUser(updatedUser), notificationRecorded },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/deactivate", sensitiveLimiter, async (request, response, next) => {
    try {
      if (request.body?.confirmation !== "DEACTIVATE") {
        return response.status(400).json({ success: false, message: "Type DEACTIVATE to confirm account deactivation." });
      }
      if (typeof request.body?.currentPassword !== "string") {
        return response.status(400).json({ success: false, message: "Enter your current password." });
      }
      const user = await User.findById(request.user._id).select("+password");
      if (!user || !(await bcrypt.compare(request.body.currentPassword, user.password))) {
        return response.status(400).json({ success: false, message: "Current password is incorrect." });
      }
      user.isActive = false;
      user.tokenVersion += 1;
      await user.save();
      clearAuthCookie(response, config);
      return response.json({ success: true, message: "Account deactivated. Historical records have been retained." });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/me", sensitiveLimiter, async (request, response, next) => {
    try {
      if (request.body?.confirmation !== "DELETE ACCOUNT") {
        return response.status(400).json({ success: false, message: "Type DELETE ACCOUNT to confirm permanent deletion." });
      }
      if (typeof request.body?.currentPassword !== "string") {
        return response.status(400).json({ success: false, message: "Enter your current password." });
      }
      const user = await User.findById(request.user._id).select("+password");
      if (!user || !(await bcrypt.compare(request.body.currentPassword, user.password))) {
        return response.status(400).json({ success: false, message: "Current password is incorrect." });
      }

      const session = await User.startSession();
      try {
        await session.withTransaction(async () => {
          await Notification.deleteMany({ userId: user._id }, { session });
          const deletion = await User.deleteOne({ _id: user._id }, { session });
          if (deletion.deletedCount !== 1) throw new Error("Account deletion did not remove the account.");
        });
      } catch (error) {
        if (error?.code === 20 || /replica set|transaction numbers are only allowed/i.test(error?.message || "")) {
          return response.status(503).json({
            success: false,
            message: "Permanent account deletion requires MongoDB transactions. Configure MongoDB as a replica set and try again.",
          });
        }
        throw error;
      } finally {
        await session.endSession();
      }

      clearAuthCookie(response, config);
      return response.json({ success: true, message: "Your account and associated notification data were permanently deleted." });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

export function createNotificationRouter(config) {
  const router = Router();
  const { requireAuth } = createAuthMiddleware(config);
  router.use(createLimiter(15 * 60 * 1000, 120, "Too many notification requests. Please try again later."));
  router.use(requireAuth);

  router.get("/", async (request, response, next) => {
    try {
      const page = Math.max(1, Math.min(10_000, Number.parseInt(request.query.page, 10) || 1));
      const limit = Math.max(1, Math.min(50, Number.parseInt(request.query.limit, 10) || 20));
      const filter = { userId: request.user._id };
      if (request.query.unread === "true") filter.readAt = null;
      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Notification.countDocuments(filter),
        Notification.countDocuments({ userId: request.user._id, readAt: null }),
      ]);
      return response.json({ success: true, message: "Notifications loaded.", data: { notifications, unreadCount, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/read-all", async (request, response, next) => {
    try {
      const result = await Notification.updateMany(
        { userId: request.user._id, readAt: null },
        { $set: { readAt: new Date() } },
      );
      return response.json({ success: true, message: "Notifications marked as read.", data: { modifiedCount: result.modifiedCount } });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:id/read", async (request, response, next) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(request.params.id)) return response.status(400).json({ success: false, message: "Notification ID is invalid." });
      const notification = await Notification.findOneAndUpdate(
        { _id: request.params.id, userId: request.user._id, readAt: null },
        { $set: { readAt: new Date() } },
        { new: true },
      );
      if (notification) {
        return response.json({ success: true, message: "Notification marked as read.", data: { notification, changed: true } });
      }
      const existing = await Notification.exists({ _id: request.params.id, userId: request.user._id });
      if (!existing) return response.status(404).json({ success: false, message: "Notification not found." });
      return response.json({ success: true, message: "Notification was already read.", data: { changed: false } });
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/:id", async (request, response, next) => {
    try {
      if (!/^[a-f\d]{24}$/i.test(request.params.id)) return response.status(400).json({ success: false, message: "Notification ID is invalid." });
      const result = await Notification.deleteOne({ _id: request.params.id, userId: request.user._id });
      if (result.deletedCount === 0) return response.status(404).json({ success: false, message: "Notification not found." });
      return response.json({ success: true, message: "Notification deleted." });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
