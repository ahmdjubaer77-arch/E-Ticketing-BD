import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api.js";
import {
  ArrowRight,
  Bus,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Ship,
  Ticket,
  TrainFront,
  Trash2,
  X,
} from "lucide-react";
import { initialRoutes } from "./RouteManagement.jsx";
import { initialVehicles } from "./VehicleManagement.jsx";
import "./schedule-management.css";

const pad = (value) => String(value).padStart(2, "0");

function dateOffset(days, hour = 8, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function inputDateTime(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function dateKey(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function formatDateTime(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "—";
  return new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
}

function formatTime(date) {
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? "—" : new Intl.DateTimeFormat("en-BD", { hour: "2-digit", minute: "2-digit" }).format(value);
}

function addDuration(start, duration) {
  const match = duration.match(/(?:(\d+)\s*h)?(?:\s*(\d+)\s*m)?/i);
  const hours = Number(match?.[1] || 0);
  const minutes = Number(match?.[2] || 0);
  return inputDateTime(new Date(new Date(start).getTime() + (hours * 60 + minutes) * 60000));
}

const demoScheduleSeeds = [
  [0, 1, 0, 8, 0, "scheduled", 22],
  [1, 2, 1, 10, 30, "scheduled", 106],
  [2, 4, 2, 21, 0, "scheduled", 9],
  [3, 3, 3, 19, 30, "scheduled", 244],
  [4, 5, 4, 7, 15, "scheduled", 15],
  [5, 6, 5, 12, 0, "scheduled", 187],
  [6, 7, 6, 23, 0, "cancelled", 0],
  [7, 8, 7, 9, 0, "scheduled", 31],
  [8, 9, 8, 15, 30, "scheduled", 298],
  [9, 10, -1, 20, 0, "completed", 0],
  [10, 11, 10, 6, 45, "scheduled", 54],
  [11, 0, -2, 9, 0, "completed", 0],
];

export const initialSchedules = demoScheduleSeeds.map(([routeIndex, vehicleIndex, day, hour, minute, seededStatus, seatsLeft], index) => {
  const route = initialRoutes[routeIndex];
  const compatibleVehicles = initialVehicles.filter((vehicle) => vehicle.transport === route.transport);
  const vehicle = compatibleVehicles[vehicleIndex % compatibleVehicles.length];
  const departureAt = dateOffset(day, hour, minute);
  const isPast = new Date(departureAt).getTime() < Date.now();
  const status = seededStatus === "scheduled" && isPast ? "completed" : seededStatus;
  return {
    id: `SCH-${String(5108 - index).padStart(4, "0")}`,
    operatorId: vehicle.operatorId,
    vehicleId: vehicle.id,
    routeId: route.id,
    departureAt,
    arrivalAt: addDuration(departureAt, route.duration),
    availableSeats: Math.min(seatsLeft, vehicle.seats),
    fare: route.fare,
    status,
  };
});

function ScheduleTransportIcon({ type, size = 14 }) {
  if (type === "Train") return <TrainFront size={size} />;
  if (type === "Launch") return <Ship size={size} />;
  return <Bus size={size} />;
}

function ScheduleStatus({ status }) {
  const labels = { scheduled: "Scheduled", active: "Active", cancelled: "Cancelled", completed: "Completed" };
  return <span className={`schedule-status ${status}`}><i />{labels[status] || status}</span>;
}

function scheduleFromApi(schedule) {
  return {
    ...schedule,
    operator: schedule.operator,
    vehicle: schedule.vehicle ? { ...schedule.vehicle, seats: schedule.vehicle.seatCapacity } : null,
    route: schedule.route ? { ...schedule.route, departure: schedule.route.departure ?? schedule.route.name } : null,
  };
}

function ScheduleModal({ schedule, operators, vehicles, routes, onClose, onSave }) {
  const initialOperator = schedule?.operatorId ?? operators[0]?.id ?? "";
  const firstVehicle = vehicles.find((vehicle) => vehicle.operatorId === initialOperator);
  const firstRoute = routes.find((route) => !firstVehicle || route.transport === firstVehicle.transport);
  const [values, setValues] = useState({
    operatorId: initialOperator,
    vehicleId: schedule?.vehicleId ?? firstVehicle?.id ?? "",
    routeId: schedule?.routeId ?? firstRoute?.id ?? "",
    departureAt: schedule ? inputDateTime(schedule.departureAt) : dateOffset(1, 8, 0),
    arrivalAt: schedule ? inputDateTime(schedule.arrivalAt) : dateOffset(1, 13, 30),
    totalSeats: schedule?.totalSeats ?? firstVehicle?.seats ?? "",
    availableSeats: schedule?.availableSeats ?? "",
    fare: schedule?.fare ?? firstRoute?.fare ?? "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const operatorVehicles = vehicles.filter((vehicle) => vehicle.operatorId === values.operatorId);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === values.vehicleId);
  const compatibleRoutes = routes.filter((route) => !selectedVehicle || route.transport === selectedVehicle.transport);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function changeOperator(operatorId) {
    const nextVehicle = vehicles.find((vehicle) => vehicle.operatorId === operatorId);
    const nextRoute = routes.find((route) => !nextVehicle || route.transport === nextVehicle.transport);
    setValues((current) => ({
      ...current,
      operatorId,
      vehicleId: nextVehicle?.id ?? "",
      routeId: nextRoute?.id ?? "",
      totalSeats: nextVehicle?.seats ?? "",
      availableSeats: nextVehicle?.seats ?? "",
    }));
    setErrors((current) => ({ ...current, operatorId: "", vehicleId: "", routeId: "", totalSeats: "", availableSeats: "" }));
  }

  function changeVehicle(vehicleId) {
    const nextVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
    const nextRoute = routes.find((route) => !nextVehicle || route.transport === nextVehicle.transport);
    setValues((current) => ({
      ...current,
      vehicleId,
      routeId: nextRoute?.id ?? "",
      totalSeats: nextVehicle?.seats ?? "",
      availableSeats: nextVehicle?.seats ?? "",
    }));
    setErrors((current) => ({ ...current, vehicleId: "", routeId: "", totalSeats: "", availableSeats: "" }));
  }

  function changeRoute(routeId) {
    const route = routes.find((item) => item.id === routeId);
    const durationMinutes = route?.durationMinutes ?? 0;
    const departureAt = values.departureAt;
    const arrivalAt = departureAt && durationMinutes > 0 ? new Date(new Date(departureAt).getTime() + durationMinutes * 60000) : null;
    setValues((current) => ({
      ...current,
      routeId,
      fare: route?.fare ?? current.fare,
      arrivalAt: arrivalAt ? inputDateTime(arrivalAt) : current.arrivalAt,
    }));
    setErrors((current) => ({ ...current, routeId: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    const selectedRoute = routes.find((route) => route.id === values.routeId);
    const selectedOperator = operators.find((operator) => operator.id === values.operatorId);
    const totalSeats = Number(values.totalSeats);
    const seats = Number(values.availableSeats);
    const fare = Number(values.fare);
    if (!selectedOperator || selectedOperator.status !== "active") nextErrors.operatorId = "Select an active operator.";
    if (!selectedVehicle || selectedVehicle.operatorId !== values.operatorId) nextErrors.vehicleId = "Select a vehicle assigned to this operator.";
    if (!selectedRoute || selectedRoute.status !== "active") nextErrors.routeId = "Select an active route.";
    else if (selectedVehicle && selectedRoute.transport !== selectedVehicle.transport) nextErrors.routeId = "Route transport type must match the selected vehicle.";
    if (!values.departureAt || Number.isNaN(new Date(values.departureAt).getTime())) nextErrors.departureAt = "Choose a valid departure date and time.";
    if (!values.arrivalAt || Number.isNaN(new Date(values.arrivalAt).getTime())) nextErrors.arrivalAt = "Choose a valid arrival date and time.";
    if (values.departureAt && values.arrivalAt && new Date(values.arrivalAt) <= new Date(values.departureAt)) {
      nextErrors.arrivalAt = "Arrival must be after departure.";
    }
    if (!Number.isInteger(totalSeats) || !selectedVehicle || totalSeats !== selectedVehicle.seats) {
      nextErrors.totalSeats = "Total seats must match the selected vehicle capacity.";
    }
    if (!Number.isInteger(seats) || seats < 0 || (selectedVehicle && seats > selectedVehicle.seats)) {
      nextErrors.availableSeats = selectedVehicle
        ? `Enter available seats from 0 to ${selectedVehicle.seats}.`
        : "Enter a valid available seat count.";
    }
    if (!Number.isFinite(fare) || fare < 0 || fare > 100000000) nextErrors.fare = "Enter a fare between ৳0 and ৳100,000,000.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setFormError("");
    try {
      await onSave({
        ...schedule,
        operatorId: values.operatorId,
        vehicleId: values.vehicleId,
        routeId: values.routeId,
        transport: selectedVehicle.transport,
        departureAt: new Date(values.departureAt).toISOString(),
        arrivalAt: new Date(values.arrivalAt).toISOString(),
        totalSeats,
        availableSeats: seats,
        fare,
      });
      onClose();
    } catch (error) {
      setFormError(error.message);
      if (error.errors) setErrors((current) => ({ ...current, ...error.errors }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="schedule-modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="schedule-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-form-title">
        <header className="schedule-modal-header"><div><span className="schedule-eyebrow">{schedule ? "JOURNEY DETAILS" : "NEW JOURNEY"}</span><h2 id="schedule-form-title">{schedule ? "Edit schedule" : "Add schedule"}</h2><p>{schedule ? "Update service assignment and departure times." : "Create a journey using active operators, vehicles, and routes."}</p></div><button className="schedule-icon-button" type="button" aria-label="Close dialog" onClick={onClose} disabled={saving}><X size={19} /></button></header>
        <form className="schedule-form" onSubmit={submit} noValidate>
          <label className="schedule-field"><span>Operator</span><select value={values.operatorId} onChange={(event) => changeOperator(event.target.value)} aria-invalid={Boolean(errors.operatorId)}><option value="">Select an operator</option>{operators.map((operator) => <option value={operator.id} key={operator.id}>{operator.name} · {operator.id}</option>)}</select>{errors.operatorId && <small className="schedule-error">{errors.operatorId}</small>}</label>
          <div className="schedule-form-row">
            <label className="schedule-field"><span>Vehicle</span><select value={values.vehicleId} onChange={(event) => changeVehicle(event.target.value)} aria-invalid={Boolean(errors.vehicleId)}><option value="">Select a vehicle</option>{operatorVehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.name} · {vehicle.transport} · {vehicle.seats} seats</option>)}</select>{errors.vehicleId && <small className="schedule-error">{errors.vehicleId}</small>}</label>
            <label className="schedule-field"><span>Route</span><select value={values.routeId} onChange={(event) => changeRoute(event.target.value)} aria-invalid={Boolean(errors.routeId)}><option value="">Select a route</option>{compatibleRoutes.map((route) => <option value={route.id} key={route.id}>{route.departure} → {route.destination}</option>)}</select>{errors.routeId && <small className="schedule-error">{errors.routeId}</small>}</label>
          </div>
          <div className="schedule-form-row">
            <label className="schedule-field"><span>Departure date &amp; time</span><input type="datetime-local" value={values.departureAt} onChange={(event) => update("departureAt", event.target.value)} aria-invalid={Boolean(errors.departureAt)} />{errors.departureAt && <small className="schedule-error">{errors.departureAt}</small>}</label>
            <label className="schedule-field"><span>Arrival date &amp; time</span><input type="datetime-local" value={values.arrivalAt} onChange={(event) => update("arrivalAt", event.target.value)} aria-invalid={Boolean(errors.arrivalAt)} />{errors.arrivalAt && <small className="schedule-error">{errors.arrivalAt}</small>}</label>
          </div>
          <div className="schedule-form-row">
            <label className="schedule-field"><span>Total seats</span><input type="number" value={values.totalSeats} readOnly placeholder="Set by selected vehicle" aria-invalid={Boolean(errors.totalSeats)} />{errors.totalSeats && <small className="schedule-error">{errors.totalSeats}</small>}</label>
            <label className="schedule-field"><span>Available seats</span><input type="number" min="0" max={selectedVehicle?.seats ?? 1000} step="1" value={values.availableSeats} onChange={(event) => update("availableSeats", event.target.value)} placeholder={selectedVehicle ? `Up to ${selectedVehicle.seats}` : "Select vehicle first"} aria-invalid={Boolean(errors.availableSeats)} />{errors.availableSeats && <small className="schedule-error">{errors.availableSeats}</small>}</label>
          </div>
          <label className="schedule-field"><span>Ticket fare (৳)</span><input type="number" min="0" max="100000000" step="1" value={values.fare} onChange={(event) => update("fare", event.target.value)} placeholder="e.g. 850" aria-invalid={Boolean(errors.fare)} />{errors.fare && <small className="schedule-error">{errors.fare}</small>}</label>
          {selectedVehicle && <small className="schedule-form-hint">Total capacity is fixed at {selectedVehicle.seats} seats for this vehicle.</small>}
          {formError && <p className="schedule-form-error" role="alert">{formError}</p>}
          <footer className="schedule-form-actions"><button className="schedule-button secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="schedule-button primary" type="submit" disabled={saving}>{saving ? "Saving..." : schedule ? "Save changes" : "Add schedule"}</button></footer>
        </form>
      </section>
    </div>
  );
}

function ScheduleDrawer({ schedule, operatorName, vehicleName, route, canEdit, onClose, onEdit, onSetStatus, onCancel, onDelete }) {
  useEffect(() => {
    if (!schedule) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [schedule, onClose]);
  if (!schedule) return null;

  return (
    <div className="schedule-drawer-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="schedule-drawer" role="dialog" aria-modal="true" aria-labelledby="schedule-drawer-title">
        <header className="schedule-drawer-header"><div><span className="schedule-eyebrow">JOURNEY PREVIEW</span><h2 id="schedule-drawer-title">Schedule details</h2></div><button className="schedule-icon-button" type="button" aria-label="Close schedule details" onClick={onClose}><X size={19} /></button></header>
        <div className="schedule-drawer-content">
          <section className="schedule-profile-card"><span className="schedule-id">{schedule.id}</span><div className="schedule-journey"><div><span><MapPin size={14} /></span><small>DEPARTURE</small><strong>{route?.departure ?? "Route unavailable"}</strong><time>{formatDateTime(schedule.departureAt)}</time></div><ArrowRight size={19} /><div><span><MapPin size={14} /></span><small>ARRIVAL</small><strong>{route?.destination ?? "Route unavailable"}</strong><time>{formatDateTime(schedule.arrivalAt)}</time></div></div><div className="schedule-profile-tags"><ScheduleStatus status={schedule.status} /><span className="schedule-type-pill"><ScheduleTransportIcon type={schedule.transport} />{schedule.transport}</span></div><div className="schedule-profile-actions">{schedule.status !== "completed" && <button className="schedule-button secondary" type="button" disabled={schedule.status !== "cancelled" && !canEdit} title={schedule.status !== "cancelled" && !canEdit ? "Schedules with reserved seats cannot be cancelled." : undefined} onClick={() => schedule.status === "cancelled" ? onSetStatus(schedule, "scheduled") : onCancel(schedule)}>{schedule.status === "cancelled" ? <Check size={14} /> : <X size={14} />}{schedule.status === "cancelled" ? "Reactivate" : "Cancel schedule"}</button>}<button className="schedule-button secondary" type="button" disabled={!canEdit} title={!canEdit ? "Schedules with reserved seats cannot be edited." : undefined} onClick={() => onEdit(schedule)}><Pencil size={14} />Edit schedule</button></div></section>
          <section className="schedule-details-section"><h3>Service information</h3><div className="schedule-detail-row"><span><Bus size={15} /></span><div><small>Operator</small><strong>{operatorName}</strong></div></div><div className="schedule-detail-row"><span><ScheduleTransportIcon type={schedule.transport} /></span><div><small>Vehicle</small><strong>{vehicleName}</strong></div></div><div className="schedule-detail-row"><span><Ticket size={15} /></span><div><small>Available seats</small><strong>{schedule.availableSeats.toLocaleString("en-BD")} / {schedule.totalSeats.toLocaleString("en-BD")}</strong></div></div><div className="schedule-detail-row"><span><Ticket size={15} /></span><div><small>Ticket fare</small><strong>৳{new Intl.NumberFormat("en-BD").format(schedule.fare)}</strong></div></div></section>
          {!canEdit && <div className="schedule-live-note">This schedule has reserved seats. Updates and cancellation are blocked to protect passenger reservations.</div>}
          <div className="schedule-live-note">Schedule information is stored in the database.</div>
          <button className="schedule-delete-link" type="button" disabled={!canEdit} title={!canEdit ? "Schedules with reserved seats cannot be archived." : undefined} onClick={() => onDelete(schedule)}><Trash2 size={14} />Archive schedule</button>
        </div>
      </aside>
    </div>
  );
}

function ScheduleConfirm({ schedule, mode, busy, onClose, onConfirm }) {
  useEffect(() => {
    if (!schedule) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [schedule, onClose]);
  if (!schedule) return null;
  const deleting = mode === "delete";
  return (
    <div className="schedule-modal-scrim schedule-confirm-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="schedule-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="schedule-confirm-title" aria-describedby="schedule-confirm-description">
        <span className={`schedule-confirm-icon${deleting ? " danger" : ""}`}>{deleting ? <Trash2 size={19} /> : <X size={19} />}</span>
        <h2 id="schedule-confirm-title">{deleting ? "Archive this schedule?" : "Cancel this schedule?"}</h2>
        <p id="schedule-confirm-description">{deleting ? <>This will cancel and archive <strong>{schedule.id}</strong>. Its database record will be retained. Schedules with reserved seats cannot be archived.</> : <>This will cancel the <strong>{schedule.id}</strong> journey from {formatDateTime(schedule.departureAt)}. Schedules with reserved seats cannot be cancelled.</>}</p>
        <footer className="schedule-form-actions"><button className="schedule-button secondary" type="button" disabled={busy} onClick={onClose}>Keep schedule</button><button className={`schedule-button ${deleting ? "danger" : "warning"}`} type="button" disabled={busy} onClick={onConfirm}>{busy ? "Saving..." : deleting ? "Archive schedule" : "Cancel schedule"}</button></footer>
      </section>
    </div>
  );
}

function ScheduleActions({ schedule, open, canEdit, onToggleMenu, onView, onEdit, onCancel, onActivate, onSetActive, onDelete }) {
  return (
    <span className="schedule-row-actions">
      <button className="schedule-icon-button" type="button" aria-label={`Actions for ${schedule.id}`} aria-expanded={open} onClick={onToggleMenu}><MoreHorizontal size={18} /></button>
      {open && <span className="schedule-action-menu" role="menu">
        <button type="button" role="menuitem" onClick={onView}><Eye size={14} />View details</button>
        <button type="button" role="menuitem" disabled={!canEdit} title={!canEdit ? "Schedule has reserved seats." : undefined} onClick={onEdit}><Pencil size={14} />Edit schedule</button>
        {schedule.status === "cancelled"
          ? <button type="button" role="menuitem" onClick={onActivate}><Check size={14} />Activate schedule</button>
          : schedule.status === "scheduled" && <button type="button" role="menuitem" onClick={onSetActive}><Check size={14} />Mark as active</button>}
        {(schedule.status === "scheduled" || schedule.status === "active") && <button type="button" role="menuitem" disabled={!canEdit} title={!canEdit ? "Schedule has reserved seats." : undefined} onClick={onCancel}><X size={14} />Cancel schedule</button>}
        <button className="danger-action" type="button" role="menuitem" disabled={!canEdit} title={!canEdit ? "Schedule has reserved seats." : undefined} onClick={onDelete}><Trash2 size={14} />Archive schedule</button>
      </span>}
    </span>
  );
}

function ScheduleCalendar({ schedules, onSelectDate, selectedDate, month, setMonth }) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat("en-BD", { month: "long", year: "numeric" }).format(month);
  const eventCounts = schedules.reduce((counts, schedule) => {
    const key = dateKey(schedule.departureAt);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const cells = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);

  function moveMonth(delta) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <section className="schedule-calendar" aria-label="Schedule calendar">
      <header className="schedule-calendar-header"><div><span className="schedule-calendar-icon"><CalendarDays size={17} /></span><div><h2>Journey calendar</h2><p>Select a date to view its departures.</p></div></div><div className="schedule-calendar-month"><button className="schedule-icon-button" type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></button><strong>{monthLabel}</strong><button className="schedule-icon-button" type="button" aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={17} /></button></div></header>
      <div className="schedule-calendar-grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span className="schedule-calendar-weekday" key={day}>{day}</span>)}
        {cells.map((day, index) => {
          if (!day) return <span className="schedule-calendar-cell empty" key={`empty-${index}`} />;
          const date = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
          const count = eventCounts[date] || 0;
          const today = date === dateKey(new Date());
          return <button className={`schedule-calendar-cell${date === selectedDate ? " selected" : ""}${today ? " today" : ""}${count ? " has-events" : ""}`} type="button" key={date} onClick={() => onSelectDate(date)} aria-label={`${date}${count ? `, ${count} schedules` : ""}`}>
            <span>{day}</span>{count > 0 && <i>{count}</i>}
          </button>;
        })}
      </div>
      <footer className="schedule-calendar-footer"><span><i /> Journeys</span><button type="button" onClick={() => onSelectDate("")}>Clear date selection</button></footer>
    </section>
  );
}

export default function ScheduleManagement({ query, onQueryChange, onToast }) {
  const [schedules, setSchedules] = useState([]);
  const [operators, setOperators] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [statistics, setStatistics] = useState({ total: 0, upcoming: 0, completed: 0, cancelled: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 0 });
  const [calendarSchedules, setCalendarSchedules] = useState([]);
  const [calendarError, setCalendarError] = useState("");
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateFilter, setDateFilter] = useState("all");
  const [specificDate, setSpecificDate] = useState("");
  const [transportFilter, setTransportFilter] = useState("All transport");
  const [operatorFilter, setOperatorFilter] = useState("All operators");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [activeMenu, setActiveMenu] = useState("");
  const [drawerId, setDrawerId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setOptionsLoading(true);
    setOptionsError("");
    Promise.all([
      apiRequest("/admin/operators?status=active&limit=100", { signal: controller.signal }),
      apiRequest("/admin/vehicles?status=active&limit=100", { signal: controller.signal }),
      apiRequest("/admin/routes?status=active&limit=100", { signal: controller.signal }),
    ]).then(([operatorData, vehicleData, routeData]) => {
      if (controller.signal.aborted) return;
      setOperators(operatorData.operators.map((operator) => ({
        id: operator.id,
        name: operator.name,
        transport: operator.transport,
        status: operator.status,
      })));
      setVehicles(vehicleData.vehicles.map((vehicle) => ({
        id: vehicle.id,
        name: vehicle.name,
        operatorId: vehicle.operatorId,
        transport: vehicle.transport,
        seats: vehicle.seatCapacity,
        status: vehicle.status,
      })));
      setRoutes(routeData.routes.map((route) => ({
        id: route.id,
        departure: route.departure,
        destination: route.destination,
        transport: route.transport,
        durationMinutes: route.estimatedDurationMinutes,
        fare: route.startingFare,
        status: route.status,
      })));
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setOperators([]);
      setVehicles([]);
      setRoutes([]);
      setOptionsError(error.message);
    }).finally(() => {
      if (!controller.signal.aborted) setOptionsLoading(false);
    });
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
      sort: "departure_asc",
    });
    if (debouncedQuery) params.set("search", debouncedQuery);
    if (transportFilter !== "All transport") params.set("transport", transportFilter);
    if (operatorFilter !== "All operators") params.set("operatorId", operatorFilter);
    if (statusFilter !== "All statuses") params.set("status", statusFilter);
    const today = dateKey(new Date());
    if (dateFilter === "today") params.set("date", today);
    if (dateFilter === "specific" && specificDate) params.set("date", specificDate);
    if (dateFilter === "next7") {
      const lastDay = new Date();
      lastDay.setDate(lastDay.getDate() + 6);
      params.set("from", today);
      params.set("to", dateKey(lastDay));
    }
    if (dateFilter === "month") {
      const start = new Date();
      start.setDate(1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      params.set("from", dateKey(start));
      params.set("to", dateKey(end));
    }

    setLoading(true);
    setScheduleError("");
    apiRequest(`/admin/schedules?${params}`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setSchedules(data.schedules.map(scheduleFromApi));
        setStatistics(data.statistics);
        setPagination(data.pagination);
        setPage((current) => Math.max(1, Math.min(current, data.pagination.totalPages || 1)));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setSchedules([]);
        setScheduleError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, pageSize, debouncedQuery, dateFilter, specificDate, transportFilter, operatorFilter, statusFilter, refreshKey]);

  useEffect(() => {
    if (!calendarOpen) return undefined;
    const controller = new AbortController();
    setCalendarSchedules([]);
    setCalendarError("");
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const params = new URLSearchParams({
      from: dateKey(monthStart),
      to: dateKey(monthEnd),
      limit: "100",
      sort: "departure_asc",
    });
    apiRequest(`/admin/schedules?${params}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setCalendarSchedules(data.schedules.map(scheduleFromApi));
      })
      .catch((error) => {
        if (!controller.signal.aborted) setCalendarError(error.message);
      });
    return () => controller.abort();
  }, [calendarOpen, calendarMonth, refreshKey]);

  const enrichedSchedules = useMemo(() => schedules.map((schedule) => {
    const operator = operators.find((item) => item.id === schedule.operatorId);
    const vehicle = vehicles.find((item) => item.id === schedule.vehicleId);
    const route = schedule.route ?? routes.find((item) => item.id === schedule.routeId);
    return {
      ...schedule,
      operatorName: schedule.operator?.name ?? operator?.name ?? "Operator unavailable",
      vehicleName: schedule.vehicle?.name ?? vehicle?.name ?? "Vehicle unavailable",
      route,
    };
  }), [schedules, operators, vehicles, routes]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, dateFilter, specificDate, transportFilter, operatorFilter, statusFilter, pageSize]);

  const totalPages = Math.max(1, pagination.totalPages);
  const pageSchedules = enrichedSchedules;
  const drawerSchedule = enrichedSchedules.find((schedule) => schedule.id === drawerId) ?? null;
  const editingSchedule = schedules.find((schedule) => schedule.id === editingId) ?? null;
  const stats = [
    { label: "Total schedules", value: statistics.total, caption: "Database schedules", Icon: CalendarDays, tone: "all" },
    { label: "Upcoming journeys", value: statistics.upcoming, caption: "Scheduled or active departures", Icon: Clock3, tone: "upcoming" },
    { label: "Completed journeys", value: statistics.completed, caption: "Completed database schedules", Icon: Check, tone: "completed" },
    { label: "Cancelled schedules", value: statistics.cancelled, caption: "Cancelled database schedules", Icon: X, tone: "cancelled" },
  ];

  async function saveSchedule(schedule) {
    const isSavedSchedule = Boolean(schedule.id);
    const body = {
      operatorId: schedule.operatorId,
      vehicleId: schedule.vehicleId,
      routeId: schedule.routeId,
      transport: schedule.transport,
      departureAt: schedule.departureAt,
      arrivalAt: schedule.arrivalAt,
      totalSeats: schedule.totalSeats,
      availableSeats: schedule.availableSeats,
      fare: schedule.fare,
    };
    const result = await apiRequest(isSavedSchedule ? `/admin/schedules/${schedule.id}` : "/admin/schedules", {
      method: isSavedSchedule ? "PUT" : "POST",
      body,
    });
    const saved = scheduleFromApi(result.schedule);
    setSchedules((current) => isSavedSchedule
      ? current.map((item) => item.id === saved.id ? saved : item)
      : [saved, ...current].slice(0, pageSize));
    setRefreshKey((key) => key + 1);
    onToast(isSavedSchedule ? "Schedule updated" : "Schedule created", `${saved.id} was saved to the database.`);
  }

  async function setScheduleStatus(schedule, status) {
    try {
      const result = await apiRequest(`/admin/schedules/${schedule.id}/status`, {
        method: "PATCH",
        body: { status },
      });
      const updated = scheduleFromApi(result.schedule);
      setSchedules((current) => current.map((item) => item.id === updated.id ? updated : item));
      setRefreshKey((key) => key + 1);
      setActiveMenu("");
      onToast("Schedule status updated", `${schedule.id} is now ${status}.`);
      return true;
    } catch (error) {
      onToast("Could not update schedule", error.message);
      return false;
    }
  }

  function openAction(action, schedule) {
    setActiveMenu("");
    if (action === "view") setDrawerId(schedule.id);
    if (action === "edit") {
      setDrawerId("");
      setEditingId(schedule.id);
    }
    if (action === "cancel") setConfirmTarget({ schedule, mode: "cancel" });
    if (action === "activate") setScheduleStatus(schedule, "scheduled");
    if (action === "setActive") setScheduleStatus(schedule, "active");
    if (action === "delete") {
      setDrawerId("");
      setConfirmTarget({ schedule, mode: "delete" });
    }
  }

  async function confirmScheduleAction() {
    if (!confirmTarget) return;
    const { schedule, mode } = confirmTarget;
    setActionBusy(true);
    if (mode === "cancel") {
      try {
        const updated = await setScheduleStatus(schedule, "cancelled");
        if (updated) setConfirmTarget(null);
      } finally {
        setActionBusy(false);
      }
      return;
    }
    try {
      await apiRequest(`/admin/schedules/${schedule.id}`, { method: "DELETE" });
      setSchedules((current) => current.filter((item) => item.id !== schedule.id));
      setDrawerId("");
      setRefreshKey((key) => key + 1);
      onToast("Schedule archived", `${schedule.id} was cancelled and archived. Its database record was retained.`);
      setConfirmTarget(null);
    } catch (error) {
      onToast("Could not archive schedule", error.message);
    } finally {
      setActionBusy(false);
    }
  }

  function setCalendarDate(date) {
    setSpecificDate(date);
    setDateFilter(date ? "specific" : "all");
    if (date) {
      const [year, month] = date.split("-").map(Number);
      setCalendarMonth(new Date(year, month - 1, 1));
    }
  }

  const locationFor = (schedule, field) => schedule.route?.[field] ?? routes.find((route) => route.id === schedule.routeId)?.[field] ?? "Route unavailable";

  return (
    <section className="schedule-management">
      <div className="schedule-live-note"><span /> LIVE DATABASE DATA <span>Schedules and related operator, vehicle, and route details are loaded from MongoDB.</span><button className="schedule-icon-button" type="button" aria-label="Refresh schedules" disabled={loading} onClick={() => setRefreshKey((key) => key + 1)}><RefreshCw size={14} /></button></div>
      {scheduleError && <div className="schedule-page-error" role="alert"><strong>Could not load schedules.</strong> {scheduleError}<button type="button" onClick={() => setRefreshKey((key) => key + 1)}>Retry</button></div>}
      {optionsError && <div className="schedule-page-error" role="alert"><strong>Schedule options unavailable.</strong> {optionsError} Active operators, vehicles, and routes could not be loaded.</div>}
      <header className="schedule-page-heading"><div><span className="schedule-eyebrow">WORKSPACE <ArrowRight size={12} /> SCHEDULES</span><h1>Schedule Management</h1><p>Plan journeys, assign fleet and track departure schedules.</p></div><button className="schedule-button primary" type="button" disabled={optionsLoading || Boolean(optionsError)} title={optionsError || undefined} onClick={() => setAdding(true)}><Plus size={16} />Add schedule</button></header>
      <section className="schedule-stats-grid" aria-label="Schedule statistics">{stats.map(({ label, value, caption, Icon, tone }) => <article className="schedule-stat-card" key={label}><span className={`schedule-stat-icon ${tone}`}><Icon size={18} /></span><span className="schedule-stat-label">{label}</span><strong>{value.toLocaleString("en-BD")}</strong><small>{caption}</small></article>)}</section>

      <div className={`schedule-calendar-wrap${calendarOpen ? " is-open" : ""}`}>
        <button className="schedule-calendar-toggle" type="button" aria-expanded={calendarOpen} onClick={() => setCalendarOpen((value) => !value)}><span><CalendarDays size={17} />Date-wise calendar</span><span className="schedule-calendar-toggle-right">{dateFilter === "specific" && specificDate && <small>{specificDate}</small>}<ChevronDown size={16} /></span></button>
        {calendarOpen && <ScheduleCalendar schedules={calendarSchedules} onSelectDate={setCalendarDate} selectedDate={dateFilter === "specific" ? specificDate : ""} month={calendarMonth} setMonth={setCalendarMonth} />}
        {calendarOpen && calendarError && <p className="schedule-calendar-error" role="alert">Could not load calendar schedules. {calendarError}</p>}
      </div>

      <section className="schedule-table-card">
        <header className="schedule-table-heading"><div><h2>Journey schedules <span>{pagination.total.toLocaleString("en-BD")}</span></h2><p>View and manage upcoming, completed and cancelled journeys.</p></div><div className="schedule-search-caption"><Search size={15} /><span>{query ? `Searching “${query}”` : "Search ID, operator or route"}</span></div></header>
        <div className="schedule-filters">
          <label className="schedule-search-field"><Search size={15} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search ID, operator or route..." aria-label="Search schedule ID, operator or route" />{query && <button type="button" aria-label="Clear schedule search" onClick={() => onQueryChange("")}><X size={14} /></button>}</label>
          <label className="schedule-filter-select schedule-date-filter"><CalendarDays size={14} /><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filter by date"><option value="all">All dates</option><option value="today">Today</option><option value="next7">Next 7 days</option><option value="month">This month</option><option value="specific">Choose date</option></select><ChevronDown size={14} /></label>
          {dateFilter === "specific" && <input className="schedule-specific-date" type="date" value={specificDate} aria-label="Choose a specific schedule date" onChange={(event) => setSpecificDate(event.target.value)} />}
          <label className="schedule-filter-select"><Bus size={14} /><select value={transportFilter} onChange={(event) => setTransportFilter(event.target.value)} aria-label="Filter by transport type"><option>All transport</option><option>Bus</option><option>Train</option><option>Launch</option></select><ChevronDown size={14} /></label>
          <label className="schedule-filter-select"><Bus size={14} /><select value={operatorFilter} onChange={(event) => setOperatorFilter(event.target.value)} aria-label="Filter by operator"><option value="All operators">All operators</option>{operators.map((operator) => <option value={operator.id} key={operator.id}>{operator.name}</option>)}</select><ChevronDown size={14} /></label>
          <label className="schedule-filter-select"><Check size={14} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by schedule status"><option value="All statuses">All statuses</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><ChevronDown size={14} /></label>
        </div>
        <div className="schedule-table-scroll"><table className="schedule-table"><thead><tr><th>SCHEDULE ID</th><th>OPERATOR</th><th>VEHICLE</th><th>TRANSPORT</th><th>DEPARTURE</th><th>DESTINATION</th><th>DEPARTURE DATE &amp; TIME</th><th>ARRIVAL DATE &amp; TIME</th><th>AVAILABLE SEATS</th><th>TICKET FARE</th><th>STATUS</th><th><span className="schedule-sr-only">Actions</span></th></tr></thead><tbody>
          {pageSchedules.map((schedule) => {
            const canEdit = schedule.availableSeats >= schedule.totalSeats;
            return <tr key={schedule.id}><td><button className="schedule-id-link" type="button" onClick={() => setDrawerId(schedule.id)}>{schedule.id}</button></td><td className="schedule-operator-cell">{schedule.operatorName}</td><td className="schedule-vehicle-cell">{schedule.vehicleName}</td><td><span className="schedule-transport"><ScheduleTransportIcon type={schedule.transport} />{schedule.transport}</span></td><td><span className="schedule-location"><MapPin size={13} />{locationFor(schedule, "departure")}</span></td><td><span className="schedule-location"><MapPin size={13} />{locationFor(schedule, "destination")}</span></td><td className="schedule-datetime">{formatDateTime(schedule.departureAt)}</td><td className="schedule-datetime">{formatDateTime(schedule.arrivalAt)}</td><td className="schedule-seats">{schedule.availableSeats.toLocaleString("en-BD")} / {schedule.totalSeats.toLocaleString("en-BD")}</td><td className="schedule-fare">৳{new Intl.NumberFormat("en-BD").format(schedule.fare)}</td><td><ScheduleStatus status={schedule.status} /></td><td><ScheduleActions schedule={schedule} canEdit={canEdit} open={activeMenu === schedule.id} onToggleMenu={() => setActiveMenu((current) => current === schedule.id ? "" : schedule.id)} onView={() => openAction("view", schedule)} onEdit={() => openAction("edit", schedule)} onCancel={() => openAction("cancel", schedule)} onActivate={() => openAction("activate", schedule)} onSetActive={() => openAction("setActive", schedule)} onDelete={() => openAction("delete", schedule)} /></td></tr>;
          })}
          {pageSchedules.length === 0 && <tr><td className="schedule-empty" colSpan="12"><Search size={20} /><strong>{loading ? "Loading schedules…" : "No schedules found"}</strong><span>{loading ? "Getting the latest records from MongoDB." : "Try changing your search or filters."}</span></td></tr>}
        </tbody></table></div>
        <footer className="schedule-pagination"><span>Showing <strong>{pagination.total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, pagination.total)}</strong> of <strong>{pagination.total.toLocaleString("en-BD")}</strong> schedules</span><div className="schedule-page-controls"><label>Rows per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value="8">8</option><option value="12">12</option><option value="20">20</option></select></label><button className="schedule-icon-button" type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /></button><span>{page} <small>of</small> {totalPages}</span><button className="schedule-icon-button" type="button" aria-label="Next page" disabled={page >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={17} /></button></div></footer>
      </section>

      {(adding || editingId) && !optionsLoading && <ScheduleModal key={editingId || "new"} schedule={editingSchedule} operators={operators} vehicles={vehicles} routes={routes} onClose={() => { setAdding(false); setEditingId(null); }} onSave={saveSchedule} />}
      <ScheduleDrawer schedule={drawerSchedule} operatorName={drawerSchedule?.operatorName} vehicleName={drawerSchedule?.vehicleName} route={drawerSchedule?.route} canEdit={drawerSchedule ? drawerSchedule.availableSeats >= drawerSchedule.totalSeats : true} onClose={() => setDrawerId("")} onEdit={(schedule) => openAction("edit", schedule)} onSetStatus={async (schedule, status) => { if (await setScheduleStatus(schedule, status)) setDrawerId(""); }} onCancel={(schedule) => openAction("cancel", schedule)} onDelete={(schedule) => openAction("delete", schedule)} />
      <ScheduleConfirm schedule={confirmTarget?.schedule} mode={confirmTarget?.mode} busy={actionBusy} onClose={() => { if (!actionBusy) setConfirmTarget(null); }} onConfirm={confirmScheduleAction} />
    </section>
  );
}
