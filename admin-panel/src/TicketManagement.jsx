import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bus,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  MapPin,
  MoreHorizontal,
  Printer,
  QrCode,
  Search,
  Ship,
  Ticket,
  TrainFront,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { initialBookings } from "./BookingManagement.jsx";
import { initialSchedules } from "./ScheduleManagement.jsx";
import { initialVehicles } from "./VehicleManagement.jsx";
import "./ticket-management.css";

const seatLabels = (transport, index) => {
  const row = Math.floor(index / 4) + 1;
  const seat = ["A", "B", "C", "D"][index % 4];
  if (transport === "Train") return `${String.fromCharCode(65 + (Math.floor(index / 6) % 4))}${row}`;
  if (transport === "Launch") return `D${row}-${seat}`;
  return `${row}${seat}`;
};

const ticketStatusFor = (booking) => {
  if (booking.status === "cancelled") return "cancelled";
  if (booking.status === "completed") return "used";
  if (new Date(booking.departureAt).getTime() < Date.now()) return "expired";
  return "active";
};

export const initialTickets = initialBookings.flatMap((booking, bookingIndex) => {
  const schedule = initialSchedules.find((item) => item.id === booking.scheduleId);
  const vehicle = initialVehicles.find((item) => item.id === schedule?.vehicleId);
  const farePerPassenger = Math.round(booking.totalAmount / booking.passengers);
  return Array.from({ length: booking.passengers }, (_, passengerIndex) => ({
    id: `TKT-${String(731502 + bookingIndex * 12 + passengerIndex).padStart(6, "0")}`,
    bookingId: booking.id,
    passengerIndex,
    passengerCount: booking.passengers,
    passengerName: booking.passengers > 1 ? `${booking.customerName} · Passenger ${passengerIndex + 1}` : booking.customerName,
    customerEmail: booking.customerEmail,
    transport: booking.transport,
    operatorId: booking.operatorId,
    operatorName: booking.operatorName,
    routeId: booking.routeId,
    departure: booking.departure,
    destination: booking.destination,
    departureAt: booking.departureAt,
    arrivalAt: booking.arrivalAt,
    seatNumber: seatLabels(booking.transport, (bookingIndex * 3 + passengerIndex) % Math.max(4, vehicle?.seats ?? 40)),
    ticketPrice: farePerPassenger,
    paymentStatus: booking.paymentStatus,
    status: ticketStatusFor(booking),
    color: booking.color,
    ticketCode: `${booking.ticketCode}${passengerIndex ? String(passengerIndex + 1) : ""}`,
  }));
});

function TransportIcon({ type, size = 14 }) {
  if (type === "Train") return <TrainFront size={size} />;
  if (type === "Launch") return <Ship size={size} />;
  return <Bus size={size} />;
}

function TicketStatus({ status }) {
  const labels = { active: "Active", used: "Used", cancelled: "Cancelled", expired: "Expired" };
  return <span className={`ticket-status ${status}`}><i />{labels[status] || status}</span>;
}

function PassengerAvatar({ ticket, large = false }) {
  const initials = ticket.passengerName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className={`ticket-avatar ${ticket.color || "mint"}${large ? " large" : ""}`}>{initials}</span>;
}

function QrPlaceholder() {
  return <div className="ticket-qr-placeholder" role="img" aria-label="Demo QR code placeholder">
    <span className="qr-finder top-left"><i /></span><span className="qr-finder top-right"><i /></span><span className="qr-finder bottom-left"><i /></span>
    <span className="qr-pixels" />
    <small>DEMO QR</small>
  </div>;
}

function TicketActions({ ticket, open, onToggleMenu, onView, onDownload, onVerify, onCancel }) {
  return (
    <span className="ticket-row-actions">
      <button className="ticket-icon-button" type="button" aria-label={`Actions for ${ticket.id}`} aria-expanded={open} onClick={onToggleMenu}><MoreHorizontal size={18} /></button>
      {open && <span className="ticket-action-menu" role="menu">
        <button type="button" role="menuitem" onClick={onView}><Eye size={14} />View details</button>
        <button type="button" role="menuitem" onClick={onDownload}><Download size={14} />Download PDF</button>
        {ticket.status === "active" && <button type="button" role="menuitem" onClick={onVerify}><Check size={14} />Verify ticket</button>}
        {ticket.status === "active" && <button className="danger-action" type="button" role="menuitem" onClick={onCancel}><X size={14} />Cancel ticket</button>}
      </span>}
    </span>
  );
}

