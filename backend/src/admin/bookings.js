import { randomBytes } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import QRCode from "qrcode";
import Booking from "../models/Booking.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
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
  const seatNumbers = Array.isArray(booking.seatNumbers) ? booking.seatNumbers : [];
  const tickets = Array.isArray(booking.tickets) ? booking.tickets : [];
  const passengers = seatNumbers.length;
  const baseFare = booking.farePerSeat * passengers;
  const ticketPassengers = seatNumbers.map((seatNumber) => {
    const ticket = tickets.find((item) => item.seatNumber === seatNumber);
    return {
      seatNumber,
      passengerName: ticket?.passengerName || booking.customerName,
      ticketCode: ticket?.ticketCode || `${booking.ticketCode}-${seatNumber}`,
    };
  });
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
    seatNumbers,
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
    ticketCodes: ticketPassengers.map((ticket) => ticket.ticketCode),
    ticketPassengers,
    ticketGenerationStatus: tickets.length >= passengers ? "generated" : "pending",
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildPassengerSearchQuery(value) {
  const search = typeof value === "string" ? value.trim() : "";
  if (search.length < 3 || search.length > 254) return null;
  const exactPattern = escapeRegex(search);
  const alternatives = [
    { ticketCode: { $regex: exactPattern, $options: "i" } },
    { "tickets.ticketCode": { $regex: exactPattern, $options: "i" } },
  ];
  if (search.includes("@")) {
    alternatives.push({ customerEmail: { $regex: escapeRegex(search), $options: "i" } });
  } else {
    alternatives.push({ customerEmail: { $regex: exactPattern, $options: "i" } });
  }
  const digits = search.replace(/\D/g, "");
  if (digits.length >= 3) {
    const phoneVariants = new Set([digits]);
    if (digits.startsWith("0") && digits.length === 11) {
      phoneVariants.add(`880${digits.slice(1)}`);
      phoneVariants.add(digits.slice(1));
    }
    if (digits.startsWith("880") && digits.length >= 12) phoneVariants.add(`0${digits.slice(3)}`);
    for (const variant of phoneVariants) {
      const phonePattern = variant.split("").map(escapeRegex).join("\\D*");
      alternatives.push({ customerPhone: { $regex: phonePattern } });
    }
  }
  return { $or: alternatives };
}

function makeTicketCode() {
  return `ET${randomBytes(10).toString("hex").toUpperCase()}`;
}

function ticketVerificationUrl(config, ticketCode) {
  const path = `/api/tickets/verify/${encodeURIComponent(ticketCode)}`;
  return config?.clientUrl ? new URL(path, config.clientUrl).toString() : path;
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
      passengerName: savedTicket?.passengerName || booking.customerName,
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
      qrCode: savedTicket?.qrCode || "",
    };
  });
}

async function ensureTicketRecords(booking, config) {
  const existingSeats = new Set(booking.tickets.map((ticket) => ticket.seatNumber));
  for (const seatNumber of booking.seatNumbers) {
    if (!existingSeats.has(seatNumber)) {
      booking.tickets.push({
        seatNumber,
        passengerName: booking.customerName,
        ticketCode: `${booking.ticketCode}-${seatNumber}`,
        status: "active",
      });
    }
  }
  for (const ticket of booking.tickets) {
    ticket.qrCode = await QRCode.toDataURL(ticketVerificationUrl(config, ticket.ticketCode), {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 220,
    });
  }
}

