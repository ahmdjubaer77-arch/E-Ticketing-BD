import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { rateLimit } from "express-rate-limit";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import PaymentMethod from "../models/PaymentMethod.js";
import Schedule from "../models/Schedule.js";
import { expirePendingBookings } from "../bookings/expiration.js";
import { detectImageContentType } from "../media/cloudinary.js";
import { createAuthMiddleware } from "../auth/middleware.js";

const seatPattern = /^[A-D]\d{1,3}$/;
const holdDurationMs = 3 * 60 * 1000;
const maxPaymentProofImageBytes = 1024 * 1024;

export function parsePublicBookingInput(body) {
  const errors = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: { body: "A JSON object is required." }, values: {} };
  }
  const values = {
    scheduleId: typeof body.scheduleId === "string" ? body.scheduleId : "",
    customerName: typeof body.customerName === "string" ? body.customerName.trim().replace(/\s+/g, " ") : "",
    customerEmail: typeof body.customerEmail === "string" ? body.customerEmail.trim().toLowerCase() : "",
    customerPhone: typeof body.customerPhone === "string" ? body.customerPhone.trim() : "",
    seatNumbers: body.seatNumbers,
  };
  const unexpectedFields = Object.keys(body).filter((key) =>
    !["scheduleId", "customerName", "customerEmail", "customerPhone", "seatNumbers"].includes(key));
  if (unexpectedFields.length) errors.body = `Unsupported fields: ${unexpectedFields.join(", ")}.`;
  if (!mongoose.isObjectIdOrHexString(values.scheduleId)) errors.scheduleId = "Choose a valid schedule.";
  if (values.customerName.length < 2 || values.customerName.length > 100) {
    errors.customerName = "Customer name must be between 2 and 100 characters.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.customerEmail) || values.customerEmail.length > 254) {
    errors.customerEmail = "Enter a valid email address.";
  }
  if (values.customerPhone.length > 24 || !/^\+?[0-9\s()-]{7,24}$/.test(values.customerPhone)) {
    errors.customerPhone = "Enter a valid phone number.";
  }
  if (!Array.isArray(values.seatNumbers) || values.seatNumbers.length < 1 || values.seatNumbers.length > 10) {
    errors.seatNumbers = "Choose between 1 and 10 seats.";
  } else if (
    values.seatNumbers.some((seat) => typeof seat !== "string" || !seatPattern.test(seat))
    || new Set(values.seatNumbers).size !== values.seatNumbers.length
  ) {
    errors.seatNumbers = "Seats must be unique valid seat labels.";
  }
  return { errors, values };
}

