import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function sanitizeText(value) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim() : "";
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function validatePassword(password) {
  if (
    typeof password !== "string"
    || password.length < 8
    || Buffer.byteLength(password, "utf8") > 72
  ) {
    return "Password must be between 8 and 72 characters.";
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include uppercase, lowercase, and numeric characters.";
  }
  return "";
}

export function generateOtp() {
  return String(randomInt(100_000, 1_000_000));
}

export function hashSecret(value, secret) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function secureStringEqual(first, second) {
  if (typeof first !== "string" || typeof second !== "string") return false;
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

export function generateResetToken() {
  return randomBytes(32).toString("base64url");
}

export function otpResendAvailable(lastSentAt, now = Date.now()) {
  return !lastSentAt || now - lastSentAt.getTime() >= OTP_RESEND_COOLDOWN_MS;
}
