import { randomBytes } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Schedule from "../models/Schedule.js";
import { expirePendingBookings } from "../bookings/expiration.js";

const validSeatLabel = /^[A-D]\d{1,3}$/;
const activeBookingStatuses = ["pending", "confirmed"];

export function parseAdminBookingInput(body) {
  const errors = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { errors: { body: "A JSON object is required." }, values: {} };
  }

  const allowedFields = new Set(["scheduleId", "customerName", "customerEmail", "customerPhone", "seatNumbers"]);
  const unsupported = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unsupported.length) errors.body = `Unsupported fields: ${unsupported.join(", ")}.`;

  const values = {
    scheduleId: typeof body.scheduleId === "string" ? body.scheduleId : "",
    customerName: typeof body.customerName === "string" ? body.customerName.trim().replace(/\s+/g, " ") : "",
    customerEmail: typeof body.customerEmail === "string" ? body.customerEmail.trim().toLowerCase() : "",
    customerPhone: typeof body.customerPhone === "string" ? body.customerPhone.trim() : "",
    seatNumbers: body.seatNumbers,
  };
  if (!mongoose.isObjectIdOrHexString(values.scheduleId)) errors.scheduleId = "Choose a valid schedule.";
  if (values.customerName.length < 2 || values.customerName.length > 100) {
    errors.customerName = "Customer name must be between 2 and 100 characters.";
  }
  if (values.customerEmail.length > 254 || (values.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.customerEmail))) {
    errors.customerEmail = "Enter a valid email address.";
  }
  if (values.customerPhone.length > 24 || (values.customerPhone && !/^\+?[0-9\s()-]{7,24}$/.test(values.customerPhone))) {
    errors.customerPhone = "Enter a valid phone number.";
  }
  if (!Array.isArray(values.seatNumbers) || values.seatNumbers.length < 1 || values.seatNumbers.length > 10) {
    errors.seatNumbers = "Choose between 1 and 10 seats.";
  } else if (
    values.seatNumbers.some((seat) => typeof seat !== "string" || !validSeatLabel.test(seat))
    || new Set(values.seatNumbers).size !== values.seatNumbers.length
  ) {
    errors.seatNumbers = "Seats must be unique valid seat labels.";
  }
  return { errors, values };
}

function bookingResponse(booking) {
  const passengers = booking.seatNumbers.length;
  const baseFare = booking.farePerSeat * passengers;
  return {
    id: booking._id.toString(),
    scheduleId: booking.scheduleId.toString(),
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone,
    operatorName: booking.operatorName,
    departure: booking.departure,
    destination: booking.destination,
    transport: booking.transport,
    departureAt: booking.departureAt,
    arrivalAt: booking.arrivalAt,
    passengers,
    seatNumbers: booking.seatNumbers,
    baseFare,
    serviceFee: 0,
    discount: 0,
    totalAmount: baseFare,
    paymentStatus: booking.paymentStatus,
    paymentProof: booking.paymentProof ? {
      paymentMethodName: booking.paymentProof.paymentMethodName,
      accountNumber: booking.paymentProof.accountNumber,
      transactionId: booking.paymentProof.transactionId,
      submittedAt: booking.paymentProof.submittedAt,
      reviewStatus: booking.paymentProof.reviewStatus,
      hasImage: Boolean(booking.paymentProof.imageContentType),
    } : null,
    status: booking.status,
    expiresAt: booking.expiresAt,
    bookedAt: booking.createdAt,
    ticketCode: booking.ticketCode,
  };
}

function makeTicketCode() {
  return `ET${randomBytes(10).toString("hex").toUpperCase()}`;
}

function ticketStatus(booking, seatNumber) {
  if (booking.status === "cancelled") return "cancelled";
  if (booking.status === "expired") return "expired";
  if (booking.paymentStatus !== "paid") return "pending";
  if (booking.status === "completed") return "used";
  if (booking.status === "pending") return "pending";
  const savedTicket = booking.tickets?.find((ticket) => ticket.seatNumber === seatNumber);
  if (savedTicket?.status === "used") return "used";
  if (new Date(booking.departureAt).getTime() < Date.now()) return "expired";
  return "active";
}

