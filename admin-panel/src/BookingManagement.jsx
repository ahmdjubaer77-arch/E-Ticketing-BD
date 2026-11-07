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
  CreditCard,
  Download,
  Eye,
  Mail,
  MapPin,
  MoreHorizontal,
  Printer,
  Search,
  Ship,
  Ticket,
  TrainFront,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { initialSchedules } from "./ScheduleManagement.jsx";
import { initialUsers } from "./UserManagement.jsx";
import { initialRoutes } from "./RouteManagement.jsx";
import { initialOperators } from "./OperatorManagement.jsx";
import "./booking-management.css";

const demoBookingSeeds = [
  [0, 0, 2, "paid", "confirmed", 120],
  [1, 2, 1, "pending", "pending", 0],
  [2, 4, 3, "paid", "confirmed", 250],
  [3, 5, 2, "refunded", "cancelled", 0],
  [4, 6, 1, "paid", "completed", 0],
  [5, 8, 4, "failed", "pending", 180],
  [6, 9, 2, "paid", "confirmed", 0],
  [7, 11, 1, "paid", "completed", 80],
  [8, 3, 3, "paid", "confirmed", 150],
  [9, 1, 2, "pending", "pending", 0],
  [10, 7, 1, "paid", "confirmed", 0],
  [11, 12, 4, "refunded", "cancelled", 300],
  [0, 13, 1, "paid", "confirmed", 0],
  [2, 10, 2, "failed", "pending", 0],
];

export const initialBookings = demoBookingSeeds.map(([scheduleIndex, userIndex, passengers, paymentStatus, status, discount], index) => {
  const schedule = initialSchedules[scheduleIndex % initialSchedules.length];
  const user = initialUsers[userIndex % initialUsers.length];
  const route = initialRoutes.find((item) => item.id === schedule.routeId);
  const operator = initialOperators.find((item) => item.id === schedule.operatorId);
  const baseFare = schedule.fare * passengers;
  const serviceFee = Math.round(baseFare * 0.035);
  return {
    id: `BK-${String(84261 - index).padStart(5, "0")}`,
    scheduleId: schedule.id,
    customerId: user.id,
    customerName: user.name,
    customerEmail: user.email,
    customerPhone: user.phone,
    operatorId: schedule.operatorId,
    operatorName: operator?.name ?? "Operator unavailable",
    routeId: schedule.routeId,
    departure: route?.departure ?? "Location unavailable",
    destination: route?.destination ?? "Location unavailable",
    transport: route?.transport ?? "Bus",
    departureAt: schedule.departureAt,
    arrivalAt: schedule.arrivalAt,
    passengers,
    baseFare,
    serviceFee,
    discount,
    totalAmount: baseFare + serviceFee - discount,
    paymentStatus,
    status,
    bookedAt: new Date(new Date(schedule.departureAt).getTime() - (index + 2) * 3600000).toISOString(),
    color: ["lavender", "peach", "mint", "blue", "rose", "gold"][index % 6],
    ticketCode: `ET${String(6728401 + index * 137).slice(0, 8)}`,
  };
});

function TransportIcon({ type, size = 14 }) {
  if (type === "Train") return <TrainFront size={size} />;
  if (type === "Launch") return <Ship size={size} />;
  return <Bus size={size} />;
}

function BookingStatus({ status }) {
  const labels = { pending: "Pending", confirmed: "Confirmed", cancelled: "Cancelled", completed: "Completed" };
  return <span className={`booking-status ${status}`}><i />{labels[status] || status}</span>;
}

function PaymentStatus({ status }) {
  const labels = { paid: "Paid", pending: "Pending", failed: "Failed", refunded: "Refunded" };
  return <span className={`booking-payment-status ${status}`}><i />{labels[status] || status}</span>;
}

function Avatar({ booking, large = false }) {
  const initials = booking.customerName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className={`booking-avatar ${booking.color || "mint"}${large ? " large" : ""}`}>{initials}</span>;
}