function TicketDrawer({ ticket, onClose, onPreview, onVerify, onCancel }) {
  useEffect(() => {
    if (!ticket) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ticket, onClose]);
  if (!ticket) return null;

  const formatDateTime = (date) => new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
  const money = (amount) => `৳${new Intl.NumberFormat("en-BD").format(amount)}`;

  return (
    <div className="ticket-drawer-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="ticket-drawer" role="dialog" aria-modal="true" aria-labelledby="ticket-drawer-title">
        <header className="ticket-drawer-header"><div><span className="ticket-eyebrow">PASSENGER TICKET</span><h2 id="ticket-drawer-title">Ticket details</h2></div><button className="ticket-icon-button" type="button" aria-label="Close ticket details" onClick={onClose}><X size={19} /></button></header>
        <div className="ticket-drawer-content">
          <section className="ticket-passenger-card"><div className="ticket-passenger-heading"><PassengerAvatar ticket={ticket} large /><div><h3>{ticket.passengerName}</h3><span>{ticket.id}</span></div></div><div className="ticket-profile-tags"><TicketStatus status={ticket.status} /><span className={`ticket-payment-tag ${ticket.paymentStatus}`}>{ticket.paymentStatus}</span></div><div className="ticket-passenger-email"><UserRound size={14} /><span>{ticket.customerEmail}</span></div></section>
          <section className="ticket-detail-section"><h3>Journey information</h3><div className="ticket-journey-visual"><div><small>FROM</small><strong>{ticket.departure}</strong><time>{formatDateTime(ticket.departureAt)}</time></div><ArrowRight size={18} /><div><small>TO</small><strong>{ticket.destination}</strong><time>{formatDateTime(ticket.arrivalAt)}</time></div></div><div className="ticket-detail-row"><span><TransportIcon type={ticket.transport} /></span><div><small>Transport &amp; operator</small><strong>{ticket.transport} · {ticket.operatorName}</strong></div></div><div className="ticket-detail-row"><span><Ticket size={15} /></span><div><small>Booking reference</small><strong>{ticket.bookingId}</strong></div></div></section>
          <section className="ticket-detail-section"><h3>Seat &amp; fare information</h3><div className="ticket-seat-summary"><div><small>SEAT</small><strong>{ticket.seatNumber}</strong></div><div><small>PASSENGERS</small><strong>{ticket.passengerIndex + 1} of {ticket.passengerCount}</strong></div><div><small>FARE</small><strong>{money(ticket.ticketPrice)}</strong></div></div><div className="ticket-fare-line"><span>Ticket fare</span><strong>{money(ticket.ticketPrice)}</strong></div><div className="ticket-fare-line"><span>Payment status</span><strong className={`ticket-payment-text ${ticket.paymentStatus}`}>{ticket.paymentStatus}</strong></div></section>
          <div className="ticket-qr-card"><QrPlaceholder /><div><strong>Scan to verify ticket</strong><small>Ticket code · {ticket.ticketCode}</small><small>Demo QR placeholder — not valid for travel.</small></div></div>
          <div className="ticket-drawer-actions"><button className="ticket-button secondary" type="button" onClick={() => onPreview(ticket)}><Eye size={14} />Ticket preview</button><button className="ticket-button secondary" type="button" onClick={() => onPreview(ticket)}><Download size={14} />Download PDF</button>{ticket.status === "active" && <><button className="ticket-button primary" type="button" onClick={() => onVerify(ticket)}><Check size={14} />Verify</button><button className="ticket-button danger-outline" type="button" onClick={() => onCancel(ticket)}><X size={14} />Cancel</button></>}</div>
          <div className="ticket-demo-note"><Check size={14} /> Demo ticket data is stored locally in this browser session.</div>
        </div>
      </aside>
    </div>
  );
}

