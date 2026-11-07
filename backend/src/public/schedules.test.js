import test from "node:test";
import assert from "node:assert/strict";
import { parsePublicScheduleQuery, publicScheduleResponse } from "./schedules.js";

test("public schedule search validates locations, transport, and Dhaka travel date", () => {
  const { errors, values } = parsePublicScheduleQuery({
    from: "  Dhaka ",
    to: "Chattogram",
    date: "2026-11-10",
    transport: "Bus",
  });

  assert.deepEqual(errors, {});
  assert.equal(values.from, "Dhaka");
  assert.equal(values.dateRange.start.toISOString(), "2026-11-09T18:00:00.000Z");
  assert.equal(values.dateRange.end.toISOString(), "2026-11-10T18:00:00.000Z");
});

test("public schedule search rejects invalid dates, same locations, and unsupported transport", () => {
  const { errors } = parsePublicScheduleQuery({
    from: "Dhaka",
    to: " dhaka ",
    date: "2026-02-30",
    transport: ["Bus"],
  });

  assert.match(errors.to, /different from the departure/);
  assert.match(errors.date, /valid date/);
  assert.match(errors.transport, /Bus, Train, Launch, or Event/);
});

test("public schedule response exposes only public listing fields", () => {
  const schedule = publicScheduleResponse({
    _id: "507f1f77bcf86cd799439011",
    operatorId: { name: "Green Line Paribahan", email: "private@example.com" },
    vehicleId: { name: "AC Business Coach", registrationNumber: "DHAKA-1" },
    routeId: { departure: "Dhaka", destination: "Chattogram" },
    transport: "Bus",
    departureAt: new Date("2026-11-10T01:00:00.000Z"),
    arrivalAt: new Date("2026-11-10T06:30:00.000Z"),
    totalSeats: 40,
    availableSeats: 12,
    fare: 1250,
    status: "active",
  });

  assert.deepEqual(schedule, {
    id: "507f1f77bcf86cd799439011",
    operator: "Green Line Paribahan",
    transport: "Bus",
    departure: "Dhaka",
    destination: "Chattogram",
    departureAt: new Date("2026-11-10T01:00:00.000Z"),
    arrivalAt: new Date("2026-11-10T06:30:00.000Z"),
    totalSeats: 40,
    availableSeats: 12,
    fare: 1250,
    coach: "AC Business Coach",
    bookedSeats: [],
  });
});
