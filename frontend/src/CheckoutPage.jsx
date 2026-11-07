import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  CalendarDays,
  Check,
  Clock3,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Ticket,
  UserRound,
  UsersRound,
} from "lucide-react";
import "./checkout.css";

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

function SummaryCard({ draft, onEditSeats }) {
  const { query, schedule, selectedSeats, totalFare } = draft;

  return (
    <aside className="checkout-order-card" aria-label="Order summary">
      <div className="checkout-order-heading">
        <div>
          <p>YOUR ORDER</p>
          <h2>Booking summary</h2>
        </div>
        <span><Ticket size={19} /></span>
      </div>

      <div className="checkout-order-route">
        <div className="checkout-order-city">
          <i className="origin-dot" />
          <div><small>DEPARTURE</small><strong>{query.from}</strong></div>
        </div>
        <span className="checkout-route-connector" />
        <div className="checkout-order-city">
          <i className="destination-dot" />
          <div><small>DESTINATION</small><strong>{query.to}</strong></div>
        </div>
      </div>

      <div className="checkout-order-details">
        <span><CalendarDays size={16} />{formatJourneyDate(query.date)}</span>
        <span><Clock3 size={16} />Departure at {formatClock(schedule.departure)}</span>
        <span><Bus size={16} />{schedule.operator}</span>
      </div>

      <div className="checkout-seat-summary">
        <div className="checkout-seat-heading">
          <span>Selected seats</span>
          <strong>{selectedSeats.length} seat{selectedSeats.length === 1 ? "" : "s"}</strong>
        </div>
        <div className="checkout-seat-chips">
          {selectedSeats.map((seat) => <span key={seat}>{seat}</span>)}
        </div>
        <button type="button" className="checkout-edit-link" onClick={onEditSeats}>
          <Pencil size={13} /> Edit seats
        </button>
      </div>

      <div className="checkout-price-breakdown">
        <div className="checkout-price-line">
          <span>Ticket price <small>৳ {schedule.fare.toLocaleString("en-BD")} × {selectedSeats.length}</small></span>
          <strong>৳ {totalFare.toLocaleString("en-BD")}</strong>
        </div>
        <div className="checkout-price-line">
          <span>Service charge <small>Not configured</small></span>
          <strong>৳ 0</strong>
        </div>
        <div className="checkout-price-line">
          <span>Discount <small>No promo applied</small></span>
          <strong>− ৳ 0</strong>
        </div>
        <div className="checkout-grand-total">
          <span>Grand total</span>
          <strong>৳ {totalFare.toLocaleString("en-BD")}</strong>
        </div>
      </div>
      <p className="checkout-price-note">No service charge or discount has been included in this total.</p>
    </aside>
  );
}

function CheckoutInfoCard({ icon: Icon, title, action, onAction, children }) {
  return (
    <section className="checkout-info-card">
      <div className="checkout-info-heading">
        <span className="checkout-info-icon"><Icon size={18} /></span>
        <h2>{title}</h2>
        <button className="checkout-edit-link" type="button" onClick={onAction}>
          <Pencil size={13} /> {action}
        </button>
      </div>
      {children}
    </section>
  );
}