function TicketPreview({ ticket, onClose, onDownload }) {
  useEffect(() => {
    if (!ticket) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ticket, onClose]);
  if (!ticket) return null;
  const formatDateTime = (date) => new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));

  return (
    <div className="ticket-modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="ticket-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="ticket-preview-title">
        <h2 className="ticket-sr-only" id="ticket-preview-title">E-ticket preview · {ticket.id}</h2>
        <header><span className="ticket-eyebrow">E-TICKETING · DEMO E-TICKET</span><button className="ticket-icon-button" type="button" aria-label="Close ticket preview" onClick={onClose}><X size={18} /></button></header>
        <div className="ticket-paper">
          <div className="ticket-brand"><span><Ticket size={18} /></span><div><strong>E-Ticketing</strong><small>Passenger journey pass</small></div><TicketStatus status={ticket.status} /></div>
          <div className="ticket-ref"><span>TICKET ID</span><strong>{ticket.id}</strong><small>Booking reference · {ticket.bookingId}</small></div>
          <div className="ticket-route"><div><small>DEPARTURE</small><strong>{ticket.departure}</strong><time>{formatDateTime(ticket.departureAt)}</time></div><ArrowRight size={20} /><div><small>DESTINATION</small><strong>{ticket.destination}</strong><time>{formatDateTime(ticket.arrivalAt)}</time></div></div>
          <div className="ticket-paper-info"><div><small>PASSENGER</small><strong>{ticket.passengerName}</strong></div><div><small>OPERATOR</small><strong>{ticket.operatorName}</strong></div><div><small>TRANSPORT</small><strong>{ticket.transport}</strong></div><div><small>SEAT</small><strong>{ticket.seatNumber}</strong></div><div><small>JOURNEY FARE</small><strong>৳{new Intl.NumberFormat("en-BD").format(ticket.ticketPrice)}</strong></div><div><small>PAYMENT</small><strong className={`ticket-payment-text ${ticket.paymentStatus}`}>{ticket.paymentStatus}</strong></div></div>
          <div className="ticket-paper-qr"><QrPlaceholder /><div><strong>Present this ticket when boarding</strong><small>Ticket code · {ticket.ticketCode}</small><small>QR code shown is for demo preview only.</small></div></div>
          <footer><span>Digital ticket · No printing required</span><span>{ticket.status.toUpperCase()}</span></footer>
        </div>
        <div className="ticket-preview-actions"><button className="ticket-button secondary" type="button" onClick={onClose}>Close preview</button><button className="ticket-button primary" type="button" onClick={() => onDownload(ticket)}><Download size={14} />Download PDF</button></div>
      </section>
    </div>
  );
}

function TicketConfirm({ ticket, mode, onClose, onConfirm }) {
  useEffect(() => {
    if (!ticket) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ticket, onClose]);
  if (!ticket) return null;
  const verifying = mode === "verify";
  return (
    <div className="ticket-modal-scrim ticket-confirm-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="ticket-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ticket-confirm-title" aria-describedby="ticket-confirm-description">
        <span className={`ticket-confirm-icon${verifying ? " verify" : ""}`}>{verifying ? <Check size={19} /> : <X size={19} />}</span>
        <h2 id="ticket-confirm-title">{verifying ? "Verify this ticket?" : "Cancel this ticket?"}</h2>
        <p id="ticket-confirm-description">{verifying ? <>Mark <strong>{ticket.id}</strong> for {ticket.passengerName} as used?</> : <>This will cancel ticket <strong>{ticket.id}</strong> for {ticket.passengerName}.</>}</p>
        <footer><button className="ticket-button secondary" type="button" onClick={onClose}>Go back</button><button className={`ticket-button ${verifying ? "primary" : "danger"}`} type="button" onClick={onConfirm}>{verifying ? "Verify ticket" : "Cancel ticket"}</button></footer>
      </section>
    </div>
  );
}

