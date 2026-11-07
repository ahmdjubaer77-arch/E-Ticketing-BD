import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import User from "../models/User.js";
import {
  generateOtp,
  generateResetToken,
  hashSecret,
  isValidEmail,
  normalizeEmail,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  otpResendAvailable,
  sanitizeText,
  secureStringEqual,
  validatePassword,
} from "./security.js";
import { createAuthMiddleware } from "./middleware.js";
import { AUTH_COOKIE_NAME, clearAuthCookie, setAuthCookie } from "./cookies.js";

const GENERIC_RESET_MESSAGE = "If an eligible account exists, password reset instructions have been sent.";

function limiter(windowMs, limit, message) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({ success: false, message }),
  });
}

function userResponse(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    profileImage: user.profileImage || "",
    createdAt: user.createdAt,
  };
}

function cooldownResponse(response, lastSentAt) {
  const retryAfterSeconds = Math.ceil(
    Math.max(0, OTP_RESEND_COOLDOWN_MS - (Date.now() - lastSentAt.getTime())) / 1000,
  );
  response.set("Retry-After", String(retryAfterSeconds));
  return response.status(429).json({
    success: false,
    message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
    data: { retryAfterSeconds },
  });
}

export function createAuthRouter({ config, mailer }) {
  const router = Router();
  const { requireAuth, requireRole } = createAuthMiddleware(config);
  const registrationLimiter = limiter(15 * 60 * 1000, 5, "Too many registration attempts. Please try again later.");
  const otpRequestLimiter = limiter(60 * 60 * 1000, 5, "Too many code requests. Please try again later.");
  const otpVerifyLimiter = limiter(15 * 60 * 1000, 10, "Too many code attempts. Please try again later.");
  const loginLimiter = limiter(15 * 60 * 1000, 10, "Too many sign-in attempts. Please try again later.");
  const resetLimiter = limiter(15 * 60 * 1000, 5, "Too many password reset attempts. Please try again later.");

  router.post("/register", registrationLimiter, async (request, response, next) => {
    try {
      const fullName = sanitizeText(request.body?.fullName);
      const email = normalizeEmail(request.body?.email);
      const phone = sanitizeText(request.body?.phone);
      const password = request.body?.password;
      const confirmPassword = request.body?.confirmPassword;
      const errors = {};

      if (fullName.length < 2 || fullName.length > 100) errors.fullName = "Full name must be between 2 and 100 characters.";
      if (!isValidEmail(email)) errors.email = "Enter a valid email address.";
      if (phone.length > 24 || (phone && !/^\+?[0-9\s()-]{7,20}$/.test(phone))) errors.phone = "Enter a valid phone number.";
      const passwordError = validatePassword(password);
      if (passwordError) errors.password = passwordError;
      if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }

      const existing = await User.findOne({ email }).select("isEmailVerified");
      if (existing) {
        return response.status(409).json({
          success: false,
          message: existing.isEmailVerified
            ? "An account with this email already exists."
            : "An account with this email is awaiting verification. Request a new code to continue.",
          code: existing.isEmailVerified ? "EMAIL_ALREADY_EXISTS" : "EMAIL_NOT_VERIFIED",
          data: existing.isEmailVerified ? undefined : { email },
          errors: { email: "Email address is already registered." },
        });
      }

      const now = new Date();
      const otp = generateOtp();
      const passwordHash = await bcrypt.hash(password, 12);
      const user = new User({
        fullName,
        email,
        phone,
        password: passwordHash,
        emailOtpHash: hashSecret(otp, config.jwtSecret),
        emailOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
        emailOtpLastSentAt: now,
      });

      try {
        await user.save();
      } catch (error) {
        if (error?.code === 11000) {
          return response.status(409).json({ success: false, message: "An account with this email already exists." });
        }
        throw error;
      }

      try {
        await mailer.sendOtp({ email, fullName, otp, purpose: "email-verification" });
      } catch (error) {
        await User.deleteOne({ _id: user._id, isEmailVerified: false });
        return response.status(503).json({
          success: false,
          message: "We could not send the verification email. Please try again.",
        });
      }

      return response.status(201).json({
        success: true,
        message: "Verification code sent. Check your email to activate your account.",
        data: { email, expiresInSeconds: OTP_TTL_MS / 1000, resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000 },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/verify-email", otpVerifyLimiter, async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email);
      const otp = typeof request.body?.otp === "string" ? request.body.otp.trim() : "";
      if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
        return response.status(400).json({ success: false, message: "Enter a valid email and 6-digit verification code." });
      }
      const currentUser = await User.findOne({ email }).select("+emailOtpHash +emailOtpExpiresAt");
      if (!currentUser || currentUser.isEmailVerified || !currentUser.emailOtpHash) {
        return response.status(400).json({ success: false, message: "This verification code is invalid or has expired." });
      }
      const now = new Date();
      if (!currentUser.emailOtpExpiresAt || currentUser.emailOtpExpiresAt.getTime() <= now.getTime()) {
        await User.updateOne(
          { _id: currentUser._id, emailOtpHash: currentUser.emailOtpHash },
          { $set: { emailOtpHash: null, emailOtpExpiresAt: null } },
        );
        return response.status(400).json({ success: false, message: "This verification code has expired. Request a new code." });
      }
      if (!secureStringEqual(hashSecret(otp, config.jwtSecret), currentUser.emailOtpHash)) {
        return response.status(400).json({ success: false, message: "The verification code is incorrect." });
      }
      const user = await User.findOneAndUpdate(
        {
          _id: currentUser._id,
          isEmailVerified: false,
          emailOtpHash: currentUser.emailOtpHash,
          emailOtpExpiresAt: { $gt: now },
        },
        {
          $set: {
            isEmailVerified: true,
            emailVerifiedAt: now,
            emailOtpHash: null,
            emailOtpExpiresAt: null,
            emailOtpLastSentAt: null,
          },
        },
        { new: true, runValidators: true },
      );
      if (!user) {
        return response.status(400).json({ success: false, message: "This verification code is invalid or has expired." });
      }
      setAuthCookie(response, user, config);
      return response.json({ success: true, message: "Email verified successfully.", data: { user: userResponse(user) } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/resend-otp", otpRequestLimiter, async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email);
      if (!isValidEmail(email)) {
        return response.status(400).json({ success: false, message: "Enter a valid email address." });
      }
      const currentUser = await User.findOne({ email }).select("+emailOtpHash +emailOtpExpiresAt +emailOtpLastSentAt");
      if (!currentUser || currentUser.isEmailVerified) {
        return response.status(404).json({ success: false, message: "No pending email verification was found." });
      }
      const now = new Date();
      const otp = generateOtp();
      const cutoff = new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS);
      const user = await User.findOneAndUpdate(
        {
          _id: currentUser._id,
          isEmailVerified: false,
          $or: [
            { emailOtpLastSentAt: null },
            { emailOtpLastSentAt: { $lte: cutoff } },
          ],
        },
        {
          $set: {
            emailOtpHash: hashSecret(otp, config.jwtSecret),
            emailOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
            emailOtpLastSentAt: now,
          },
        },
        { new: true },
      );
      if (!user) {
        const latestUser = await User.findById(currentUser._id).select("+emailOtpLastSentAt");
        if (latestUser?.emailOtpLastSentAt) return cooldownResponse(response, latestUser.emailOtpLastSentAt);
        return response.status(404).json({ success: false, message: "No pending email verification was found." });
      }
      try {
        await mailer.sendOtp({ email, fullName: user.fullName, otp, purpose: "email-verification" });
      } catch (error) {
        user.emailOtpHash = null;
        user.emailOtpExpiresAt = null;
        await user.save();
        return response.status(503).json({ success: false, message: "We could not send the verification email. Please try again later." });
      }
      return response.json({
        success: true,
        message: "A new verification code was sent.",
        data: { expiresInSeconds: OTP_TTL_MS / 1000, resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000 },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/login", loginLimiter, async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email);
      const password = request.body?.password;
      if (!isValidEmail(email) || typeof password !== "string" || !password) {
        return response.status(400).json({ success: false, message: "Enter a valid email and password." });
      }
      const user = await User.findOne({ email }).select("+password");
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return response.status(401).json({ success: false, message: "Invalid email or password." });
      }
      if (!user.isEmailVerified) {
        return response.status(403).json({
          success: false,
          code: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email before signing in.",
          data: { email: user.email },
        });
      }
      if (!user.isActive) {
        return response.status(403).json({ success: false, message: "This account is not available." });
      }
      setAuthCookie(response, user, config, request.body?.rememberMe === true);
      return response.json({ success: true, message: "Signed in successfully.", data: { user: userResponse(user) } });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/forgot-password", otpRequestLimiter, async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email);
      if (!isValidEmail(email)) {
        return response.status(400).json({ success: false, message: "Enter a valid email address." });
      }
      const currentUser = await User.findOne({ email }).select("+resetOtpLastSentAt");
      if (!currentUser || !currentUser.isActive || !currentUser.isEmailVerified) {
        return response.json({ success: true, message: GENERIC_RESET_MESSAGE });
      }
      if (!otpResendAvailable(currentUser.resetOtpLastSentAt)) {
        return response.json({ success: true, message: GENERIC_RESET_MESSAGE });
      }

      const now = new Date();
      const otp = generateOtp();
      const cutoff = new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS);
      const user = await User.findOneAndUpdate(
        {
          _id: currentUser._id,
          isActive: true,
          isEmailVerified: true,
          $or: [
            { resetOtpLastSentAt: null },
            { resetOtpLastSentAt: { $lte: cutoff } },
          ],
        },
        {
          $set: {
            resetOtpHash: hashSecret(otp, config.jwtSecret),
            resetOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
            resetOtpLastSentAt: now,
            resetTokenHash: null,
            resetTokenExpiresAt: null,
          },
        },
        { new: true },
      );
      if (!user) {
        return response.json({ success: true, message: GENERIC_RESET_MESSAGE });
      }
      try {
        await mailer.sendOtp({ email, fullName: user.fullName, otp, purpose: "password-reset" });
      } catch (error) {
        user.resetOtpHash = null;
        user.resetOtpExpiresAt = null;
        await user.save();
        console.warn("Password reset email delivery failed.");
        return response.json({ success: true, message: GENERIC_RESET_MESSAGE });
      }
      return response.json({
        success: true,
        message: GENERIC_RESET_MESSAGE,
        data: { expiresInSeconds: OTP_TTL_MS / 1000, resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000 },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/verify-reset-otp", otpVerifyLimiter, async (request, response, next) => {
    try {
      const email = normalizeEmail(request.body?.email);
      const otp = typeof request.body?.otp === "string" ? request.body.otp.trim() : "";
      if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
        return response.status(400).json({ success: false, message: "Enter a valid email and 6-digit reset code." });
      }
      const currentUser = await User.findOne({ email, isEmailVerified: true, isActive: true })
        .select("+resetOtpHash +resetOtpExpiresAt");
      if (!currentUser || !currentUser.resetOtpHash) {
        return response.status(400).json({ success: false, message: "This reset code is invalid or has expired." });
      }
      const now = new Date();
      if (!currentUser.resetOtpExpiresAt || currentUser.resetOtpExpiresAt.getTime() <= now.getTime()) {
        await User.updateOne(
          { _id: currentUser._id, resetOtpHash: currentUser.resetOtpHash },
          { $set: { resetOtpHash: null, resetOtpExpiresAt: null } },
        );
        return response.status(400).json({ success: false, message: "This reset code has expired. Request another code." });
      }
      if (!secureStringEqual(hashSecret(otp, config.jwtSecret), currentUser.resetOtpHash)) {
        return response.status(400).json({ success: false, message: "The reset code is incorrect." });
      }
      const resetToken = generateResetToken();
      const user = await User.findOneAndUpdate(
        {
          _id: currentUser._id,
          resetOtpHash: currentUser.resetOtpHash,
          resetOtpExpiresAt: { $gt: now },
        },
        {
          $set: {
            resetOtpHash: null,
            resetOtpExpiresAt: null,
            resetTokenHash: hashSecret(resetToken, config.jwtSecret),
            resetTokenExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
          },
        },
        { new: true },
      );
      if (!user) {
        return response.status(400).json({ success: false, message: "This reset code is invalid or has expired." });
      }
      return response.json({
        success: true,
        message: "Reset code verified. Choose a new password.",
        data: { resetToken, expiresInSeconds: 600 },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/reset-password", resetLimiter, async (request, response, next) => {
    try {
      const resetToken = request.body?.resetToken;
      const password = request.body?.password;
      const confirmPassword = request.body?.confirmPassword;
      const passwordError = validatePassword(password);
      const errors = {};
      if (passwordError) errors.password = passwordError;
      if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
      if (typeof resetToken !== "string" || resetToken.length < 32 || resetToken.length > 128) {
        errors.resetToken = "Password reset session is invalid or expired.";
      }
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the highlighted fields.", errors });
      }

      const resetTokenHash = hashSecret(resetToken, config.jwtSecret);
      const now = new Date();
      const resetSession = await User.exists({
        resetTokenHash,
        resetTokenExpiresAt: { $gt: now },
        isActive: true,
        isEmailVerified: true,
      });
      if (!resetSession) {
        return response.status(400).json({ success: false, message: "Password reset session is invalid or expired. Request a new reset code." });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.findOneAndUpdate(
        {
          resetTokenHash,
          resetTokenExpiresAt: { $gt: now },
          isActive: true,
          isEmailVerified: true,
        },
        {
          $set: {
            password: passwordHash,
            resetTokenHash: null,
            resetTokenExpiresAt: null,
            resetOtpLastSentAt: null,
          },
          $inc: { tokenVersion: 1 },
        },
        { new: false },
      );
      if (!user) {
        return response.status(400).json({ success: false, message: "Password reset session is invalid or expired. Request a new reset code." });
      }
      clearAuthCookie(response, config);
      return response.json({ success: true, message: "Password reset successfully. Please sign in with your new password." });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/logout", async (request, response, next) => {
    try {
      const token = request.cookies?.[AUTH_COOKIE_NAME];
      if (token) {
        let payload;
        try {
          payload = jwt.verify(token, config.jwtSecret, {
            algorithms: ["HS256"],
            ignoreExpiration: true,
          });
        } catch (error) {
          if (!(error instanceof jwt.JsonWebTokenError)) return next(error);
        }
        if (payload?.sub && Number.isInteger(payload.tokenVersion)) {
          await User.updateOne(
            { _id: payload.sub, tokenVersion: payload.tokenVersion },
            { $inc: { tokenVersion: 1 } },
          );
        }
      }
      clearAuthCookie(response, config);
      return response.json({ success: true, message: "Signed out successfully." });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/me", requireAuth, (request, response) => {
    response.json({ success: true, message: "Authenticated user.", data: { user: userResponse(request.user) } });
  });

  router.get("/admin", requireAuth, requireRole("admin"), (_request, response) => {
    response.json({ success: true, message: "Authorized administrator." });
  });

  return router;
}