export default function CheckoutPage({ draft, onEditPassengers, onEditSeats, onContinueToPayment }) {
  const { query, schedule, selectedSeats, passengers, contact, totalFare } = draft;
  const [promoCode, setPromoCode] = useState("");
  const [promoFeedback, setPromoFeedback] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");

  function applyPromoCode(event) {
    event.preventDefault();
    setPromoFeedback(
      promoCode.trim()
        ? "Promo-code verification is not available yet. No discount was applied."
        : "Enter a promo code to check it.",
    );
  }

  function continueToPayment() {
    if (!termsAccepted) {
      setPaymentMessage("Please accept the terms and conditions before continuing.");
      return;
    }
    setPaymentMessage("");
    onContinueToPayment(draft);
  }

  return (
    <main className="checkout-page">
      <div className="checkout-container">
        <button
          className="checkout-back-button"
          type="button"
          onClick={onEditPassengers}
        >
          <ArrowLeft size={17} /> Back to passenger details
        </button>

        <header className="checkout-page-heading">
          <div>
            <p className="checkout-eyebrow">STEP 3 OF 3 <span /> REVIEW &amp; CONFIRM</p>
            <h1>Checkout</h1>
            <p>Review your journey and booking details before payment.</p>
          </div>
          <div className="checkout-step-indicator" aria-label="Step 3 of 3">
            <span><Check size={13} /></span><i />
            <span><Check size={13} /></span><i />
            <span className="current-step">3</span>
          </div>
        </header>

        <div className="checkout-layout">
          <div className="checkout-main-content">
            <CheckoutInfoCard
              icon={MapPin}
              title="Journey details"
              action="Edit seats"
              onAction={onEditSeats}
            >
              <div className="checkout-journey-content">
                <div className="checkout-journey-route">
                  <span><small>FROM</small><strong>{query.from}</strong></span>
                  <ArrowRight size={17} />
                  <span><small>TO</small><strong>{query.to}</strong></span>
                </div>
                <div className="checkout-journey-meta">
                  <span><CalendarDays size={16} />{formatJourneyDate(query.date)}</span>
                  <span><Clock3 size={16} />{formatClock(schedule.departure)}</span>
                  <span><Bus size={16} />{schedule.operator}</span>
                </div>
              </div>
            </CheckoutInfoCard>

            <CheckoutInfoCard
              icon={UsersRound}
              title="Passenger information"
              action="Edit details"
              onAction={onEditPassengers}
            >
              <div className="checkout-passenger-list">
                {passengers.map((passenger, index) => (
                  <div className="checkout-passenger-row" key={passenger.seat}>
                    <span className="checkout-passenger-avatar"><UserRound size={17} /></span>
                    <span className="checkout-passenger-name">
                      <strong>{passenger.fullName}</strong>
                      <small>Passenger {index + 1} · Seat {passenger.seat}</small>
                    </span>
                    {passenger.gender && <span className="checkout-passenger-gender">{passenger.gender}</span>}
                  </div>
                ))}
              </div>
              <div className="checkout-contact-details">
                <span><UserRound size={15} />{contact.fullName}</span>
                <span><Phone size={15} />{contact.mobile}</span>
                <span><Mail size={15} />{contact.email}</span>
              </div>
            </CheckoutInfoCard>

            <form className="checkout-promo-card" onSubmit={applyPromoCode}>
              <div className="checkout-promo-title">
                <span className="checkout-promo-icon"><Ticket size={17} /></span>
                <span><strong>Have a promo code?</strong><small>Enter a code to check for an offer.</small></span>
              </div>
              <div className="checkout-promo-control">
                <input
                  aria-label="Promo code"
                  autoComplete="off"
                  value={promoCode}
                  onChange={(event) => {
                    setPromoCode(event.target.value);
                    setPromoFeedback("");
                  }}
                  placeholder="Enter promo code"
                />
                <button type="submit">Apply</button>
              </div>
              {promoFeedback && <p className="checkout-promo-feedback" role="status">{promoFeedback}</p>}
            </form>

            <label className="checkout-terms">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => {
                  setTermsAccepted(event.target.checked);
                  setPaymentMessage("");
                }}
              />
              <span className="checkout-custom-checkbox" aria-hidden="true"><Check size={13} /></span>
              <span>I have reviewed the booking details and agree to the terms and conditions.</span>
            </label>
            {paymentMessage && (
              <p className="checkout-payment-message" role="status">{paymentMessage}</p>
            )}
          </div>

          <div className="checkout-sidebar">
            <SummaryCard draft={{ query, schedule, selectedSeats, totalFare }} onEditSeats={onEditSeats} />
            <button className="checkout-payment-button" type="button" onClick={continueToPayment}>
              Continue to Payment <ArrowRight size={17} />
            </button>
            <p className="checkout-secure-note"><ShieldCheck size={15} />Secure checkout · Your details stay private</p>
          </div>
        </div>
      </div>
    </main>
  );
}