function BookingActions({ booking, open, onToggleMenu, onView, onConfirm, onCancel, onTicket }) {
  return (
    <span className="booking-row-actions">
      <button className="booking-icon-button" type="button" aria-label={`Actions for ${booking.id}`} aria-expanded={open} onClick={onToggleMenu}><MoreHorizontal size={18} /></button>
      {open && <span className="booking-action-menu" role="menu">
        <button type="button" role="menuitem" onClick={onView}><Eye size={14} />View details</button>
        {booking.status === "pending" && <button type="button" role="menuitem" onClick={onConfirm}><Check size={14} />Confirm booking</button>}
        {(booking.status === "pending" || booking.status === "confirmed") && <button type="button" role="menuitem" onClick={onCancel}><X size={14} />Cancel booking</button>}
        <button type="button" role="menuitem" onClick={onTicket}><Ticket size={14} />View ticket</button>
      </span>}
    </span>
  );
}

function BookingDrawer({ booking, onClose, onConfirm, onCancel, onTicket }) {
  useEffect(() => {
    if (!booking) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [booking, onClose]);
  if (!booking) return null;
  const money = (amount) => `৳${new Intl.NumberFormat("en-BD").format(amount)}`;

  return (
    <div className="booking-drawer-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="booking-drawer" role="dialog" aria-modal="true" aria-labelledby="booking-drawer-title">
        <header className="booking-drawer-header"><div><span className="booking-eyebrow">BOOKING PREVIEW</span><h2 id="booking-drawer-title">Booking details</h2></div><button className="booking-icon-button" type="button" aria-label="Close booking details" onClick={onClose}><X size={19} /></button></header>
        <div className="booking-drawer-content">
          <section className="booking-profile-card"><div className="booking-profile-heading"><Avatar booking={booking} large /><div><h3>{booking.customerName}</h3><span>{booking.id}</span></div></div><div className="booking-profile-tags"><BookingStatus status={booking.status} /><PaymentStatus status={booking.paymentStatus} /></div><div className="booking-customer-info"><div><Mail size={14} /><span>{booking.customerEmail}</span></div><div><UserRound size={14} /><span>{booking.customerPhone}</span></div></div></section>
          <section className="booking-detail-section"><h3>Journey details</h3><div className="booking-route-visual"><div><small>FROM</small><strong>{booking.departure}</strong><time>{new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(booking.departureAt))}</time></div><ArrowRight size={18} /><div><small>TO</small><strong>{booking.destination}</strong><time>{new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(booking.arrivalAt))}</time></div></div><div className="booking-detail-row"><span><TransportIcon type={booking.transport} /></span><div><small>Transport &amp; operator</small><strong>{booking.transport} · {booking.operatorName}</strong></div></div><div className="booking-detail-row"><span><UsersRound size={15} /></span><div><small>Passengers</small><strong>{booking.passengers} {booking.passengers === 1 ? "passenger" : "passengers"}</strong></div></div><div className="booking-detail-row"><span><CalendarDays size={15} /></span><div><small>Booked on</small><strong>{new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(booking.bookedAt))}</strong></div></div></section>
          <section className="booking-detail-section"><h3>Fare breakdown</h3><div className="booking-fare-line"><span>Base fare · {booking.passengers} {booking.passengers === 1 ? "passenger" : "passengers"}</span><strong>{money(booking.baseFare)}</strong></div><div className="booking-fare-line"><span>Service fee</span><strong>{money(booking.serviceFee)}</strong></div>{booking.discount > 0 && <div className="booking-fare-line discount"><span>Discount</span><strong>−{money(booking.discount)}</strong></div>}<div className="booking-fare-total"><span>Total amount</span><strong>{money(booking.totalAmount)}</strong></div></section>
          <section className="booking-payment-card"><span><CreditCard size={15} />PAYMENT INFORMATION</span><div><strong>{booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}</strong><small>Payment reference · PAY-{booking.id.slice(3)}</small></div></section>
          <div className="booking-drawer-actions"><button className="booking-button secondary" type="button" onClick={() => onTicket(booking)}><Ticket size={14} />View ticket</button>{booking.status === "pending" && <button className="booking-button primary" type="button" onClick={() => onConfirm(booking)}><Check size={14} />Confirm</button>}{(booking.status === "pending" || booking.status === "confirmed") && <button className="booking-button danger-outline" type="button" onClick={() => onCancel(booking)}><X size={14} />Cancel</button>}</div>
          <div className="booking-demo-note"><Check size={14} /> Demo booking information is local to this browser session.</div>
        </div>
      </aside>
    </div>
  );
}

