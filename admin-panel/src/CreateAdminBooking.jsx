import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api.js";
import { RefreshCw, X } from "lucide-react";
import "./create-admin-booking.css";

const columns = ["A", "B", "C", "D"];

function seatLabels(totalSeats) {
  return Array.from({ length: totalSeats }, (_, index) => `${columns[index % columns.length]}${Math.floor(index / columns.length) + 1}`);
}

function formatSchedule(schedule) {
  const date = new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short" }).format(new Date(schedule.departureAt));
  return `${schedule.route?.departure || "—"} → ${schedule.route?.destination || "—"} · ${schedule.operator?.name || "Operator"} · ${date} · ${schedule.availableSeats} seats left`;
}

export default function CreateAdminBooking({ onClose, onCreated }) {
  const [schedules, setSchedules] = useState([]);
  const [scheduleId, setScheduleId] = useState("");
  const [scheduleSeats, setScheduleSeats] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [refreshingSeats, setRefreshingSeats] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all(["scheduled", "active"].map((status) => apiRequest(`/admin/schedules?status=${status}&limit=100`)))
      .then((responses) => {
        if (!active) return;
        const upcoming = responses.flatMap((response) => response.schedules)
          .filter((schedule) => new Date(schedule.departureAt).getTime() > Date.now())
          .sort((first, second) => new Date(first.departureAt) - new Date(second.departureAt));
        setSchedules(upcoming);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoadingSchedules(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!scheduleId) {
      setScheduleSeats(null);
      setSelectedSeats([]);
      return undefined;
    }
    let active = true;
    setLoadingSeats(true);
    setScheduleSeats(null);
    setSelectedSeats([]);
    apiRequest(`/admin/bookings/schedules/${scheduleId}/seats`)
      .then((data) => {
        if (active) setScheduleSeats(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoadingSeats(false);
      });
    return () => { active = false; };
  }, [scheduleId]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  const bookedSeats = useMemo(() => new Set(scheduleSeats?.bookedSeats || []), [scheduleSeats]);
  const seats = useMemo(() => seatLabels(scheduleSeats?.schedule.totalSeats || 0), [scheduleSeats]);
  const selectedSchedule = schedules.find((schedule) => schedule.id === scheduleId);
  const total = (selectedSchedule?.fare || 0) * selectedSeats.length;

  function toggleSeat(seat) {
    setSelectedSeats((current) => current.includes(seat)
      ? current.filter((value) => value !== seat)
      : current.length >= 10 ? current : [...current, seat].sort((first, second) => {
          const firstIndex = (Number(first.slice(1)) - 1) * 4 + columns.indexOf(first[0]);
          const secondIndex = (Number(second.slice(1)) - 1) * 4 + columns.indexOf(second[0]);
          return firstIndex - secondIndex;
        }));
  }

  async function refreshSeatAvailability() {
    if (!scheduleId || loadingSeats || refreshingSeats) return;
    setRefreshingSeats(true);
    setError("");
    try {
      const data = await apiRequest(`/admin/bookings/schedules/${scheduleId}/seats`);
      setScheduleSeats(data);
      setSelectedSeats((current) => current.filter((seat) => !data.bookedSeats.includes(seat)));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRefreshingSeats(false);
    }
  }

  async function submitBooking(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { booking } = await apiRequest("/admin/bookings", {
        method: "POST",
        body: { scheduleId, customerName, customerEmail, customerPhone, seatNumbers: selectedSeats },
      });
      onCreated(booking);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-booking-modal-scrim" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose();
    }}>
      <section className="admin-booking-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-booking-title">
        <header className="admin-booking-dialog-header">
          <div><span className="booking-eyebrow">NEW RESERVATION</span><h2 id="admin-booking-title">Book seats for a customer</h2><p>Select an upcoming schedule and reserve available seats.</p></div>
          <button className="booking-icon-button" type="button" aria-label="Close booking form" disabled={submitting} onClick={onClose}><X size={18} /></button>
        </header>
        <form onSubmit={submitBooking}>
          <div className="admin-booking-dialog-body">
            {error && <p className="admin-booking-form-error" role="alert">{error}</p>}
            <label className="admin-booking-field">Schedule
              <select required value={scheduleId} onChange={(event) => { setError(""); setScheduleId(event.target.value); }} disabled={loadingSchedules}>
                <option value="">{loadingSchedules ? "Loading schedules…" : "Choose a schedule"}</option>
                {schedules.map((schedule) => <option value={schedule.id} key={schedule.id} disabled={schedule.availableSeats < 1}>{formatSchedule(schedule)}</option>)}
              </select>
            </label>
            {scheduleId && (
              <section className="admin-seat-picker" aria-label="Schedule seat map">
                <div className="admin-seat-picker-heading"><strong>Choose seats</strong><span>{loadingSeats || refreshingSeats ? "Refreshing seat availability…" : `${scheduleSeats?.bookedSeats.length || 0} booked · ${scheduleSeats?.schedule.availableSeats || 0} available`}</span><button type="button" className="admin-seat-refresh" aria-label="Refresh seat availability" disabled={loadingSeats || refreshingSeats} onClick={refreshSeatAvailability}><RefreshCw size={13} /></button></div>
                {scheduleSeats && <div className="admin-seat-grid" role="group" aria-label="Available seats">
                  {seats.map((seat) => {
                    const booked = bookedSeats.has(seat);
                    const selected = selectedSeats.includes(seat);
                    const selectionLimitReached = selectedSeats.length >= 10 && !selected;
                    return <button key={seat} type="button" disabled={booked || loadingSeats || refreshingSeats || selectionLimitReached} aria-pressed={selected} aria-label={`${seat}${booked ? " booked" : selected ? " selected" : selectionLimitReached ? " unavailable, maximum of 10 seats selected" : " available"}`} className={`admin-seat${booked ? " is-booked" : ""}${selected ? " is-selected" : ""}`} onClick={() => toggleSeat(seat)}>{seat}</button>;
                  })}
                </div>}
                <div className="admin-seat-legend"><span><i />Available</span><span><i className="selected" />Selected</span><span><i className="booked" />Booked</span></div>
                <p className="admin-seat-selection">{selectedSeats.length ? `Selected (${selectedSeats.length}/10): ${selectedSeats.join(", ")}` : "Choose up to 10 available seats."}</p>
              </section>
            )}
            <div className="admin-booking-customer-fields">
              <label className="admin-booking-field">Customer name<input required minLength={2} maxLength={100} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Passenger full name" /></label>
              <label className="admin-booking-field">Phone (optional)<input maxLength={24} value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="01XXXXXXXXX" /></label>
              <label className="admin-booking-field full">Email (optional)<input type="email" maxLength={254} value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="customer@example.com" /></label>
            </div>
            <div className="admin-booking-total"><span>{selectedSeats.length} seat{selectedSeats.length === 1 ? "" : "s"} · payment pending</span><strong>৳{total.toLocaleString("en-BD")}</strong></div>
          </div>
          <footer className="admin-booking-dialog-footer"><button className="booking-button secondary" type="button" disabled={submitting} onClick={onClose}>Cancel</button><button className="booking-button primary" type="submit" disabled={submitting || loadingSchedules || loadingSeats || !scheduleId || !selectedSeats.length}>{submitting ? "Booking…" : "Confirm seat booking"}</button></footer>
        </form>
      </section>
    </div>
  );
}
