import test from "node:test";
import assert from "node:assert/strict";
import Schedule from "../models/Schedule.js";
import {
  hasScheduleOverlap,
  hasReservedSeats,
  isScheduleObjectId,
  parseDate,
  validateScheduleFields,
} from "./schedules.js";

const operatorId = "507f1f77bcf86cd799439011";
const vehicleId = "507f1f77bcf86cd799439012";
const routeId = "507f1f77bcf86cd799439013";
const validSchedule = {
  operatorId,
  vehicleId,
  routeId,
  transport: "Bus",
  departureAt: "2030-01-01T10:00:00.000Z",
  arrivalAt: "2030-01-01T14:00:00.000Z",
  totalSeats: 40,
  availableSeats: 40,
  fare: 750,
  status: "scheduled",
};

test("schedule validation accepts valid values and parses dates", () => {
  const { errors, values } = validateScheduleFields(validSchedule, { creating: true });

  assert.deepEqual(errors, {});
  assert.equal(values.departureAt.toISOString(), validSchedule.departureAt);
  assert.equal(values.fare, 750);
  assert.ok(parseDate("2030-01-01"));
  assert.equal(parseDate("2030-02-30"), null);
});

test("schedule validation rejects invalid chronology, seat capacity, references and statuses", () => {
  const invalid = validateScheduleFields({
    ...validSchedule,
    operatorId: "operator-1",
    arrivalAt: "2030-01-01T09:00:00.000Z",
    availableSeats: 41,
    status: "pending",
  }, { creating: true });

  assert.match(invalid.errors.operatorId, /valid operator/);
  assert.match(invalid.errors.arrivalAt, /after departure/);
  assert.match(invalid.errors.availableSeats, /cannot exceed total/);
  assert.match(invalid.errors.status, /scheduled, active, completed, or cancelled/);
});

test("schedule update requires allowed fields and prevents status field injection", () => {
  assert.match(
    validateScheduleFields({}, { creating: false }).errors.body,
    /at least one schedule field/,
  );
  assert.match(
    validateScheduleFields({ status: "cancelled" }, { creating: false }).errors.body,
    /Unsupported fields/,
  );
});

test("schedule IDs and vehicle overlap checks use proper ObjectIds and exclusive boundaries", () => {
  assert.equal(isScheduleObjectId(operatorId), true);
  assert.equal(isScheduleObjectId("schedule-1"), false);
  const existing = [{
    vehicleId,
    departureAt: "2030-01-01T10:00:00.000Z",
    arrivalAt: "2030-01-01T12:00:00.000Z",
    status: "scheduled",
    deletedAt: null,
  }];
  assert.equal(hasScheduleOverlap({
    vehicleId,
    departureAt: "2030-01-01T11:00:00.000Z",
    arrivalAt: "2030-01-01T13:00:00.000Z",
  }, existing), true);
  assert.equal(hasScheduleOverlap({
    vehicleId,
    departureAt: "2030-01-01T12:00:00.000Z",
    arrivalAt: "2030-01-01T13:00:00.000Z",
  }, existing), false);
});

test("schedules with reserved seats are treated as unsafe to mutate", () => {
  assert.equal(hasReservedSeats({ totalSeats: 40, availableSeats: 39 }), true);
  assert.equal(hasReservedSeats({ totalSeats: 40, availableSeats: 40 }), false);
});

test("schedule schema rejects arrival-before-departure and excess available seats", async () => {
  const schedule = new Schedule({
    ...validSchedule,
    departureAt: new Date("2030-01-01T10:00:00.000Z"),
    arrivalAt: new Date("2030-01-01T09:00:00.000Z"),
    availableSeats: 41,
  });
  await assert.rejects(schedule.validate(), (error) => {
    assert.ok(error.errors.arrivalAt);
    assert.ok(error.errors.availableSeats);
    return true;
  });
});
