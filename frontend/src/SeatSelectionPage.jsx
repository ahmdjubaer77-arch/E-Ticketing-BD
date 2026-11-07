import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bus,
  CalendarDays,
  CircleDot,
  CircleHelp,
  Clock3,
  MapPin,
  UsersRound,
} from "lucide-react";
import PassengerDetailsPage from "./PassengerDetailsPage.jsx";
import CheckoutPage from "./CheckoutPage.jsx";
import PaymentPage from "./PaymentPage.jsx";
import BookingConfirmationPage from "./BookingConfirmationPage.jsx";
import "./seat-selection.css";

const seatColumns = ["A", "B", "C", "D"];

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
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function getSeatList(totalSeats) {
  return Array.from({ length: Math.ceil(totalSeats / seatColumns.length) }, (_, rowIndex) =>
    seatColumns.map((column) => `${column}${rowIndex + 1}`),
  ).flat().slice(0, totalSeats);
}

function BusSeatMap({ totalSeats, bookedSeats, selectedSeats, onToggleSeat }) {
  const seats = getSeatList(totalSeats);

  return (
    <section className="seat-map-card" aria-labelledby="seat-map-title">
      <div className="seat-map-heading">
        <div>
          <p className="seat-section-eyebrow">YOUR COACH</p>
          <h2 id="seat-map-title">Choose your seats</h2>
        </div>
        <span className="seat-map-capacity">
          <UsersRound size={14} /> {totalSeats} seats
        </span>
      </div>

      <div className="bus-direction" aria-label="Front of bus">
        <span>FRONT OF BUS</span>
        <span className="bus-direction-indicator">
          <ArrowUp size={14} />
          <CircleDot size={20} />
          <ArrowUp size={14} />
        </span>
      </div>

      <div className="bus-seat-shell">
        <div className="bus-seat-grid" role="group" aria-label="Bus seat map">
          {seats.map((seat) => {
            const booked = bookedSeats.includes(seat);
            const selected = selectedSeats.includes(seat);
            const column = seat[0];
            const hasAisle = column === "C";

            return (
              <React.Fragment key={seat}>
                {hasAisle && <span className="bus-aisle" aria-hidden="true" />}
                <button
                  className={`bus-seat${booked ? " booked" : ""}${selected ? " selected" : ""}`}
                  type="button"
                  disabled={booked}
                  aria-label={`Seat ${seat}${booked ? ", booked" : selected ? ", selected" : ", available"}`}
                  aria-pressed={selected}
                  onClick={() => onToggleSeat(seat)}
                >
                  <span className="seat-number">{seat}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="seat-legend" aria-label="Seat availability legend">
        <span>
          <i className="legend-seat available" /> Available
        </span>
        <span>
          <i className="legend-seat selected" /> Selected
        </span>
        <span>
          <i className="legend-seat booked" /> Booked
        </span>
      </div>
      <p className="seat-map-note">Seat layout is a preview until live operator availability is connected.</p>
    </section>
  );
}

function SelectedSeatSummary({ schedule, selectedSeats }) {
  const total = selectedSeats.length * schedule.fare;

  return (
    <section className="selected-seat-summary" aria-live="polite">
      <div className="selection-summary-heading">
        <span>Your selection</span>
        <strong>
          {selectedSeats.length} seat{selectedSeats.length === 1 ? "" : "s"}
        </strong>
      </div>
      {selectedSeats.length ? (
        <div className="selected-seat-chips">
          {selectedSeats.map((seat) => (
            <span className="selected-seat-chip" key={seat}>
              {seat}
            </span>
          ))}
        </div>
      ) : (
        <p className="no-seats-selected">Choose one or more available seats to continue.</p>
      )}
      <div className="fare-breakdown">
        <span>
          ৳ {schedule.fare.toLocaleString("en-BD")} <small>× {selectedSeats.length} seat(s)</small>
        </span>
        <span className="total-fare">
          Total <strong>৳ {total.toLocaleString("en-BD")}</strong>
        </span>
      </div>
    </section>
  );
}

export default function SeatSelectionPage({ query, schedule, onBack, onHome }) {
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [step, setStep] = useState("seats");
  const [passengers, setPassengers] = useState([]);
  const [contact, setContact] = useState({ fullName: "", mobile: "", email: "" });
  const [checkoutDraft, setCheckoutDraft] = useState(null);
  const [paymentDraft, setPaymentDraft] = useState(null);
  const [bookingResponse, setBookingResponse] = useState(null);
  const availableSeats = schedule.seats;

  function toggleSeat(seat) {
    setSelectedSeats((current) =>
      current.includes(seat)
        ? current.filter((value) => value !== seat)
        : [...current, seat].sort((first, second) => {
            const firstRow = Number(first.slice(1));
            const secondRow = Number(second.slice(1));
            return firstRow === secondRow
              ? first[0].localeCompare(second[0])
              : firstRow - secondRow;
          }),
    );
  }

  function continueToDetails() {
    if (!selectedSeats.length) return;
    setPassengers((current) =>
      selectedSeats.map(
        (seat) => current.find((passenger) => passenger.seat === seat) || {
          seat,
          fullName: "",
          gender: "",
        },
      ),
    );
    setStep("passengers");
    window.setTimeout(() => {
      document.getElementById("passenger-details-title")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);
  }

  if (step === "payment" && paymentDraft) {
    return (
      <PaymentPage
        draft={paymentDraft}
        onBookingStatus={() => {
          setBookingResponse(null);
          setStep("confirmation");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onBack={() => {
          setStep("checkout");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    );
  }

  if (step === "confirmation" && paymentDraft) {
    return (
      <BookingConfirmationPage
        draft={paymentDraft}
        bookingResponse={bookingResponse}
        onBackToPayment={() => {
          setStep("payment");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onBackToHome={onHome}
      />
    );
  }

  if (step === "checkout" && checkoutDraft) {
    return (
      <CheckoutPage
        draft={checkoutDraft}
        onContinueToPayment={(draft) => {
          setPaymentDraft(draft);
          setStep("payment");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onEditPassengers={() => {
          setStep("passengers");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onEditSeats={() => {
          setStep("seats");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    );
  }

  if (step === "passengers") {
    return (
      <PassengerDetailsPage
        query={query}
        schedule={schedule}
        selectedSeats={selectedSeats}
        passengers={passengers}
        setPassengers={setPassengers}
        contact={contact}
        setContact={setContact}
        onContinue={(draft) => {
          setCheckoutDraft(draft);
          setStep("checkout");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onBack={() => {
          setStep("seats");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    );
  }

  return (
    <main className="seat-selection-page">
      <div className="seat-selection-container">
        <button className="back-to-results" type="button" onClick={onBack}>
          <ArrowLeft size={17} /> Back to schedules
        </button>

        <div className="seat-page-heading">
          <div>
            <p className="seat-section-eyebrow">STEP 1 OF 3 · SELECT SEATS</p>
            <h1>Select your seats</h1>
          </div>
          <span className="seat-data-note">
            <span /> Seat map preview
          </span>
        </div>

        <section className="seat-journey-card" aria-label="Journey information">
          <div className="seat-journey-route">
            <span>
              <small>FROM</small>
              <strong>{query.from}</strong>
            </span>
            <span className="seat-journey-arrow" aria-hidden="true">
              <ArrowRight size={17} />
            </span>
            <span>
              <small>TO</small>
              <strong>{query.to}</strong>
            </span>
          </div>
          <div className="seat-journey-meta">
            <span>
              <CalendarDays size={16} /> {formatJourneyDate(query.date)}
            </span>
            <span>
              <Clock3 size={16} /> {formatClock(schedule.departure)}
            </span>
          </div>
          <div className="seat-operator-info">
            <span className="seat-operator-icon">
              <Bus size={18} />
            </span>
            <span>
              <strong>{schedule.operator}</strong>
              <small>{schedule.coach}</small>
            </span>
          </div>
        </section>

        <div className="seat-selection-layout">
          <div className="seat-selection-main">
            <BusSeatMap
              totalSeats={schedule.totalSeats}
              bookedSeats={schedule.bookedSeats}
              selectedSeats={selectedSeats}
              onToggleSeat={toggleSeat}
            />
          </div>

          <aside className="seat-booking-panel" aria-label="Seat booking summary">
            <div className="seat-booking-panel-heading">
              <h2>Booking summary</h2>
              <span className="available-seats-badge">
                <span /> {availableSeats} seats available
              </span>
            </div>

            <div className="seat-summary-route">
              <MapPin size={16} />
              <span>
                <strong>{query.from}</strong>
                <ArrowRight size={14} />
                <strong>{query.to}</strong>
              </span>
            </div>
            <p className="seat-summary-date">{formatJourneyDate(query.date)} · {schedule.operator}</p>

            <SelectedSeatSummary schedule={schedule} selectedSeats={selectedSeats} />

            <button
              className="continue-passenger-button"
              type="button"
              disabled={!selectedSeats.length}
              onClick={continueToDetails}
            >
              Continue to Passenger Details <ArrowRight size={17} />
            </button>
            <p className="seat-booking-disclaimer">
              <CircleHelp size={13} />
              Preview only. Seat availability and fare are not live.
            </p>
          </aside>
        </div>
      </div>

      <div className="mobile-seat-summary-bar">
        <SelectedSeatSummary schedule={schedule} selectedSeats={selectedSeats} />
        <button
          className="continue-passenger-button"
          type="button"
          disabled={!selectedSeats.length}
          onClick={continueToDetails}
        >
          Continue <ArrowRight size={17} />
        </button>
      </div>
    </main>
  );
}
