import { useEffect, useMemo, useState } from "react";
import { apiRequest, uploadImage } from "./api.js";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  Bus,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Ship,
  ShieldCheck,
  TrainFront,
  Trash2,
  UserCheck,
  UsersRound,
  X,
} from "lucide-react";
import "./operator-management.css";

const demoOperators = [
  ["Sakura Express", "Bus", "+880 1711-203040", "ops@sakuraexpress.bd", "Dhaka", "active", "SE"],
  ["Bangladesh Railway", "Train", "+880 1312-345678", "support@railway.gov.bd", "Dhaka", "active", "BR"],
  ["Green Line Paribahan", "Bus", "+880 1911-223344", "info@greenlinebd.com", "Dhaka", "pending", "GL"],
  ["Sundarban Launch Service", "Launch", "+880 1718-881122", "hello@sundarbanlaunch.bd", "Barishal", "active", "SL"],
  ["Hanif Enterprise", "Bus", "+880 1811-567890", "contact@hanifenterprise.bd", "Dhaka", "active", "HE"],
  ["Ena Transport", "Bus", "+880 1912-567890", "service@enatransport.bd", "Sylhet", "inactive", "EN"],
  ["Shohagh Paribahan", "Bus", "+880 1715-332211", "support@shohaghparibahan.bd", "Dhaka", "active", "SP"],
  ["BRTC", "Bus", "+880 1552-555666", "info@brtc.gov.bd", "Dhaka", "pending", "BT"],
  ["MV Green Line", "Launch", "+880 1712-998877", "booking@mvgreenline.bd", "Dhaka", "active", "MV"],
  ["Desh Travels", "Bus", "+880 1816-223344", "help@deshtravels.bd", "Rajshahi", "inactive", "DT"],
  ["US-Bangla Airlines", "Event", "+880 1717-999000", "care@usbangla.com", "Dhaka", "active", "UB"],
  ["Tisha Plus", "Bus", "+880 1913-776655", "info@tishaplus.bd", "Mymensingh", "pending", "TP"],
];

const dateAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const palette = ["mint", "blue", "gold", "rose", "lavender", "peach"];

export const initialOperators = demoOperators.map(([name, transport, phone, email, city, status, short], index) => ({
  id: `OPR-${String(2031 - index).padStart(4, "0")}`,
  name,
  transport,
  phone,
  email,
  address: `${city}, Bangladesh`,
  city,
  status,
  short,
  color: palette[index % palette.length],
  logo: "",
  joinedAt: dateAgo([2, 5, 8, 12, 16, 23, 29, 34, 41, 52, 65, 78][index]),
  vehicles: [42, 158, 36, 18, 54, 29, 47, 86, 14, 33, 22, 16][index],
  routes: [28, 62, 18, 9, 31, 16, 25, 37, 7, 19, 11, 12][index],
  bookings: [2140, 5630, 0, 1240, 2980, 760, 1840, 0, 960, 530, 420, 0][index],
}));

const formatDate = (date) => new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));

function TransportIcon({ type, size = 15 }) {
  if (type === "Train") return <TrainFront size={size} />;
  if (type === "Launch") return <Ship size={size} />;
  if (type === "Event") return <CalendarDays size={size} />;
  return <Bus size={size} />;
}

