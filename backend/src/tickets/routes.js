import { createHash, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import Booking from "../models/Booking.js";
import { createAuthMiddleware } from "../auth/middleware.js";
import { createTicketPdf } from "./ticketPdf.js";

const ticketIdPattern = /^[A-Za-z0-9-]{6,80}$/;

function ticketState(booking, ticket) {
  if (booking.status === "cancelled") return "cancelled";
  if (booking.status === "expired") return "expired";
  if (booking.paymentStatus !== "paid" || !["confirmed", "completed"].includes(booking.status)) return "pending";
  if (ticket.status === "used" || booking.status === "completed") return "used";
  if (new Date(booking.departureAt).getTime() < Date.now()) return "expired";
  return "active";
}

function hasBookingAccess(request, booking) {
  if (request.user?.role === "admin") return true;
  if (request.user && booking.bookedBy && booking.bookedBy.toString() === request.user._id.toString()) return true;
  if (request.user && !booking.bookedBy && booking.customerEmail?.toLowerCase() === request.user.email.toLowerCase()) return true;
  const accessToken = request.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!booking.publicAccessTokenHash || !accessToken || accessToken.length > 200) return false;
  const expectedHash = Buffer.from(booking.publicAccessTokenHash, "hex");
  const suppliedHash = createHash("sha256").update(accessToken).digest();
  return expectedHash.length === suppliedHash.length && timingSafeEqual(expectedHash, suppliedHash);
}

function validTicketState(state) {
  return state === "active";
}

export function createTicketRouter(config) {
  const router = Router();
  const { optionalAuth } = createAuthMiddleware(config);
  const verifyLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({ success: false, message: "Too many ticket verification requests. Try again shortly." }),
  });

  router.get("/verify/:ticketId", verifyLimiter, async (request, response, next) => {
    try {
      const ticketId = request.params.ticketId;
      if (!ticketIdPattern.test(ticketId)) {
        return response.status(400).json({ success: false, message: "Ticket ID is invalid." });
      }
      const booking = await Booking.findOne({ "tickets.ticketCode": ticketId }).select(
        "tickets.ticketCode tickets.seatNumber tickets.status status paymentStatus transport operatorName departure destination departureAt",
      ).lean();
      const ticket = booking?.tickets.find((item) => item.ticketCode === ticketId);
      if (!booking || !ticket) {
        return response.status(404).json({ success: false, message: "Ticket was not found." });
      }
      const status = ticketState(booking, ticket);
      response.set("Cache-Control", "no-store");
      return response.json({
        success: true,
        message: validTicketState(status) ? "Ticket is valid for boarding." : `Ticket status: ${status}.`,
        data: {
          valid: validTicketState(status),
          status,
          ticketId,
          transport: booking.transport,
          operatorName: booking.operatorName,
          departure: booking.departure,
          destination: booking.destination,
          departureAt: booking.departureAt,
          seatNumber: ticket.seatNumber,
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:ticketId/pdf", optionalAuth, async (request, response, next) => {
    try {
      const ticketId = request.params.ticketId;
      if (!ticketIdPattern.test(ticketId)) {
        return response.status(400).json({ success: false, message: "Ticket ID is invalid." });
      }
      const booking = await Booking.findOne({ "tickets.ticketCode": ticketId }).select(
        "_id scheduleId customerName customerPhone customerEmail bookedBy transport operatorName departure destination departureAt arrivalAt status paymentStatus tickets.ticketCode tickets.seatNumber tickets.passengerName tickets.status",
      ).select("+publicAccessTokenHash");
      const ticket = booking?.tickets.find((item) => item.ticketCode === ticketId);
      if (!booking || !ticket) {
        return response.status(404).json({ success: false, message: "Ticket was not found." });
      }
      if (!hasBookingAccess(request, booking)) {
        return response.status(403).json({ success: false, message: "You are not authorized to download this ticket." });
      }
      if (booking.paymentStatus !== "paid" || !["confirmed", "completed"].includes(booking.status)) {
        return response.status(409).json({ success: false, message: "A ticket PDF is available only after payment is confirmed." });
      }
      const verificationUrl = new URL(`/api/tickets/verify/${encodeURIComponent(ticketId)}`, config.clientUrl).toString();
      const pdf = await createTicketPdf({ booking, ticket, verificationUrl });
      response.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="e-ticket-${ticket.seatNumber}-${ticketId}.pdf"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      return response.send(pdf);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:ticketId", optionalAuth, async (request, response, next) => {
    try {
      const ticketId = request.params.ticketId;
      if (!ticketIdPattern.test(ticketId)) {
        return response.status(400).json({ success: false, message: "Ticket ID is invalid." });
      }
      const booking = await Booking.findOne({ "tickets.ticketCode": ticketId }).select(
        "_id scheduleId customerName customerPhone customerEmail bookedBy transport operatorName departure destination departureAt arrivalAt status paymentStatus tickets.ticketCode tickets.seatNumber tickets.passengerName tickets.status",
      ).select("+publicAccessTokenHash").lean();
      const ticket = booking?.tickets.find((item) => item.ticketCode === ticketId);
      if (!booking || !ticket) {
        return response.status(404).json({ success: false, message: "Ticket was not found." });
      }
      if (!hasBookingAccess(request, booking)) {
        return response.status(403).json({ success: false, message: "You are not authorized to view this ticket." });
      }
      const status = ticketState(booking, ticket);
      response.set("Cache-Control", "private, no-store");
      return response.json({
        success: true,
        message: "Ticket retrieved.",
        data: {
          ticketId,
          bookingId: booking._id.toString(),
          tripId: booking.scheduleId.toString(),
          passengerName: ticket.passengerName || booking.customerName,
          passengerPhone: booking.customerPhone || "",
          departure: booking.departure,
          destination: booking.destination,
          transport: booking.transport,
          operatorName: booking.operatorName,
          departureAt: booking.departureAt,
          arrivalAt: booking.arrivalAt,
          seatNumber: ticket.seatNumber,
          status,
          valid: validTicketState(status),
        },
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
