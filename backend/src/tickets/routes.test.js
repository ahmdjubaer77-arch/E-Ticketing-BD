import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import { createTicketRouter } from "./routes.js";

const secret = "ticket-route-test-secret-that-is-long-enough";
const ownerId = new mongoose.Types.ObjectId();
const bookingId = new mongoose.Types.ObjectId();
const scheduleId = new mongoose.Types.ObjectId();
const guestAccessToken = "guest-ticket-access-token-for-test";
const futureDeparture = new Date(Date.now() + 86_400_000);
const booking = {
  _id: bookingId,
  scheduleId,
  customerName: "Rahim Uddin",
  customerPhone: "01712345678",
  customerEmail: "rahim@example.com",
  bookedBy: ownerId,
  publicAccessTokenHash: createHash("sha256").update(guestAccessToken).digest("hex"),
  transport: "Bus",
  operatorName: "Green Line",
  departure: "Dhaka",
  destination: "Chattogram",
  departureAt: futureDeparture,
  arrivalAt: new Date(futureDeparture.getTime() + 5 * 60 * 60 * 1000),
  status: "confirmed",
  paymentStatus: "paid",
  tickets: [{ seatNumber: "A1", passengerName: "Ayesha Rahman", ticketCode: "ET1234567890ABCDEF12", status: "active" }],
};

async function withApi(t, testFn, { currentUserId = ownerId, email = "rahim@example.com" } = {}) {
  const originalFindOne = Booking.findOne;
  const originalFindById = User.findById;
  const selection = {
    select: () => selection,
    lean: async () => booking,
    then: (resolve, reject) => Promise.resolve(booking).then(resolve, reject),
  };
  Booking.findOne = () => ({ select: () => selection });
  User.findById = () => ({
    select: async () => ({
      _id: currentUserId,
      email,
      role: "user",
      isActive: true,
      isEmailVerified: true,
      tokenVersion: 0,
    }),
  });
  const config = {
    jwtSecret: secret,
    nodeEnv: "test",
    clientUrl: "http://localhost:5173",
  };
  const app = express();
  app.use(cookieParser());
  app.use("/api/tickets", createTicketRouter(config));
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => {
    server.close();
    Booking.findOne = originalFindOne;
    User.findById = originalFindById;
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ sub: currentUserId.toString(), tokenVersion: 0 }, secret, { expiresIn: "5m" });
  return testFn({ baseUrl, cookie: `accessToken=${token}` });
}

test("public QR verification returns ticket status without passenger contact data", async (t) => {
  await withApi(t, async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/tickets/verify/${booking.tickets[0].ticketCode}`);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.data.valid, true);
    assert.equal(result.data.seatNumber, "A1");
    assert.equal("passengerName" in result.data, false);
    assert.equal("passengerPhone" in result.data, false);
  });
});

test("invalid QR verification returns not found", async (t) => {
  await withApi(t, async ({ baseUrl }) => {
    Booking.findOne = () => ({
      select: () => ({ lean: async () => null }),
    });
    const response = await fetch(`${baseUrl}/api/tickets/verify/ETNOTFOUND00000000`);
    assert.equal(response.status, 404);
  });
});

test("ticket details and PDF are available only to the booking owner", async (t) => {
  await withApi(t, async ({ baseUrl, cookie }) => {
    const details = await fetch(`${baseUrl}/api/tickets/${booking.tickets[0].ticketCode}`, {
      headers: { Cookie: cookie },
    });
    const result = await details.json();
    assert.equal(details.status, 200);
    assert.equal(result.data.passengerName, "Ayesha Rahman");
    assert.equal(result.data.bookingId, bookingId.toString());

    const pdfResponse = await fetch(`${baseUrl}/api/tickets/${booking.tickets[0].ticketCode}/pdf`, {
      headers: { Cookie: cookie },
    });
    const pdf = Buffer.from(await pdfResponse.arrayBuffer());
    assert.equal(pdfResponse.status, 200);
    assert.match(pdfResponse.headers.get("content-type"), /application\/pdf/);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  }, { currentUserId: ownerId });

  await withApi(t, async ({ baseUrl, cookie }) => {
    const response = await fetch(`${baseUrl}/api/tickets/${booking.tickets[0].ticketCode}/pdf`, {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 403);
  }, { currentUserId: new mongoose.Types.ObjectId(), email: "other@example.com" });
});

test("booking bearer token can download its PDF without a user session", async (t) => {
  await withApi(t, async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/tickets/${booking.tickets[0].ticketCode}/pdf`, {
      headers: { Authorization: `Bearer ${guestAccessToken}` },
    });
    const pdf = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  });
});