export function ticketsForBooking(booking) {
  return booking.seatNumbers.map((seatNumber, passengerIndex) => {
    const savedTicket = booking.tickets?.find((ticket) => ticket.seatNumber === seatNumber);
    const ticketCode = savedTicket?.ticketCode || `${booking.ticketCode}-${seatNumber}`;
    return {
      id: ticketCode,
      bookingId: booking._id.toString(),
      passengerIndex,
      passengerCount: booking.seatNumbers.length,
      passengerName: booking.seatNumbers.length > 1
        ? `${booking.customerName} · Passenger ${passengerIndex + 1}`
        : booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      transport: booking.transport,
      operatorId: booking.operatorName,
      operatorName: booking.operatorName,
      departure: booking.departure,
      destination: booking.destination,
      departureAt: booking.departureAt,
      arrivalAt: booking.arrivalAt,
      seatNumber,
      ticketPrice: booking.farePerSeat,
      paymentStatus: booking.paymentStatus,
      status: ticketStatus(booking, seatNumber),
      ticketCode,
    };
  });
}

function ensureTicketRecords(booking) {
  if (booking.tickets.length) return;
  booking.tickets = booking.seatNumbers.map((seatNumber) => ({
    seatNumber,
    ticketCode: `${booking.ticketCode}-${seatNumber}`,
    status: "active",
  }));
}

