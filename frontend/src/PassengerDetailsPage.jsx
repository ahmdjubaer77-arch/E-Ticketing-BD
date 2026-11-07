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
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import "./passenger-details.css";

const checkoutDraftKey = "eticketing.checkoutDraft";

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

function PassengerCard({ passenger, index, error, onChange }) {
  const nameErrorId = `passenger-${index}-name-error`;

  return (
    <section className="passenger-card" aria-labelledby={`passenger-${index}-title`}>
      <div className="passenger-card-heading">
        <span className="passenger-card-number">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <h3 id={`passenger-${index}-title`}>Passenger {index + 1}</h3>
          <p>Seat {passenger.seat}</p>
        </div>
        <span className="passenger-seat-tag">{passenger.seat}</span>
      </div>

      <div className="passenger-fields-grid">
        <label className="passenger-field passenger-field-wide">
          <span>Full name <b>*</b></span>
          <span className={`passenger-input-wrap${error ? " has-error" : ""}`}>
            <UserRound size={17} aria-hidden="true" />
            <input
              id={`passenger-${index}-name`}
              autoComplete="name"
              value={passenger.fullName}
              onChange={(event) => onChange("fullName", event.target.value)}
              placeholder="Enter passenger's full name"
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? nameErrorId : undefined}
            />
          </span>
          {error && <small className="passenger-field-error" id={nameErrorId}>{error}</small>}
        </label>

        <label className="passenger-field">
          <span>Gender <small>Optional</small></span>
          <select
            value={passenger.gender}
            onChange={(event) => onChange("gender", event.target.value)}
          >
            <option value="">Select if needed</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function BookingSummary({ query, schedule, selectedSeats }) {
  const total = selectedSeats.length * schedule.fare;

  return (
    <aside className="passenger-summary-card" aria-label="Booking summary">
      <div className="passenger-summary-heading">
        <div>
          <p>YOUR BOOKING</p>
          <h2>Journey summary</h2>
        </div>
        <span className="summary-shield"><ShieldCheck size={19} /></span>
      </div>

      <div className="passenger-summary-route">
        <span className="summary-route-point">
          <i />
          <small>FROM</small>
          <strong>{query.from}</strong>
        </span>
        <span className="summary-route-line" aria-hidden="true" />
        <span className="summary-route-point">
          <i />
          <small>TO</small>
          <strong>{query.to}</strong>
        </span>
      </div>

      <div className="passenger-summary-meta">
        <span><CalendarDays size={16} />{formatJourneyDate(query.date)}</span>
        <span><Clock3 size={16} />{formatClock(schedule.departure)}</span>
        <span><Bus size={16} />{schedule.operator}</span>
      </div>

      <div className="passenger-summary-seats">
        <div>
          <span>Selected seats</span>
          <strong>{selectedSeats.length} seat{selectedSeats.length === 1 ? "" : "s"}</strong>
        </div>
        <div className="passenger-summary-seat-list">
          {selectedSeats.map((seat) => <span key={seat}>{seat}</span>)}
        </div>
      </div>

      <div className="passenger-fare-lines">
        <span>Fare <small>৳ {schedule.fare.toLocaleString("en-BD")} × {selectedSeats.length}</small></span>
        <span className="passenger-total-fare">Total fare <strong>৳ {total.toLocaleString("en-BD")}</strong></span>
      </div>
      <p className="passenger-summary-note">Final payment details will be shown at checkout.</p>
    </aside>
  );
}

export default function PassengerDetailsPage({
  query,
  schedule,
  selectedSeats,
  holdRemainingLabel,
  passengers,
  setPassengers,
  contact,
  setContact,
  onBack,
  onContinue,
}) {
  const [errors, setErrors] = useState({});
  const [saveMessage, setSaveMessage] = useState("");

  function updatePassenger(index, field, value) {
    setPassengers((current) =>
      current.map((passenger, passengerIndex) =>
        passengerIndex === index ? { ...passenger, [field]: value } : passenger,
      ),
    );
    if (field === "fullName" && value.trim()) {
      setErrors((current) => ({ ...current, [`passenger-${index}`]: "" }));
    }
    setSaveMessage("");
  }

  function updateContact(field, value) {
    setContact((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setSaveMessage("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    passengers.forEach((passenger, index) => {
      if (!passenger.fullName.trim()) {
        nextErrors[`passenger-${index}`] = "Please enter this passenger's full name.";
      }
    });
    if (!contact.fullName.trim()) nextErrors.fullName = "Please enter the contact person's name.";
    if (!contact.mobile.trim()) {
      nextErrors.mobile = "Please enter a mobile number.";
    } else if (!/^\+?[0-9\s()-]{7,20}$/.test(contact.mobile.trim())) {
      nextErrors.mobile = "Enter a valid mobile number.";
    }
    if (!contact.email.trim()) {
      nextErrors.email = "Please enter an email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    setErrors(nextErrors);
    setSaveMessage("");
    if (Object.keys(nextErrors).length) {
      const firstInvalid = Object.keys(nextErrors)[0];
      const target = firstInvalid.startsWith("passenger-")
        ? document.getElementById(`${firstInvalid}-name`)
        : document.getElementById(`contact-${firstInvalid}`);
      target?.focus();
      return;
    }

    const checkoutDraft = {
      query,
      schedule: {
        id: schedule.id,
        operator: schedule.operator,
        type: schedule.type,
        departure: schedule.departure,
        arrival: schedule.arrival,
        fare: schedule.fare,
        coach: schedule.coach,
      },
      selectedSeats,
      passengers: passengers.map((passenger) => ({
        ...passenger,
        fullName: passenger.fullName.trim(),
      })),
      contact: {
        fullName: contact.fullName.trim(),
        mobile: contact.mobile.trim(),
        email: contact.email.trim(),
      },
      totalFare: selectedSeats.length * schedule.fare,
      savedAt: new Date().toISOString(),
    };

    try {
      window.sessionStorage.setItem(checkoutDraftKey, JSON.stringify(checkoutDraft));
      setSaveMessage("Your passenger details are saved and ready for checkout.");
      onContinue(checkoutDraft);
    } catch (error) {
      console.error("Unable to save passenger details for checkout.", error);
      setSaveMessage("We couldn't save your details. Please check your browser storage and try again.");
    }
  }

  return (
    <main className="passenger-details-page">
      <div className="passenger-details-container">
        <button className="passenger-back-button" type="button" onClick={onBack}>
          <ArrowLeft size={17} /> Back to seat selection
        </button>

        <header className="passenger-page-heading">
          <div>
            <p className="passenger-eyebrow">STEP 2 OF 3 <span /> GUEST INFORMATION</p>
            <h1 id="passenger-details-title">Passenger details</h1>
            <p className="passenger-page-intro">A few details and you&apos;re one step closer to your journey.</p>
          </div>
          <div className="passenger-progress" aria-label="Step 2 of 3">
            <span className="progress-complete"><Check size={13} /></span>
            <i />
            <span className="progress-current">2</span>
            <i />
            <span className="progress-upcoming">3</span>
          </div>
        </header>
        {holdRemainingLabel && <p className="seat-hold-countdown"><Clock3 size={16} /><span>Complete payment proof within</span><strong>{holdRemainingLabel}</strong></p>}

        <div className="passenger-details-layout">
          <form className="passenger-form-column" noValidate onSubmit={handleSubmit}>
            <section className="passenger-form-section" aria-labelledby="travellers-title">
              <div className="passenger-section-heading">
                <span className="passenger-section-icon"><UsersRound size={18} /></span>
                <div>
                  <h2 id="travellers-title">Traveller information</h2>
                  <p>Enter the name for each selected seat.</p>
                </div>
              </div>

              <div className="passenger-cards-list">
                {passengers.map((passenger, index) => (
                  <PassengerCard
                    key={passenger.seat}
                    passenger={passenger}
                    index={index}
                    error={errors[`passenger-${index}`]}
                    onChange={(field, value) => updatePassenger(index, field, value)}
                  />
                ))}
              </div>
            </section>

            <section className="passenger-form-section contact-section" aria-labelledby="contact-title">
              <div className="passenger-section-heading">
                <span className="passenger-section-icon"><Phone size={18} /></span>
                <div>
                  <h2 id="contact-title">Contact person</h2>
                  <p>Booking updates and tickets will be sent to these details.</p>
                </div>
              </div>

              <div className="passenger-fields-grid">
                <label className="passenger-field passenger-field-wide">
                  <span>Full name <b>*</b></span>
                  <span className={`passenger-input-wrap${errors.fullName ? " has-error" : ""}`}>
                    <UserRound size={17} aria-hidden="true" />
                    <input
                      id="contact-fullName"
                      autoComplete="name"
                      value={contact.fullName}
                      onChange={(event) => updateContact("fullName", event.target.value)}
                      placeholder="Contact person's full name"
                      required
                      aria-invalid={Boolean(errors.fullName)}
                      aria-describedby={errors.fullName ? "contact-fullName-error" : undefined}
                    />
                  </span>
                  {errors.fullName && <small className="passenger-field-error" id="contact-fullName-error">{errors.fullName}</small>}
                </label>

                <label className="passenger-field">
                  <span>Mobile number <b>*</b></span>
                  <span className={`passenger-input-wrap${errors.mobile ? " has-error" : ""}`}>
                    <Phone size={17} aria-hidden="true" />
                    <input
                      id="contact-mobile"
                      autoComplete="tel"
                      type="tel"
                      value={contact.mobile}
                      onChange={(event) => updateContact("mobile", event.target.value)}
                      placeholder="+880 1XXX-XXXXXX"
                      required
                      aria-invalid={Boolean(errors.mobile)}
                      aria-describedby={errors.mobile ? "contact-mobile-error" : undefined}
                    />
                  </span>
                  {errors.mobile && <small className="passenger-field-error" id="contact-mobile-error">{errors.mobile}</small>}
                </label>

                <label className="passenger-field">
                  <span>Email address <b>*</b></span>
                  <span className={`passenger-input-wrap${errors.email ? " has-error" : ""}`}>
                    <Mail size={17} aria-hidden="true" />
                    <input
                      id="contact-email"
                      autoComplete="email"
                      type="email"
                      value={contact.email}
                      onChange={(event) => updateContact("email", event.target.value)}
                      placeholder="you@example.com"
                      required
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "contact-email-error" : undefined}
                    />
                  </span>
                  {errors.email && <small className="passenger-field-error" id="contact-email-error">{errors.email}</small>}
                </label>
              </div>
            </section>

            {saveMessage && (
              <p
                className={`passenger-save-message${saveMessage.startsWith("We couldn't") ? " error" : ""}`}
                role={saveMessage.startsWith("We couldn't") ? "alert" : "status"}
              >
                {saveMessage.startsWith("We couldn't") ? null : <Check size={17} />}
                {saveMessage}
              </p>
            )}

            <div className="passenger-form-actions">
              <p><ShieldCheck size={15} /> Your information is kept private and secure.</p>
              <button className="passenger-checkout-button" type="submit">
                Continue to Checkout <ArrowRight size={17} />
              </button>
            </div>
          </form>

          <BookingSummary query={query} schedule={schedule} selectedSeats={selectedSeats} />
        </div>
      </div>
    </main>
  );
}