function TicketPreview({ booking, onClose }) {
  useEffect(() => {
    if (!booking) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [booking, onClose]);
  if (!booking) return null;
  return (
    <div className="booking-modal-scrim booking-ticket-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="booking-ticket-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-ticket-title">
        <h2 className="booking-sr-only" id="booking-ticket-title">Ticket preview for {booking.id}</h2>
        <header><span className="booking-eyebrow">E-TICKETING · DEMO TICKET</span><button className="booking-icon-button" type="button" aria-label="Close ticket preview" onClick={onClose}><X size={18} /></button></header>
        <div className="booking-ticket-brand"><span><Ticket size={18} /></span><div><strong>E-Ticketing</strong><small>Journey pass</small></div><BookingStatus status={booking.status} /></div>
        <div className="booking-ticket-number"><span>BOOKING REFERENCE</span><strong>{booking.id}</strong></div>
        <div className="booking-ticket-route"><div><small>FROM</small><strong>{booking.departure}</strong><time>{new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(booking.departureAt))}</time></div><ArrowRight size={19} /><div><small>TO</small><strong>{booking.destination}</strong><time>{new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(booking.arrivalAt))}</time></div></div>
        <div className="booking-ticket-meta"><div><small>PASSENGER</small><strong>{booking.customerName}</strong></div><div><small>OPERATOR</small><strong>{booking.operatorName}</strong></div><div><small>TRANSPORT</small><strong>{booking.transport}</strong></div><div><small>PASSENGERS</small><strong>{booking.passengers}</strong></div></div>
        <div className="booking-ticket-code"><span>{booking.ticketCode}</span><small>Ticket code · {booking.paymentStatus.toUpperCase()}</small></div>
        <footer><button className="booking-button secondary" type="button" onClick={onClose}>Close preview</button><button className="booking-button primary" type="button" onClick={() => window.print()}><Printer size={14} />Print ticket</button></footer>
      </section>
    </div>
  );
}

