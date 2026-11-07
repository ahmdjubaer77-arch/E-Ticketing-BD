import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api.js";
import {
  ArrowDownUp,
  ArrowRight,
  Bus,
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
  TrainFront,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import "./route-management.css";

const demoRoutes = [
  ["Dhaka", "Chattogram", 265, "5h 30m", "Bus", 850, "active", true, "A popular highway connection with regular express services."],
  ["Dhaka", "Sylhet", 241, "6h 15m", "Train", 420, "active", true, "Scenic intercity rail service to Sylhet."],
  ["Dhaka", "Cox's Bazar", 395, "10h 30m", "Bus", 1450, "active", true, "Overnight coach service to the coastal destination."],
  ["Dhaka", "Barishal", 178, "7h 00m", "Launch", 700, "active", false, "Overnight river journey via the Padma and Kirtankhola."],
  ["Chattogram", "Cox's Bazar", 148, "4h 00m", "Bus", 500, "active", true, "Coastal highway route with frequent daily departures."],
  ["Dhaka", "Rajshahi", 255, "5h 45m", "Train", 390, "active", false, "Intercity rail connection to Rajshahi."],
  ["Dhaka", "Khulna", 272, "8h 00m", "Bus", 780, "inactive", false, "Direct highway service to Khulna city."],
  ["Sylhet", "Chattogram", 367, "9h 30m", "Bus", 1200, "active", false, "Long-distance regional coach service."],
  ["Dhaka", "Rangpur", 304, "7h 15m", "Train", 510, "active", true, "Northern intercity rail connection."],
  ["Barishal", "Dhaka", 178, "8h 00m", "Launch", 720, "inactive", false, "Return river service to the capital."],
  ["Dhaka", "Mymensingh", 116, "3h 30m", "Train", 260, "active", false, "Short intercity service with multiple daily trips."],
  ["Chattogram", "Dhaka", 265, "6h 00m", "Bus", 900, "active", false, "Return express route from Chattogram to Dhaka."],
];

export const BANGLADESH_DISTRICTS = [
  "Bagerhat", "Bandarban", "Barguna", "Barishal", "Bhola", "Bogura", "Brahmanbaria", "Chandpur",
  "Chapainawabganj", "Chattogram", "Chuadanga", "Cox's Bazar", "Cumilla", "Dhaka", "Dinajpur",
  "Faridpur", "Feni", "Gaibandha", "Gazipur", "Gopalganj", "Habiganj", "Jamalpur", "Jashore",
  "Jhalokati", "Jhenaidah", "Joypurhat", "Khagrachhari", "Khulna", "Kishoreganj", "Kurigram",
  "Kushtia", "Lakshmipur", "Lalmonirhat", "Madaripur", "Magura", "Manikganj", "Meherpur",
  "Moulvibazar", "Munshiganj", "Mymensingh", "Naogaon", "Narail", "Narayanganj", "Narsingdi",
  "Natore", "Netrokona", "Nilphamari", "Noakhali", "Pabna", "Panchagarh", "Patuakhali",
  "Pirojpur", "Rajbari", "Rajshahi", "Rangamati", "Rangpur", "Satkhira", "Shariatpur",
  "Sherpur", "Sirajganj", "Sunamganj", "Sylhet", "Tangail", "Thakurgaon",
];

export const initialRoutes = demoRoutes.map(([departure, destination, distance, duration, transport, fare, status, popular, description], index) => ({
  id: `RTE-${String(3021 - index).padStart(4, "0")}`,
  departure,
  destination,
  distance,
  duration,
  transport,
  fare,
  status,
  popular,
  description,
  createdAt: new Date(Date.now() - index * 86400000).toISOString().slice(0, 10),
}));

const formatCurrency = (amount) => `৳${new Intl.NumberFormat("en-BD").format(amount)}`;
const formatDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return [hours ? `${hours}h` : "", remainingMinutes ? `${remainingMinutes}m` : ""].filter(Boolean).join(" ") || "1m";
};

function routeFromApi(route) {
  return {
    ...route,
    distance: route.distanceKm,
    durationMinutes: route.estimatedDurationMinutes,
    duration: formatDuration(route.estimatedDurationMinutes),
    fare: route.startingFare,
    createdAt: route.createdAt,
  };
}

