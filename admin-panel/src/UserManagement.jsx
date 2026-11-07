import { useEffect, useState } from "react";
import { apiRequest } from "./api.js";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
  UserRound,
  UserRoundX,
  X,
} from "lucide-react";
import "./user-management.css";

const demoPeople = [
  ["Ayesha Rahman", "ayesha.rahman@email.com", "+880 1712-345678", "lavender", 4, 6850],
  ["Mohammad Fahim", "fahim.mohammad@email.com", "+880 1811-234567", "blue", 8, 12400],
  ["Nusrat Jahan", "nusrat.jahan@email.com", "+880 1914-567890", "peach", 3, 4250],
  ["Tanvir Ahmed", "tanvir.ahmed@email.com", "+880 1610-789012", "mint", 12, 18900],
  ["Sadia Islam", "sadia.islam@email.com", "+880 1517-890123", "rose", 2, 1850],
  ["Imran Hossain", "imran.hossain@email.com", "+880 1718-901234", "gold", 6, 9200],
  ["Mehjabin Chowdhury", "mehja.chowdhury@email.com", "+880 1819-012345", "lavender", 5, 7200],
  ["Rafiul Karim", "rafiul.karim@email.com", "+880 1910-123456", "blue", 1, 1200],
  ["Samira Akter", "samira.akter@email.com", "+880 1611-234567", "mint", 9, 14600],
  ["Arif Mahmud", "arif.mahmud@email.com", "+880 1512-345678", "peach", 7, 10800],
  ["Tanjila Sultana", "tanjila.sultana@email.com", "+880 1713-456789", "rose", 0, 0],
  ["Shakib Hasan", "shakib.hasan@email.com", "+880 1814-567890", "gold", 11, 17350],
  ["Nabila Yasmin", "nabila.yasmin@email.com", "+880 1915-678901", "lavender", 3, 3900],
  ["Farhan Kabir", "farhan.kabir@email.com", "+880 1616-789012", "blue", 2, 2700],
];

const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

export const initialUsers = demoPeople.map(([name, email, phone, color, bookings, spent], index) => ({
  id: `USR-${String(1042 - index).padStart(5, "0")}`,
  name,
  email,
  phone,
  joinedAt: daysAgo([1, 2, 4, 7, 11, 18, 24, 31, 38, 45, 54, 68, 82, 96][index]),
  status: index === 6 || index === 10 ? "Blocked" : "Active",
  color,
  bookings,
  spent,
  recentBookings: [
    { id: `ET-${28491 - index * 3}`, route: index % 2 ? "Dhaka → Sylhet" : "Dhaka → Chattogram", mode: index % 3 === 0 ? "Bus" : "Train", date: daysAgo(index + 1), amount: Math.max(0, Math.round(spent * 0.3)) },
    { id: `ET-${28490 - index * 3}`, route: index % 2 ? "Sylhet → Dhaka" : "Chattogram → Dhaka", mode: index % 3 === 1 ? "Launch" : "Bus", date: daysAgo(index + 9), amount: Math.max(0, Math.round(spent * 0.22)) },
  ],
}));

const registrationDate = (date) =>
  new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));

const amount = (value) => `৳${new Intl.NumberFormat("en-BD").format(value)}`;

function Avatar({ user, size = "" }) {
  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <span className={`users-avatar ${user.color || "mint"} ${size}`}>{user.profileImage ? <img src={user.profileImage} alt="" /> : initials}</span>;
}

function UserStatus({ status }) {
  return <span className={`users-status ${status.toLowerCase()}`}><i />{status}</span>;
}

function userFromApi(record, index = 0) {
  const createdAt = record.createdAt ? new Date(record.createdAt) : new Date();
  return {
    id: record.id,
    name: record.fullName,
    email: record.email,
    phone: record.phone || "",
    profileImage: record.profileImage || "",
    role: record.role,
    isEmailVerified: Boolean(record.isEmailVerified),
    joinedAt: createdAt.toISOString().slice(0, 10),
    status: record.isActive ? "Active" : "Blocked",
    color: ["mint", "blue", "gold", "rose", "lavender", "peach"][index % 6],
    bookings: null,
    spent: null,
    recentBookings: [],
  };
}

