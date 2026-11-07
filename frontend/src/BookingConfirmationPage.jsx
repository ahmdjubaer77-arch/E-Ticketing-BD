import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bus,
  CalendarDays,
  Check,
  Clock3,
  Download,
  Mail,
  MapPin,
  Phone,
  Printer,
  ShieldCheck,
  Ticket,
  TriangleAlert,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { apiRequest } from "./authApi.js";
import "./booking-confirmation.css";

function formatJourneyDate(date) {
  if (!date) return "Date not selected";
  return new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatClock(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function getBookingDetails(response) {
  if (!response || typeof response !== "object") return null;
  const booking = response.booking;
  if (!booking || typeof booking !== "object") return null;
  const payment = response.payment || { status: booking.paymentStatus, amount: booking.totalAmount };
  const reference = booking.reference || booking.pnr || booking.ticketCode;
  const amount = Number(payment.amount ?? booking.totalAmount);
  if (
    typeof reference !== "string"
    || !reference.trim()
    || !Number.isFinite(amount)
    || amount < 0
  ) {
    return null;
  }
  return {
    booking,
    payment,
    reference: reference.trim(),
    amount,
    expiresAt: booking.expiresAt,
    paymentProof: booking.paymentProof || null,
    isPaid: booking.status === "confirmed" && ["paid", "confirmed", "success", "successful"].includes(payment.status),
    isReserved: booking.status === "pending" && payment.status === "pending",
    isExpired: booking.status === "expired" || booking.status === "cancelled",
    isProofRejected: booking.paymentProof?.reviewStatus === "rejected",
  };
}

function makeTicketText(draft, confirmation) {
  const { query, schedule, selectedSeats, passengers, contact } = draft;
  const { reference, payment } = confirmation;
  const amount = confirmation.amount;
  const lines = [
    `E-TICKETING — ${confirmation.isPaid ? "CONFIRMED E-TICKET" : "PENDING SEAT RESERVATION"}`,
    `Booking reference: ${reference}`,
    `Payment status: ${payment.status}`,
    `Payment reference: ${payment.reference || payment.transactionId || "Not provided"}`,
    `${confirmation.isPaid ? "Total paid" : "Total payable"}: BDT ${amount.toLocaleString("en-BD")}`,
    "",
    `Journey: ${query.from} to ${query.to}`,
    `Date: ${formatJourneyDate(query.date)}`,
    `Departure: ${formatClock(schedule.departure)}`,
    `Operator: ${schedule.operator}`,
    `Seats: ${selectedSeats.join(", ")}`,
    "",
    "Passengers:",
    ...passengers.map((passenger) => `${passenger.fullName} — Seat ${passenger.seat}`),
    "",
    `Contact: ${contact.fullName}`,
    `Mobile: ${contact.mobile}`,
    `Email: ${contact.email}`,
  ];
  return lines.join("\r\n");
}

function BookingTicket({ draft, confirmation, onClose }) {
  const { query, schedule, selectedSeats, passengers, contact } = draft;
  const amount = Number(confirmation.payment.amount ?? draft.totalFare);

  return (
    <div className="ticket-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="ticket-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-modal-title">
        <div className="ticket-modal-heading">
          <span className="ticket-modal-icon"><Ticket size={19} /></span>
          <div>
            <p>{confirmation.isPaid ? "YOUR E-TICKET" : "SEAT RESERVATION"}</p>
            <h2 id="ticket-modal-title">Booking {confirmation.reference}</h2>
          </div>
          <button type="button" aria-label="Close ticket" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="ticket-modal-body">
          <div className="ticket-modal-route">
            <strong>{query.from}</strong><span>to</span><strong>{query.to}</strong>
          </div>
          <div className="ticket-modal-details">
            <span>Journey date<strong>{formatJourneyDate(query.date)}</strong></span>
            <span>Departure<strong>{formatClock(schedule.departure)}</strong></span>
            <span>Operator<strong>{schedule.operator}</strong></span>
            <span>Seats<strong>{selectedSeats.join(", ")}</strong></span>
            <span>Payment<strong>{confirmation.payment.status}</strong></span>
            <span>{confirmation.isPaid ? "Total paid" : "Total payable"}<strong>৳ {amount.toLocaleString("en-BD")}</strong></span>
          </div>
          <div className="ticket-modal-passengers">
            <strong>Passengers</strong>
            {passengers.map((passenger) => (
              <span key={passenger.seat}>{passenger.fullName} · Seat {passenger.seat}</span>
            ))}
          </div>
          <div className="ticket-modal-contact">
            <span>{contact.fullName}</span>
            <span>{contact.mobile}</span>
            <span>{contact.email}</span>
          </div>
        </div>
        <button className="ticket-print-button" type="button" onClick={() => window.print()}>
          <Printer size={16} /> Print ticket
        </button>
      </section>
    </div>
  );
}

export default function BookingConfirmationPage({
  draft,
  bookingResponse,
  onBackToHome,
}) {
  const [ticketOpen, setTicketOpen] = useState(false);
  const [liveBooking, setLiveBooking] = useState(bookingResponse?.booking || null);
  const [now, setNow] = useState(Date.now());
  const [statusRefreshError, setStatusRefreshError] = useState("");

  useEffect(() => {
    setLiveBooking(bookingResponse?.booking || null);
  }, [bookingResponse]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const initialBooking = bookingResponse?.booking;
    if (!initialBooking?.id || !initialBooking.accessToken) return undefined;
    let active = true;
    let timer;
    async function refreshStatus() {
      try {
        const { data } = await apiRequest(`/public/bookings/${initialBooking.id}`, {
          headers: { Authorization: `Bearer ${initialBooking.accessToken}` },
        });
        if (active) {
          setLiveBooking((current) => ({ ...data.booking, accessToken: current?.accessToken || initialBooking.accessToken }));
          setStatusRefreshError("");
        }
      } catch (error) {
        if (active) setStatusRefreshError(error.message);
      }
    }
    refreshStatus();
    timer = window.setInterval(refreshStatus, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [bookingResponse]);

  const confirmation = getBookingDetails(liveBooking ? { booking: liveBooking } : bookingResponse);
  const remainingMs = confirmation?.expiresAt
    ? Math.max(0, new Date(confirmation.expiresAt).getTime() - now)
    : null;
  const remainingLabel = remainingMs === null
    ? ""
    : `${Math.floor(remainingMs / 60_000)}:${String(Math.floor(remainingMs % 60_000 / 1000)).padStart(2, "0")}`;

  function downloadTicket() {
    if (!confirmation?.isPaid) return;
    const blob = new Blob([makeTicketText(draft, confirmation)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ticket-${confirmation.reference}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const { query, schedule, selectedSeats, passengers, contact, totalFare } = draft;
  const paidAmount = confirmation?.amount ?? totalFare;

  return (
    <main className="booking-confirmation-page">
      <div className="booking-confirmation-container">
        <button className="confirmation-back-link" type="button" onClick={onBackToHome}>
          <ArrowLeft size={17} /> Back to home
        </button>

        <section className={`confirmation-hero${confirmation?.isPaid ? " confirmed" : " unconfirmed"}`}>
          <span className="confirmation-status-icon">
            {confirmation?.isPaid ? <Check size={26} strokeWidth={2.5} /> : <TriangleAlert size={25} />}
          </span>
          <p className="confirmation-eyebrow">
            {confirmation?.isPaid ? "PAYMENT CONFIRMED" : confirmation?.isReserved ? confirmation.paymentProof ? "PAYMENT PROOF SUBMITTED" : "SEATS RESERVED" : confirmation?.isProofRejected ? "PAYMENT PROOF REJECTED" : "BOOKING STATUS"}
          </p>
          <h1>{confirmation?.isPaid ? "Your Booking is Confirmed!" : confirmation?.isReserved ? "Your payment is under review" : confirmation?.isProofRejected ? "Payment proof was rejected" : confirmation?.isExpired ? "This reservation has expired" : "Your booking is not confirmed"}</h1>
          <p>
            {confirmation?.isPaid
              ? "Your journey is all set. Your e-ticket is ready to view or download."
              : confirmation?.isReserved && confirmation.paymentProof?.reviewStatus === "submitted"
                ? "Your payment proof was submitted within the hold period. Your seats are reserved while an administrator reviews it."
                : confirmation?.isReserved && remainingMs > 0
                  ? `Your seats are held for ${remainingLabel}. Submit payment proof before the timer ends.`
                  : confirmation?.isReserved
                  ? "The hold time has ended. The server is releasing these seats."
                  : confirmation?.isProofRejected
                    ? "The submitted payment proof was rejected. Please contact the ticket office before making another booking."
                  : confirmation?.isExpired
                    ? "This booking is no longer active. Select seats again to make a new reservation."
                    : "We have not received a confirmed booking or payment response."}
          </p>
          {confirmation ? (
            <div className="confirmation-reference">
              <span>{confirmation.isPaid ? "BOOKING REFERENCE" : "RESERVATION REFERENCE"}</span>
              <strong>{confirmation.reference}</strong>
            </div>
          ) : (
            <div className="confirmation-unavailable-note" role="status">
              <ShieldCheck size={16} />
              <span>No online payment was collected. The administrator updates payment status manually.</span>
            </div>
          )}
        </section>

        <div className="confirmation-layout">
          <div className="confirmation-main">
            <section className="confirmation-card" aria-labelledby="confirmation-journey-title">
              <div className="confirmation-card-heading">
                <span><MapPin size={18} /></span>
                <h2 id="confirmation-journey-title">Journey information</h2>
              </div>
              <div className="confirmation-route">
                <div className="confirmation-city">
                  <i className="confirmation-origin-dot" />
                  <span><small>DEPARTURE</small><strong>{query.from}</strong></span>
                </div>
                <span className="confirmation-route-line" />
                <div className="confirmation-city">
                  <i className="confirmation-destination-dot" />
                  <span><small>DESTINATION</small><strong>{query.to}</strong></span>
                </div>
              </div>
              <div className="confirmation-journey-meta">
                <span><CalendarDays size={16} />{formatJourneyDate(query.date)}</span>
                <span><Clock3 size={16} />{formatClock(schedule.departure)}</span>
                <span><Bus size={16} />{schedule.operator}</span>
              </div>
            </section>

            <section className="confirmation-card" aria-labelledby="confirmation-passengers-title">
              <div className="confirmation-card-heading">
                <span><UsersRound size={18} /></span>
                <h2 id="confirmation-passengers-title">Passenger details</h2>
              </div>
              <div className="confirmation-passenger-list">
                {passengers.map((passenger, index) => (
                  <div className="confirmation-passenger" key={passenger.seat}>
                    <span className="confirmation-passenger-avatar"><UserRound size={16} /></span>
                    <span><strong>{passenger.fullName}</strong><small>Passenger {index + 1} · Seat {passenger.seat}</small></span>
                    <b>{passenger.seat}</b>
                  </div>
                ))}
              </div>
              <div className="confirmation-contact">
                <span><UserRound size={14} />{contact.fullName}</span>
                <span><Phone size={14} />{contact.mobile}</span>
                <span><Mail size={14} />{contact.email}</span>
              </div>
            </section>
          </div>

          <aside className="confirmation-summary-card" aria-label="Payment and seat summary">
            <div className="confirmation-summary-heading">
              <div><p>BOOKING SUMMARY</p><h2>Payment details</h2></div>
              <Ticket size={19} />
            </div>
            <div className="confirmation-seats">
              <span>Selected seats <strong>{selectedSeats.length} seat{selectedSeats.length === 1 ? "" : "s"}</strong></span>
              <div>{selectedSeats.map((seat) => <i key={seat}>{seat}</i>)}</div>
            </div>
            <div className={`confirmation-payment-status${confirmation?.isPaid ? " is-paid" : " is-unpaid"}`}>
              <span>{confirmation ? "Payment status" : "Payment status"}</span>
              <strong>{confirmation?.paymentProof?.reviewStatus === "submitted" ? "Proof submitted · under review" : confirmation?.paymentProof?.reviewStatus === "rejected" ? "Proof rejected" : confirmation?.paymentProof?.reviewStatus === "approved" ? "Proof approved" : confirmation ? confirmation.payment.status : "Not confirmed"}</strong>
            </div>
            <div className="confirmation-total">
              <span>{confirmation?.isPaid ? "Total paid" : "Total payable"}</span>
              <strong>৳ {paidAmount.toLocaleString("en-BD")}</strong>
            </div>
            {confirmation?.paymentProof && <p className="confirmation-summary-note">Method: {confirmation.paymentProof.paymentMethodName} · TrxID: {confirmation.paymentProof.transactionId}</p>}
            {confirmation?.isReserved && confirmation.paymentProof?.reviewStatus === "submitted" && <p className="confirmation-summary-note">Your seats are secured while the administrator reviews TrxID {confirmation.paymentProof.transactionId}.</p>}
            {confirmation?.isReserved && !confirmation.paymentProof && remainingMs > 0 && <p className="confirmation-summary-note">Seat hold expires in {remainingLabel}. Keep this page open for live payment status updates.</p>}
            {statusRefreshError && <p className="confirmation-summary-note" role="status">Live status refresh failed: {statusRefreshError}</p>}
            {!confirmation && <p className="confirmation-summary-note">No reservation has been created yet.</p>}

            <div className="confirmation-actions">
              <button
                type="button"
                className="confirmation-ticket-button"
                disabled={!confirmation?.isPaid}
                onClick={() => setTicketOpen(true)}
              >
                <Ticket size={16} /> View My Ticket
              </button>
              <button
                type="button"
                className="confirmation-download-button"
                disabled={!confirmation?.isPaid}
                onClick={downloadTicket}
              >
                <Download size={16} /> Download Ticket
              </button>
              {!confirmation?.isPaid && <small>Tickets become valid after admin marks payment Paid.</small>}
            </div>
          </aside>
        </div>

        <div className="confirmation-footer">
          <span><ShieldCheck size={15} />{confirmation?.isPaid ? "Booking payment confirmed by the admin." : confirmation?.isReserved && confirmation.paymentProof ? "Seats secured; payment proof is awaiting admin review." : confirmation?.isReserved ? "Reserved seats are pending payment proof." : "No active seat reservation."}</span>
          <button type="button" onClick={onBackToHome}>Back to Home</button>
        </div>
      </div>
      {ticketOpen && confirmation && (
        <BookingTicket draft={draft} confirmation={confirmation} onClose={() => setTicketOpen(false)} />
      )}
    </main>
  );
}
