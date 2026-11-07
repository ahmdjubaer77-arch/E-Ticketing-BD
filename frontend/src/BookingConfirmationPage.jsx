import React, { useState } from "react";
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

function getConfirmedBooking(response) {
  if (!response || typeof response !== "object") return null;
  const booking = response.booking;
  const payment = response.payment;
  if (
    !booking
    || booking.status !== "confirmed"
    || !payment
    || !["paid", "confirmed", "success", "successful"].includes(payment.status)
  ) {
    return null;
  }
  const reference = booking.reference || booking.pnr;
  const amount = Number(payment.amount);
  if (
    typeof reference !== "string"
    || !reference.trim()
    || !Number.isFinite(amount)
    || amount < 0
  ) {
    return null;
  }
  return { booking, payment, reference: reference.trim(), amount };
}

function makeTicketText(draft, confirmation) {
  const { query, schedule, selectedSeats, passengers, contact } = draft;
  const { reference, payment } = confirmation;
  const amount = confirmation.amount;
  const lines = [
    "E-TICKETING — CONFIRMED E-TICKET",
    `Booking reference: ${reference}`,
    `Payment status: ${payment.status}`,
    `Payment reference: ${payment.reference || payment.transactionId || "Not provided"}`,
    `Total paid: BDT ${amount.toLocaleString("en-BD")}`,
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
            <p>YOUR E-TICKET</p>
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
            <span>Total paid<strong>৳ {amount.toLocaleString("en-BD")}</strong></span>
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
  onBackToPayment,
  onBackToHome,
}) {
  const [ticketOpen, setTicketOpen] = useState(false);
  const confirmation = getConfirmedBooking(bookingResponse);

  function downloadTicket() {
    if (!confirmation) return;
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
        <button className="confirmation-back-link" type="button" onClick={onBackToPayment}>
          <ArrowLeft size={17} /> Back to payment
        </button>

        <section className={`confirmation-hero${confirmation ? " confirmed" : " unconfirmed"}`}>
          <span className="confirmation-status-icon">
            {confirmation ? <Check size={26} strokeWidth={2.5} /> : <TriangleAlert size={25} />}
          </span>
          <p className="confirmation-eyebrow">
            {confirmation ? "BOOKING COMPLETE" : "BOOKING STATUS"}
          </p>
          <h1>{confirmation ? "Your Booking is Confirmed!" : "Your booking is not confirmed"}</h1>
          <p>
            {confirmation
              ? "Your journey is all set. Your e-ticket is ready to view or download."
              : "We have not received a confirmed booking or payment response. No ticket has been issued."}
          </p>
          {confirmation ? (
            <div className="confirmation-reference">
              <span>BOOKING REFERENCE / PNR</span>
              <strong>{confirmation.reference}</strong>
            </div>
          ) : (
            <div className="confirmation-unavailable-note" role="status">
              <ShieldCheck size={16} />
              <span>Payment gateway and booking confirmation API are not connected. No payment was attempted.</span>
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
            <div className={`confirmation-payment-status${confirmation ? " is-paid" : " is-unpaid"}`}>
              <span>{confirmation ? "Payment status" : "Payment status"}</span>
              <strong>{confirmation ? confirmation.payment.status : "Not confirmed"}</strong>
            </div>
            <div className="confirmation-total">
              <span>{confirmation ? "Total paid" : "Total payable"}</span>
              <strong>৳ {paidAmount.toLocaleString("en-BD")}</strong>
            </div>
            {!confirmation && <p className="confirmation-summary-note">This is the fare from your booking draft, not a payment receipt.</p>}

            <div className="confirmation-actions">
              <button
                type="button"
                className="confirmation-ticket-button"
                disabled={!confirmation}
                onClick={() => setTicketOpen(true)}
              >
                <Ticket size={16} /> View My Ticket
              </button>
              <button
                type="button"
                className="confirmation-download-button"
                disabled={!confirmation}
                onClick={downloadTicket}
              >
                <Download size={16} /> Download Ticket
              </button>
              {!confirmation && <small>Ticket actions become available after a confirmed booking.</small>}
            </div>
          </aside>
        </div>

        <div className="confirmation-footer">
          <span><ShieldCheck size={15} />{confirmation ? "Payment and booking confirmed by the provider." : "Booking reference and ticket are unavailable until confirmed."}</span>
          <button type="button" onClick={onBackToHome}>Back to Home</button>
        </div>
      </div>
      {ticketOpen && confirmation && (
        <BookingTicket draft={draft} confirmation={confirmation} onClose={() => setTicketOpen(false)} />
      )}
    </main>
  );
}