function UserModal({ user, users, onClose, onSave }) {
  const [values, setValues] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    password: "",
    status: user?.status ?? "Active",
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");

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
    setSubmitError("");
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (values.name.trim().length < 2) nextErrors.name = "Enter a name with at least 2 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (values.phone.trim() && !/^\+?[0-9\s()-]{7,20}$/.test(values.phone.trim())) nextErrors.phone = "Enter a valid phone number.";
    if ((!user || values.password) && (values.password.length < 8 || values.password.length > 72)) nextErrors.password = "Password must be between 8 and 72 characters.";
    if (users.some((item) => item.email.toLowerCase() === values.email.trim().toLowerCase() && item.id !== user?.id)) {
      nextErrors.email = "An account with this email already exists.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      await onSave({
        ...user,
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        password: values.password,
        status: values.status,
        joinedAt: user?.joinedAt ?? daysAgo(0),
        color: user?.color ?? "mint",
        bookings: user?.bookings ?? 0,
        spent: user?.spent ?? 0,
        recentBookings: user?.recentBookings ?? [],
      });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save this user.");
    }
  }

  return (
    <div className="users-modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="users-modal" role="dialog" aria-modal="true" aria-labelledby="user-form-title">
        <div className="users-modal-head">
          <div><span className="users-eyebrow">{user ? "ACCOUNT DETAILS" : "NEW ACCOUNT"}</span><h2 id="user-form-title">{user ? "Edit user" : "Add new user"}</h2><p>{user ? "Update this user’s database account." : "Create a verified customer account."}</p></div>
          <button className="users-icon-button" type="button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button>
        </div>
        <form className="users-form" onSubmit={submit} noValidate>
          <label className="users-field"><span>Full name</span><input autoFocus value={values.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Ayesha Rahman" aria-invalid={Boolean(errors.name)} />{errors.name && <small className="users-field-error">{errors.name}</small>}</label>
          <label className="users-field"><span>Email address</span><input type="email" autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} placeholder="name@example.com" aria-invalid={Boolean(errors.email)} />{errors.email && <small className="users-field-error">{errors.email}</small>}</label>
          <label className="users-field"><span>Phone number</span><input type="tel" autoComplete="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+880 1XXX-XXXXXX" aria-invalid={Boolean(errors.phone)} />{errors.phone && <small className="users-field-error">{errors.phone}</small>}</label>
          {user?.role !== "admin" && <label className="users-field"><span>{user ? "New password (optional)" : "Password"}</span><input type="password" autoComplete="new-password" value={values.password} onChange={(event) => update("password", event.target.value)} placeholder={user ? "Leave blank to keep current password" : "8–72 characters"} aria-invalid={Boolean(errors.password)} />{errors.password && <small className="users-field-error">{errors.password}</small>}</label>}
          {user?.role !== "admin" && <label className="users-field"><span>Account status</span><select value={values.status} onChange={(event) => update("status", event.target.value)}><option>Active</option><option>Blocked</option></select></label>}
          {submitError && <p className="users-submit-error" role="alert">{submitError}</p>}
          <div className="users-form-actions"><button className="users-button secondary" type="button" onClick={onClose}>Cancel</button><button className="users-button primary" type="submit">{user ? "Save changes" : "Create user"}</button></div>
        </form>
      </section>
    </div>
  );
}

