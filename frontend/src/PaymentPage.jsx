import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  CalendarDays,
  Clock3,
  Copy,
  ImagePlus,
  LockKeyhole,
  Ticket,
  TriangleAlert,
} from "lucide-react";
import { apiRequest } from "./authApi.js";
import "./payment.css";

function encodeHeaderJson(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

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

export default function PaymentPage({ draft, reservation, holdRemainingLabel, onBack, onBookingCreated }) {
  const [methods, setMethods] = useState([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [methodsError, setMethodsError] = useState("");
  const [methodsRetryKey, setMethodsRetryKey] = useState(0);
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [proofImage, setProofImage] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest("/public/payment-methods", { signal: AbortSignal.timeout(10_000) })
      .then(({ data }) => {
        if (!active) return;
        const availableMethods = data.paymentMethods || [];
        setMethods(availableMethods);
        setSelectedMethodId(availableMethods[0]?.id || "");
      })
      .catch((requestError) => {
        if (active) {
          setMethods([]);
          setMethodsError(requestError.name === "TimeoutError"
            ? "Loading payment methods timed out. Check your connection and retry."
            : requestError.message);
        }
      })
      .finally(() => {
        if (active) setMethodsLoading(false);
      });
    return () => { active = false; };
  }, [methodsRetryKey]);

  const selectedMethod = methods.find((method) => method.id === selectedMethodId) || methods[0];

  async function submitPaymentProof() {
    if (status === "checking") return;
    if (methodsLoading) {
      setError("Payment methods are still loading. Please try again in a moment.");
      return;
    }
    if (methodsError || methods.length === 0) {
      setMethodsError("");
      setMethodsLoading(true);
      setMethodsRetryKey((key) => key + 1);
      setError("Refreshing payment methods. Please submit again when the available accounts appear.");
      return;
    }
    if (!/^[A-Za-z0-9_-]{4,100}$/.test(transactionId.trim())) {
      setError("Enter the transaction ID from your payment receipt.");
      return;
    }
    if (proofImage && proofImage.size > 1024 * 1024) {
      setError("Payment screenshot must be 1 MB or smaller.");
      return;
    }

    setStatus("checking");
    setError("");
    try {
      if (!reservation?.id || !reservation.accessToken) {
        throw new Error("Your seat hold is missing or expired. Go back and select your seats again.");
      }

      const proofOptions = {
        method: "POST",
        headers: { Authorization: `Bearer ${reservation.accessToken}` },
      };
      const proofDetails = {
        paymentMethodId: selectedMethod.id,
        transactionId: transactionId.trim(),
        customerName: draft.contact.fullName,
        customerEmail: draft.contact.email,
        customerPhone: draft.contact.mobile,
        passengers: draft.passengers.map(({ seat, fullName }) => ({ seat, fullName })),
      };
      const proofRequest = proofImage
        ? {
            ...proofOptions,
            body: proofImage,
            headers: {
              ...proofOptions.headers,
              "X-Payment-Details": encodeHeaderJson(proofDetails),
            },
          }
        : {
            ...proofOptions,
            body: proofDetails,
          };
      const { data: proofData } = await apiRequest(`/public/bookings/${reservation.id}/proof`, proofRequest);
      onBookingCreated(proofData.booking);
    } catch (requestError) {
      setError(requestError.message);
      setStatus("idle");
    }
  }

  async function copyAccountNumber() {
    try {
      await navigator.clipboard.writeText(selectedMethod.accountNumber);
    } catch {
      setError("Could not copy the account number. Please copy it manually.");
    }
  }

  return (
    <main className="payment-page">
      <div className="payment-container">
        <button className="payment-back-button" type="button" onClick={onBack}>
          <ArrowLeft size={17} /> Back to checkout
        </button>

        <header className="payment-page-heading">
          <div>
            <p className="payment-eyebrow">TICKET <span /> RESERVATION</p>
            <h1>Reserve your seats</h1>
            <p>{holdRemainingLabel ? `Submit payment proof within ${holdRemainingLabel} to secure your seats.` : "Your seats are held while the administrator reviews your payment proof."}</p>
          </div>
          <span className="payment-lock-badge"><LockKeyhole size={15} /> 3-minute hold</span>
        </header>

        <div className="payment-layout">
          <div className="payment-main">
            <section className="payment-method-section" aria-labelledby="payment-method-title">
              <div className="payment-section-heading">
                <span className="payment-section-icon"><Ticket size={18} /></span>
                <div>
                  <h2 id="payment-method-title">Pay and submit your proof</h2>
                  <p>Choose an account, pay outside the website, then enter the transaction ID.</p>
                </div>
              </div>
              {methodsLoading ? <div className="payment-method-loading" role="status">Loading available payment methods…</div> : methodsError ? <div className="payment-method-error" role="alert">{methodsError}<button type="button" onClick={() => { setMethodsError(""); setMethodsLoading(true); setMethodsRetryKey((key) => key + 1); }}>Retry</button></div> : methods.length === 0 ? <div className="payment-method-error" role="status">No active payment methods are configured. Please contact the ticket office or try again.</div> : <>
                <label className="payment-form-field">Payment method
                  <select value={selectedMethodId} onChange={(event) => setSelectedMethodId(event.target.value)}>
                    {methods.map((method) => <option value={method.id} key={method.id}>{method.name} · {method.accountType}</option>)}
                  </select>
                </label>
                {selectedMethod && <div className="payment-recipient-card">
                  <div><small>PAY TO · {selectedMethod.accountType.toUpperCase()}</small><strong>{selectedMethod.name}</strong><span>{selectedMethod.accountNumber}</span>{selectedMethod.instructions && <p>{selectedMethod.instructions}</p>}</div>
                  <button type="button" aria-label="Copy payment account number" onClick={copyAccountNumber}><Copy size={15} />Copy</button>
                </div>}
                <label className="payment-form-field">Transaction ID
                  <input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} maxLength={100} required placeholder="Enter the TrxID from your payment receipt" />
                </label>
                <label className="payment-proof-upload">
                  <ImagePlus size={17} />
                  <span><strong>{proofImage ? proofImage.name : "Add payment screenshot (optional)"}</strong><small>JPEG, PNG, or WebP · up to 1 MB</small></span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                    const selected = event.target.files?.[0] || null;
                    if (selected && !["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
                      setError("Upload a JPEG, PNG, or WebP screenshot.");
                      setProofImage(null);
                    } else {
                      setError("");
                      setProofImage(selected);
                    }
                  }} />
                </label>
              </>}
              <div className="payment-method-note">
                <TriangleAlert size={17} />
                <span><strong>Admin review required</strong><small>After payment, submit your TrxID and optional screenshot. Seats are held for 3 minutes while an administrator reviews your proof. No payment is collected by this website.</small></span>
              </div>
            </section>

            {error && <div className="payment-status-panel failed" role="alert"><span className="payment-status-icon"><TriangleAlert size={19} /></span><span><strong>{reservation ? "Reservation is held; proof was not submitted" : "Could not submit payment proof"}</strong><small>{error}</small></span><button type="button" onClick={() => setError("")}>Dismiss</button></div>}
          </div>

          <div className="payment-sidebar">
            <PaymentSummary draft={draft} />
            <button
              className="pay-now-button"
              type="button"
              onClick={submitPaymentProof}
              disabled={status === "checking"}
            >
              {status === "checking" ? (
                <><span className="pay-button-spinner" /> {reservation ? "Submitting proof…" : "Reserving seats and submitting…"}</>
              ) : methodsLoading ? (
                <>Payment methods loading <ArrowRight size={17} /></>
              ) : methodsError || methods.length === 0 ? (
                <>Retry payment methods <ArrowRight size={17} /></>
              ) : (
                <>Submit payment proof <ArrowRight size={17} /></>
              )}
            </button>
            <p className="payment-secure-caption"><LockKeyhole size={14} />Your TrxID and screenshot are visible only to admins.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