function OperatorLogo({ operator, large = false }) {
  if (operator.logo) return <img className={`operator-logo ${large ? "large" : ""}`} src={operator.logo} alt={`${operator.name} logo`} />;
  return <span className={`operator-logo ${operator.color || "mint"} ${large ? "large" : ""}`} aria-label={`${operator.name} logo`}>
    <span>{operator.short || operator.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
  </span>;
}

function OperatorStatus({ status }) {
  const label = status === "active" ? "Active" : status === "pending" ? "Pending" : "Inactive";
  return <span className={`operator-status ${status}`}><i />{label}</span>;
}

function operatorFromApi(operator, index = 0) {
  const name = operator.name || "Operator";
  return {
    id: operator.id,
    name,
    logo: operator.logo || "",
    transport: operator.transport,
    email: operator.email,
    phone: operator.phone,
    address: operator.address,
    status: operator.status,
    short: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
    color: palette[index % palette.length],
    joinedAt: operator.createdAt?.slice(0, 10) || dateAgo(0),
    vehicles: 0,
    routes: 0,
    bookings: 0,
  };
}

function OperatorModal({ operator, operators, onClose, onSave }) {
  const [values, setValues] = useState({
    name: operator?.name ?? "",
    transport: operator?.transport ?? "Bus",
    email: operator?.email ?? "",
    phone: operator?.phone ?? "",
    address: operator?.address ?? "",
    status: operator?.status ?? "pending",
    logo: operator?.logo ?? "",
  });
  const [errors, setErrors] = useState({});
  const [logoError, setLogoError] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [savedId, setSavedId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!logoFile) return undefined;
    const preview = URL.createObjectURL(logoFile);
    update("logo", preview);
    return () => URL.revokeObjectURL(preview);
  }, [logoFile]);

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

  function chooseLogo(event) {
    const file = event.target.files?.[0];
    setLogoError("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setLogoError("Choose a PNG, JPG or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Logo must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }
    setRemoveLogo(false);
    setLogoFile(file);
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (values.name.trim().length < 2) nextErrors.name = "Enter an operator name with at least 2 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!/^\+?[0-9\s()-]{7,20}$/.test(values.phone.trim())) nextErrors.phone = "Enter a valid contact number.";
    if (values.address.trim().length < 4) nextErrors.address = "Enter the operator's address.";
    if (operators.some((item) => item.email.toLowerCase() === values.email.trim().toLowerCase() && item.id !== (savedId || operator?.id))) {
      nextErrors.email = "An operator with this email already exists.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setLogoError("");
    try {
      const outcome = await onSave({
        ...operator,
        ...values,
        id: savedId || operator?.id,
        logoFile,
        removeLogo,
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
      });
      if (outcome?.operator?.id) setSavedId(outcome.operator.id);
      if (outcome?.uploadError) {
        setLogoError(outcome.uploadError);
        return;
      }
      onClose();
    } catch (error) {
      setLogoError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="operator-modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="operator-modal" role="dialog" aria-modal="true" aria-labelledby="operator-form-title">
        <header className="operator-modal-header"><div><span className="operator-eyebrow">{operator ? "OPERATOR PROFILE" : "NEW PARTNER"}</span><h2 id="operator-form-title">{operator ? "Edit operator" : "Add operator"}</h2><p>{operator ? "Update operator contact and account information." : "Register a new transport partner for the demo."}</p></div><button className="operator-icon-button" type="button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></header>
        <form className="operator-form" onSubmit={submit} noValidate>
          <div className="operator-logo-field"><div className="operator-logo-preview">{values.logo ? <img src={values.logo} alt="Operator logo preview" /> : <span>{values.name.trim() ? values.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() : "OP"}</span>}</div><div><strong>Operator logo</strong><small>PNG, JPG or WebP · Max 2 MB</small><label className="operator-upload-button"><Plus size={13} />Upload logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseLogo} /></label>{logoError && <small className="operator-error">{logoError}</small>}</div>{values.logo && <button className="operator-logo-remove" type="button" onClick={() => { setLogoFile(null); setRemoveLogo(true); update("logo", ""); }}>Remove</button>}</div>
          <label className="operator-field"><span>Operator name</span><input autoFocus value={values.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Sakura Express" aria-invalid={Boolean(errors.name)} />{errors.name && <small className="operator-error">{errors.name}</small>}</label>
          <div className="operator-form-row">
            <label className="operator-field"><span>Transport type</span><select value={values.transport} onChange={(event) => update("transport", event.target.value)}><option>Bus</option><option>Train</option><option>Launch</option><option>Event</option></select></label>
            <label className="operator-field"><span>Account status</span><select value={values.status} onChange={(event) => update("status", event.target.value)}><option value="active">Active</option><option value="pending">Pending approval</option><option value="inactive">Inactive</option></select></label>
          </div>
          <label className="operator-field"><span>Email address</span><input type="email" autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} placeholder="operator@example.com" aria-invalid={Boolean(errors.email)} />{errors.email && <small className="operator-error">{errors.email}</small>}</label>
          <label className="operator-field"><span>Contact number</span><input type="tel" autoComplete="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+880 1XXX-XXXXXX" aria-invalid={Boolean(errors.phone)} />{errors.phone && <small className="operator-error">{errors.phone}</small>}</label>
          <label className="operator-field"><span>Address</span><textarea rows="2" autoComplete="street-address" value={values.address} onChange={(event) => update("address", event.target.value)} placeholder="Office address, city" aria-invalid={Boolean(errors.address)} />{errors.address && <small className="operator-error">{errors.address}</small>}</label>
          <footer className="operator-form-actions"><button className="operator-button secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="operator-button primary" type="submit" disabled={saving}>{saving ? "Saving..." : operator ? "Save changes" : "Add operator"}</button></footer>
        </form>
      </section>
    </div>
  );
}

