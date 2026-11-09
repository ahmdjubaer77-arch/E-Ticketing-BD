import { Router } from "express";
import { rateLimit } from "express-rate-limit";

const topics = new Set(["Booking help", "Payment issue", "Ticket or QR code", "Change or cancellation", "Account help", "Other"]);

export function parseSupportRequest(input) {
  const errors = {};
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const allowed = new Set(["name", "email", "bookingReference", "topic", "message"]);
  const unsupported = Object.keys(body).filter((key) => !allowed.has(key));
  if (unsupported.length) errors.body = "The request contains unsupported fields.";

  const rawName = typeof body.name === "string" ? body.name : "";
  const rawBookingReference = typeof body.bookingReference === "string" ? body.bookingReference : "";
  const name = rawName.trim().replace(/\s+/g, " ");
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const bookingReference = rawBookingReference.trim();
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (name.length < 2 || name.length > 80 || /[\u0000-\u001f\u007f]/.test(rawName)) errors.name = "Enter a name between 2 and 80 characters.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (bookingReference.length > 80 || /[\u0000-\u001f\u007f]/.test(rawBookingReference)) errors.bookingReference = "Booking reference must be 80 characters or fewer.";
  if (!topics.has(topic)) errors.topic = "Choose a valid support topic.";
  if (message.length < 10 || message.length > 2000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(message)) errors.message = "Message must be between 10 and 2,000 characters.";

  return { errors, values: { name, email, bookingReference, topic, message } };
}

export function createPublicSupportRouter({ mailer }) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 4,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Too many support requests. Please try again later." },
  });

  router.post("/", limiter, async (request, response, next) => {
    const { errors, values } = parseSupportRequest(request.body);
    if (Object.keys(errors).length) {
      return response.status(400).json({ success: false, message: "Please check the support request details.", errors });
    }
    try {
      await mailer.sendSupportRequest(values);
      return response.status(202).json({ success: true, message: "Your support request was sent. Our team will reply by email." });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
