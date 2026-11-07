import test from "node:test";
import assert from "node:assert/strict";
import { isOperatorObjectId, validateOperatorFields } from "./operators.js";

const validOperator = {
  name: "  Sakura Express ",
  logo: "https://cdn.example.com/operators/sakura.png",
  email: " OPS@SAKURA.EXAMPLE ",
  phone: "+880 1711-203040",
  address: "Dhaka, Bangladesh",
  transport: "Bus",
  status: "pending",
};

test("operator validation normalizes supported profile values", () => {
  const { errors, values } = validateOperatorFields(validOperator, { creating: true });

  assert.deepEqual(errors, {});
  assert.equal(values.name, "Sakura Express");
  assert.equal(values.email, "ops@sakura.example");
  assert.equal(values.logo, "https://cdn.example.com/operators/sakura.png");
  assert.equal(values.transport, "Bus");
});

test("operator validation rejects invalid transport, status, logo, and unsupported fields", () => {
  const invalid = validateOperatorFields({
    ...validOperator,
    transport: "SpaceShip",
    status: "deleted",
    logo: "data:image/png;base64,abc",
  }, { creating: true });

  assert.match(invalid.errors.transport, /Bus, Train, Launch, or Event/);
  assert.match(invalid.errors.status, /active, inactive, or pending/);
  assert.match(invalid.errors.logo, /HTTPS image URL/);
  const privilegeEscalation = validateOperatorFields({ role: "admin" }, { creating: true });
  assert.match(privilegeEscalation.errors.body, /Unsupported fields/);
});

test("operator updates cannot directly change status and require at least one field", () => {
  assert.match(
    validateOperatorFields({ status: "active" }, { creating: false }).errors.body,
    /Unsupported fields/,
  );
  assert.match(
    validateOperatorFields({}, { creating: false }).errors.body,
    /at least one operator field/,
  );
});

test("operator IDs must be MongoDB ObjectId-shaped strings", () => {
  assert.equal(isOperatorObjectId("507f1f77bcf86cd799439011"), true);
  assert.equal(isOperatorObjectId("507f1f77bcf86cd79943901g"), false);
  assert.equal(isOperatorObjectId("operators-1"), false);
});
