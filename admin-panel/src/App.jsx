import { useEffect, useMemo, useRef, useState } from "react";
import UserManagement, { initialUsers } from "./UserManagement.jsx";
import OperatorManagement, { initialOperators } from "./OperatorManagement.jsx";
import VehicleManagement, { initialVehicles } from "./VehicleManagement.jsx";
import RouteManagement from "./RouteManagement.jsx";
import ScheduleManagement from "./ScheduleManagement.jsx";
import BookingManagement, { initialBookings } from "./BookingManagement.jsx";
import TicketManagement, { initialTickets } from "./TicketManagement.jsx";
import PaymentManagement from "./PaymentManagement.jsx";
import OfferManagement from "./OfferManagement.jsx";
import { apiRequest } from "./api.js";
import {
  ArrowRight,
  BadgePercent,
  Bell,
  Bus,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleHelp,
  CreditCard,
  Download,
  Ellipsis,
  FileChartColumnIncreasing,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  MessageSquareText,
  RefreshCw,
  Search,
  Settings,
  Ship,
  Ticket,
  TrainFront,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

const navigation = [
  { name: "Overview", Icon: LayoutDashboard },
  { name: "Users", Icon: UsersRound },
  { name: "Operators", Icon: Bus },
  { name: "Vehicles", Icon: Bus },
  { name: "Routes", Icon: Map },
  { name: "Schedules", Icon: CalendarDays },
  { name: "Bookings", Icon: Ticket, badge: "12" },
  { name: "Tickets", Icon: CheckCheck },
  { name: "Payments", Icon: CreditCard },
  { name: "Offers", Icon: BadgePercent },
  { name: "Destinations", Icon: Map },
  { name: "Reviews", Icon: MessageSquareText },
  { name: "Messages", Icon: MessageSquareText, badge: "4" },
  { name: "Reports", Icon: FileChartColumnIncreasing },
  { name: "Settings", Icon: Settings },
];

function Logo({ compact }) {
  return (
    <a className="brand" href="#overview" aria-label="E-Ticketing Admin home">
      <span className="brand-icon"><Ticket size={19} strokeWidth={2.2} /></span>
      {!compact && <span className="brand-name">E-Ticketing<span>ADMIN</span></span>}
    </a>
  );
}

function Sidebar({ activePage, setActivePage, collapsed, mobileOpen, onClose, onToast, adminUser }) {
  return (
    <>
      {mobileOpen && <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}>
        <div className="sidebar-head">
          <Logo compact={collapsed} />
          <button className="sidebar-close icon-button" type="button" aria-label="Close navigation" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">ET</span>
          {!collapsed && <><span className="workspace-copy"><strong>ETicketing Inc.</strong><small>Workspace</small></span><ChevronsUpDown size={15} /></>}
        </div>
        <p className="nav-caption">{!collapsed ? "WORKSPACE" : "MENU"}</p>
        <nav className="sidebar-nav" aria-label="Admin navigation">
          {navigation.map(({ name, Icon, badge }) => (
            <button
              className={`nav-item${activePage === name ? " active" : ""}`}
              key={name}
              type="button"
              title={collapsed ? name : undefined}
              aria-current={activePage === name ? "page" : undefined}
              onClick={() => {
                setActivePage(name);
                onClose();
                if (name !== "Overview") onToast(`${name} module selected`, `The ${name.toLowerCase()} workspace is ready for management.`);
              }}
            >
              <Icon size={18} strokeWidth={1.85} />
              {!collapsed && <><span>{name}</span>{badge && <small className="nav-badge">{badge}</small>}</>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon"><CircleHelp size={17} /></span>
            {!collapsed && <span><strong>Need a hand?</strong><small>Visit our help center</small></span>}
            {!collapsed && <ArrowRight className="help-arrow" size={15} />}
          </div>
          <button className="sidebar-profile" type="button" onClick={() => onToast("Admin profile", `Signed in as ${adminUser.email}.`)}>
            <span className="profile-avatar">{adminUser.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
            {!collapsed && <span className="profile-copy"><strong>{adminUser.fullName}</strong><small>{adminUser.email}</small></span>}
            {!collapsed && <Ellipsis size={18} />}
          </button>
        </div>
      </aside>
    </>
  );
}

function Dropdown({ className = "", children }) {
  return <div className={`dropdown-panel ${className}`} role="menu">{children}</div>;
}

function Topbar({ activePage, search, setSearch, onToast, onOpenMobileNav, onToggleSidebar, onExport, adminUser, onLogout }) {
  const [openMenu, setOpenMenu] = useState("");
  const searchInput = useRef(null);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key === "Escape") setOpenMenu("");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-leading">
        <button className="icon-button sidebar-toggle" type="button" aria-label="Toggle sidebar" onClick={onToggleSidebar}>
          <Menu size={20} />
        </button>
        <div className="breadcrumb">
          <span>Workspace</span><ChevronRight size={14} /><strong>{activePage}</strong>
        </div>
      </div>
      <div className="topbar-tools">
        <label className="global-search">
          <Search size={17} />
          <input ref={searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search anything..." aria-label="Search dashboard" />
          {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}
          {!search && <kbd>⌘ K</kbd>}
        </label>
        <div className="topbar-menu-wrap">
          <button className={`icon-button topbar-notifications${openMenu === "notifications" ? " is-open" : ""}`} type="button" aria-label="Notifications" aria-expanded={openMenu === "notifications"} onClick={() => setOpenMenu(openMenu === "notifications" ? "" : "notifications")}>
            <Bell size={19} />
          </button>
          {openMenu === "notifications" && (
            <Dropdown className="notifications-menu">
              <div className="dropdown-heading"><span><strong>Notifications</strong><small>No live notification feed</small></span></div>
              <p className="notification-empty">System notifications are not connected to the database yet.</p>
            </Dropdown>
          )}
        </div>
        <div className="topbar-menu-wrap">
          <button className="admin-menu-button" type="button" aria-expanded={openMenu === "profile"} onClick={() => setOpenMenu(openMenu === "profile" ? "" : "profile")}>
            <span className="profile-avatar">{adminUser.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><span className="admin-menu-copy"><strong>{adminUser.fullName}</strong><small>Administrator</small></span><ChevronDown size={15} />
          </button>
          {openMenu === "profile" && (
            <Dropdown className="profile-menu">
              <button type="button" onClick={() => { setOpenMenu(""); onToast("Your profile", "Profile settings are available in the Settings module."); }}><UserRound size={16} /> My profile</button>
              <button type="button" onClick={() => { setOpenMenu(""); onToast("Settings", "Admin preferences opened."); }}><Settings size={16} /> Settings</button>
              <div />
              <button className="logout-action" type="button" onClick={() => { setOpenMenu(""); onLogout(); }}><LogOut size={16} /> Log out</button>
            </Dropdown>
          )}
        </div>
        <button className="icon-button mobile-nav-toggle" type="button" aria-label="Open navigation" onClick={onOpenMobileNav}><Menu size={20} /></button>
      </div>
    </header>
  );
}

function Welcome({ adminUser, days, setDays, onExport, onRefresh, loading }) {
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    .format(new Date()).toUpperCase();
  const firstName = adminUser.fullName.trim().split(/\s+/)[0];
  return (
    <section className="welcome-row">
      <div>
        <div className="welcome-eyebrow"><span /> {today}</div>
        <h1>Welcome back, {firstName} <span aria-hidden="true">✦</span></h1>
        <p>Live overview of records currently stored in your E-Ticketing database.</p>
      </div>
      <div className="welcome-actions">
        <label className="button button-secondary date-range-button"><CalendarDays size={16} /><select aria-label="Select dashboard date range" value={days} onChange={(event) => setDays(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select><ChevronDown size={14} /></label>
        <button className="button button-secondary" type="button" onClick={onRefresh} disabled={loading}><RefreshCw size={15} className={loading ? "is-spinning" : ""} /> Refresh</button>
        <button className="button button-primary" type="button" onClick={onExport}><Download size={16} /> Export report</button>
      </div>
    </section>
  );
}

function StatCard({ stat }) {
  const { label, value, note, Icon, tone, values } = stat;
  const max = Math.max(...values, 1);
  return (
    <article className="stat-card">
      <div className="stat-top"><span className={`stat-icon ${tone}`}><Icon size={18} strokeWidth={1.9} /></span></div>
      <p className="stat-label">{label}</p>
      <div className="stat-bottom"><div><strong>{value.toLocaleString("en-BD")}</strong><small>{note}</small></div><div className={`mini-chart ${tone}`} aria-hidden="true">{values.map((count, index) => <i key={index} style={{ height: `${Math.max(4, count / max * 100)}%` }} />)}</div></div>
    </article>
  );
}

const seriesOptions = {
  users: { label: "New users", color: "#047857" },
  operators: { label: "Operators", color: "#bd8a38" },
  schedules: { label: "Schedules", color: "#4789d8" },
};

function ActivityChart({ trend, days }) {
  const [activeSeries, setActiveSeries] = useState("users");
  const series = seriesOptions[activeSeries];
  const values = trend.map((item) => item[activeSeries]);
  const maximum = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 406 : 54 + index * 704 / (values.length - 1);
    const y = 174 - value / maximum * 140;
    return `${x},${y}`;
  }).join(" ");
  const total = values.reduce((sum, value) => sum + value, 0);
  const labelStep = Math.max(1, Math.ceil(trend.length / 7));
  const xLabels = trend.filter((_, index) => index % labelStep === 0 || index === trend.length - 1);
  const yLabels = [maximum, Math.round(maximum / 2), 0];

  return (
    <section className="panel revenue-panel">
      <div className="panel-heading">
        <div><h2>Database activity</h2><p>New records created during the selected period</p></div>
        <span className="overview-period-label">Last {days} days</span>
      </div>
      <div className="chart-summary"><strong>{total.toLocaleString("en-BD")}</strong><small>{series.label.toLowerCase()} in this period</small></div>
      <div className="chart-content">
        <div className="chart-y-labels">{yLabels.map((label, index) => <span key={index}>{label.toLocaleString("en-BD")}</span>)}</div>
        <div className="chart-plot">
          <svg className="line-chart" viewBox="0 0 770 190" preserveAspectRatio="none" role="img" aria-label={`${series.label} created during the last ${days} days`}>
            <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={series.color} stopOpacity=".17" /><stop offset="100%" stopColor={series.color} stopOpacity="0" /></linearGradient></defs>
            {[0, 1, 2, 3].map((line) => <line key={line} x1="0" x2="770" y1={18 + line * 48} y2={18 + line * 48} className="chart-gridline" />)}
            {values.length > 1 && <polygon points={`54,174 ${points} 758,174`} fill="url(#chartFill)" />}
            {values.length > 1
              ? <polyline points={points} fill="none" stroke={series.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              : <circle cx="406" cy="174" r="4" fill={series.color} />}
          </svg>
          <div className="chart-x-labels">{xLabels.map((item) => <span key={item.date}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${item.date}T00:00:00Z`))}</span>)}</div>
        </div>
      </div>
      <div className="chart-legend">{Object.entries(seriesOptions).map(([key, item]) => <button className={activeSeries === key ? "selected" : ""} type="button" key={key} onClick={() => setActiveSeries(key)}><i style={{ backgroundColor: item.color }} />{item.label}</button>)}</div>
    </section>
  );
}

const transportOptions = [
  { name: "Bus", color: "#047857", Icon: Bus },
  { name: "Train", color: "#8bc9aa", Icon: TrainFront },
  { name: "Launch", color: "#d8b45b", Icon: Ship },
];

function TransportPanel({ schedulesByTransport }) {
  const data = transportOptions.map((item) => ({ ...item, count: schedulesByTransport[item.name] ?? 0 }));
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let offset = 0;
  const segments = data.map((item) => {
    const end = offset + (total ? item.count / total * 100 : 0);
    const segment = `${item.color} ${offset}% ${end}%`;
    offset = end;
    return segment;
  });
  const background = total ? `conic-gradient(${segments.join(", ")})` : "#edf1ee";

  return (
    <section className="panel transport-panel">
      <div className="panel-heading"><div><h2>Schedules by transport</h2><p>Departures in the selected date range</p></div></div>
      <div className="donut-layout">
        <div className="donut-chart" role="img" aria-label={`${total} schedules in the selected period`} style={{ background }}><div><strong>{total.toLocaleString("en-BD")}</strong><small>Total schedules</small></div></div>
        <div className="transport-legend">{data.map(({ name, count, color, Icon }) => <div className="transport-legend-item" key={name}><span className="transport-name"><i style={{ background: color }} /><Icon size={15} />{name}</span><span><strong>{count.toLocaleString("en-BD")}</strong><small>{total ? `${Math.round(count / total * 100)}%` : "0%"}</small></span></div>)}</div>
      </div>
    </section>
  );
}

function ScheduleStatusSummary({ scheduleStatuses }) {
  return (
    <section className="status-panel">
      <div className="status-heading"><div><h2>Schedule status</h2><p>Departures in the selected date range</p></div></div>
      <div className="status-items">{Object.entries(scheduleStatuses).map(([status, count]) => <div className="status-item" key={status}><span className={`status-dot ${status}`} /><span>{status[0].toUpperCase() + status.slice(1)}</span><strong>{count.toLocaleString("en-BD")}</strong></div>)}</div>
    </section>
  );
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${status}`}><i />{status[0].toUpperCase() + status.slice(1)}</span>;
}

function RecentSchedules({ schedules, query }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const filteredSchedules = useMemo(() => schedules.filter((schedule) => {
    const matchesStatus = statusFilter === "all" || schedule.status === statusFilter;
    const searchText = `${schedule.id} ${schedule.operator?.name ?? ""} ${schedule.route?.departure ?? ""} ${schedule.route?.destination ?? ""} ${schedule.transport} ${schedule.status}`.toLowerCase();
    return matchesStatus && searchText.includes(query.toLowerCase().trim());
  }), [schedules, query, statusFilter]);

  return (
    <section className="panel table-panel">
      <div className="table-heading"><div><h2>Recent schedules</h2><p>Latest schedule records created during the selected period</p></div><label className="table-filter"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by schedule status"><option value="all">All statuses</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><ChevronDown size={14} /></label></div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>SCHEDULE ID</th><th>OPERATOR</th><th>JOURNEY</th><th>TRANSPORT</th><th>DEPARTURE</th><th>SEATS</th><th>STATUS</th></tr></thead>
          <tbody>
            {filteredSchedules.map((schedule) => <tr key={schedule.id}>
              <td><span className="booking-id">{schedule.id.slice(-8).toUpperCase()}</span></td>
              <td>{schedule.operator?.name ?? "Operator unavailable"}</td>
              <td><div className="journey-cell"><strong>{schedule.route?.departure ?? "—"}</strong><ArrowRight size={13} /><strong>{schedule.route?.destination ?? "—"}</strong></div></td>
              <td><span className="transport-pill">{schedule.transport}</span></td>
              <td className="date-cell">{new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short" }).format(new Date(schedule.departureAt))}</td>
              <td>{schedule.availableSeats}/{schedule.totalSeats}</td>
              <td><StatusBadge status={schedule.status} /></td>
            </tr>)}
            {filteredSchedules.length === 0 && <tr><td className="empty-table" colSpan="7"><Search size={18} /><strong>No schedules found</strong><span>There are no matching records for this period.</span></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-footer"><span>Showing <strong>{filteredSchedules.length}</strong> of <strong>{schedules.length}</strong> recent schedules</span></div>
    </section>
  );
}

function OverviewDashboard({ adminUser, data, loading, error, days, setDays, onRefresh, onExport, query }) {
  if (!data && loading) return <div className="overview-state" role="status">Loading live overview from the database…</div>;
  if (!data && error) return <div className="overview-state is-error" role="alert"><strong>Could not load the dashboard.</strong><span>{error}</span><button className="button button-primary" type="button" onClick={onRefresh}>Try again</button></div>;
  if (!data) return null;

  const { statistics, trend, schedulesByTransport, scheduleStatuses, recentSchedules, availability } = data;
  const cards = [
    { label: "Total users", value: statistics.users.total, note: `${statistics.users.newInPeriod.toLocaleString("en-BD")} new in period`, Icon: UsersRound, tone: "green", values: trend.map((item) => item.users) },
    { label: "Total schedules", value: statistics.schedules.total, note: `${statistics.schedules.upcoming.toLocaleString("en-BD")} upcoming`, Icon: CalendarDays, tone: "blue", values: trend.map((item) => item.schedules) },
    { label: "Active operators", value: statistics.operators.active, note: `of ${statistics.operators.total.toLocaleString("en-BD")} operators`, Icon: Bus, tone: "gold", values: trend.map((item) => item.operators) },
    { label: "Active routes", value: statistics.routes.active, note: `of ${statistics.routes.total.toLocaleString("en-BD")} routes`, Icon: Map, tone: "violet", values: [] },
  ];

  return (
    <>
      <div className="overview-data-banner"><span className="demo-dot" /> LIVE DATABASE DATA <span>Counts and activity are loaded from MongoDB. {availability.message}</span>{loading && <small>Refreshing…</small>}</div>
      {error && <div className="overview-inline-error" role="alert">{error} Showing the last successfully loaded data.</div>}
      <Welcome adminUser={adminUser} days={days} setDays={setDays} onExport={onExport} onRefresh={onRefresh} loading={loading} />
      <section className="stats-grid" aria-label="Database statistics">{cards.map((stat) => <StatCard stat={stat} key={stat.label} />)}</section>
      <section className="analytics-grid" aria-label="Database analytics">
        <ActivityChart trend={trend} days={days} />
        <TransportPanel schedulesByTransport={schedulesByTransport} />
      </section>
      <ScheduleStatusSummary scheduleStatuses={scheduleStatuses} />
      <RecentSchedules schedules={recentSchedules} query={query} />
      <footer className="dashboard-footer"><span>© {new Date().getFullYear()} E-Ticketing Admin</span><span>Overview data is refreshed from MongoDB.</span><span className="overview-connection"><i /> Database connected</span></footer>
    </>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return <div className="toast-message" role="status"><span><Check size={16} /></span><div><strong>{toast.title}</strong><small>{toast.description}</small></div><button className="icon-button" type="button" aria-label="Dismiss message" onClick={onClose}><X size={16} /></button></div>;
}

function ActivePageIcon({ name }) {
  const Icon = navigation.find((item) => item.name === name)?.Icon ?? LayoutDashboard;
  return <Icon size={18} />;
}

function AdminSignIn({ onSignIn, error, busy }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <main className="admin-signin-page">
      <form className="admin-signin-card" onSubmit={(event) => { event.preventDefault(); onSignIn(email, password); }}>
        <span className="admin-signin-mark"><Ticket size={22} /></span>
        <span className="admin-signin-eyebrow">E-TICKETING ADMIN</span>
        <h1>Welcome back</h1>
        <p>Sign in with an active administrator account to manage records and image uploads.</p>
        <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <div className="admin-signin-error" role="alert">{error}</div>}
        <button type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in securely"}</button>
        <small>Access is restricted to verified administrator accounts.</small>
      </form>
    </main>
  );
}

function App() {
  const [adminUser, setAdminUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("checking");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [activePage, setActivePage] = useState("Overview");
  const [collapsed, setCollapsed] = useState(() =>
    window.matchMedia("(min-width: 701px) and (max-width: 1050px)").matches,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("30");
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [overviewRefreshKey, setOverviewRefreshKey] = useState(0);
  const [users, setUsers] = useState(initialUsers);
  const [operators, setOperators] = useState(initialOperators);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [managedOperators, setManagedOperators] = useState(initialOperators);
  const [managedVehicles, setManagedVehicles] = useState(initialVehicles);
  const [bookings, setBookings] = useState(initialBookings);
  const [tickets, setTickets] = useState(initialTickets);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    function handleUnauthorized() {
      setAdminUser(null);
      setAuthStatus("signed-out");
      setAuthError("Your administrator session expired. Please sign in again.");
    }
    window.addEventListener("admin:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("admin:unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest("/admin/me")
      .then(({ user }) => {
        if (!active) return;
        setAdminUser(user);
        setAuthStatus("signed-in");
      })
      .catch((error) => {
        if (!active) return;
        setAuthError(error.status === 401 || error.status === 403 ? "" : error.message);
        setAuthStatus("signed-out");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authStatus !== "signed-in" || activePage !== "Overview") return undefined;
    const controller = new AbortController();
    setOverviewData(null);
    setOverviewLoading(true);
    setOverviewError("");
    apiRequest(`/admin/overview?days=${period}`, { signal: controller.signal })
      .then((data) => setOverviewData(data))
      .catch((error) => {
        if (!controller.signal.aborted) setOverviewError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setOverviewLoading(false);
      });
    return () => controller.abort();
  }, [authStatus, activePage, period, overviewRefreshKey]);

  function showToast(title, description) {
    setToast({ title, description });
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => setToast(null), 3600);
  }

  async function signIn(email, password) {
    setAuthBusy(true);
    setAuthError("");
    try {
      const { user: signedInUser } = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
      if (signedInUser.role !== "admin") {
        await apiRequest("/auth/logout", { method: "POST", body: {} });
        setAuthError("This account does not have administrator access.");
        return;
      }
      const { user } = await apiRequest("/admin/me");
      setOverviewData(null);
      setOverviewError("");
      setAdminUser(user);
      setAuthStatus("signed-in");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    try {
      await apiRequest("/auth/logout", { method: "POST", body: {} });
      setAdminUser(null);
      setOverviewData(null);
      setOverviewError("");
      setAuthStatus("signed-out");
    } catch (error) {
      showToast("Sign-out failed", error.message);
    }
  }

  function refreshOverview() {
    setOverviewRefreshKey((key) => key + 1);
  }

  function exportOverviewReport() {
    if (!overviewData) {
      showToast("Report unavailable", "Load the database overview before exporting it.");
      return;
    }
    const csvRows = [
      ["Overview metric", "Value"],
      ["Period (days)", overviewData.period.days],
      ["Total users", overviewData.statistics.users.total],
      ["New users in period", overviewData.statistics.users.newInPeriod],
      ["Total operators", overviewData.statistics.operators.total],
      ["Active operators", overviewData.statistics.operators.active],
      ["Total vehicles", overviewData.statistics.vehicles.total],
      ["Total routes", overviewData.statistics.routes.total],
      ["Active routes", overviewData.statistics.routes.active],
      ["Total schedules", overviewData.statistics.schedules.total],
      ["Upcoming schedules", overviewData.statistics.schedules.upcoming],
      [],
      ["Schedule ID", "Operator", "Route", "Transport", "Departure", "Available seats", "Total seats", "Status"],
      ...overviewData.recentSchedules.map((schedule) => [
        schedule.id,
        schedule.operator?.name ?? "",
        `${schedule.route?.departure ?? ""} to ${schedule.route?.destination ?? ""}`,
        schedule.transport,
        schedule.departureAt,
        schedule.availableSeats,
        schedule.totalSeats,
        schedule.status,
      ]),
    ];
    const csv = csvRows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "eticketing-overview-report.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Report exported", "Current MongoDB overview statistics and recent schedules were downloaded as CSV.");
  }

  if (authStatus === "checking") {
    return <main className="admin-signin-page"><p className="admin-auth-check">Checking administrator session...</p></main>;
  }
  if (authStatus !== "signed-in" || !adminUser) {
    return <AdminSignIn onSignIn={signIn} error={authError} busy={authBusy} />;
  }

  return (
    <div className={`admin-app${collapsed ? " sidebar-collapsed" : ""}`}>
      <Sidebar activePage={activePage} setActivePage={setActivePage} collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onToast={showToast} adminUser={adminUser} />
      <main className="app-main">
        <Topbar activePage={activePage} search={search} setSearch={setSearch} onToast={showToast} onOpenMobileNav={() => setMobileOpen(true)} onToggleSidebar={() => setCollapsed((value) => !value)} onExport={exportOverviewReport} adminUser={adminUser} onLogout={signOut} />
        <div className="dashboard-content">
          {activePage === "Users" ? (
            <UserManagement users={users} setUsers={setUsers} query={search} onQueryChange={setSearch} onToast={showToast} />
          ) : activePage === "Operators" ? (
            <OperatorManagement operators={managedOperators} setOperators={setManagedOperators} query={search} onQueryChange={setSearch} onToast={showToast} />
          ) : activePage === "Vehicles" ? (
            <VehicleManagement vehicles={managedVehicles} setVehicles={setManagedVehicles} operators={managedOperators} setOperators={setManagedOperators} query={search} onQueryChange={setSearch} onToast={showToast} />
          ) : activePage === "Routes" ? (
            <RouteManagement query={search} onQueryChange={setSearch} onToast={showToast} />
          ) : activePage === "Schedules" ? (
            <ScheduleManagement query={search} onQueryChange={setSearch} onToast={showToast} />
          ) : activePage === "Bookings" ? (
            <BookingManagement bookings={bookings} setBookings={setBookings} query={search} onQueryChange={setSearch} onToast={showToast} />
          ) : activePage === "Tickets" ? (
            <TicketManagement tickets={tickets} setTickets={setTickets} query={search} onQueryChange={setSearch} onToast={showToast} />
          ) : activePage === "Payments" ? (
            <PaymentManagement query={search} onToast={showToast} />
          ) : activePage === "Offers" ? (
            <OfferManagement query={search} onToast={showToast} />
          ) : activePage === "Overview" ? (
            <OverviewDashboard adminUser={adminUser} data={overviewData} loading={overviewLoading} error={overviewError} days={period} setDays={setPeriod} onRefresh={refreshOverview} onExport={exportOverviewReport} query={search} />
          ) : (
            <div className="module-notice"><span><ActivePageIcon name={activePage} /></span><div><strong>{activePage} workspace</strong><small>This section is not connected to a live backend yet.</small></div></div>
          )}
        </div>
      </main>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default App;
