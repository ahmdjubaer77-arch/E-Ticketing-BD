import test from "node:test";
import assert from "node:assert/strict";
import { isVehicleObjectId, validateVehicleFields } from "./vehicles.js";

const validVehicle = {
  name: "  Sakura Coach  ",
  registrationNumber: " dha-ka 11-1234 ",
  transport: "Bus",
  operatorId: "507f1f77bcf86cd799439011",
  image: "https://cdn.example.com/vehicles/sakura.png",
  seatCapacity: 40,
  status: "active",
};

test("vehicle validation normalizes supported vehicle fields", () => {
  const { errors, values } = validateVehicleFields(validVehicle, { creating: true });

  assert.deepEqual(errors, {});
  assert.equal(values.name, "Sakura Coach");
  assert.equal(values.registrationNumber, "DHA-KA 11-1234");
  assert.equal(values.seatCapacity, 40);
  assert.equal(values.image, "https://cdn.example.com/vehicles/sakura.png");
});

test("vehicle registration accepts long values and characters without format restrictions", () => {
  const { errors, values } = validateVehicleFields({
    ...validVehicle,
    registrationNumber: "dhaka metro-ba 15-4290",
  }, { creating: true });

  assert.deepEqual(errors, {});
  assert.equal(values.registrationNumber, "DHAKA METRO-BA 15-4290");
});

test("vehicle validation rejects invalid transport, status, image, capacity, and extra fields", () => {
  const invalid = validateVehicleFields({
    ...validVehicle,
    transport: "Event",
    status: "deleted",
    image: "data:image/png;base64,abc",
    seatCapacity: 1.5,
  }, { creating: true });

  assert.match(invalid.errors.transport, /Bus, Train, or Launch/);
  assert.match(invalid.errors.status, /active, inactive, or maintenance/);
  assert.match(invalid.errors.image, /HTTPS URL/);
  assert.match(invalid.errors.seatCapacity, /whole number/);

  const extra = validateVehicleFields({ ...validVehicle, role: "admin" }, { creating: true });
  assert.match(extra.errors.body, /Unsupported fields/);
});

test("vehicle update cannot set status directly and must contain an allowed field", () => {
  assert.match(
    validateVehicleFields({ status: "maintenance" }, { creating: false }).errors.body,
    /Unsupported fields/,
  );
  assert.match(
    validateVehicleFields({}, { creating: false }).errors.body,
    /at least one vehicle field/,
  );
});

test("vehicle and operator references require valid MongoDB ObjectIds", () => {
  assert.equal(isVehicleObjectId("507f1f77bcf86cd799439011"), true);
  assert.equal(isVehicleObjectId("507f1f77bcf86cd79943901g"), false);
  assert.equal(isVehicleObjectId("operator-123"), false);

  assert.match(
    validateVehicleFields({ ...validVehicle, operatorId: "not-an-object-id" }, { creating: true }).errors.operatorId,
    /valid operator/,
  );
});