export function createAdminBookingsRouter() {
  const router = Router();

  router.get("/", async (_request, response, next) => {
    try {
      await expirePendingBookings();
      const bookings = await Booking.find().sort({ createdAt: -1, _id: -1 }).limit(500).lean();
      return response.json({
        success: true,
        message: "Bookings retrieved.",
        data: { bookings: bookings.map(bookingResponse) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/tickets", async (_request, response, next) => {
    try {
      await expirePendingBookings();
      const bookings = await Booking.find().sort({ departureAt: 1, _id: 1 }).limit(500).lean();
      return response.json({
        success: true,
        message: "Tickets retrieved.",
        data: { tickets: bookings.flatMap(ticketsForBooking) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id/payment-proof-image", async (request, response, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(request.params.id)) {
        return response.status(400).json({ success: false, message: "Booking ID must be a valid MongoDB ObjectId." });
      }
      const booking = await Booking.findById(request.params.id).select("+paymentProof.imageData");
      if (!booking?.paymentProof?.imageData || !booking.paymentProof.imageContentType) {
        return response.status(404).json({ success: false, message: "Payment screenshot not found." });
      }
      response.set("Cache-Control", "private, no-store");
      response.set("X-Content-Type-Options", "nosniff");
      return response.type(booking.paymentProof.imageContentType).send(booking.paymentProof.imageData);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/schedules/:id/seats", async (request, response, next) => {
    try {
      await expirePendingBookings();
      if (!mongoose.isObjectIdOrHexString(request.params.id)) {
        return response.status(400).json({ success: false, message: "Schedule ID must be a valid MongoDB ObjectId." });
      }
      const schedule = await Schedule.findOne({
        _id: request.params.id,
        deletedAt: null,
        status: { $in: ["scheduled", "active"] },
        departureAt: { $gt: new Date() },
      })
        .select("operatorId vehicleId routeId transport departureAt arrivalAt totalSeats availableSeats fare")
        .populate({ path: "operatorId", select: "name" })
        .populate({ path: "vehicleId", select: "name" })
        .populate({ path: "routeId", select: "departure destination" })
        .lean();
      if (!schedule) return response.status(404).json({ success: false, message: "Upcoming schedule not found." });

      const bookings = await Booking.find({
        scheduleId: schedule._id,
        status: { $in: activeBookingStatuses },
      }).select("seatNumbers").lean();
      const bookedSeats = [...new Set(bookings.flatMap((booking) => booking.seatNumbers))];
      return response.json({
        success: true,
        message: "Schedule seats retrieved.",
        data: {
          schedule: {
            id: schedule._id.toString(),
            operatorName: schedule.operatorId?.name || "Operator unavailable",
            departure: schedule.routeId?.departure || "Location unavailable",
            destination: schedule.routeId?.destination || "Location unavailable",
            transport: schedule.transport,
            departureAt: schedule.departureAt,
            arrivalAt: schedule.arrivalAt,
            totalSeats: schedule.totalSeats,
            availableSeats: schedule.availableSeats,
            fare: schedule.fare,
          },
          bookedSeats,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    let reservedSeatCount = 0;
    let scheduleId;
    try {
      await expirePendingBookings();
      const { errors, values } = parseAdminBookingInput(request.body);
      if (Object.keys(errors).length) {
        return response.status(400).json({ success: false, message: "Please correct the booking details.", errors });
      }

      scheduleId = values.scheduleId;
      const schedule = await Schedule.findOneAndUpdate(
        {
          _id: scheduleId,
          deletedAt: null,
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
        const index = (Number(match[2]) - 1) * 4 + "ABCD".indexOf(match[1]);
        return index < 0 || index >= schedule.totalSeats;
      });
      if (seatsOutsideCapacity) {
        await Schedule.updateOne({ _id: scheduleId }, { $inc: { availableSeats: reservedSeatCount } });
        reservedSeatCount = 0;
        return response.status(400).json({ success: false, message: "One or more selected seats are outside this vehicle's capacity." });
      }

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
        status: "confirmed",
        paymentStatus: "pending",
        bookedBy: request.user.id,
        ticketCode: makeTicketCode(),
        tickets: values.seatNumbers.map((seatNumber) => ({
          seatNumber,
          ticketCode: makeTicketCode(),
          status: "active",
        })),
      });
      reservedSeatCount = 0;
      return response.status(201).json({
        success: true,
        message: "Seats booked successfully. Payment is pending.",
        data: { booking: bookingResponse(booking) },
      });
    } catch (error) {
      if (reservedSeatCount && scheduleId) {
        await Schedule.updateOne({ _id: scheduleId }, { $inc: { availableSeats: reservedSeatCount } });
      }
      if (error?.code === 11000) {
        return response.status(409).json({
          success: false,
          message: "One or more selected seats were just booked. Refresh the seat list and choose again.",
          code: "SEAT_ALREADY_BOOKED",
        });
      }
      return next(error);
    }
  });

  router.patch("/:id/cancel", async (request, response, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(request.params.id)) {
        return response.status(400).json({ success: false, message: "Booking ID must be a valid MongoDB ObjectId." });
      }
      const booking = await Booking.findOneAndUpdate(
        { _id: request.params.id, status: { $in: activeBookingStatuses } },
        { $set: { status: "cancelled" } },
        { new: true },
      );
      if (!booking) return response.status(404).json({ success: false, message: "Active booking not found." });

      const updatedSchedule = await Schedule.updateOne(
        { _id: booking.scheduleId, deletedAt: null },
        { $inc: { availableSeats: booking.seatNumbers.length } },
      );
      if (updatedSchedule.matchedCount !== 1) {
        return response.status(409).json({ success: false, message: "Booking was cancelled, but its schedule could not be updated." });
      }
      return response.json({
        success: true,
        message: "Booking cancelled and seats released.",
        data: { booking: bookingResponse(booking) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:id/confirm", async (request, response, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(request.params.id)) {
        return response.status(400).json({ success: false, message: "Booking ID must be a valid MongoDB ObjectId." });
      }
      const booking = await Booking.findOneAndUpdate(
        { _id: request.params.id, status: "pending" },
        { $set: { status: "confirmed" } },
        { new: true },
      );
      if (!booking) return response.status(404).json({ success: false, message: "Pending booking not found." });
      return response.json({
        success: true,
        message: "Booking confirmed.",
        data: { booking: bookingResponse(booking) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:id/payment-status", async (request, response, next) => {
    try {
      await expirePendingBookings();
      if (!mongoose.isObjectIdOrHexString(request.params.id)) {
        return response.status(400).json({ success: false, message: "Booking ID must be a valid MongoDB ObjectId." });
      }
      const { paymentStatus } = request.body || {};
      if (Object.keys(request.body || {}).some((key) => key !== "paymentStatus")) {
        return response.status(400).json({ success: false, message: "Only paymentStatus can be updated." });
      }
      if (!["pending", "paid", "failed", "refunded"].includes(paymentStatus)) {
        return response.status(400).json({
          success: false,
          message: "Payment status must be pending, paid, failed, or refunded.",
          errors: { paymentStatus: "Choose a valid payment status." },
        });
      }
      const now = new Date();
      const releasesSeats = paymentStatus === "failed" || paymentStatus === "refunded";
      const booking = await Booking.findOneAndUpdate(
        { _id: request.params.id, status: { $in: activeBookingStatuses } },
        {
          $set: {
            paymentStatus,
            status: paymentStatus === "paid" ? "confirmed" : releasesSeats ? "cancelled" : "pending",
            expiresAt: paymentStatus === "paid" || releasesSeats ? null : new Date(now.getTime() + 3 * 60 * 1000),
          },
        },
        { new: true },
      );
      if (!booking) {
        return response.status(404).json({ success: false, message: "Active booking not found. It may have expired or already been cancelled." });
      }
      if (booking.paymentProof && paymentStatus !== "pending") {
        booking.paymentProof.reviewStatus = paymentStatus === "paid" ? "approved" : "rejected";
        await booking.save();
      }
      if (releasesSeats) {
        const updatedSchedule = await Schedule.updateOne(
          { _id: booking.scheduleId, deletedAt: null },
          { $inc: { availableSeats: booking.seatNumbers.length } },
        );
        if (updatedSchedule.matchedCount !== 1) {
          return response.status(409).json({ success: false, message: "Payment status changed, but the schedule seat count could not be updated." });
        }
      }
      return response.json({
        success: true,
        message: releasesSeats
          ? `Payment marked ${paymentStatus}; booking cancelled and seats released.`
          : `Payment status updated to ${paymentStatus}.`,
        data: { booking: bookingResponse(booking) },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.patch("/:id/tickets/:ticketCode/verify", async (request, response, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(request.params.id)) {
        return response.status(400).json({ success: false, message: "Booking ID must be a valid MongoDB ObjectId." });
      }
      const booking = await Booking.findOne({
        _id: request.params.id,
        status: { $in: activeBookingStatuses },
      });
      if (!booking) return response.status(404).json({ success: false, message: "Active booking not found." });
      if (booking.paymentStatus !== "paid") {
        return response.status(409).json({ success: false, message: "Payment must be marked Paid before verifying this ticket." });
      }
      if (booking.departureAt.getTime() < Date.now()) {
        return response.status(409).json({ success: false, message: "This ticket has expired and cannot be verified." });
      }

      ensureTicketRecords(booking);
      const ticket = booking.tickets.find((item) => item.ticketCode === request.params.ticketCode);
      if (!ticket) return response.status(404).json({ success: false, message: "Ticket code not found for this booking." });
      if (ticket.status === "used") {
        return response.status(409).json({ success: false, message: "This ticket has already been verified." });
      }

      const updatedBooking = await Booking.findOneAndUpdate(
        {
          _id: booking._id,
          status: { $in: activeBookingStatuses },
          tickets: { $elemMatch: { ticketCode: ticket.ticketCode, status: "active" } },
        },
        { $set: { "tickets.$.status": "used" } },
        { new: true },
      );
      if (!updatedBooking) {
        return response.status(409).json({ success: false, message: "This ticket has already been verified." });
      }
      return response.json({
        success: true,
        message: "Ticket verified and marked as used.",
        data: { ticket: ticketsForBooking(updatedBooking).find((item) => item.id === ticket.ticketCode) },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
