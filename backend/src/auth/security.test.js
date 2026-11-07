import test from "node:test";
import assert from "node:assert/strict";
import {
  generateOtp,
  generateResetToken,
  hashSecret,
  isValidEmail,
  normalizeEmail,
  otpResendAvailable,
  sanitizeText,
  secureStringEqual,
  validatePassword,
} from "./security.js";

test("normalizes email and strips control characters from text", () => {
  assert.equal(normalizeEmail("  USER@Example.COM "), "user@example.com");
  assert.equal(sanitizeText("  Ada\u0000 Lovelace\n "), "Ada Lovelace");
});

test("validates email format and password requirements", () => {
  assert.equal(isValidEmail("person@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(validatePassword("ValidPass123"), "");
  assert.match(validatePassword("weakpass"), /uppercase, lowercase, and numeric/);
  assert.match(validatePassword(`Aa1${"x".repeat(70)}`), /8 and 72/);
});

test("generates secure-format OTPs and reset tokens", () => {
  assert.match(generateOtp(), /^\d{6}$/);
  assert.equal(Buffer.from(generateResetToken(), "base64url").length, 32);
});

test("hash comparison is timing-safe compatible and OTP cooldown is enforced", () => {
  const firstHash = hashSecret("123456", "test-secret");
  assert.equal(secureStringEqual(firstHash, hashSecret("123456", "test-secret")), true);
  assert.equal(secureStringEqual(firstHash, hashSecret("654321", "test-secret")), false);
  assert.equal(otpResendAvailable(null), true);
  assert.equal(otpResendAvailable(new Date(90_000), 100_000), false);
  assert.equal(otpResendAvailable(new Date(39_000), 100_000), true);
});