export function parsePaymentProofInput(body) {
  const errors = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: { body: "A JSON object is required." }, values: {} };
  }
  const allowedFields = ["paymentMethodId", "transactionId", "customerName", "customerEmail", "customerPhone", "passengers"];
  const unsupported = Object.keys(body).filter((key) => !allowedFields.includes(key));
  if (unsupported.length) errors.body = `Unsupported fields: ${unsupported.join(", ")}.`;
  const values = {
    paymentMethodId: typeof body.paymentMethodId === "string" ? body.paymentMethodId : "",
    transactionId: typeof body.transactionId === "string" ? body.transactionId.trim() : "",
    customerName: typeof body.customerName === "string" ? body.customerName.trim().replace(/\s+/g, " ") : "",
    customerEmail: typeof body.customerEmail === "string" ? body.customerEmail.trim().toLowerCase() : "",
    customerPhone: typeof body.customerPhone === "string" ? body.customerPhone.trim() : "",
    passengers: Array.isArray(body.passengers) ? body.passengers.map((passenger) => ({
      seatNumber: typeof passenger?.seat === "string" ? passenger.seat.trim() : "",
      fullName: typeof passenger?.fullName === "string" ? passenger.fullName.trim().replace(/\s+/g, " ") : "",
    })) : [],
  };
  if (!mongoose.isObjectIdOrHexString(values.paymentMethodId)) errors.paymentMethodId = "Choose an available payment method.";
  if (!/^[A-Za-z0-9_-]{4,100}$/.test(values.transactionId)) {
    errors.transactionId = "Enter a valid transaction ID (4–100 letters, numbers, hyphens, or underscores).";
  }
  if (Object.hasOwn(body, "customerName") && (values.customerName.length < 2 || values.customerName.length > 100)) {
    errors.customerName = "Customer name must be between 2 and 100 characters.";
  }
  if (Object.hasOwn(body, "customerEmail")
    && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.customerEmail) || values.customerEmail.length > 254)) {
    errors.customerEmail = "Enter a valid email address.";
  }
  if (Object.hasOwn(body, "customerPhone")
    && (values.customerPhone.length > 24 || !/^\+?[0-9\s()-]{7,24}$/.test(values.customerPhone))) {
    errors.customerPhone = "Enter a valid phone number.";
  }
  if (Object.hasOwn(body, "passengers")) {
    if (!Array.isArray(body.passengers) || body.passengers.length < 1 || body.passengers.length > 10) {
      errors.passengers = "Provide passenger details for each reserved seat.";
    } else if (values.passengers.some((passenger) => !seatPattern.test(passenger.seatNumber)
      || passenger.fullName.length < 2 || passenger.fullName.length > 100)
      || new Set(values.passengers.map((passenger) => passenger.seatNumber)).size !== values.passengers.length) {
      errors.passengers = "Each passenger needs a unique valid seat and a name between 2 and 100 characters.";
    }
  }
  return { errors, values };
}

export function parseSeatHoldInput(body) {
  const errors = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: { body: "A JSON object is required." }, values: {} };
  }
  const allowedFields = new Set(["scheduleId", "seatNumber", "bookingId", "accessToken"]);
  const unsupported = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unsupported.length) errors.body = `Unsupported fields: ${unsupported.join(", ")}.`;
  const values = {
    scheduleId: typeof body.scheduleId === "string" ? body.scheduleId : "",
    seatNumber: typeof body.seatNumber === "string" ? body.seatNumber : "",
    bookingId: typeof body.bookingId === "string" ? body.bookingId : "",
    accessToken: typeof body.accessToken === "string" ? body.accessToken : "",
  };
  if (!mongoose.isObjectIdOrHexString(values.scheduleId)) errors.scheduleId = "Choose a valid schedule.";
  if (!seatPattern.test(values.seatNumber)) errors.seatNumber = "Choose a valid seat.";
  if (Boolean(values.bookingId) !== Boolean(values.accessToken)) {
    errors.accessToken = "A booking ID and access token must be provided together.";
  }
  if (values.bookingId && !mongoose.isObjectIdOrHexString(values.bookingId)) errors.bookingId = "Choose a valid booking.";
  if (values.accessToken && values.accessToken.length > 200) errors.accessToken = "Seat reservation token is invalid.";
  return { errors, values };
}

function publicBookingResponse(booking) {
  return {
    id: booking._id.toString(),
    reference: booking.ticketCode,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    departure: booking.departure,
    destination: booking.destination,
    transport: booking.transport,
    operatorName: booking.operatorName,
    departureAt: booking.departureAt,
    arrivalAt: booking.arrivalAt,
    seatNumbers: booking.seatNumbers,
    totalAmount: booking.farePerSeat * booking.seatNumbers.length,
    paymentStatus: booking.paymentStatus,
    paymentProof: booking.paymentProof ? {
      paymentMethodName: booking.paymentProof.paymentMethodName,
      transactionId: booking.paymentProof.transactionId,
      submittedAt: booking.paymentProof.submittedAt,
      reviewStatus: booking.paymentProof.reviewStatus,
    } : null,
    status: booking.status,
    expiresAt: booking.expiresAt,
    ticketCodes: booking.tickets.map((ticket) => ticket.ticketCode),
    ticketPassengerNames: booking.seatNumbers.map((seatNumber) =>
      booking.tickets.find((ticket) => ticket.seatNumber === seatNumber)?.passengerName || booking.customerName),
  };
}

