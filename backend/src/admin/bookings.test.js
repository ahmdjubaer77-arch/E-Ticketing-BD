import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { parseAdminBookingInput } from "./bookings.js";

const validInput = {
  scheduleId: new mongoose.Types.ObjectId().toString(),
  customerName: "  Rahim   Uddin ",
  customerEmail: "RAHIM@example.com",
  customerPhone: "01712345678",
  seatNumbers: ["A1", "B1"],
};

test("validates and normalizes admin booking details", () => {
  const { errors, values } = parseAdminBookingInput(validInput);
  assert.deepEqual(errors, {});
  assert.equal(values.customerName, "Rahim Uddin");
  assert.equal(values.customerEmail, "rahim@example.com");
  assert.deepEqual(values.seatNumbers, ["A1", "B1"]);
});

test("rejects malformed, duplicate, or excessive seat selections", () => {
  for (const seatNumbers of [["A1", "A1"], ["E1"], [], Array.from({ length: 11 }, (_, i) => `A${i + 1}`)]) {
    const { errors } = parseAdminBookingInput({ ...validInput, seatNumbers });
    assert.ok(errors.seatNumbers);
  }
});

test("rejects invalid customer data and unknown request fields", () => {
  const { errors } = parseAdminBookingInput({
    ...validInput,
    customerName: "x",
    customerEmail: "not-an-email",
    extra: true,
  });
  assert.ok(errors.customerName);
  assert.ok(errors.customerEmail);
  assert.match(errors.body, /Unsupported fields/);
});
