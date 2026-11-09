import nodemailer from "nodemailer";

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

export function createMailer(config) {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });

  async function sendOtp({ email, fullName, otp, purpose }) {
    const reset = purpose === "password-reset";
    const subject = reset ? "Reset your E-Ticketing password" : "Verify your E-Ticketing account";
    const heading = reset ? "Password reset code" : "Verify your email";
    const message = reset
      ? "Use this code to continue resetting your password."
      : "Use this code to verify your email address and activate your account.";
    const safeName = escapeHtml(fullName || "traveller");
    const html = `<!doctype html>
<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f7f8f5;font-family:Arial,sans-serif;color:#17211e">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f8f5;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fff;border:1px solid #e5e9e6;border-radius:16px;overflow:hidden">
        <tr><td style="padding:22px 26px;background:#064e3b;color:#fff;font-size:19px;font-weight:bold">E-Ticketing</td></tr>
        <tr><td style="padding:28px 26px 10px">
          <p style="margin:0 0 8px;color:#047857;font-size:12px;font-weight:bold;letter-spacing:1px">SECURE ACCOUNT ACCESS</p>
          <h1 style="margin:0 0 12px;font-size:23px;line-height:1.3">${heading}</h1>
          <p style="margin:0;color:#58655e;font-size:15px;line-height:1.6">Hello ${safeName}, ${message}</p>
        </td></tr>
        <tr><td align="center" style="padding:20px 26px">
          <div style="display:inline-block;padding:15px 25px;border:1px dashed #b6d7c3;border-radius:10px;background:#f5faf6;color:#064e3b;font-size:30px;font-weight:bold;letter-spacing:8px">${otp}</div>
          <p style="margin:12px 0 0;color:#66716c;font-size:13px">This code expires in 5 minutes.</p>
        </td></tr>
        <tr><td style="padding:8px 26px 26px">
          <p style="margin:0;padding:13px;border-radius:9px;background:#fff8e9;color:#72531c;font-size:12px;line-height:1.55"><strong>Security notice:</strong> Never share this code. E-Ticketing support will never ask you for your OTP.</p>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;color:#89948d;font-size:11px">If you did not request this, you can safely ignore this email.</p>
    </td></tr>
  </table>
</body></html>`;

    await transporter.sendMail({
      from: { name: config.smtpFromName, address: config.smtpFromEmail },
      to: email,
      subject,
      text: `Hello ${fullName || "traveller"}. ${message} Your one-time code is ${otp}. It expires in 5 minutes. Never share this code.`,
      html,
    });
  }

  async function sendBookingConfirmation({ booking, ticketCodes }) {
    const safe = (value) => escapeHtml(String(value ?? ""));
    const seats = booking.seatNumbers.map(safe).join(", ");
    const codes = ticketCodes.map(safe).join(", ");
    const journeyDate = new Intl.DateTimeFormat("en-BD", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Dhaka",
    }).format(new Date(booking.departureAt));
    const route = `${safe(booking.departure)} to ${safe(booking.destination)}`;
    const result = await transporter.sendMail({
      from: { name: config.smtpFromName, address: config.smtpFromEmail },
      to: booking.customerEmail,
      subject: "Your E-Ticket Booking Is Confirmed!",
      text: `Hello ${booking.customerName || "traveller"}. Your booking ${booking._id} from ${booking.departure} to ${booking.destination} is confirmed. Journey: ${journeyDate}. Seats: ${booking.seatNumbers.join(", ")}. Ticket IDs: ${ticketCodes.join(", ")}. Total fare: ${booking.farePerSeat * booking.seatNumbers.length}.`,
      html: `<!doctype html><html lang="en"><body style="margin:0;background:#f7f8f5;font-family:Arial,sans-serif;color:#17211e"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e5e9e6;border-radius:14px"><tr><td style="padding:22px 26px;background:#064e3b;color:#fff;font-size:19px;font-weight:bold">E-Ticketing</td></tr><tr><td style="padding:26px"><h1 style="margin:0 0 10px;font-size:22px">Booking confirmed</h1><p>Hello ${safe(booking.customerName || "traveller")}, your payment was approved and your ticket is ready.</p><p><strong>Booking ID:</strong> ${safe(booking._id)}<br><strong>Journey:</strong> ${route}<br><strong>Date:</strong> ${safe(journeyDate)}<br><strong>Departure:</strong> ${safe(booking.operatorName)} · ${safe(booking.transport)}<br><strong>Seats:</strong> ${seats}<br><strong>Total fare:</strong> ৳${safe(booking.farePerSeat * booking.seatNumbers.length)}<br><strong>Ticket ID${ticketCodes.length === 1 ? "" : "s"}:</strong> ${codes}</p></td></tr></table></td></tr></table></body></html>`,
    });
    if (!result.accepted?.length || result.rejected?.length) {
      const error = new Error("The SMTP server did not accept the booking recipient.");
      error.code = "SMTP_RECIPIENT_REJECTED";
      throw error;
    }
    return { accepted: result.accepted };
  }

  async function sendSupportRequest({ name, email, bookingReference, topic, message }) {
    const safe = (value) => escapeHtml(String(value ?? ""));
    await transporter.sendMail({
      from: { name: config.smtpFromName, address: config.smtpFromEmail },
      to: config.supportEmail || config.smtpUser,
      replyTo: { name, address: email },
      subject: `[Support] ${topic}${bookingReference ? ` · ${bookingReference}` : ""}`,
      text: `Support request from ${name} <${email}>\nTopic: ${topic}\nBooking reference: ${bookingReference || "Not provided"}\n\n${message}`,
      html: `<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;color:#17211e"><h2>New support request</h2><p><strong>From:</strong> ${safe(name)} &lt;${safe(email)}&gt;</p><p><strong>Topic:</strong> ${safe(topic)}<br><strong>Booking reference:</strong> ${safe(bookingReference || "Not provided")}</p><p style="white-space:pre-wrap">${safe(message)}</p></body></html>`,
    });
  }

  return { sendOtp, sendBookingConfirmation, sendSupportRequest, verify: () => transporter.verify() };
}