function UserDrawer({ user, onClose, onEdit, onAction }) {
  useEffect(() => {
    if (!user) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [user, onClose]);

  if (!user) return null;
  return (
    <div className="users-drawer-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="users-drawer" role="dialog" aria-modal="true" aria-labelledby="users-drawer-title">
        <header className="users-drawer-head"><div><span className="users-eyebrow">USER PROFILE</span><h2 id="users-drawer-title">User details</h2></div><button className="users-icon-button" type="button" aria-label="Close user details" onClick={onClose}><X size={19} /></button></header>
        <div className="users-drawer-scroll">
          <section className="users-profile-card"><Avatar user={user} size="large" /><h3>{user.name}</h3><span>{user.id}</span>{user.role === "admin" && <span className="users-role-badge">Administrator</span>}<UserStatus status={user.status} /><div className="users-profile-actions"><button className="users-button secondary" type="button" onClick={() => onEdit(user)}><Pencil size={14} /> Edit profile</button>{user.role !== "admin" && <button className="users-icon-button" type="button" aria-label={user.status === "Active" ? "Block user" : "Unblock user"} onClick={() => onAction(user.status === "Active" ? "block" : "unblock", user)}>{user.status === "Active" ? <Ban size={16} /> : <UserCheck size={16} />}</button>}</div></section>
          <section className="users-detail-section"><h3>Contact information</h3><div className="users-detail-row"><span><Mail size={15} /></span><div><small>Email address</small><strong>{user.email}</strong></div></div><div className="users-detail-row"><span><Phone size={15} /></span><div><small>Phone number</small><strong>{user.phone}</strong></div></div><div className="users-detail-row"><span><CalendarDays size={15} /></span><div><small>Registered on</small><strong>{registrationDate(user.joinedAt)}</strong></div></div></section>
          <section className="users-detail-section"><h3>Account security</h3><div className="users-detail-row"><span><ShieldCheck size={15} /></span><div><small>Email verification</small><strong>{user.isEmailVerified ? "Verified" : "Not verified"}</strong></div></div><div className="users-detail-row"><span><UserRound size={15} /></span><div><small>Account role</small><strong>{user.role === "admin" ? "Administrator" : "Customer"}</strong></div></div></section>
          <section className="users-detail-section users-booking-history"><div className="users-history-heading"><h3>Booking history</h3></div><div className="users-no-history"><Clock3 size={17} />Admin-created bookings are not linked to customer accounts yet.</div></section>
          {user.role !== "admin" && <button className="users-delete-link" type="button" onClick={() => onAction("delete", user)}><Trash2 size={15} /> Deactivate user</button>}
        </div>
      </aside>
    </div>
  );
}

function ConfirmDialog({ action, onCancel, onConfirm }) {
  if (!action) return null;
  const isDelete = action.type === "delete";
  const isBulk = action.type === "bulk-block";
  const subject = isBulk ? `${action.ids.length} selected users` : action.user.name;
  const title = isDelete ? "Deactivate this user?" : action.type === "block" || isBulk ? "Block account?" : "Unblock account?";
  const description = isDelete
    ? `${subject} will lose access to their account. Its database record and related data will be retained.`
    : isBulk
      ? `${subject} will lose access to their accounts.`
      : action.type === "block"
        ? `${subject} will lose access to their account until you unblock them.`
        : `${subject} will be able to access their account again.`;
  return (
    <div className="users-modal-scrim confirm-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="users-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="users-confirm-title">
        <span className={`users-confirm-icon ${isDelete ? "danger" : ""}`}>{isDelete ? <Trash2 size={19} /> : action.type === "unblock" ? <UserCheck size={19} /> : <ShieldCheck size={19} />}</span>
        <h2 id="users-confirm-title">{title}</h2><p>{description}</p>
        <div className="users-form-actions"><button className="users-button secondary" type="button" onClick={onCancel}>Cancel</button><button className={`users-button ${isDelete ? "danger-button" : "primary"}`} type="button" onClick={onConfirm}>{isDelete ? "Deactivate user" : action.type === "unblock" ? "Unblock user" : "Block user"}</button></div>
      </section>
    </div>
  );
}

function UserActions({ user, open, onToggle, onAction }) {
  return (
    <div className="users-row-actions">
      <button className="users-icon-button" type="button" aria-label={`Actions for ${user.name}`} aria-expanded={open} onClick={onToggle}><MoreHorizontal size={18} /></button>
      {open && <div className="users-action-menu" role="menu"><button type="button" role="menuitem" onClick={() => onAction("view", user)}><Eye size={14} />View details</button><button type="button" role="menuitem" onClick={() => onAction("edit", user)}><Pencil size={14} />Edit user</button>{user.role !== "admin" && <><button type="button" role="menuitem" onClick={() => onAction(user.status === "Active" ? "block" : "unblock", user)}>{user.status === "Active" ? <Ban size={14} /> : <UserCheck size={14} />}{user.status === "Active" ? "Block user" : "Unblock user"}</button><button className="danger-action" type="button" role="menuitem" onClick={() => onAction("delete", user)}><Trash2 size={14} />Deactivate user</button></>}</div>}
    </div>
  );
}

export default function UserManagement({ users, setUsers, query, onQueryChange, onToast }) {
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [dateFilter, setDateFilter] = useState("Any time");
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeMenu, setActiveMenu] = useState("");
  const [drawerUserId, setDrawerUserId] = useState("");
  const [editingUserId, setEditingUserId] = useState(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [statistics, setStatistics] = useState({ totalUsers: 0, activeUsers: 0, blockedUsers: 0, newThisMonth: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  const currentDate = new Date();
  const monthStart = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-01`;
  const last30Days = daysAgo(30);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, dateFilter, sortOrder, pageSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
      sort: sortOrder,
    });
    if (debouncedQuery) params.set("search", debouncedQuery);
    if (statusFilter !== "All statuses") params.set("status", statusFilter.toLowerCase());
    if (dateFilter === "This month") params.set("from", monthStart);
    if (dateFilter === "Last 30 days") params.set("from", last30Days);

    setLoading(true);
    apiRequest(`/admin/users?${params}`, { signal: controller.signal })
      .then((data) => {
        setUsers((data.users || []).map(userFromApi));
        setStatistics(data.statistics || { totalUsers: 0, activeUsers: 0, blockedUsers: 0, newThisMonth: 0 });
        setPagination(data.pagination || { page, limit: pageSize, total: 0, totalPages: 0 });
        setHasLoaded(true);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setUsers([]);
        setStatistics({ totalUsers: 0, activeUsers: 0, blockedUsers: 0, newThisMonth: 0 });
        setPagination({ page, limit: pageSize, total: 0, totalPages: 0 });
        setHasLoaded(true);
        onToast("Could not load users", error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, statusFilter, dateFilter, sortOrder, page, pageSize, monthStart, last30Days, reloadVersion]);

  useEffect(() => {
    setSelectedIds([]);
  }, [query, statusFilter, dateFilter, sortOrder]);

  useEffect(() => {
    setSelectedIds((ids) => ids.filter((id) => users.some((user) => user.id === id && user.role !== "admin")));
  }, [users]);

  const visibleUsers = hasLoaded ? users : [];
  const pageUsers = visibleUsers;
  const totalPages = Math.max(1, pagination.totalPages);
  const drawerUser = users.find((user) => user.id === drawerUserId) ?? null;
  const editingUser = users.find((user) => user.id === editingUserId) ?? null;
  const pageIsSelected = pageUsers.length > 0 && pageUsers.every((user) => selectedIds.includes(user.id));

  function changePageSelection(checked) {
    setSelectedIds((current) => checked
      ? Array.from(new Set([...current, ...pageUsers.filter((user) => user.role !== "admin").map((user) => user.id)]))
      : current.filter((id) => !pageUsers.some((user) => user.id === id)));
  }

  async function rowAction(type, user) {
    setActiveMenu("");
    if (type === "view") {
      setDrawerUserId(user.id);
      try {
        const detail = await apiRequest(`/admin/users/${user.id}`);
        const detailedUser = userFromApi(detail.user);
        setUsers((current) => current.map((item) => item.id === user.id ? detailedUser : item));
      } catch (error) {
        onToast("Could not load user details", error.message);
      }
      return;
    }
    if (type === "edit") {
      setDrawerUserId("");
      setEditingUserId(user.id);
      return;
    }
    setConfirmAction({ type, user });
  }

  async function saveUser(user) {
    const isExisting = Boolean(user.id && /^[a-f\d]{24}$/i.test(user.id));
    const body = {
      fullName: user.name,
      email: user.email,
      phone: user.phone,
      ...(user.password ? { password: user.password } : {}),
    };
    const result = await apiRequest(isExisting ? `/admin/users/${user.id}` : "/admin/users", {
      method: isExisting ? "PUT" : "POST",
      body,
    });
    let savedUser = result.user;
    if (user.status === "Blocked" && savedUser.isActive) {
      try {
        const statusResult = await apiRequest(`/admin/users/${savedUser.id}/status`, {
          method: "PATCH",
          body: { status: "blocked" },
        });
        savedUser = statusResult.user;
      } catch (error) {
        setReloadVersion((version) => version + 1);
        throw new Error(`Account was created, but could not be blocked: ${error.message}`);
      }
    } else if (isExisting && savedUser.role !== "admin" && user.status !== (savedUser.isActive ? "Active" : "Blocked")) {
      const statusResult = await apiRequest(`/admin/users/${savedUser.id}/status`, {
        method: "PATCH",
        body: { status: user.status === "Blocked" ? "blocked" : "active" },
      });
      savedUser = statusResult.user;
    }

    setSortOrder("newest");
    setStatusFilter("All statuses");
    setDateFilter("Any time");
    onQueryChange("");
    setPage(1);
    setReloadVersion((version) => version + 1);
    onToast(isExisting ? "User updated" : "User created", `${savedUser.fullName}'s account was saved to the database.`);
  }

  async function confirmUserAction() {
    const action = confirmAction;
    if (!action) return;
    if (confirmAction.type === "delete") {
      const { user } = action;
      try {
        await apiRequest(`/admin/users/${user.id}`, { method: "DELETE" });
        setDrawerUserId("");
        setSelectedIds((current) => current.filter((id) => id !== user.id));
        setReloadVersion((version) => version + 1);
        onToast("User deactivated", `${user.name}'s account was deactivated; its records were retained.`);
      } catch (error) {
        onToast("Could not deactivate user", error.message);
      }
    } else if (confirmAction.type === "bulk-block") {
      const ids = action.ids;
      const results = await Promise.allSettled(ids.map((id) => apiRequest(`/admin/users/${id}/status`, {
        method: "PATCH",
        body: { status: "blocked" },
      })));
      const failedCount = results.filter((result) => result.status === "rejected").length;
      setSelectedIds([]);
      setReloadVersion((version) => version + 1);
      if (failedCount) onToast("Some accounts were not blocked", `${ids.length - failedCount} updated; ${failedCount} failed. Administrator accounts cannot be blocked.`);
      else onToast("Accounts blocked", `${ids.length} accounts were blocked.`);
    } else {
      const { user, type } = action;
      try {
        await apiRequest(`/admin/users/${user.id}/status`, {
          method: "PATCH",
          body: { status: type === "block" ? "blocked" : "active" },
        });
        setDrawerUserId("");
        setReloadVersion((version) => version + 1);
        onToast(type === "block" ? "Account blocked" : "Account unblocked", `${user.name}'s account status was updated.`);
      } catch (error) {
        onToast("Could not update account status", error.message);
      }
    }
    setConfirmAction(null);
  }

  return (
    <section className="user-management">
      <div className="users-demo-note"><span /> LIVE DATABASE <span>User records and account actions are loaded from MongoDB through the protected admin API.</span></div>
      <header className="users-page-heading">
        <div><span className="users-eyebrow">WORKSPACE <ArrowRight size={12} /> USERS</span><h1>User Management</h1><p>Manage and monitor all registered users.</p></div>
        <button className="users-button primary add-user-button" type="button" onClick={() => setIsAddingUser(true)}><UserPlus size={16} />Add new user</button>
      </header>

      <section className="users-stats-grid" aria-label="User statistics">
        <article className="users-stat-card"><span className="users-stat-icon all"><UsersRound size={18} /></span><span className="users-stat-label">Total users</span><strong>{statistics.totalUsers.toLocaleString("en-BD")}</strong><small>All registered accounts</small></article>
        <article className="users-stat-card"><span className="users-stat-icon active"><UserCheck size={18} /></span><span className="users-stat-label">Active users</span><strong>{statistics.activeUsers.toLocaleString("en-BD")}</strong><small>Accounts in good standing</small></article>
        <article className="users-stat-card"><span className="users-stat-icon blocked"><UserRoundX size={18} /></span><span className="users-stat-label">Blocked users</span><strong>{statistics.blockedUsers.toLocaleString("en-BD")}</strong><small>Restricted accounts</small></article>
        <article className="users-stat-card"><span className="users-stat-icon new"><UserPlus size={18} /></span><span className="users-stat-label">New this month</span><strong>{statistics.newThisMonth.toLocaleString("en-BD")}</strong><small>Joined since {registrationDate(monthStart)}</small></article>
      </section>

      <section className="users-table-card">
        <header className="users-table-heading"><div><h2>All users <span>{pagination.total}</span></h2><p>A complete list of E-Ticketing user accounts.</p></div><div className="users-table-search"><Search size={16} /><span>{query ? `Searching “${query}”` : "Use the top search to find users"}</span></div></header>
        <div className="users-filter-bar">
          <label className="users-filter-search"><Search size={15} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} aria-label="Search users by name, email, phone or user ID" placeholder="Search name, email, phone or ID..." />{query && <button type="button" aria-label="Clear user search" onClick={() => onQueryChange("")}><X size={14} /></button>}</label>
          <label className="users-filter-select"><UserRound size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by account status"><option>All statuses</option><option>Active</option><option>Blocked</option></select><ChevronDown size={14} /></label>
          <label className="users-filter-select"><CalendarDays size={15} /><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filter by registration date"><option>Any time</option><option>This month</option><option>Last 30 days</option></select><ChevronDown size={14} /></label>
          <label className="users-filter-select users-sort-select"><ArrowDownWideNarrow size={15} /><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort registration date"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><ChevronDown size={14} /></label>
        </div>
        {selectedIds.length > 0 && <div className="users-bulk-bar"><span><Check size={14} />{selectedIds.length} selected</span><button type="button" onClick={() => setConfirmAction({ type: "bulk-block", ids: selectedIds })}><Ban size={14} />Block selected</button><button className="users-clear-selection" type="button" onClick={() => setSelectedIds([])}>Clear selection</button></div>}
        <div className="users-table-scroll">
          <table className="users-table">
            <thead><tr><th className="users-checkbox-column"><input type="checkbox" checked={pageIsSelected} onChange={(event) => changePageSelection(event.target.checked)} aria-label="Select all users on this page" /></th><th>USER ID</th><th>USER</th><th>EMAIL ADDRESS</th><th>PHONE NUMBER</th><th>REGISTERED</th><th>STATUS</th><th><span className="users-sr-only">Actions</span></th></tr></thead>
            <tbody>{pageUsers.map((user) => <tr key={user.id}>
              <td className="users-checkbox-column"><input type="checkbox" checked={selectedIds.includes(user.id)} disabled={user.role === "admin"} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id))} aria-label={`Select ${user.name}`} /></td>
              <td><button className="users-id-link" type="button" onClick={() => rowAction("view", user)}>{user.id}</button></td>
              <td><button className="users-person-cell" type="button" onClick={() => rowAction("view", user)}><Avatar user={user} /><strong>{user.name}</strong></button></td>
              <td className="users-email-cell">{user.email}</td><td className="users-phone-cell">{user.phone}</td><td className="users-date-cell">{registrationDate(user.joinedAt)}</td><td><UserStatus status={user.status} /></td>
              <td><UserActions user={user} open={activeMenu === user.id} onToggle={() => setActiveMenu((current) => current === user.id ? "" : user.id)} onAction={rowAction} /></td>
            </tr>)}
              {pageUsers.length === 0 && <tr><td className="users-empty-state" colSpan="8">{loading ? <Clock3 size={20} /> : <Search size={20} />}<strong>{loading ? "Loading database users..." : "No users found"}</strong><span>{loading ? "Fetching real user records from the server." : "Try adjusting your search or filters."}</span></td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="users-pagination"><span>Showing <strong>{pagination.total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, pagination.total)}</strong> of <strong>{pagination.total}</strong> users{loading ? " · refreshing" : ""}</span><div className="users-page-controls"><label>Rows per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value="8">8</option><option value="12">12</option><option value="20">20</option></select></label><button className="users-icon-button" type="button" disabled={page <= 1 || loading} aria-label="Previous page" onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /></button><span className="users-page-number">{page} <small>of</small> {totalPages}</span><button className="users-icon-button" type="button" disabled={page >= totalPages || loading} aria-label="Next page" onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={17} /></button></div></footer>
      </section>

      {(isAddingUser || editingUserId) && <UserModal key={editingUserId || "new"} user={editingUser} users={users} onClose={() => { setIsAddingUser(false); setEditingUserId(null); }} onSave={saveUser} />}
      <UserDrawer user={drawerUser} onClose={() => setDrawerUserId("")} onEdit={(user) => { setDrawerUserId(""); setEditingUserId(user.id); }} onAction={rowAction} />
      <ConfirmDialog action={confirmAction} onCancel={() => setConfirmAction(null)} onConfirm={confirmUserAction} />
    </section>
  );
}
