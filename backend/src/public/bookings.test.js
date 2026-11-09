import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  parsePaymentProofInput,
  parsePublicBookingInput,
  parseSeatHoldInput,
  validSeatForCapacity,
} from "./bookings.js";

const validInput = {
  scheduleId: new mongoose.Types.ObjectId().toString(),
  customerName: "  Rahim   Uddin ",
  customerEmail: "RAHIM@example.com",
  customerPhone: "01712345678",
  seatNumbers: ["A1", "B1"],
};

test("validates and normalizes a customer seat reservation", () => {
  const { errors, values } = parsePublicBookingInput(validInput);
  assert.deepEqual(errors, {});
  assert.equal(values.customerName, "Rahim Uddin");
  assert.equal(values.customerEmail, "rahim@example.com");
  assert.deepEqual(values.seatNumbers, ["A1", "B1"]);
});

test("rejects invalid customer contact and seat selections", () => {
  const { errors } = parsePublicBookingInput({
    ...validInput,
    customerEmail: "invalid",
    customerPhone: "",
    seatNumbers: ["A1", "A1"],
  });
  assert.ok(errors.customerEmail);
  assert.ok(errors.customerPhone);
  assert.ok(errors.seatNumbers);
});

test("limits public reservations to ten valid, unique seats", () => {
  const tooManySeats = Array.from({ length: 11 }, (_, index) => `A${index + 1}`);
  assert.ok(parsePublicBookingInput({ ...validInput, seatNumbers: tooManySeats }).errors.seatNumbers);
  assert.ok(parsePublicBookingInput({ ...validInput, seatNumbers: ["E1"] }).errors.seatNumbers);
});

test("validates a payment method and transaction ID before accepting customer proof", () => {
  const { errors, values } = parsePaymentProofInput({
    paymentMethodId: new mongoose.Types.ObjectId().toString(),
    transactionId: "TRX-1234_ab",
  });
  assert.deepEqual(errors, {});
  assert.equal(values.transactionId, "TRX-1234_ab");
});

test("validates and normalizes one passenger per seat for ticket issuance", () => {
  const { errors, values } = parsePaymentProofInput({
    paymentMethodId: new mongoose.Types.ObjectId().toString(),
    transactionId: "TRX-1234",
    passengers: [
      { seat: "A1", fullName: "  Ayesha   Rahman " },
      { seat: "B1", fullName: "Karim Rahman" },
    ],
  });
  assert.deepEqual(errors, {});
  assert.deepEqual(values.passengers, [
    { seatNumber: "A1", fullName: "Ayesha Rahman" },
    { seatNumber: "B1", fullName: "Karim Rahman" },
  ]);

  const invalid = parsePaymentProofInput({
    paymentMethodId: new mongoose.Types.ObjectId().toString(),
    transactionId: "TRX-1234",
    passengers: [{ seat: "A1", fullName: "A" }, { seat: "A1", fullName: "Second" }],
  });
  assert.ok(invalid.errors.passengers);
});

test("rejects malformed or unexpected payment proof fields", () => {
  const { errors } = parsePaymentProofInput({
    paymentMethodId: "not-an-id",
    transactionId: "x",
    paymentStatus: "paid",
  });
  assert.ok(errors.paymentMethodId);
  assert.ok(errors.transactionId);
  assert.match(errors.body, /Unsupported fields/);
});

test("validates seat hold requests and optional bearer credentials", () => {
  const { errors, values } = parseSeatHoldInput({
    scheduleId: new mongoose.Types.ObjectId().toString(),
    seatNumber: "C4",
  });
  assert.deepEqual(errors, {});
  assert.equal(values.seatNumber, "C4");

  const invalid = parseSeatHoldInput({
    scheduleId: new mongoose.Types.ObjectId().toString(),
    seatNumber: "E4",
    accessToken: "token-without-booking-id",
  });
  assert.ok(invalid.errors.seatNumber);
  assert.ok(invalid.errors.accessToken);
});

test("checks seat labels against the vehicle capacity", () => {
  assert.equal(validSeatForCapacity("D1", 4), true);
  assert.equal(validSeatForCapacity("A2", 4), false);
  assert.equal(validSeatForCapacity("E1", 40), false);
});