export function createAdminBookingsRouter({ mailer, config } = {}) {
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
      const tickets = bookings.flatMap(ticketsForBooking);
      await Promise.all(tickets.map(async (ticket) => {
        ticket.qrCode = await QRCode.toDataURL(ticketVerificationUrl(config, ticket.ticketCode), { errorCorrectionLevel: "H", margin: 1, width: 220 });
      }));
      return response.json({
        success: true,
        message: "Tickets retrieved.",
        data: { tickets },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/passenger-search", async (request, response, next) => {
    try {
      const searchQuery = buildPassengerSearchQuery(request.query.q);
      if (!searchQuery) {
        return response.status(400).json({ success: false, message: "Enter at least 3 characters to search by ticket ID, mobile number, or email." });
      }
      await expirePendingBookings();
      const bookings = await Booking.find(searchQuery).sort({ createdAt: -1, _id: -1 }).limit(50).lean();
      return response.json({
        success: true,
        message: bookings.length ? "Passenger matches found." : "No passengers matched your search.",
        data: { bookings: bookings.map(bookingResponse) },
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

      const customerAccount = values.customerEmail
        ? await User.findOne({ email: values.customerEmail, role: "user", isActive: true, isEmailVerified: true }).select("_id").lean()
        : null;

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
        bookedBy: customerAccount?._id || null,
        ticketCode: makeTicketCode(),
        tickets: values.seatNumbers.map((seatNumber) => ({
          seatNumber,
          passengerName: values.customerName,
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

  router.post("/:id/confirmation-email", async (request, response, next) => {
    try {
      if (!mongoose.isObjectIdOrHexString(request.params.id)) {
        return response.status(400).json({ success: false, message: "Booking ID must be a valid MongoDB ObjectId." });
      }
      const booking = await Booking.findOne({
        _id: request.params.id,
        status: { $in: ["confirmed", "completed"] },
        paymentStatus: "paid",
      });
      if (!booking) return response.status(409).json({ success: false, message: "Only paid, confirmed bookings can receive a confirmation email." });
      if (!booking.customerEmail) return response.status(409).json({ success: false, message: "This booking has no customer email address." });
      if (!mailer?.sendBookingConfirmation) return response.status(503).json({ success: false, message: "Email service is not configured." });
      await ensureTicketRecords(booking, config);
      try {
        await mailer.sendBookingConfirmation({
          booking,
          ticketCodes: booking.tickets.map((ticket) => ticket.ticketCode),
        });
      } catch (error) {
        console.error(`Booking confirmation resend failed (${error.code || "SMTP_ERROR"}).`);
        return response.status(502).json({ success: false, message: "Gmail did not accept the confirmation email. Check the SMTP credentials and retry." });
      }
      return response.json({ success: true, message: "Confirmation email accepted by Gmail SMTP.", data: { emailDeliveryStatus: "accepted" } });
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
      let booking;
      if (paymentStatus === "paid") {
        // Prepare ticket rows before changing payment state. Ticket rows are
        // embedded in Booking, so this conditional write commits both in one
        // MongoDB document update and only one concurrent approval can win.
        const current = await Booking.findOne({ _id: request.params.id, status: { $in: activeBookingStatuses } });
        if (!current) {
          return response.status(404).json({ success: false, message: "Active booking not found. It may have expired or already been cancelled." });
        }
        if (current.paymentStatus !== "pending") {
          return response.status(409).json({ success: false, message: "This payment has already been reviewed." });
        }
        if (current.paymentProof && current.paymentProof.reviewStatus !== "submitted") {
          return response.status(409).json({ success: false, message: "This payment proof has already been reviewed." });
        }
        await ensureTicketRecords(current, config);
        const update = {
          $set: {
            paymentStatus: "paid",
            status: "confirmed",
            expiresAt: null,
            tickets: current.tickets,
          },
        };
        if (current.paymentProof) update.$set["paymentProof.reviewStatus"] = "approved";
        booking = await Booking.findOneAndUpdate(
          { _id: current._id, status: { $in: activeBookingStatuses }, paymentStatus: "pending" },
          update,
          { new: true, runValidators: true },
        );
        if (!booking) {
          return response.status(409).json({ success: false, message: "This payment was updated by another administrator. Refresh the booking." });
        }
        const notificationOwner = booking.bookedBy
          ? await User.findOne({ _id: booking.bookedBy, role: "user", isActive: true }).select("_id").lean()
          : null;
        const emailOwner = !notificationOwner && booking.customerEmail
          ? await User.findOne({ email: booking.customerEmail, role: "user", isActive: true, isEmailVerified: true }).select("_id").lean()
          : null;
        const notificationUserId = notificationOwner?._id || emailOwner?._id;
        if (notificationUserId) {
          try {
            await Notification.create({
              userId: notificationUserId,
              category: "ticket",
              title: "Payment approved and ticket issued",
              message: `Your booking from ${booking.departure} to ${booking.destination} is confirmed. Ticket${booking.tickets.length === 1 ? "" : "s"} ${booking.tickets.map((ticket) => ticket.ticketCode).join(", ")} ${booking.tickets.length === 1 ? "is" : "are"} ready.`,
              metadata: { bookingId: booking._id.toString(), ticketCodes: booking.tickets.map((ticket) => ticket.ticketCode) },
            });
          } catch {
            console.error("A booking approval notification could not be recorded.");
          }
        }
        let emailDeliveryStatus = booking.customerEmail ? "failed" : "no-recipient";
        if (booking.customerEmail && mailer?.sendBookingConfirmation) {
          try {
            await mailer.sendBookingConfirmation({
              booking,
              ticketCodes: booking.tickets.map((ticket) => ticket.ticketCode),
            });
            emailDeliveryStatus = "accepted";
          } catch (error) {
            console.error(`Booking confirmation email failed (${error.code || "SMTP_ERROR"}).`);
          }
        }
        booking.$locals.emailDeliveryStatus = emailDeliveryStatus;
      } else {
        booking = await Booking.findOneAndUpdate(
          { _id: request.params.id, status: { $in: activeBookingStatuses }, paymentStatus: { $ne: "paid" } },
          {
            $set: {
              paymentStatus,
              status: releasesSeats ? "cancelled" : "pending",
              expiresAt: releasesSeats ? null : new Date(now.getTime() + 3 * 60 * 1000),
            },
          },
          { new: true },
        );
      }
      if (!booking) {
        return response.status(404).json({ success: false, message: "Active booking not found. It may have expired, already been reviewed, or already been cancelled." });
      }
      if (booking.paymentProof && paymentStatus !== "pending" && paymentStatus !== "paid") {
        booking.paymentProof.reviewStatus = "rejected";
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
        message: paymentStatus === "paid"
          ? "Payment approved, booking confirmed, and tickets issued."
          : releasesSeats
          ? `Payment marked ${paymentStatus}; booking cancelled and seats released.`
          : `Payment status updated to ${paymentStatus}.`,
        data: {
          booking: bookingResponse(booking),
          ...(paymentStatus === "paid" ? { emailDeliveryStatus: booking.$locals.emailDeliveryStatus || (booking.customerEmail ? "failed" : "no-recipient") } : {}),
        },
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

      await ensureTicketRecords(booking, config);
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