export default function TicketManagement({ tickets, setTickets, query, onQueryChange, onToast }) {
  const [transportFilter, setTransportFilter] = useState("All transport");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [operatorFilter, setOperatorFilter] = useState("All operators");
  const [journeyDate, setJourneyDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [activeMenu, setActiveMenu] = useState("");
  const [drawerId, setDrawerId] = useState("");
  const [previewId, setPreviewId] = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null);

  const operators = useMemo(() => [...new Map(tickets.map((ticket) => [ticket.operatorId, { id: ticket.operatorId, name: ticket.operatorName }])).values()].sort((a, b) => a.name.localeCompare(b.name)), [tickets]);
  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const searchText = `${ticket.id} ${ticket.bookingId} ${ticket.passengerName}`.toLowerCase();
    const value = new Date(ticket.departureAt);
    const date = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    return (!query.trim() || searchText.includes(query.trim().toLowerCase()))
      && (transportFilter === "All transport" || ticket.transport === transportFilter)
      && (statusFilter === "All statuses" || ticket.status === statusFilter)
      && (operatorFilter === "All operators" || ticket.operatorId === operatorFilter)
      && (!journeyDate || date === journeyDate);
  }).sort((a, b) => new Date(a.departureAt) - new Date(b.departureAt) || a.id.localeCompare(b.id)), [tickets, query, transportFilter, statusFilter, operatorFilter, journeyDate]);

  useEffect(() => {
    setPage(1);
  }, [query, transportFilter, statusFilter, operatorFilter, journeyDate, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const pageTickets = filteredTickets.slice((page - 1) * pageSize, page * pageSize);
  const drawerTicket = tickets.find((ticket) => ticket.id === drawerId) ?? null;
  const previewTicket = tickets.find((ticket) => ticket.id === previewId) ?? null;
  const confirmTicket = confirmTarget ? tickets.find((ticket) => ticket.id === confirmTarget.id) ?? null : null;
  const count = (status) => tickets.filter((ticket) => ticket.status === status).length;
  const money = (amount) => `৳${new Intl.NumberFormat("en-BD").format(amount)}`;
  const formatDate = (date) => new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
  const formatTime = (date) => new Intl.DateTimeFormat("en-BD", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));
  const stats = [
    { label: "Total tickets", value: tickets.length, caption: "Issued in the demo ticketing system", Icon: Ticket, tone: "all" },
    { label: "Active tickets", value: count("active"), caption: "Valid for upcoming journeys", Icon: Check, tone: "active" },
    { label: "Used tickets", value: count("used"), caption: "Verified or completed journeys", Icon: QrCode, tone: "used" },
    { label: "Cancelled tickets", value: count("cancelled"), caption: "Cancelled before travel", Icon: X, tone: "cancelled" },
  ];

  function downloadTicket(ticket) {
    setPreviewId(ticket.id);
    setActiveMenu("");
    onToast("Ticket ready to download", "Use the Download PDF button in the ticket preview to print or save as PDF.");
  }

  function applyTicketAction() {
    if (!confirmTarget) return;
    const { id, mode } = confirmTarget;
    const nextStatus = mode === "verify" ? "used" : "cancelled";
    setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, status: nextStatus } : ticket));
    setDrawerId("");
    onToast(mode === "verify" ? "Ticket verified" : "Ticket cancelled", `${id} is now ${nextStatus}.`);
    setConfirmTarget(null);
  }

  function exportTickets() {
    const headers = ["Ticket ID", "Booking ID", "Passenger", "Email", "Transport", "Operator", "Departure", "Destination", "Journey Date", "Seat", "Ticket Price", "Status"];
    const rows = filteredTickets.map((ticket) => [ticket.id, ticket.bookingId, ticket.passengerName, ticket.customerEmail, ticket.transport, ticket.operatorName, ticket.departure, ticket.destination, ticket.departureAt, ticket.seatNumber, ticket.ticketPrice, ticket.status]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "eticketing-demo-tickets.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onToast("Tickets exported", `${filteredTickets.length} demo tickets were downloaded as CSV.`);
  }

  function openAction(action, ticket) {
    setActiveMenu("");
    if (action === "view") setDrawerId(ticket.id);
    if (action === "download") downloadTicket(ticket);
    if (action === "verify" || action === "cancel") setConfirmTarget({ id: ticket.id, mode: action });
  }

  return (
    <section className="ticket-management">
      <div className="ticket-demo-banner"><span /> DEMO DATA <span>Sample tickets are local to this demo; no live passes or travel validations are affected.</span></div>
      <header className="ticket-page-heading"><div><span className="ticket-eyebrow">WORKSPACE <ArrowRight size={12} /> TICKETS</span><h1>Ticket Management</h1><p>Review passenger tickets, verify journeys and manage ticket status.</p></div><button className="ticket-button primary" type="button" onClick={exportTickets}><Download size={15} />Export tickets</button></header>
      <section className="ticket-stats-grid" aria-label="Ticket statistics">{stats.map(({ label, value, caption, Icon, tone }) => <article className="ticket-stat-card" key={label}><span className={`ticket-stat-icon ${tone}`}><Icon size={18} /></span><span className="ticket-stat-label">{label}</span><strong>{value.toLocaleString("en-BD")}</strong><small>{caption}</small></article>)}</section>

      <section className="ticket-table-card">
        <header className="ticket-table-heading"><div><h2>All tickets <span>{tickets.length}</span></h2><p>Search and manage issued passenger e-tickets.</p></div><div className="ticket-search-caption"><Search size={15} /><span>{query ? `Searching “${query}”` : "Search ticket ID, booking ID or passenger"}</span></div></header>
        <div className="ticket-filters">
          <label className="ticket-search-field"><Search size={15} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search tickets..." aria-label="Search ticket ID, booking ID or passenger name" />{query && <button type="button" aria-label="Clear ticket search" onClick={() => onQueryChange("")}><X size={14} /></button>}</label>
          <label className="ticket-filter-select"><Bus size={14} /><select value={transportFilter} onChange={(event) => setTransportFilter(event.target.value)} aria-label="Filter by transport type"><option>All transport</option><option>Bus</option><option>Train</option><option>Launch</option></select><ChevronDown size={14} /></label>
          <label className="ticket-filter-select"><Check size={14} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by ticket status"><option value="All statuses">All statuses</option><option value="active">Active</option><option value="used">Used</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select><ChevronDown size={14} /></label>
          <label className="ticket-date-filter"><CalendarDays size={14} /><input type="date" value={journeyDate} aria-label="Filter by journey date" onChange={(event) => setJourneyDate(event.target.value)} /></label>
          <label className="ticket-filter-select"><UserRound size={14} /><select value={operatorFilter} onChange={(event) => setOperatorFilter(event.target.value)} aria-label="Filter by operator"><option value="All operators">All operators</option>{operators.map((operator) => <option value={operator.id} key={operator.id}>{operator.name}</option>)}</select><ChevronDown size={14} /></label>
          {journeyDate && <button className="ticket-clear-date" type="button" onClick={() => setJourneyDate("")}>Clear date</button>}
        </div>
        <div className="ticket-table-scroll"><table className="ticket-table"><thead><tr><th>TICKET ID</th><th>BOOKING ID</th><th>PASSENGER</th><th>TRANSPORT</th><th>OPERATOR</th><th>JOURNEY</th><th>JOURNEY DATE &amp; TIME</th><th>SEAT</th><th>TICKET PRICE</th><th>STATUS</th><th><span className="ticket-sr-only">Actions</span></th></tr></thead><tbody>
          {pageTickets.map((ticket) => <tr key={ticket.id}><td><button className="ticket-id-link" type="button" onClick={() => setDrawerId(ticket.id)}>{ticket.id}</button></td><td><button className="ticket-booking-link" type="button" onClick={() => setDrawerId(ticket.id)}>{ticket.bookingId}</button></td><td><button className="ticket-passenger-cell" type="button" onClick={() => setDrawerId(ticket.id)}><PassengerAvatar ticket={ticket} /><span><strong>{ticket.passengerName}</strong><small>{ticket.customerEmail}</small></span></button></td><td><span className="ticket-transport"><TransportIcon type={ticket.transport} />{ticket.transport}</span></td><td className="ticket-operator">{ticket.operatorName}</td><td><span className="ticket-journey"><strong>{ticket.departure}</strong><ArrowRight size={12} /><strong>{ticket.destination}</strong></span></td><td className="ticket-date">{formatDate(ticket.departureAt)}<small>{formatTime(ticket.departureAt)}</small></td><td className="ticket-seat">{ticket.seatNumber}</td><td className="ticket-price">{money(ticket.ticketPrice)}</td><td><TicketStatus status={ticket.status} /></td><td><TicketActions ticket={ticket} open={activeMenu === ticket.id} onToggleMenu={() => setActiveMenu((current) => current === ticket.id ? "" : ticket.id)} onView={() => openAction("view", ticket)} onDownload={() => openAction("download", ticket)} onVerify={() => openAction("verify", ticket)} onCancel={() => openAction("cancel", ticket)} /></td></tr>)}
          {pageTickets.length === 0 && <tr><td className="ticket-empty" colSpan="11"><Search size={20} /><strong>No tickets found</strong><span>Try changing your search or filters.</span></td></tr>}
        </tbody></table></div>
        <footer className="ticket-pagination"><span>Showing <strong>{filteredTickets.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredTickets.length)}</strong> of <strong>{filteredTickets.length}</strong> tickets</span><div className="ticket-page-controls"><label>Rows per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value="8">8</option><option value="12">12</option><option value="20">20</option></select></label><button className="ticket-icon-button" type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /></button><span>{page} <small>of</small> {totalPages}</span><button className="ticket-icon-button" type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={17} /></button></div></footer>
      </section>

      <TicketDrawer ticket={drawerTicket} onClose={() => setDrawerId("")} onPreview={(ticket) => setPreviewId(ticket.id)} onVerify={(ticket) => openAction("verify", ticket)} onCancel={(ticket) => openAction("cancel", ticket)} />
      <TicketPreview ticket={previewTicket} onClose={() => setPreviewId("")} onDownload={() => window.print()} />
      <TicketConfirm ticket={confirmTicket} mode={confirmTarget?.mode} onClose={() => setConfirmTarget(null)} onConfirm={applyTicketAction} />
    </section>
  );
}
