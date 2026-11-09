import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { ticketsForBooking } from "./bookings.js";

const bookingId = new mongoose.Types.ObjectId();
const futureDeparture = new Date(Date.now() + 60 * 60 * 1000);

test("expands a saved multi-seat booking into passenger tickets", () => {
  const [first, second] = ticketsForBooking({
    _id: bookingId,
    seatNumbers: ["A1", "B1"],
    tickets: [
      { seatNumber: "A1", passengerName: "Ayesha Rahman", ticketCode: "ET-FIRST", status: "active" },
      { seatNumber: "B1", passengerName: "Karim Rahman", ticketCode: "ET-SECOND", status: "used" },
    ],
    ticketCode: "ET-BOOKING",
    customerName: "Rahim Uddin",
    customerEmail: "rahim@example.com",
    customerPhone: "01712345678",
    transport: "Bus",
    operatorName: "Green Line",
    departure: "Dhaka",
    destination: "Chattogram",
    departureAt: futureDeparture,
    arrivalAt: new Date(futureDeparture.getTime() + 5 * 60 * 60 * 1000),
    farePerSeat: 750,
    paymentStatus: "paid",
    status: "confirmed",
  });

  assert.equal(first.id, "ET-FIRST");
  assert.equal(first.bookingId, bookingId.toString());
  assert.equal(first.passengerName, "Ayesha Rahman");
  assert.equal(first.seatNumber, "A1");
  assert.equal(first.status, "active");
  assert.equal(first.ticketPrice, 750);
  assert.equal(second.passengerName, "Karim Rahman");
  assert.equal(second.status, "used");
});

test("marks cancelled bookings and past journeys as inactive tickets", () => {
  const baseBooking = {
    _id: bookingId,
    seatNumbers: ["A1"],
    tickets: [{ seatNumber: "A1", ticketCode: "ET-ONE", status: "active" }],
    ticketCode: "ET-BOOKING",
    customerName: "Rahim",
    transport: "Bus",
    operatorName: "Green Line",
    departure: "Dhaka",
    destination: "Chattogram",
    departureAt: new Date(Date.now() - 60 * 60 * 1000),
    arrivalAt: new Date(),
    farePerSeat: 750,
    paymentStatus: "paid",
  };
  assert.equal(ticketsForBooking({ ...baseBooking, status: "cancelled" })[0].status, "cancelled");
  assert.equal(ticketsForBooking({ ...baseBooking, status: "confirmed" })[0].status, "expired");
  assert.equal(ticketsForBooking({ ...baseBooking, status: "pending" })[0].status, "pending");
  assert.equal(ticketsForBooking({ ...baseBooking, status: "expired" })[0].status, "expired");
  assert.equal(ticketsForBooking({
    ...baseBooking,
    status: "confirmed",
    paymentStatus: "pending",
    departureAt: futureDeparture,
  })[0].status, "pending");
});
