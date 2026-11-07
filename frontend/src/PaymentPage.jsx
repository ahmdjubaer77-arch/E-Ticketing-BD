import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bus,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Ticket,
  TriangleAlert,
} from "lucide-react";
import "./payment.css";

const paymentMethods = [
  { id: "bkash", name: "bKash", detail: "Mobile wallet", mark: "bK", kind: "wallet" },
  { id: "nagad", name: "Nagad", detail: "Mobile wallet", mark: "N", kind: "wallet" },
  { id: "rocket", name: "Rocket", detail: "Mobile wallet", mark: "R", kind: "wallet" },
  { id: "card", name: "Debit / Credit Card", detail: "Visa · Mastercard · local cards", mark: null, kind: "card" },
];

function formatJourneyDate(date) {
  if (!date) return "Date not selected";
  return new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatClock(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function PaymentSummary({ draft }) {
  const { query, schedule, selectedSeats, totalFare } = draft;

  return (
    <aside className="payment-summary-card" aria-label="Booking and payment summary">
      <div className="payment-summary-heading">
        <div>
          <p>BOOKING SUMMARY</p>
          <h2>Your journey</h2>
        </div>
        <span><Ticket size={19} /></span>
      </div>

      <div className="payment-route">
        <div className="payment-route-place">
          <i className="payment-origin-dot" />
          <span><small>FROM</small><strong>{query.from}</strong></span>
        </div>
        <span className="payment-route-line" />
        <div className="payment-route-place">
          <i className="payment-destination-dot" />
          <span><small>TO</small><strong>{query.to}</strong></span>
        </div>
      </div>

      <div className="payment-summary-meta">
        <span><CalendarDays size={15} />{formatJourneyDate(query.date)}</span>
        <span><Clock3 size={15} />{formatClock(schedule.departure)}</span>
        <span><Bus size={15} />{schedule.operator}</span>
      </div>

      <div className="payment-summary-seats">
        <div><span>Seats · {selectedSeats.length}</span></div>
        <div className="payment-seat-tags">
          {selectedSeats.map((seat) => <span key={seat}>{seat}</span>)}
        </div>
      </div>

      <div className="payment-summary-total">
        <span>Total payable</span>
        <strong>৳ {totalFare.toLocaleString("en-BD")}</strong>
      </div>
      <p className="payment-no-extra-fees">No additional payment fees have been configured.</p>
    </aside>
  );
}

function PaymentResult({ status, onBack, onBookingStatus }) {
  if (status === "checking") {
    return (
      <div className="payment-status-panel checking" role="status" aria-live="polite">
        <span className="payment-spinner" />
        <span>
          <strong>Checking secure payment availability</strong>
          <small>No payment is being initiated during this check.</small>
        </span>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="payment-status-panel success" role="status">
        <span className="payment-status-icon"><Check size={19} /></span>
        <span>
          <strong>Payment confirmed</strong>
          <small>Your payment provider confirmed the transaction.</small>
        </span>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="payment-status-panel failed" role="alert">
        <span className="payment-status-icon"><TriangleAlert size={19} /></span>
        <span>
          <strong>Payment could not be completed</strong>
          <small>No confirmed payment was received. Please try again or choose another method.</small>
        </span>
        <button type="button" onClick={onBack}>Return to checkout</button>
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div className="payment-status-panel failed" role="alert">
        <span className="payment-status-icon"><TriangleAlert size={19} /></span>
        <span>
          <strong>Online payment is not available yet</strong>
          <small>No payment gateway is connected. No transaction was attempted and no money was charged.</small>
        </span>
        <button type="button" onClick={onBookingStatus}>View booking status</button>
        <button type="button" onClick={onBack}>Return to checkout</button>
      </div>
    );
  }

  return null;
}

export default function PaymentPage({ draft, onBack, onBookingStatus }) {
  const [selectedMethod, setSelectedMethod] = useState("bkash");
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (status !== "checking") return undefined;
    const timer = window.setTimeout(() => setStatus("unavailable"), 500);
    return () => window.clearTimeout(timer);
  }, [status]);

  const method = paymentMethods.find(({ id }) => id === selectedMethod);

  function payNow() {
    if (status === "checking") return;
    setStatus("checking");
  }

  return (
    <main className="payment-page">
      <div className="payment-container">
        <button className="payment-back-button" type="button" onClick={onBack}>
          <ArrowLeft size={17} /> Back to checkout
        </button>

        <header className="payment-page-heading">
          <div>
            <p className="payment-eyebrow">PAYMENT <span /> SECURE CHECKOUT</p>
            <h1>Choose how to pay</h1>
            <p>Select a payment method for your booking.</p>
          </div>
          <span className="payment-lock-badge"><LockKeyhole size={15} /> Secure payment</span>
        </header>

        <div className="payment-layout">
          <div className="payment-main">
            <section className="payment-method-section" aria-labelledby="payment-method-title">
              <div className="payment-section-heading">
                <span className="payment-section-icon"><Banknote size={18} /></span>
                <div>
                  <h2 id="payment-method-title">Payment method</h2>
                  <p>Choose your preferred payment option.</p>
                </div>
              </div>

              <div className="payment-method-grid" role="radiogroup" aria-label="Payment method">
                {paymentMethods.map((item) => {
                  const selected = selectedMethod === item.id;
                  return (
                    <button
                      className={`payment-method-card${selected ? " selected" : ""}`}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      key={item.id}
                      onClick={() => {
                        setSelectedMethod(item.id);
                        setStatus("idle");
                      }}
                    >
                      <span className={`payment-method-mark ${item.id}`}>
                        {item.mark ? item.mark : <CreditCard size={22} />}
                      </span>
                      <span className="payment-method-copy">
                        <strong>{item.name}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <span className="payment-radio" aria-hidden="true">
                        {selected && <i />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="payment-method-note">
                {method?.kind === "card" ? (
                  <>
                    <CreditCard size={17} />
                    <span><strong>Card payments use a hosted checkout</strong><small>Card number, expiry and CVV must only be entered on your payment provider&apos;s secure page. This website does not collect card details.</small></span>
                  </>
                ) : (
                  <>
                    <Smartphone size={17} />
                    <span><strong>{method?.name} payment</strong><small>You would confirm payment in the provider&apos;s secure app or hosted page. No wallet PIN or OTP is collected here.</small></span>
                  </>
                )}
              </div>
            </section>

            <div className="payment-security-notice">
              <span><ShieldCheck size={19} /></span>
              <div>
                <strong>Your payment information stays protected</strong>
                <p>Payment details should be entered only on a verified provider-hosted checkout. We never store card numbers, CVV, PINs or one-time passwords.</p>
              </div>
            </div>

            <PaymentResult status={status} onBack={onBack} onBookingStatus={() => onBookingStatus(draft)} />
          </div>

          <div className="payment-sidebar">
            <PaymentSummary draft={draft} />
            <button
              className="pay-now-button"
              type="button"
              onClick={payNow}
              disabled={status === "checking" || status === "success"}
            >
              {status === "checking" ? (
                <><span className="pay-button-spinner" /> Checking availability</>
              ) : (
                <>Pay Now <ArrowRight size={17} /></>
              )}
            </button>
            <p className="payment-secure-caption"><LockKeyhole size={14} />You will not be charged on this demo.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
