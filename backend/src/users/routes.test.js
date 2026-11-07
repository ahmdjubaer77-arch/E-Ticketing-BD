import test from "node:test";
import assert from "node:assert/strict";
import { bookingStatusFilter } from "./routes.js";

test("ticket status filter includes only paid confirmed or completed bookings", () => {
  assert.deepEqual(bookingStatusFilter("tickets"), {
    status: { $in: ["confirmed", "completed"] },
    paymentStatus: "paid",
  });
});

test("booking status filter keeps individual status behavior", () => {
  assert.deepEqual(bookingStatusFilter("pending"), { status: "pending" });
  assert.equal(bookingStatusFilter(""), null);
});