function hashAccessToken(value) {
  return createHash("sha256").update(value).digest();
}

function ticketCode() {
  return `ET${randomBytes(10).toString("hex").toUpperCase()}`;
}

export function validSeatForCapacity(seatNumber, totalSeats) {
  const match = /^([A-D])(\d{1,3})$/.exec(seatNumber);
  if (!match) return false;
  const seatIndex = (Number(match[2]) - 1) * 4 + "ABCD".indexOf(match[1]);
  return seatIndex >= 0 && seatIndex < totalSeats;
}

async function findBookingForAccessToken(id, accessToken) {
  if (!mongoose.isObjectIdOrHexString(id) || !accessToken || accessToken.length > 200) return null;
  const booking = await Booking.findById(id).select("+publicAccessTokenHash");
  if (!booking?.publicAccessTokenHash) return null;
  const expectedHash = Buffer.from(booking.publicAccessTokenHash, "hex");
  const suppliedHash = hashAccessToken(accessToken);
  if (expectedHash.length !== suppliedHash.length || !timingSafeEqual(expectedHash, suppliedHash)) return null;
  return booking;
}

export function createPublicBookingsRouter(config) {
  const router = Router();
  const { optionalAuth } = createAuthMiddleware(config);
  const createLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many booking attempts. Please try again later." },
  });
  const proofLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 6,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many payment proof attempts. Please try again later." },
  });

  router.use(optionalAuth);

  router.post("/hold", createLimiter, async (request, response, next) => {
    let reservedSeatCount = 0;
    let scheduleId = "";
    try {
      await expirePendingBookings();
      const { errors, values } = parseSeatHoldInput(request.body);
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please choose a valid seat.", errors });
      }
      const { scheduleId: requestedScheduleId, seatNumber, accessToken, bookingId } = values;

      let existingBooking = null;
      if (accessToken) {
        existingBooking = await findBookingForAccessToken(bookingId, accessToken);
        if (!existingBooking || existingBooking.scheduleId.toString() !== requestedScheduleId) {
          return response.status(401).json({ success: false, message: "Seat reservation is unavailable. Refresh and select again." });
        }
        if (request.user && existingBooking.bookedBy && !existingBooking.bookedBy.equals(request.user._id)) {
          return response.status(403).json({ success: false, message: "This reservation belongs to another account." });
        }
        if (
          existingBooking.status !== "pending"
          || existingBooking.paymentStatus !== "pending"
          || existingBooking.paymentProof?.reviewStatus === "submitted"
          || existingBooking.expiresAt <= new Date()
        ) {
          return response.status(409).json({ success: false, message: "This seat reservation is no longer available." });
        }
        if (existingBooking.seatNumbers.includes(seatNumber)) {
          return response.json({
            success: true,
            message: "Seat is already held in this reservation.",
            data: { booking: { ...publicBookingResponse(existingBooking), accessToken } },
          });
        }
        if (existingBooking.seatNumbers.length >= 10) {
          return response.status(400).json({ success: false, message: "A reservation can hold at most 10 seats." });
        }
        scheduleId = requestedScheduleId;
        const schedule = await Schedule.findOneAndUpdate(
          {
            _id: scheduleId,
            deletedAt: null,
            transport: "Bus",
            status: { $in: ["scheduled", "active"] },
            departureAt: { $gt: new Date() },
            availableSeats: { $gt: 0 },
          },
          { $inc: { availableSeats: -1 } },
          { new: true },
        );
        if (!schedule) {
          return response.status(409).json({ success: false, message: "No seats remain on this schedule." });
        }
        reservedSeatCount = 1;
        if (!validSeatForCapacity(seatNumber, schedule.totalSeats)) {
          await Schedule.updateOne({ _id: scheduleId }, { $inc: { availableSeats: 1 } });
          reservedSeatCount = 0;
          return response.status(400).json({ success: false, message: "This seat is outside the vehicle's capacity." });
        }

        const seatTicketCode = ticketCode();
        const updatedBooking = await Booking.findOneAndUpdate(
          {
            _id: existingBooking._id,
            status: "pending",
            paymentStatus: "pending",
            paymentProof: null,
            expiresAt: { $gt: new Date() },
            seatNumbers: { $ne: seatNumber },
            $expr: { $lt: [{ $size: "$seatNumbers" }, 10] },
          },
          {
            $push: {
              seatNumbers: seatNumber,
              tickets: { seatNumber, ticketCode: seatTicketCode, status: "active" },
            },
          },
          { new: true },
        );
        if (!updatedBooking) {
          await Schedule.updateOne({ _id: scheduleId }, { $inc: { availableSeats: 1 } });
          reservedSeatCount = 0;
          const currentBooking = await Booking.findById(existingBooking._id);
          if (currentBooking?.seatNumbers.includes(seatNumber)) {
            return response.json({
              success: true,
              message: "Seat is already held in this reservation.",
              data: { booking: { ...publicBookingResponse(currentBooking), accessToken } },
            });
          }
          return response.status(409).json({ success: false, message: "This reservation changed or reached its seat limit. Please refresh." });
        }
        reservedSeatCount = 0;
        return response.status(201).json({
          success: true,
          message: "Seat held for three minutes.",
          data: { booking: { ...publicBookingResponse(updatedBooking), accessToken } },
        });
      }

      scheduleId = requestedScheduleId;
      const schedule = await Schedule.findOneAndUpdate(
        {
          _id: scheduleId,
          deletedAt: null,
          transport: "Bus",
          status: { $in: ["scheduled", "active"] },
          departureAt: { $gt: new Date() },
          availableSeats: { $gt: 0 },
        },
        { $inc: { availableSeats: -1 } },
        { new: true },
      )
        .populate({ path: "operatorId", select: "name" })
        .populate({ path: "routeId", select: "departure destination" });
      if (!schedule) {
        const exists = await Schedule.exists({ _id: scheduleId, deletedAt: null });
        return response.status(exists ? 409 : 404).json({
          success: false,
          message: exists ? "This schedule has no seats available." : "Schedule not found.",
        });
      }
      reservedSeatCount = 1;
      if (!validSeatForCapacity(seatNumber, schedule.totalSeats)) {
        await Schedule.updateOne({ _id: scheduleId }, { $inc: { availableSeats: 1 } });
        reservedSeatCount = 0;
        return response.status(400).json({ success: false, message: "This seat is outside the vehicle's capacity." });
      }

      const now = new Date();
      const newAccessToken = randomBytes(32).toString("base64url");
      const booking = await Booking.create({
        scheduleId,
        customerName: "Seat hold",
        operatorName: schedule.operatorId?.name || "Operator unavailable",
        departure: schedule.routeId?.departure || "Location unavailable",
        destination: schedule.routeId?.destination || "Location unavailable",
        transport: schedule.transport,
        departureAt: schedule.departureAt,
        arrivalAt: schedule.arrivalAt,
        farePerSeat: schedule.fare,
        seatNumbers: [seatNumber],
        status: "pending",
        paymentStatus: "pending",
        expiresAt: new Date(now.getTime() + holdDurationMs),
        bookedBy: request.user?._id || null,
        publicAccessTokenHash: hashAccessToken(newAccessToken).toString("hex"),
        ticketCode: ticketCode(),
        tickets: [{ seatNumber, ticketCode: ticketCode(), status: "active" }],
      });
      reservedSeatCount = 0;
      return response.status(201).json({
        success: true,
        message: "Seat held for three minutes.",
        data: { booking: { ...publicBookingResponse(booking), accessToken: newAccessToken } },
      });
    } catch (error) {
      if (reservedSeatCount && scheduleId) {
        await Schedule.updateOne({ _id: scheduleId }, { $inc: { availableSeats: reservedSeatCount } });
      }
      if (error?.code === 11000) {
        return response.status(409).json({
          success: false,
          message: "This seat was just selected by another customer. Choose a different seat.",
          code: "SEAT_ALREADY_BOOKED",
        });
      }
      return next(error);
    }
  });

  router.delete("/:id/seats/:seatNumber", async (request, response, next) => {
    try {
      const accessToken = request.get("authorization")?.replace(/^Bearer\s+/i, "");
      const booking = await findBookingForAccessToken(request.params.id, accessToken);
      if (!booking) return response.status(401).json({ success: false, message: "Seat reservation is unavailable." });
      if (booking.status !== "pending" || booking.paymentStatus !== "pending" || booking.paymentProof) {
        return response.status(409).json({ success: false, message: "Seats can no longer be changed in this reservation." });
      }
      const seatNumber = request.params.seatNumber;
      if (!booking.seatNumbers.includes(seatNumber)) {
        return response.status(404).json({ success: false, message: "Seat not found in this reservation." });
      }
      const result = await Booking.updateOne(
        {
          _id: booking._id,
          status: "pending",
          paymentStatus: "pending",
          seatNumbers: seatNumber,
          paymentProof: null,
        },
        { $pull: { seatNumbers: seatNumber, tickets: { seatNumber } } },
      );
      if (result.modifiedCount !== 1) {
        return response.status(409).json({ success: false, message: "Seat reservation changed. Refresh and try again." });
      }
      let updatedBooking = await Booking.findById(booking._id);
      if (updatedBooking.seatNumbers.length === 0) {
        await Booking.updateOne(
          { _id: booking._id, status: "pending", seatNumbers: { $size: 0 } },
          { $set: { status: "cancelled", expiresAt: null } },
        );
        updatedBooking = await Booking.findById(booking._id);
      }
      const scheduleUpdate = await Schedule.updateOne(
        { _id: booking.scheduleId, deletedAt: null },
        { $inc: { availableSeats: 1 } },
      );
      if (scheduleUpdate.matchedCount !== 1) {
        return response.status(409).json({ success: false, message: "Seat was released, but schedule availability could not be updated." });
      }
      return response.json({
        success: true,
        message: "Seat released.",
        data: {
          booking: updatedBooking.status === "cancelled"
            ? null
            : { ...publicBookingResponse(updatedBooking), accessToken },
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      await expirePendingBookings();
      const accessToken = request.get("authorization")?.replace(/^Bearer\s+/i, "");
      const booking = await findBookingForAccessToken(request.params.id, accessToken);
      if (!booking) return response.status(401).json({ success: false, message: "Booking status is unavailable." });
      return response.json({
        success: true,
        message: "Booking status retrieved.",
        data: { booking: publicBookingResponse(booking) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:id/proof", proofLimiter, async (request, response, next) => {
    try {
      await expirePendingBookings();
      const accessToken = request.get("authorization")?.replace(/^Bearer\s+/i, "");
      const booking = await findBookingForAccessToken(request.params.id, accessToken);
      if (!booking) return response.status(401).json({ success: false, message: "Booking status is unavailable." });
      const isImageUpload = Buffer.isBuffer(request.body);
      let imagePassengerDetails;
      let imageProofDetails;
      const encodedProofDetails = request.get("x-payment-details");
      if (isImageUpload && encodedProofDetails && encodedProofDetails.length <= 16_000) {
        try {
          imageProofDetails = JSON.parse(Buffer.from(encodedProofDetails, "base64url").toString("utf8"));
        } catch {
          imageProofDetails = null;
        }
      }
      if (isImageUpload && request.get("x-passengers")) {
        try {
          imagePassengerDetails = JSON.parse(request.get("x-passengers"));
        } catch {
          imagePassengerDetails = null;
        }
      }
      const proofBody = isImageUpload ? imageProofDetails || {
        paymentMethodId: request.get("x-payment-method-id"),
        transactionId: request.get("x-transaction-id"),
        customerName: request.get("x-customer-name"),
        customerEmail: request.get("x-customer-email"),
        customerPhone: request.get("x-customer-phone"),
        ...(request.get("x-passengers") ? { passengers: imagePassengerDetails } : {}),
      } : request.body;
      const { errors, values } = parsePaymentProofInput(proofBody);
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct your payment proof.", errors });
      }
      if (
        values.customerName.length < 2 || values.customerName.length > 100
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.customerEmail) || values.customerEmail.length > 254
        || values.customerPhone.length > 24 || !/^\+?[0-9\s()-]{7,24}$/.test(values.customerPhone)
      ) {
        return response.status(400).json({
          success: false,
          message: "Customer details are required before submitting payment proof.",
          errors: {
            customerName: "Enter the customer name.",
            customerEmail: "Enter a valid email address.",
            customerPhone: "Enter a valid phone number.",
          },
        });
      }
      if (request.user && values.customerEmail !== request.user.email.toLowerCase()) {
        return response.status(403).json({ success: false, message: "Use the email address on your signed-in account to link this booking." });
      }
      if (booking.bookedBy && (!request.user || !booking.bookedBy.equals(request.user._id))) {
        return response.status(403).json({ success: false, message: "Sign in to the account that reserved this seat to submit payment proof." });
      }
      if (!request.user && await User.exists({ email: values.customerEmail, isActive: true, isEmailVerified: true })) {
        return response.status(401).json({ success: false, message: "Sign in to the account for this email before submitting payment proof." });
      }
      if (booking.paymentProof?.reviewStatus === "submitted" || booking.paymentProof?.reviewStatus === "approved") {
        if (
          booking.paymentProof.paymentMethodId.toString() === values.paymentMethodId
          && booking.paymentProof.transactionId === values.transactionId
        ) {
          return response.json({
            success: true,
            message: "Payment proof was already submitted.",
            data: { booking: { ...publicBookingResponse(booking), accessToken } },
          });
        }
        return response.status(409).json({ success: false, message: "Different payment proof has already been submitted for this reservation." });
      }
      if (booking.status !== "pending" || booking.paymentStatus !== "pending" || !booking.expiresAt || booking.expiresAt <= new Date()) {
        return response.status(409).json({ success: false, message: "This reservation is no longer active. Start a new booking to submit payment proof." });
      }
      const passengerDetails = values.passengers.length
        ? values.passengers
        : booking.seatNumbers.map((seatNumber) => ({ seatNumber, fullName: values.customerName }));
      if (passengerDetails.length !== booking.seatNumbers.length
        || passengerDetails.some((passenger) => !booking.seatNumbers.includes(passenger.seatNumber))) {
        return response.status(400).json({
          success: false,
          message: "Provide exactly one passenger name for every reserved seat.",
          errors: { passengers: "Passenger seats must match the reserved seats." },
        });
      }
      const method = await PaymentMethod.findOne({ _id: values.paymentMethodId, status: "active" }).lean();
      if (!method) return response.status(400).json({ success: false, message: "This payment method is no longer available. Refresh and choose another." });

      let imageData = null;
      let imageContentType = null;
      if (isImageUpload) {
        imageContentType = detectImageContentType(request.body, request.get("content-type"));
        if (!imageContentType) {
          return response.status(request.body.length ? 415 : 400)
            .json({ success: false, message: "Upload a valid JPEG, PNG, or WebP payment screenshot." });
        }
        if (request.body.length > maxPaymentProofImageBytes) {
          return response.status(413).json({ success: false, message: "Payment screenshots must be 1 MB or smaller." });
        }
        imageData = request.body;
      }

      booking.paymentProof = {
        paymentMethodId: method._id,
        paymentMethodName: method.name,
        accountNumber: method.accountNumber,
        transactionId: values.transactionId,
        submittedAt: new Date(),
        reviewStatus: "submitted",
        imageData,
        imageContentType,
      };
      booking.customerName = values.customerName;
      booking.customerEmail = values.customerEmail;
      booking.customerPhone = values.customerPhone;
      const passengerNames = new Map(passengerDetails.map((passenger) => [passenger.seatNumber, passenger.fullName]));
      for (const ticket of booking.tickets) {
        ticket.passengerName = passengerNames.get(ticket.seatNumber) || values.customerName;
      }
      if (request.user) booking.bookedBy = request.user._id;
      booking.expiresAt = null;
      await booking.save();
      return response.status(201).json({
        success: true,
        message: "Payment proof submitted. An administrator will review it before confirming the booking.",
        data: { booking: { ...publicBookingResponse(booking), accessToken } },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", createLimiter, async (request, response, next) => {
    let reservedSeatCount = 0;
    let scheduleId = "";
    try {
      await expirePendingBookings();
      const { errors, values } = parsePublicBookingInput(request.body);
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct your booking details.", errors });
      }
      if (request.user && values.customerEmail !== request.user.email.toLowerCase()) {
        return response.status(403).json({ success: false, message: "Use the email address on your signed-in account to create this booking." });
      }

      scheduleId = values.scheduleId;
      const schedule = await Schedule.findOneAndUpdate(
        {
          _id: scheduleId,
          deletedAt: null,
          transport: "Bus",
          status: { $in: ["scheduled", "active"] },
          departureAt: { $gt: new Date() },
          availableSeats: { $gte: values.seatNumbers.length },
        },
        { $inc: { availableSeats: -values.seatNumbers.length } },
        { new: true },
      )
        .populate({ path: "operatorId", select: "name" })
        .populate({ path: "routeId", select: "departure destination" });

      if (!schedule) {
        const exists = await Schedule.exists({ _id: scheduleId, deletedAt: null });
        return response.status(exists ? 409 : 404).json({
          success: false,
          message: exists ? "This schedule is no longer available for booking." : "Schedule not found.",
        });
      }
      reservedSeatCount = values.seatNumbers.length;

      const seatsOutsideCapacity = values.seatNumbers.some((seat) => {
        const match = /^([A-D])(\d+)$/.exec(seat);
        const seatIndex = (Number(match[2]) - 1) * 4 + "ABCD".indexOf(match[1]);
        return seatIndex < 0 || seatIndex >= schedule.totalSeats;
      });
      if (seatsOutsideCapacity) {
        await Schedule.updateOne({ _id: scheduleId }, { $inc: { availableSeats: reservedSeatCount } });
        reservedSeatCount = 0;
        return response.status(400).json({ success: false, message: "One or more selected seats are outside this vehicle's capacity." });
      }

      const now = new Date();
      const accessToken = randomBytes(32).toString("base64url");
      const booking = await Booking.create({
        scheduleId,
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        customerPhone: values.customerPhone,
        operatorName: schedule.operatorId?.name || "Operator unavailable",
        departure: schedule.routeId?.departure || "Location unavailable",
        destination: schedule.routeId?.destination || "Location unavailable",
        transport: schedule.transport,
        departureAt: schedule.departureAt,
        arrivalAt: schedule.arrivalAt,
        farePerSeat: schedule.fare,
        seatNumbers: values.seatNumbers,
        status: "pending",
        paymentStatus: "pending",
        bookedBy: request.user?._id || null,
        expiresAt: new Date(now.getTime() + holdDurationMs),
        publicAccessTokenHash: hashAccessToken(accessToken).toString("hex"),
        ticketCode: ticketCode(),
        tickets: values.seatNumbers.map((seatNumber) => ({
          seatNumber,
          ticketCode: ticketCode(),
          status: "active",
        })),
      });
      reservedSeatCount = 0;
      return response.status(201).json({
        success: true,
        message: "Seats reserved for three minutes. Payment confirmation is pending.",
        data: { booking: { ...publicBookingResponse(booking), accessToken } },
      });
    } catch (error) {
      if (reservedSeatCount && scheduleId) {
        await Schedule.updateOne({ _id: scheduleId }, { $inc: { availableSeats: reservedSeatCount } });
      }
      if (error?.code === 11000) {
        return response.status(409).json({
          success: false,
          message: "One or more selected seats were just reserved. Refresh the seat list and choose again.",
          code: "SEAT_ALREADY_BOOKED",
        });
      }
      return next(error);
    }
  });

  return router;
}