function RouteTransportIcon({ type, size = 15 }) {
  if (type === "Train") return <TrainFront size={size} />;
  if (type === "Launch") return <Ship size={size} />;
  return <Bus size={size} />;
}

function RouteStatus({ status }) {
  return <span className={`route-status ${status}`}><i />{status === "active" ? "Active" : "Inactive"}</span>;
}

function RouteModal({ route, routes, onClose, onSave }) {
  const [values, setValues] = useState({
    departure: route?.departure ?? "",
    destination: route?.destination ?? "",
    distance: route?.distance ?? "",
    durationMinutes: route?.durationMinutes ?? "",
    transport: route?.transport ?? "Bus",
    fare: route?.fare ?? "",
    description: route?.description ?? "",
    status: route?.status ?? "active",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const locations = useMemo(() => [...new Set([...BANGLADESH_DISTRICTS, ...routes.flatMap((item) => [item.departure, item.destination]), route?.departure, route?.destination].filter(Boolean))].sort((a, b) => a.localeCompare(b)), [routes, route]);

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

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    const departure = values.departure;
    const destination = values.destination;
    if (!departure) nextErrors.departure = "Select a departure district.";
    if (!destination) nextErrors.destination = "Select a destination district.";
    if (departure && destination && departure.toLowerCase() === destination.toLowerCase()) {
      nextErrors.destination = "Destination must be different from departure.";
    }
    const distance = Number(values.distance);
    if (!Number.isFinite(distance) || distance < 0.1 || distance > 50000) nextErrors.distance = "Enter a distance between 0.1 and 50,000 km.";
    const durationMinutes = Number(values.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 10080) nextErrors.durationMinutes = "Enter a duration from 1 to 10,080 minutes.";
    const fare = Number(values.fare);
    if (!Number.isFinite(fare) || fare < 0 || fare > 100000000) nextErrors.fare = "Enter a fare from ৳0 to ৳100,000,000.";
    if (routes.some((item) => item.departure.toLowerCase() === departure.toLowerCase()
      && item.destination.toLowerCase() === destination.toLowerCase()
      && item.transport === values.transport
      && item.id !== route?.id)) {
      nextErrors.destination = "This route already exists for the selected transport type.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setFormError("");
    try {
      await onSave({
        ...route,
        departure,
        destination,
        distance,
        durationMinutes,
        transport: values.transport,
        fare,
        description: values.description,
        status: values.status,
      });
      onClose();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="route-modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="route-modal" role="dialog" aria-modal="true" aria-labelledby="route-form-title">
        <header className="route-modal-header">
          <div><span className="route-eyebrow">{route ? "ROUTE PROFILE" : "ROUTE PLANNING"}</span><h2 id="route-form-title">{route ? "Edit route" : "Add route"}</h2><p>{route ? "Update route details and service availability." : "Choose from all 64 districts of Bangladesh."}</p></div>
          <button className="route-icon-button" type="button" aria-label="Close dialog" onClick={onClose} disabled={saving}><X size={19} /></button>
        </header>
        <form className="route-form" onSubmit={submit} noValidate>
          <div className="route-form-row">
            <label className="route-field"><span>Departure district</span><select autoFocus value={values.departure} onChange={(event) => update("departure", event.target.value)} aria-invalid={Boolean(errors.departure)}><option value="">Select a district</option>{locations.map((location) => <option key={location}>{location}</option>)}</select>{errors.departure && <small className="route-error">{errors.departure}</small>}</label>
            <label className="route-field"><span>Destination district</span><select value={values.destination} onChange={(event) => update("destination", event.target.value)} aria-invalid={Boolean(errors.destination)}><option value="">Select a destination</option>{locations.map((location) => <option key={location}>{location}</option>)}</select>{errors.destination && <small className="route-error">{errors.destination}</small>}</label>
          </div>
          <div className="route-form-row">
            <label className="route-field"><span>Distance (km)</span><input type="number" min="0.1" max="50000" step="0.1" value={values.distance} onChange={(event) => update("distance", event.target.value)} placeholder="e.g. 265" aria-invalid={Boolean(errors.distance)} />{errors.distance && <small className="route-error">{errors.distance}</small>}</label>
            <label className="route-field"><span>Estimated duration (minutes)</span><input type="number" min="1" max="10080" step="1" value={values.durationMinutes} onChange={(event) => update("durationMinutes", event.target.value)} placeholder="e.g. 330" aria-invalid={Boolean(errors.durationMinutes)} />{errors.durationMinutes && <small className="route-error">{errors.durationMinutes}</small>}</label>
          </div>
          <div className="route-form-row">
            <label className="route-field"><span>Transport type</span><select value={values.transport} onChange={(event) => update("transport", event.target.value)}><option>Bus</option><option>Train</option><option>Launch</option><option>Event</option></select></label>
            <label className="route-field"><span>Starting fare (৳)</span><input type="number" min="0" max="100000000" step="1" value={values.fare} onChange={(event) => update("fare", event.target.value)} placeholder="e.g. 850" aria-invalid={Boolean(errors.fare)} />{errors.fare && <small className="route-error">{errors.fare}</small>}</label>
          </div>
          <label className="route-field"><span>Route description</span><textarea rows="3" maxLength="2000" value={values.description} onChange={(event) => update("description", event.target.value)} placeholder="Add a short description of this route..." /></label>
          {!route && <label className="route-field"><span>Route status</span><select value={values.status} onChange={(event) => update("status", event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}
          {formError && <p className="route-form-error" role="alert">{formError}</p>}
          <footer className="route-form-actions"><button className="route-button secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="route-button primary" type="submit" disabled={saving}>{saving ? "Saving..." : route ? "Save changes" : "Add route"}</button></footer>
        </form>
      </section>
    </div>
  );
}

function RouteDrawer({ route, onClose, onEdit, onSetStatus, onDelete }) {
  useEffect(() => {
    if (!route) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [route, onClose]);
  if (!route) return null;

  return (
    <div className="route-drawer-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="route-drawer" role="dialog" aria-modal="true" aria-labelledby="route-drawer-title">
        <header className="route-drawer-header"><div><span className="route-eyebrow">NETWORK PREVIEW</span><h2 id="route-drawer-title">Route details</h2></div><button className="route-icon-button" type="button" aria-label="Close route details" onClick={onClose}><X size={19} /></button></header>
        <div className="route-drawer-content">
          <section className="route-profile-card"><span className="route-id">{route.id}</span><div className="route-journey"><div><span><MapPin size={14} /></span><small>FROM</small><strong>{route.departure}</strong></div><ArrowRight size={19} /><div><span><MapPin size={14} /></span><small>TO</small><strong>{route.destination}</strong></div></div><div className="route-profile-tags"><RouteStatus status={route.status} /><span className="route-type-pill"><RouteTransportIcon type={route.transport} />{route.transport}</span>{route.popular && <span className="route-popular-pill"><TrendingUp size={12} />Popular</span>}</div><div className="route-profile-actions"><button className="route-button secondary" type="button" onClick={() => onEdit(route)}><Pencil size={14} />Edit route</button><button className="route-icon-button" type="button" aria-label={route.status === "active" ? "Deactivate route" : "Activate route"} title={route.status === "active" ? "Deactivate route" : "Activate route"} onClick={() => onSetStatus(route, route.status === "active" ? "inactive" : "active")}><Check size={16} /></button></div></section>
          <section className="route-details-section"><h3>Route information</h3><div className="route-detail-row"><span><ArrowDownUp size={15} /></span><div><small>Distance</small><strong>{route.distance.toLocaleString("en-BD")} km</strong></div></div><div className="route-detail-row"><span><Clock3 size={15} /></span><div><small>Estimated duration</small><strong>{route.duration}</strong></div></div><div className="route-detail-row"><span><RouteTransportIcon type={route.transport} /></span><div><small>Transport type</small><strong>{route.transport}</strong></div></div><div className="route-detail-row"><span><TrendingUp size={15} /></span><div><small>Starting fare</small><strong>{formatCurrency(route.fare)}</strong></div></div></section>
          <section className="route-description"><h3>About this route</h3><p>{route.description || "No route description has been added."}</p></section>
          <div className="route-account-note"><Check size={14} /> Route information is loaded from the database. Routes with schedules are archived safely, not permanently erased.</div>
          <button className="route-delete-link" type="button" onClick={() => onDelete(route)}><Trash2 size={14} />Delete route</button>
        </div>
      </aside>
    </div>
  );
}

function RouteConfirm({ route, onClose, onConfirm }) {
  useEffect(() => {
    if (!route) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [route, onClose]);
  if (!route) return null;
  return (
    <div className="route-modal-scrim route-confirm-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="route-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="route-delete-title" aria-describedby="route-delete-description">
        <span className="route-confirm-icon"><Trash2 size={19} /></span><h2 id="route-delete-title">Archive this route?</h2><p id="route-delete-description"><strong>{route.departure} → {route.destination}</strong> will be deactivated and hidden from active routes. The database record will be retained.</p>
        {route.actionError && <p className="route-form-error" role="alert">{route.actionError}</p>}
        <footer className="route-form-actions"><button className="route-button secondary" type="button" onClick={onClose} disabled={route.busy}>Cancel</button><button className="route-button danger" type="button" onClick={onConfirm} disabled={route.busy}>{route.busy ? "Archiving..." : "Archive route"}</button></footer>
      </section>
    </div>
  );
}

function RouteActions({ route, open, onToggleMenu, onView, onEdit, onToggleStatus, onDelete }) {
  return (
    <span className="route-row-actions">
      <button className="route-icon-button" type="button" aria-label={`Actions for ${route.departure} to ${route.destination}`} aria-expanded={open} onClick={onToggleMenu}><MoreHorizontal size={18} /></button>
      {open && <span className="route-action-menu" role="menu">
        <button type="button" role="menuitem" onClick={onView}><Eye size={14} />View details</button>
        <button type="button" role="menuitem" onClick={onEdit}><Pencil size={14} />Edit route</button>
        <button type="button" role="menuitem" onClick={() => onToggleStatus(route)}><Check size={14} />{route.status === "active" ? "Deactivate route" : "Activate route"}</button>
        <button className="danger-action" type="button" role="menuitem" onClick={onDelete}><Trash2 size={14} />Delete route</button>
      </span>}
    </span>
  );
}

export default function RouteManagement({ query, onQueryChange, onToast }) {
  const [routes, setRoutes] = useState([]);
  const [statistics, setStatistics] = useState({ total: 0, active: 0, inactive: 0, popularAvailable: false });
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [locationFilter, setLocationFilter] = useState("All locations");
  const [transportFilter, setTransportFilter] = useState("All transport");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [activeMenu, setActiveMenu] = useState("");
  const [drawerId, setDrawerId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const locations = useMemo(() => [...new Set([...BANGLADESH_DISTRICTS, ...routes.flatMap((route) => [route.departure, route.destination])])].sort((a, b) => a.localeCompare(b)), [routes]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, locationFilter, transportFilter, statusFilter, sort, pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: String(pageSize), sort });
    if (debouncedQuery) params.set("search", debouncedQuery);
    if (locationFilter !== "All locations") params.set("location", locationFilter);
    if (transportFilter !== "All transport") params.set("transport", transportFilter);
    if (statusFilter !== "All statuses") params.set("status", statusFilter);
    setLoading(true);
    setError("");
    apiRequest(`/admin/routes?${params}`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setRoutes(data.routes.map(routeFromApi));
        setStatistics(data.statistics);
        setPagination(data.pagination);
        setPage((current) => Math.max(1, Math.min(current, data.pagination.totalPages || 1)));
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setRoutes([]);
        setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, pageSize, sort, debouncedQuery, locationFilter, transportFilter, statusFilter, refreshKey]);

  const totalPages = Math.max(1, pagination.totalPages);
  const pageRoutes = routes;
  const drawerRoute = routes.find((route) => route.id === drawerId) ?? null;
  const editingRoute = routes.find((route) => route.id === editingId) ?? null;

  async function saveRoute(route) {
    const isUpdate = Boolean(route.id);
    const body = {
      departure: route.departure,
      destination: route.destination,
      distanceKm: route.distance,
      estimatedDurationMinutes: route.durationMinutes,
      transport: route.transport,
      startingFare: route.fare,
      description: route.description,
      ...(!isUpdate ? { status: route.status } : {}),
    };
    const result = await apiRequest(isUpdate ? `/admin/routes/${route.id}` : "/admin/routes", {
      method: isUpdate ? "PUT" : "POST",
      body,
    });
    const savedRoute = routeFromApi(result.route);
    onToast(isUpdate ? "Route updated" : "Route created", `${savedRoute.departure} → ${savedRoute.destination} was saved to the database.`);
    setRefreshKey((key) => key + 1);
  }

  async function setRouteStatus(route, status) {
    try {
      const result = await apiRequest(`/admin/routes/${route.id}/status`, { method: "PATCH", body: { status } });
      setRoutes((current) => current.map((item) => item.id === route.id ? routeFromApi(result.route) : item));
      setRefreshKey((key) => key + 1);
      setDrawerId("");
      setActiveMenu("");
      onToast(status === "active" ? "Route activated" : "Route deactivated", `${route.departure} → ${route.destination} is now ${status}.`);
      return true;
    } catch (requestError) {
      setError(requestError.message);
      onToast("Could not update route", requestError.message);
      return false;
    }
  }

  function openAction(action, route) {
    setActiveMenu("");
    if (action === "view") setDrawerId(route.id);
    if (action === "edit") {
      setDrawerId("");
      setEditingId(route.id);
    }
    if (action === "delete") {
      setDrawerId("");
      setDeleteTarget(route);
    }
  }

  async function deleteRoute() {
    if (!deleteTarget) return;
    setActionBusy(true);
    setActionError("");
    try {
      await apiRequest(`/admin/routes/${deleteTarget.id}`, { method: "DELETE" });
      setDrawerId("");
      onToast("Route archived", `${deleteTarget.departure} → ${deleteTarget.destination} was safely deactivated and archived.`);
      setRefreshKey((key) => key + 1);
      setDeleteTarget(null);
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionBusy(false);
    }
  }

  const stats = [
    { label: "Total routes", value: statistics.total, caption: "Database route records", Icon: MapPin, tone: "all" },
    { label: "Active routes", value: statistics.active, caption: "Currently available for booking", Icon: Check, tone: "active" },
    { label: "Popular routes", value: statistics.popularAvailable ? statistics.popular : "—", caption: statistics.popularAvailable ? "Frequently travelled connections" : "Booking metrics unavailable", Icon: TrendingUp, tone: "popular" },
    { label: "Inactive routes", value: statistics.inactive, caption: "Not currently accepting bookings", Icon: Clock3, tone: "inactive" },
  ];

  return (
    <section className="route-management">
      <div className="route-live-note"><span /> LIVE DATABASE DATA <span>Routes and statistics are loaded from MongoDB.</span><button className="route-icon-button" type="button" aria-label="Refresh routes" disabled={loading} onClick={() => setRefreshKey((key) => key + 1)}><RefreshCw size={14} /></button></div>
      {error && <div className="route-page-error" role="alert"><strong>Could not load or update routes.</strong> {error}<button type="button" onClick={() => setRefreshKey((key) => key + 1)}>Retry</button></div>}
      <header className="route-page-heading"><div><span className="route-eyebrow">WORKSPACE <ArrowRight size={12} /> ROUTES</span><h1>Route Management</h1><p>Manage Bangladesh routes, fares and service availability.</p></div><button className="route-button primary" type="button" onClick={() => setAdding(true)}><Plus size={16} />Add route</button></header>
      <section className="route-stats-grid" aria-label="Route statistics">{stats.map(({ label, value, caption, Icon, tone }) => <article className="route-stat-card" key={label}><span className={`route-stat-icon ${tone}`}><Icon size={18} /></span><span className="route-stat-label">{label}</span><strong>{value.toLocaleString("en-BD")}</strong><small>{caption}</small></article>)}</section>

      <section className="route-table-card">
        <header className="route-table-heading"><div><h2>All routes <span>{pagination.total.toLocaleString("en-BD")}</span></h2><p>Database routes with server-side search, filters and pagination.</p></div><div className="route-search-caption"><Search size={15} /><span>{query ? `Searching “${query}”` : "Search locations, route ID or transport"}</span></div></header>
        <div className="route-filters">
          <label className="route-search-field"><Search size={15} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search routes..." aria-label="Search route ID, departure, destination or transport" />{query && <button type="button" aria-label="Clear route search" onClick={() => onQueryChange("")}><X size={14} /></button>}</label>
          <label className="route-filter-select"><MapPin size={15} /><select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} aria-label="Filter by location"><option>All locations</option>{locations.map((location) => <option key={location}>{location}</option>)}</select><ChevronDown size={14} /></label>
          <label className="route-filter-select"><Bus size={15} /><select value={transportFilter} onChange={(event) => setTransportFilter(event.target.value)} aria-label="Filter by transport type"><option>All transport</option><option>Bus</option><option>Train</option><option>Launch</option><option>Event</option></select><ChevronDown size={14} /></label>
          <label className="route-filter-select"><Check size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by route status"><option value="All statuses">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><ChevronDown size={14} /></label>
          <label className="route-filter-select route-sort-select"><ArrowDownUp size={14} /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort routes"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="departure_asc">Departure A–Z</option><option value="departure_desc">Departure Z–A</option><option value="fare_asc">Fare: low to high</option><option value="fare_desc">Fare: high to low</option></select><ChevronDown size={14} /></label>
        </div>
        <div className="route-table-scroll"><table className="route-table"><thead><tr><th>ROUTE ID</th><th>DEPARTURE</th><th>DESTINATION</th><th>DISTANCE</th><th>DURATION</th><th>TRANSPORT</th><th>STARTING FARE</th><th>STATUS</th><th><span className="route-sr-only">Actions</span></th></tr></thead><tbody>
          {pageRoutes.map((route) => <tr key={route.id}><td><button className="route-id-link" type="button" onClick={() => setDrawerId(route.id)}>{route.id}</button></td><td><span className="route-location"><MapPin size={14} />{route.departure}</span></td><td><span className="route-location"><MapPin size={14} />{route.destination}</span></td><td className="route-metric">{route.distance.toLocaleString("en-BD")} km</td><td><span className="route-duration"><Clock3 size={13} />{route.duration}</span></td><td><span className="route-transport"><RouteTransportIcon type={route.transport} />{route.transport}</span></td><td className="route-fare">{formatCurrency(route.fare)}</td><td><RouteStatus status={route.status} /></td><td><RouteActions route={route} open={activeMenu === route.id} onToggleMenu={() => setActiveMenu((current) => current === route.id ? "" : route.id)} onView={() => openAction("view", route)} onEdit={() => openAction("edit", route)} onToggleStatus={(item) => setRouteStatus(item, item.status === "active" ? "inactive" : "active")} onDelete={() => openAction("delete", route)} /></td></tr>)}
          {!loading && pageRoutes.length === 0 && <tr><td className="route-empty" colSpan="9"><Search size={20} /><strong>No routes found</strong><span>Try changing your search or filters.</span></td></tr>}
          {loading && <tr><td className="route-empty" colSpan="9"><RefreshCw size={18} /><strong>Loading routes...</strong></td></tr>}
        </tbody></table></div>
        <footer className="route-pagination"><span>Showing <strong>{pagination.total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, pagination.total)}</strong> of <strong>{pagination.total.toLocaleString("en-BD")}</strong> routes</span><div className="route-page-controls"><label>Rows per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value="8">8</option><option value="12">12</option><option value="20">20</option><option value="50">50</option></select></label><button className="route-icon-button" type="button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /></button><span>{page} <small>of</small> {totalPages}</span><button className="route-icon-button" type="button" aria-label="Next page" disabled={page >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={17} /></button></div></footer>
      </section>

      {(adding || editingId) && <RouteModal key={editingId || "new"} route={editingRoute} routes={routes} onClose={() => { setAdding(false); setEditingId(null); }} onSave={saveRoute} />}
      <RouteDrawer route={drawerRoute} onClose={() => setDrawerId("")} onEdit={(route) => openAction("edit", route)} onSetStatus={setRouteStatus} onDelete={(route) => openAction("delete", route)} />
      <RouteConfirm route={deleteTarget && { ...deleteTarget, actionError, busy: actionBusy }} onClose={() => { if (!actionBusy) { setDeleteTarget(null); setActionError(""); } }} onConfirm={deleteRoute} />
    </section>
  );
}