function OperatorDrawer({ operator, onClose, onEdit, onToggle, onDelete }) {
  useEffect(() => {
    if (!operator) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [operator, onClose]);
  if (!operator) return null;

  return (
    <div className="operator-drawer-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="operator-drawer" role="dialog" aria-modal="true" aria-labelledby="operator-drawer-title">
        <header className="operator-drawer-header"><div><span className="operator-eyebrow">PARTNER PROFILE</span><h2 id="operator-drawer-title">Operator details</h2></div><button className="operator-icon-button" type="button" aria-label="Close operator details" onClick={onClose}><X size={19} /></button></header>
        <div className="operator-drawer-content">
          <section className="operator-profile-card"><OperatorLogo operator={operator} large /><h3>{operator.name}</h3><span>{operator.id}</span><div className="operator-profile-tags"><OperatorStatus status={operator.status} /><span className="operator-type-pill"><TransportIcon type={operator.transport} />{operator.transport}</span></div><div className="operator-profile-actions"><button className="operator-button secondary" type="button" onClick={() => onEdit(operator)}><Pencil size={14} />Edit operator</button><button className="operator-icon-button" type="button" aria-label={operator.status === "active" ? "Deactivate operator" : "Activate operator"} onClick={() => onToggle(operator)}>{operator.status === "active" ? <ShieldCheck size={16} /> : <UserCheck size={16} />}</button></div></section>
          <section className="operator-details-section"><h3>Contact information</h3><div className="operator-detail-row"><span><Mail size={15} /></span><div><small>Email address</small><strong>{operator.email}</strong></div></div><div className="operator-detail-row"><span><Phone size={15} /></span><div><small>Contact number</small><strong>{operator.phone}</strong></div></div><div className="operator-detail-row"><span><MapPin size={15} /></span><div><small>Business address</small><strong>{operator.address}</strong></div></div><div className="operator-detail-row"><span><CalendarDays size={15} /></span><div><small>Registered on</small><strong>{formatDate(operator.joinedAt)}</strong></div></div></section>
          <section className="operator-metrics"><article><span><Bus size={15} /></span><small>Vehicles</small><strong>{operator.vehicles}</strong></article><article><span><MapPin size={15} /></span><small>Routes</small><strong>{operator.routes}</strong></article><article><span><UsersRound size={15} /></span><small>Bookings</small><strong>{operator.bookings.toLocaleString("en-BD")}</strong></article></section>
          <div className="operator-account-note"><Clock3 size={15} /><span>Account information is sample data and is not connected to a live operator service.</span></div>
          <button className="operator-delete-link" type="button" onClick={() => onDelete(operator)}><Trash2 size={15} />Delete operator</button>
        </div>
      </aside>
    </div>
  );
}

function OperatorConfirm({ operator, onClose, onConfirm }) {
  if (!operator) return null;
  return (
    <div className="operator-modal-scrim operator-confirm-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="operator-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="operator-confirm-title"><span className="operator-confirm-icon"><Trash2 size={18} /></span><h2 id="operator-confirm-title">Archive this operator?</h2><p><strong>{operator.name}</strong> will be deactivated and archived; the database record will be retained.</p><footer className="operator-form-actions"><button className="operator-button secondary" type="button" onClick={onClose}>Cancel</button><button className="operator-button danger" type="button" onClick={onConfirm}>Archive operator</button></footer></section>
    </div>
  );
}

function OperatorActions({ operator, open, onToggleMenu, onView, onEdit, onActivate, onDelete }) {
  return (
    <div className="operator-row-actions">
      <button className="operator-icon-button" type="button" aria-label={`Actions for ${operator.name}`} aria-expanded={open} onClick={onToggleMenu}><MoreHorizontal size={18} /></button>
      {open && <div className="operator-action-menu" role="menu"><button type="button" role="menuitem" onClick={onView}><Eye size={14} />View details</button><button type="button" role="menuitem" onClick={onEdit}><Pencil size={14} />Edit operator</button><button type="button" role="menuitem" onClick={onActivate}>{operator.status === "active" ? <ShieldCheck size={14} /> : <UserCheck size={14} />}{operator.status === "active" ? "Deactivate" : "Activate"}</button><button className="danger-action" type="button" role="menuitem" onClick={onDelete}><Trash2 size={14} />Delete operator</button></div>}
    </div>
  );
}

export default function OperatorManagement({ operators, setOperators, query, onQueryChange, onToast }) {
  const [transportFilter, setTransportFilter] = useState("All transport");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [activeMenu, setActiveMenu] = useState("");
  const [drawerId, setDrawerId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest("/admin/operators?limit=100")
      .then(({ operators: records = [] }) => {
        if (active) setOperators(records.map(operatorFromApi));
      })
      .catch((error) => {
        if (active) {
          setOperators([]);
          onToast("Could not load operators", error.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filteredOperators = useMemo(() => operators.filter((operator) => {
    const searchText = `${operator.id} ${operator.name} ${operator.email} ${operator.phone} ${operator.address}`.toLowerCase();
    return (!query.trim() || searchText.includes(query.trim().toLowerCase()))
      && (transportFilter === "All transport" || operator.transport === transportFilter)
      && (statusFilter === "All statuses" || operator.status === statusFilter);
  }).sort((a, b) => sortOrder === "newest"
    ? b.joinedAt.localeCompare(a.joinedAt) || b.id.localeCompare(a.id)
    : a.joinedAt.localeCompare(b.joinedAt) || a.id.localeCompare(b.id)), [operators, query, transportFilter, statusFilter, sortOrder]);

  useEffect(() => {
    setPage(1);
  }, [query, transportFilter, statusFilter, sortOrder, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredOperators.length / pageSize));
  const pageOperators = filteredOperators.slice((page - 1) * pageSize, page * pageSize);
  const drawerOperator = operators.find((operator) => operator.id === drawerId) ?? null;
  const editingOperator = operators.find((operator) => operator.id === editingId) ?? null;
  const count = (status) => operators.filter((operator) => operator.status === status).length;

  async function saveOperator(operator) {
    const originalId = operator.id;
    const isSavedRecord = /^[a-f\d]{24}$/i.test(originalId || "");
    const payload = {
      name: operator.name,
      email: operator.email,
      phone: operator.phone,
      address: operator.address,
      transport: operator.transport,
      ...(!isSavedRecord ? { status: operator.status } : {}),
    };
    const result = await apiRequest(isSavedRecord ? `/admin/operators/${originalId}` : "/admin/operators", {
      method: isSavedRecord ? "PUT" : "POST",
      body: payload,
    });
    let saved = operatorFromApi(result.operator);
    setOperators((current) => current.some((item) => item.id === originalId)
      ? current.map((item) => item.id === originalId ? saved : item)
      : [saved, ...current]);
    try {
      const currentStatus = operators.find((item) => item.id === originalId)?.status;
      if (isSavedRecord && currentStatus !== operator.status) {
        const statusResult = await apiRequest(`/admin/operators/${saved.id}/status`, {
          method: "PATCH",
          body: { status: operator.status },
        });
        saved = operatorFromApi(statusResult.operator);
      }
      if (operator.logoFile) {
        const uploaded = await uploadImage(`/admin/operators/${saved.id}/logo`, operator.logoFile);
        saved = operatorFromApi(uploaded.operator);
      } else if (operator.removeLogo && isSavedRecord) {
        const removed = await apiRequest(`/admin/operators/${saved.id}/logo`, { method: "DELETE" });
        saved = operatorFromApi(removed.operator);
      }
      setOperators((current) => current.map((item) => item.id === saved.id ? saved : item));
      onToast(isSavedRecord ? "Operator updated" : "Operator added", `${saved.name} was saved to the database.`);
      return { operator: saved };
    } catch (error) {
      onToast("Operator saved; image change failed", error.message);
      return { operator: saved, uploadError: error.message };
    }
  }

  async function toggleOperator(operator) {
    const nextStatus = operator.status === "active" ? "inactive" : "active";
    try {
      const result = await apiRequest(`/admin/operators/${operator.id}/status`, { method: "PATCH", body: { status: nextStatus } });
      setOperators((current) => current.map((item) => item.id === operator.id ? operatorFromApi(result.operator) : item));
    } catch (error) {
      onToast("Operator status not changed", error.message);
      return;
    }
    setDrawerId("");
    setActiveMenu("");
    onToast(nextStatus === "active" ? "Operator activated" : "Operator deactivated", `${operator.name} is now ${nextStatus}.`);
  }

  function openAction(action, operator) {
    setActiveMenu("");
    if (action === "view") setDrawerId(operator.id);
    if (action === "edit") {
      setDrawerId("");
      setEditingId(operator.id);
    }
    if (action === "activate") toggleOperator(operator);
    if (action === "delete") setDeleteTarget(operator);
  }

  async function deleteOperator() {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/admin/operators/${deleteTarget.id}`, { method: "DELETE" });
    } catch (error) {
      onToast("Operator not deleted", error.message);
      return;
    }
    setOperators((current) => current.filter((operator) => operator.id !== deleteTarget.id));
    setDrawerId("");
    onToast("Operator archived", `${deleteTarget.name} was safely archived.`);
    setDeleteTarget(null);
  }

  const stats = [
    { label: "Total operators", value: operators.length, caption: "Registered transport partners", Icon: UsersRound, tone: "all" },
    { label: "Active operators", value: count("active"), caption: "Currently serving passengers", Icon: UserCheck, tone: "active" },
    { label: "Pending approval", value: count("pending"), caption: "Awaiting verification", Icon: Clock3, tone: "pending" },
    { label: "Inactive operators", value: count("inactive"), caption: "Not currently accepting bookings", Icon: ShieldCheck, tone: "inactive" },
  ];

  if (loading) {
    return <section className="operator-management"><div className="operator-demo-note"><span /> CONNECTING <span>Loading operator records from the server...</span></div></section>;
  }

  return (
    <section className="operator-management">
      <div className="operator-demo-note"><span /> LIVE DATA <span>Operator profiles and uploaded logos are saved to the backend.</span></div>
      <header className="operator-page-heading"><div><span className="operator-eyebrow">WORKSPACE <ArrowRight size={12} /> OPERATORS</span><h1>Operator Management</h1><p>Manage transport partners, review applications and monitor account status.</p></div><button className="operator-button primary" type="button" onClick={() => setAdding(true)}><Plus size={16} />Add operator</button></header>
      <section className="operator-stats-grid" aria-label="Operator statistics">{stats.map(({ label, value, caption, Icon, tone }) => <article className="operator-stat-card" key={label}><span className={`operator-stat-icon ${tone}`}><Icon size={18} /></span><span className="operator-stat-label">{label}</span><strong>{value.toLocaleString("en-BD")}</strong><small>{caption}</small></article>)}</section>

      <section className="operator-table-card">
        <header className="operator-table-heading"><div><h2>All operators <span>{operators.length}</span></h2><p>A complete list of registered transport partners.</p></div><div className="operator-search-caption"><Search size={15} /><span>{query ? `Searching “${query}”` : "Search operator name, ID, email or phone"}</span></div></header>
        <div className="operator-filters"><label className="operator-search-field"><Search size={15} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search operators..." aria-label="Search operator name, ID, email or phone" />{query && <button type="button" aria-label="Clear operator search" onClick={() => onQueryChange("")}><X size={14} /></button>}</label><label className="operator-filter-select"><TransportIcon type="Bus" /><select value={transportFilter} onChange={(event) => setTransportFilter(event.target.value)} aria-label="Filter by transport type"><option>All transport</option><option>Bus</option><option>Train</option><option>Launch</option><option>Event</option></select><ChevronDown size={14} /></label><label className="operator-filter-select"><ShieldCheck size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by operator status"><option>All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select><ChevronDown size={14} /></label><label className="operator-filter-select operator-sort"><ArrowDownWideNarrow size={15} /><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort registration date"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><ChevronDown size={14} /></label></div>
        <div className="operator-table-scroll"><table className="operator-table"><thead><tr><th>OPERATOR</th><th>OPERATOR ID</th><th>TRANSPORT</th><th>CONTACT NUMBER</th><th>EMAIL</th><th>REGISTERED</th><th>STATUS</th><th><span className="operator-sr-only">Actions</span></th></tr></thead><tbody>{pageOperators.map((operator) => <tr key={operator.id}><td><button className="operator-name-cell" type="button" onClick={() => setDrawerId(operator.id)}><OperatorLogo operator={operator} /><strong>{operator.name}</strong></button></td><td><button className="operator-id-link" type="button" onClick={() => setDrawerId(operator.id)}>{operator.id}</button></td><td><span className="operator-transport"><TransportIcon type={operator.transport} />{operator.transport}</span></td><td className="operator-contact">{operator.phone}</td><td className="operator-email">{operator.email}</td><td className="operator-date">{formatDate(operator.joinedAt)}</td><td><OperatorStatus status={operator.status} /></td><td><OperatorActions operator={operator} open={activeMenu === operator.id} onToggleMenu={() => setActiveMenu((current) => current === operator.id ? "" : operator.id)} onView={() => openAction("view", operator)} onEdit={() => openAction("edit", operator)} onActivate={() => openAction("activate", operator)} onDelete={() => openAction("delete", operator)} /></td></tr>)}{pageOperators.length === 0 && <tr><td className="operator-empty" colSpan="8"><Search size={20} /><strong>No operators found</strong><span>Try changing your search or filters.</span></td></tr>}</tbody></table></div>
        <footer className="operator-pagination"><span>Showing <strong>{filteredOperators.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredOperators.length)}</strong> of <strong>{filteredOperators.length}</strong> operators</span><div className="operator-page-controls"><label>Rows per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value="8">8</option><option value="12">12</option><option value="20">20</option></select></label><button className="operator-icon-button" type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /></button><span>{page} <small>of</small> {totalPages}</span><button className="operator-icon-button" type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={17} /></button></div></footer>
      </section>

      {(adding || editingId) && <OperatorModal key={editingId || "new"} operator={editingOperator} operators={operators} onClose={() => { setAdding(false); setEditingId(null); }} onSave={saveOperator} />}
      <OperatorDrawer operator={drawerOperator} onClose={() => setDrawerId("")} onEdit={(operator) => openAction("edit", operator)} onToggle={toggleOperator} onDelete={setDeleteTarget} />
      <OperatorConfirm operator={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={deleteOperator} />
    </section>
  );
}
