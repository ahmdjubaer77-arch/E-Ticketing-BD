import test from "node:test";
import assert from "node:assert/strict";
import { isObjectId, validateUserFields } from "./users.js";

test("admin user validation normalizes valid profile fields", () => {
  const result = validateUserFields({
    fullName: "  Ada Lovelace ",
    email: " ADA@EXAMPLE.COM ",
    phone: "+880 1712345678",
    password: "ValidPass123",
  }, { creating: true });

  assert.deepEqual(result.errors, {});
  assert.equal(result.values.fullName, "Ada Lovelace");
  assert.equal(result.values.email, "ada@example.com");
  assert.equal(result.values.phone, "+880 1712345678");
});

test("admin user validation rejects weak passwords and privilege fields", () => {
  const weakPassword = validateUserFields({
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    password: "weak",
  }, { creating: true });
  assert.match(weakPassword.errors.password, /8 and 72 characters/);

  const privilegeEscalation = validateUserFields({
    role: "admin",
    isActive: true,
  }, { creating: false });
  assert.match(privilegeEscalation.errors.body, /Unsupported fields/);
});

test("admin user updates require supported fields and valid ObjectIds", () => {
  const emptyUpdate = validateUserFields({}, { creating: false });
  assert.match(emptyUpdate.errors.body, /at least one user field/);
  assert.equal(isObjectId("507f1f77bcf86cd799439011"), true);
  assert.equal(isObjectId("507f1f77bcf86cd79943901g"), false);
  assert.equal(isObjectId("abcdefghijkl"), false);
});