function BookingConfirm({ booking, mode, onClose, onConfirm }) {
  useEffect(() => {
    if (!booking) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [booking, onClose]);
  if (!booking) return null;
  const confirming = mode === "confirm";
  return (
    <div className="booking-modal-scrim booking-confirm-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="booking-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="booking-confirm-title" aria-describedby="booking-confirm-description">
        <span className={`booking-confirm-icon${confirming ? " confirm" : ""}`}>{confirming ? <Check size={19} /> : <X size={19} />}</span>
        <h2 id="booking-confirm-title">{confirming ? "Confirm this booking?" : "Cancel this booking?"}</h2>
        <p id="booking-confirm-description">{confirming ? <>Confirm <strong>{booking.id}</strong> for {booking.customerName}?</> : <>This will cancel <strong>{booking.id}</strong> for {booking.customerName}.{booking.paymentStatus === "paid" ? " The paid amount will be marked as refunded." : ""}</>}</p>
        <footer><button className="booking-button secondary" type="button" onClick={onClose}>Go back</button><button className={`booking-button ${confirming ? "primary" : "danger"}`} type="button" onClick={onConfirm}>{confirming ? "Confirm booking" : "Cancel booking"}</button></footer>
      </section>
    </div>
  );
}

export default function BookingManagement({ bookings, setBookings, query, onQueryChange, onToast }) {
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [paymentFilter, setPaymentFilter] = useState("All payments");
  const [transportFilter, setTransportFilter] = useState("All transport");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [activeMenu, setActiveMenu] = useState("");
  const [drawerId, setDrawerId] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null);

  const filteredBookings = useMemo(() => bookings.filter((booking) => {
    const searchText = `${booking.id} ${booking.customerName} ${booking.customerEmail}`.toLowerCase();
    const journeyDate = new Date(booking.departureAt);
    const day = `${journeyDate.getFullYear()}-${String(journeyDate.getMonth() + 1).padStart(2, "0")}-${String(journeyDate.getDate()).padStart(2, "0")}`;
    return (!query.trim() || searchText.includes(query.trim().toLowerCase()))
      && (statusFilter === "All statuses" || booking.status === statusFilter)
      && (paymentFilter === "All payments" || booking.paymentStatus === paymentFilter)
      && (transportFilter === "All transport" || booking.transport === transportFilter)
      && (!dateFrom || day >= dateFrom)
      && (!dateTo || day <= dateTo);
  }).sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt)), [bookings, query, statusFilter, paymentFilter, transportFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, paymentFilter, transportFilter, dateFrom, dateTo, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const pageBookings = filteredBookings.slice((page - 1) * pageSize, page * pageSize);
  const drawerBooking = bookings.find((booking) => booking.id === drawerId) ?? null;
  const ticketBooking = bookings.find((booking) => booking.id === ticketId) ?? null;
  const confirmBooking = confirmTarget ? bookings.find((booking) => booking.id === confirmTarget.id) ?? null : null;
  const count = (status) => bookings.filter((booking) => booking.status === status).length;
  const amount = (value) => `৳${new Intl.NumberFormat("en-BD").format(value)}`;
  const stats = [
    { label: "Total bookings", value: bookings.length, caption: "All demo booking records", Icon: Ticket, tone: "all" },
    { label: "Confirmed", value: count("confirmed"), caption: "Ready for passenger travel", Icon: Check, tone: "confirmed" },
    { label: "Pending", value: count("pending"), caption: "Awaiting booking confirmation", Icon: Clock3, tone: "pending" },
    { label: "Cancelled", value: count("cancelled"), caption: "Cancelled demo bookings", Icon: X, tone: "cancelled" },
  ];

  function exportBookings() {
    const headers = ["Booking ID", "Customer", "Email", "Transport", "Operator", "Departure", "Destination", "Journey Date", "Passengers", "Total Amount", "Payment Status", "Booking Status"];
    const rows = filteredBookings.map((booking) => [booking.id, booking.customerName, booking.customerEmail, booking.transport, booking.operatorName, booking.departure, booking.destination, booking.departureAt, booking.passengers, booking.totalAmount, booking.paymentStatus, booking.status]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "eticketing-demo-bookings.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onToast("Bookings exported", `${filteredBookings.length} demo booking records were downloaded.`);
  }

  function openAction(action, booking) {
    setActiveMenu("");
    if (action === "view") setDrawerId(booking.id);
    if (action === "ticket") setTicketId(booking.id);
    if (action === "confirm" || action === "cancel") setConfirmTarget({ id: booking.id, mode: action });
  }

  function applyStatusAction() {
    if (!confirmTarget) return;
    const { id, mode } = confirmTarget;
    setBookings((current) => current.map((booking) => booking.id === id
      ? { ...booking, status: mode === "confirm" ? "confirmed" : "cancelled", paymentStatus: mode === "cancel" && booking.paymentStatus === "paid" ? "refunded" : booking.paymentStatus }
      : booking));
    setDrawerId("");
    onToast(mode === "confirm" ? "Booking confirmed" : "Booking cancelled", `${id} was ${mode === "confirm" ? "confirmed" : "cancelled"}.`);
    setConfirmTarget(null);
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
  }

  return (
    <section className="booking-management">
      <div className="booking-demo-banner"><span /> DEMO DATA <span>Sample bookings are local to this demo; no live payments or reservations are changed.</span></div>
      <header className="booking-page-heading"><div><span className="booking-eyebrow">WORKSPACE <ArrowRight size={12} /> BOOKINGS</span><h1>Booking Management</h1><p>Review reservations, monitor payment status and manage journeys.</p></div><button className="booking-button primary" type="button" onClick={exportBookings}><Download size={15} />Export bookings</button></header>
      <section className="booking-stats-grid" aria-label="Booking statistics">{stats.map(({ label, value, caption, Icon, tone }) => <article className="booking-stat-card" key={label}><span className={`booking-stat-icon ${tone}`}><Icon size={18} /></span><span className="booking-stat-label">{label}</span><strong>{value.toLocaleString("en-BD")}</strong><small>{caption}</small></article>)}</section>

      <section className="booking-table-card">
        <header className="booking-table-heading"><div><h2>All bookings <span>{bookings.length}</span></h2><p>Search and manage customer travel reservations.</p></div><div className="booking-search-caption"><Search size={15} /><span>{query ? `Searching “${query}”` : "Search booking ID, customer or email"}</span></div></header>
        <div className="booking-filters">
          <label className="booking-search-field"><Search size={15} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search bookings..." aria-label="Search booking ID, customer name or email" />{query && <button type="button" aria-label="Clear booking search" onClick={() => onQueryChange("")}><X size={14} /></button>}</label>
          <label className="booking-filter-select"><Check size={14} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by booking status"><option value="All statuses">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="completed">Completed</option></select><ChevronDown size={14} /></label>
          <label className="booking-filter-select"><CreditCard size={14} /><select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} aria-label="Filter by payment status"><option value="All payments">All payments</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select><ChevronDown size={14} /></label>
          <label className="booking-filter-select"><Bus size={14} /><select value={transportFilter} onChange={(event) => setTransportFilter(event.target.value)} aria-label="Filter by transport type"><option>All transport</option><option>Bus</option><option>Train</option><option>Launch</option></select><ChevronDown size={14} /></label>
          <label className="booking-date-filter"><CalendarDays size={14} /><input type="date" value={dateFrom} aria-label="Journey date from" onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label className="booking-date-filter"><span>to</span><input type="date" value={dateTo} aria-label="Journey date to" min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} /></label>
          {(dateFrom || dateTo) && <button className="booking-clear-dates" type="button" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear dates</button>}
        </div>
        <div className="booking-table-scroll"><table className="booking-table"><thead><tr><th>BOOKING ID</th><th>CUSTOMER</th><th>TRANSPORT</th><th>OPERATOR</th><th>JOURNEY</th><th>JOURNEY DATE</th><th>PASSENGERS</th><th>TOTAL AMOUNT</th><th>PAYMENT</th><th>BOOKING STATUS</th><th><span className="booking-sr-only">Actions</span></th></tr></thead><tbody>
          {pageBookings.map((booking) => <tr key={booking.id}><td><button className="booking-id-link" type="button" onClick={() => setDrawerId(booking.id)}>{booking.id}</button></td><td><button className="booking-customer-cell" type="button" onClick={() => setDrawerId(booking.id)}><Avatar booking={booking} /><span><strong>{booking.customerName}</strong><small>{booking.customerEmail}</small></span></button></td><td><span className="booking-transport"><TransportIcon type={booking.transport} />{booking.transport}</span></td><td className="booking-operator">{booking.operatorName}</td><td><span className="booking-journey-cell"><strong>{booking.departure}</strong><ArrowRight size={12} /><strong>{booking.destination}</strong></span></td><td className="booking-date">{formatDate(booking.departureAt)}<small>{new Intl.DateTimeFormat("en-BD", { hour: "2-digit", minute: "2-digit" }).format(new Date(booking.departureAt))}</small></td><td className="booking-passengers">{booking.passengers}</td><td className="booking-amount">{amount(booking.totalAmount)}</td><td><PaymentStatus status={booking.paymentStatus} /></td><td><BookingStatus status={booking.status} /></td><td><BookingActions booking={booking} open={activeMenu === booking.id} onToggleMenu={() => setActiveMenu((current) => current === booking.id ? "" : booking.id)} onView={() => openAction("view", booking)} onConfirm={() => openAction("confirm", booking)} onCancel={() => openAction("cancel", booking)} onTicket={() => openAction("ticket", booking)} /></td></tr>)}
          {pageBookings.length === 0 && <tr><td className="booking-empty" colSpan="11"><Search size={20} /><strong>No bookings found</strong><span>Try changing your search or filters.</span></td></tr>}
        </tbody></table></div>
        <footer className="booking-pagination"><span>Showing <strong>{filteredBookings.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredBookings.length)}</strong> of <strong>{filteredBookings.length}</strong> bookings</span><div className="booking-page-controls"><label>Rows per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value="8">8</option><option value="12">12</option><option value="20">20</option></select></label><button className="booking-icon-button" type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /></button><span>{page} <small>of</small> {totalPages}</span><button className="booking-icon-button" type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={17} /></button></div></footer>
      </section>

      <BookingDrawer booking={drawerBooking} onClose={() => setDrawerId("")} onConfirm={(booking) => openAction("confirm", booking)} onCancel={(booking) => openAction("cancel", booking)} onTicket={(booking) => setTicketId(booking.id)} />
      <TicketPreview booking={ticketBooking} onClose={() => setTicketId("")} />
      <BookingConfirm booking={confirmBooking} mode={confirmTarget?.mode} onClose={() => setConfirmTarget(null)} onConfirm={applyStatusAction} />
    </section>
  );
}
