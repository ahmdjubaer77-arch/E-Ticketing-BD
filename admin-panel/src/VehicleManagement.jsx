import { useEffect, useMemo, useState } from "react";
import { apiRequest, uploadImage } from "./api.js";
import {
  ArrowRight,
  Bus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Gauge,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Ship,
  TrainFront,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import "./vehicle-management.css";

const demoVehicles = [
  ["Sakura Executive Coach", "DHAKA-METRO-B-11-2841", "Bus", "OPR-2031", 40, "active", "blue"],
  ["Intercity Sleeper", "DHAKA-METRO-B-11-6392", "Bus", "OPR-2027", 36, "active", "mint"],
  ["Subarna Express 701", "RAIL-CH-701", "Train", "OPR-2030", 720, "active", "rose"],
  ["Sundarban River Queen", "BARISHAL-L-04-1882", "Launch", "OPR-2028", 420, "maintenance", "gold"],
  ["Hanif Business Class", "DHAKA-METRO-B-14-9086", "Bus", "OPR-2027", 40, "active", "peach"],
  ["Ena Volvo B11R", "SYLHET-METRO-B-12-4720", "Bus", "OPR-2026", 42, "inactive", "lavender"],
  ["Shohagh Scania Touring", "DHAKA-METRO-B-11-3157", "Bus", "OPR-2025", 40, "active", "blue"],
  ["BRTC City Express", "DHAKA-METRO-B-15-7512", "Bus", "OPR-2024", 45, "active", "mint"],
  ["MV Green Line 3", "DHAKA-L-03-0754", "Launch", "OPR-2023", 280, "active", "rose"],
  ["Desh Volvo Multi-Axle", "RAJSHAHI-METRO-B-13-4022", "Bus", "OPR-2022", 40, "inactive", "gold"],
  ["Padma Intercity 755", "RAIL-PA-755", "Train", "OPR-2030", 640, "active", "peach"],
  ["Sakura AC Coach", "DHAKA-METRO-B-11-8805", "Bus", "OPR-2031", 36, "maintenance", "lavender"],
];

export const initialVehicles = demoVehicles.map(([name, registration, transport, operatorId, seats, status, color], index) => ({
  id: `VEH-${String(1042 - index).padStart(4, "0")}`,
  name,
  registration,
  transport,
  operatorId,
  seats,
  status,
  color,
  image: "",
  addedAt: new Date(Date.now() - index * 86400000).toISOString().slice(0, 10),
}));

const formatDate = (date) => new Intl.DateTimeFormat("en-BD", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));

function VehicleTypeIcon({ type, size = 15 }) {
  if (type === "Train") return <TrainFront size={size} />;
  if (type === "Launch") return <Ship size={size} />;
  return <Bus size={size} />;
}

function VehicleImage({ vehicle, large = false }) {
  if (vehicle.image) return <img className={`vehicle-image${large ? " large" : ""}`} src={vehicle.image} alt={`${vehicle.name}`} />;
  const Icon = vehicle.transport === "Train" ? TrainFront : vehicle.transport === "Launch" ? Ship : Bus;
  return <span className={`vehicle-image ${vehicle.color || "mint"}${large ? " large" : ""}`} aria-label={`${vehicle.transport} vehicle image placeholder`}><Icon size={large ? 30 : 19} strokeWidth={1.6} /></span>;
}

function VehicleStatus({ status }) {
  const labels = { active: "Active", inactive: "Inactive", maintenance: "Maintenance" };
  return <span className={`vehicle-status ${status}`}><i />{labels[status]}</span>;
}

function vehicleFromApi(vehicle, index = 0) {
  return {
    id: vehicle.id,
    name: vehicle.name,
    registration: vehicle.registrationNumber,
    transport: vehicle.transport,
    operatorId: vehicle.operatorId,
    operatorName: vehicle.operator?.name || "Operator unavailable",
    seats: vehicle.seatCapacity,
    status: vehicle.status,
    image: vehicle.image || "",
    color: ["mint", "blue", "gold", "rose", "lavender", "peach"][index % 6],
    addedAt: vehicle.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  };
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
    color: ["mint", "blue", "gold", "rose", "lavender", "peach"][index % 6],
    joinedAt: operator.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    vehicles: 0,
    routes: 0,
    bookings: 0,
  };
}

function VehicleModal({ vehicle, vehicles, operators, onClose, onSave }) {
  const firstOperator = operators.find((operator) => operator.status === "active" && operator.transport === "Bus")?.id ?? "";
  const [values, setValues] = useState({
    name: vehicle?.name ?? "",
    registration: vehicle?.registration ?? "",
    transport: vehicle?.transport ?? "Bus",
    operatorId: vehicle?.operatorId ?? firstOperator,
    seats: vehicle?.seats ?? "",
    status: vehicle?.status ?? "active",
    image: vehicle?.image ?? "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [imageError, setImageError] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [savedId, setSavedId] = useState("");
  const [saving, setSaving] = useState(false);
  const compatibleOperators = operators.filter((operator) =>
    operator.transport === values.transport
    && (operator.status === "active" || operator.id === vehicle?.operatorId));

  useEffect(() => {
    if (!imageFile) return undefined;
    const preview = URL.createObjectURL(imageFile);
    update("image", preview);
    return () => URL.revokeObjectURL(preview);
  }, [imageFile]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setFormError("");
  }

  function chooseImage(event) {
    const file = event.target.files?.[0];
    setImageError("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setImageError("Choose a PNG, JPG or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageError("Image must be 2 MB or smaller.");
      event.target.value = "";
      return;
    }
    setRemoveImage(false);
    setImageFile(file);
  }

  async function submit(event) {
    event.preventDefault();
    setFormError("");
    setImageError("");
    const nextErrors = {};
    if (values.name.trim().length < 2 || values.name.trim().length > 100) nextErrors.name = "Enter a vehicle name between 2 and 100 characters.";
    if (values.registration.trim().length < 2 || values.registration.trim().length > 50) {
      nextErrors.registration = "Enter a registration number between 2 and 50 characters.";
    }
    if (vehicles.some((item) => item.registration.toLowerCase() === values.registration.trim().toLowerCase() && item.id !== (savedId || vehicle?.id))) {
      nextErrors.registration = "A vehicle with this registration already exists.";
    }
    if (!values.operatorId || !compatibleOperators.some((operator) => operator.id === values.operatorId)) {
      nextErrors.operatorId = `Select an active ${values.transport} operator.`;
    }
    const seatCount = Number(values.seats);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 1000) nextErrors.seats = "Enter a seat capacity between 1 and 1,000.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const selectedOperator = operators.find((operator) => operator.id === values.operatorId);
    setSaving(true);
    setImageError("");
    try {
      const outcome = await onSave({
      ...vehicle,
      ...values,
      id: savedId || vehicle?.id,
      imageFile,
      removeImage,
      name: values.name.trim(),
      registration: values.registration.trim().toUpperCase(),
      seats: seatCount,
      operatorName: selectedOperator.name,
      });
      if (outcome?.vehicle?.id) setSavedId(outcome.vehicle.id);
      if (outcome?.uploadError) {
        setImageError(outcome.uploadError);
        return;
      }
      onClose();
    } catch (error) {
      const fieldNames = {
        name: "name",
        registrationNumber: "registration",
        transport: "transport",
        operatorId: "operatorId",
        seatCapacity: "seats",
        status: "status",
      };
      const fieldErrors = Object.fromEntries(
        Object.entries(error.errors || {})
          .filter(([field, message]) => fieldNames[field] && typeof message === "string")
          .map(([field, message]) => [fieldNames[field], message]),
      );
      if (Object.keys(fieldErrors).length) {
        setErrors((current) => ({ ...current, ...fieldErrors }));
        setFormError("Please check the highlighted vehicle details.");
      } else {
        setFormError(error.message || "The vehicle could not be saved.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="vehicle-modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className="vehicle-modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-form-title">
        <header className="vehicle-modal-header">
          <div><span className="vehicle-eyebrow">{vehicle ? "VEHICLE PROFILE" : "FLEET MANAGEMENT"}</span><h2 id="vehicle-form-title">{vehicle ? "Edit vehicle" : "Add vehicle"}</h2><p>{vehicle ? "Update fleet details and vehicle availability." : "Add a vehicle to an operator's fleet."}</p></div>
          <button className="vehicle-icon-button" type="button" aria-label="Close dialog" disabled={saving} onClick={onClose}><X size={19} /></button>
        </header>
        <form className="vehicle-form" onSubmit={submit} noValidate>
          {formError && <p className="vehicle-error vehicle-form-error" role="alert">{formError}</p>}
          <div className="vehicle-image-field">
            <VehicleImage vehicle={{ ...values, color: vehicle?.color || "mint" }} large />
            <div><strong>Vehicle image</strong><small>PNG, JPG or WebP · Max 2 MB</small><label className="vehicle-upload-button"><Plus size={13} />Upload image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} /></label>{imageError && <small className="vehicle-error">{imageError}</small>}</div>
            {values.image && <button className="vehicle-image-remove" type="button" onClick={() => { setImageFile(null); setRemoveImage(true); update("image", ""); }}>Remove</button>}
          </div>
          <label className="vehicle-field"><span>Vehicle name</span><input autoFocus value={values.name} onChange={(event) => update("name", event.target.value)} placeholder="e.g. Sakura Executive Coach" aria-invalid={Boolean(errors.name)} />{errors.name && <small className="vehicle-error">{errors.name}</small>}</label>
          <label className="vehicle-field"><span>Registration number</span><input value={values.registration} onChange={(event) => update("registration", event.target.value)} placeholder="e.g. DHAKA-METRO-B-11-2841" aria-invalid={Boolean(errors.registration)} />{errors.registration && <small className="vehicle-error">{errors.registration}</small>}</label>
          <div className="vehicle-form-row">
            <label className="vehicle-field"><span>Transport type</span><select value={values.transport} aria-invalid={Boolean(errors.transport)} onChange={(event) => {
              const transport = event.target.value;
              const matchingOperator = operators.find((operator) => operator.transport === transport && operator.status === "active");
              setValues((current) => ({ ...current, transport, operatorId: matchingOperator?.id ?? "" }));
              setErrors((current) => ({ ...current, transport: "", operatorId: "" }));
              setFormError("");
            }}><option>Bus</option><option>Train</option><option>Launch</option></select>{errors.transport && <small className="vehicle-error">{errors.transport}</small>}</label>
            <label className="vehicle-field"><span>Seat capacity</span><input type="number" min="1" max="1000" step="1" value={values.seats} onChange={(event) => update("seats", event.target.value)} placeholder="e.g. 40" aria-invalid={Boolean(errors.seats)} />{errors.seats && <small className="vehicle-error">{errors.seats}</small>}</label>
          </div>
          <label className="vehicle-field"><span>Operator</span><select value={values.operatorId} onChange={(event) => update("operatorId", event.target.value)} aria-invalid={Boolean(errors.operatorId)}><option value="">Select an active {values.transport} operator</option>{compatibleOperators.map((operator) => <option value={operator.id} key={operator.id}>{operator.name} · {operator.status}</option>)}</select>{errors.operatorId && <small className="vehicle-error">{errors.operatorId}</small>}{!compatibleOperators.length && <small className="vehicle-error">No active {values.transport} operator is available. Add or activate one in Operator Management first.</small>}</label>
          <label className="vehicle-field"><span>Vehicle status</span><select value={values.status} aria-invalid={Boolean(errors.status)} onChange={(event) => update("status", event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option></select>{errors.status && <small className="vehicle-error">{errors.status}</small>}</label>
          <footer className="vehicle-form-actions"><button className="vehicle-button secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="vehicle-button primary" type="submit" disabled={saving || !compatibleOperators.length}>{saving ? "Saving..." : vehicle ? "Save changes" : "Add vehicle"}</button></footer>
        </form>
      </section>
    </div>
  );
}

function VehicleDrawer({ vehicle, operatorName, onClose, onEdit, onSetStatus, onDelete }) {
  useEffect(() => {
    if (!vehicle) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [vehicle, onClose]);
  if (!vehicle) return null;

  return (
    <div className="vehicle-drawer-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="vehicle-drawer" role="dialog" aria-modal="true" aria-labelledby="vehicle-drawer-title">
        <header className="vehicle-drawer-header"><div><span className="vehicle-eyebrow">FLEET PREVIEW</span><h2 id="vehicle-drawer-title">Vehicle details</h2></div><button className="vehicle-icon-button" type="button" aria-label="Close vehicle details" onClick={onClose}><X size={19} /></button></header>
        <div className="vehicle-drawer-content">
          <section className="vehicle-profile-card"><VehicleImage vehicle={vehicle} large /><h3>{vehicle.name}</h3><span>{vehicle.id}</span><div className="vehicle-profile-tags"><VehicleStatus status={vehicle.status} /><span className="vehicle-type-pill"><VehicleTypeIcon type={vehicle.transport} />{vehicle.transport}</span></div><div className="vehicle-profile-actions"><button className="vehicle-button secondary" type="button" onClick={() => onEdit(vehicle)}><Pencil size={14} />Edit vehicle</button><button className="vehicle-icon-button" type="button" aria-label="Mark as maintenance" title="Mark as maintenance" onClick={() => onSetStatus(vehicle, "maintenance")}><Wrench size={16} /></button></div></section>
          <section className="vehicle-details-section"><h3>Vehicle information</h3><div className="vehicle-detail-row"><span><Gauge size={15} /></span><div><small>Registration number</small><strong>{vehicle.registration}</strong></div></div><div className="vehicle-detail-row"><span><VehicleTypeIcon type={vehicle.transport} /></span><div><small>Transport type</small><strong>{vehicle.transport}</strong></div></div><div className="vehicle-detail-row"><span><Bus size={15} /></span><div><small>Operator</small><strong>{operatorName}</strong></div></div><div className="vehicle-detail-row"><span><Gauge size={15} /></span><div><small>Seat capacity</small><strong>{vehicle.seats.toLocaleString("en-BD")} seats</strong></div></div><div className="vehicle-detail-row"><span><Clock3 size={15} /></span><div><small>Added to fleet</small><strong>{formatDate(vehicle.addedAt)}</strong></div></div></section>
          <div className="vehicle-account-note"><Check size={14} /> Demo vehicle information is stored locally in this browser session.</div>
          <button className="vehicle-delete-link" type="button" onClick={() => onDelete(vehicle)}><Trash2 size={14} />Delete vehicle</button>
        </div>
      </aside>
    </div>
  );
}

function VehicleConfirm({ vehicle, onClose, onConfirm }) {
  useEffect(() => {
    if (!vehicle) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [vehicle, onClose]);
  if (!vehicle) return null;
  return (
    <div className="vehicle-modal-scrim vehicle-confirm-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="vehicle-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="vehicle-delete-title" aria-describedby="vehicle-delete-description">
        <span className="vehicle-confirm-icon"><Trash2 size={19} /></span><h2 id="vehicle-delete-title">Archive this vehicle?</h2><p id="vehicle-delete-description">This will deactivate and archive <strong>{vehicle.name}</strong> ({vehicle.registration}); its database record will be retained.</p>
        <footer className="vehicle-form-actions"><button className="vehicle-button secondary" type="button" onClick={onClose}>Cancel</button><button className="vehicle-button danger" type="button" onClick={onConfirm}>Delete vehicle</button></footer>
      </section>
    </div>
  );
}

function VehicleActions({ vehicle, open, onToggleMenu, onView, onEdit, onSetStatus, onDelete }) {
  const nextStatus = vehicle.status === "active" ? "inactive" : "active";
  return (
    <span className="vehicle-row-actions">
      <button className="vehicle-icon-button" type="button" aria-label={`Actions for ${vehicle.name}`} aria-expanded={open} onClick={onToggleMenu}><MoreHorizontal size={18} /></button>
      {open && <span className="vehicle-action-menu" role="menu">
        <button type="button" role="menuitem" onClick={onView}><Eye size={14} />View details</button>
        <button type="button" role="menuitem" onClick={onEdit}><Pencil size={14} />Edit vehicle</button>
        <button type="button" role="menuitem" onClick={() => onSetStatus(vehicle, nextStatus)}><Check size={14} />{nextStatus === "active" ? "Activate vehicle" : "Deactivate vehicle"}</button>
        {vehicle.status !== "maintenance" && <button type="button" role="menuitem" onClick={() => onSetStatus(vehicle, "maintenance")}><Wrench size={14} />Mark as maintenance</button>}
        <button className="danger-action" type="button" role="menuitem" onClick={onDelete}><Trash2 size={14} />Delete vehicle</button>
      </span>}
    </span>
  );
}

export default function VehicleManagement({ vehicles, setVehicles, operators, setOperators, query, onQueryChange, onToast }) {
  const [transportFilter, setTransportFilter] = useState("All transport");
  const [operatorFilter, setOperatorFilter] = useState("All operators");
  const [statusFilter, setStatusFilter] = useState("All statuses");
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
    Promise.all([
      apiRequest("/admin/operators?limit=100"),
      apiRequest("/admin/vehicles?limit=100"),
    ])
      .then(([{ operators: operatorRecords = [] }, { vehicles: vehicleRecords = [] }]) => {
        if (!active) return;
        setOperators(operatorRecords.map(operatorFromApi));
        setVehicles(vehicleRecords.map(vehicleFromApi));
      })
      .catch((error) => {
        if (active) {
          setOperators([]);
          setVehicles([]);
          onToast("Could not load fleet records", error.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const visibleVehicles = useMemo(() => vehicles.map((vehicle) => ({
    ...vehicle,
    operatorName: operators.find((operator) => operator.id === vehicle.operatorId)?.name ?? vehicle.operatorName ?? "Operator unavailable",
  })), [vehicles, operators]);

  const filteredVehicles = useMemo(() => visibleVehicles.filter((vehicle) => {
    const searchText = `${vehicle.id} ${vehicle.registration} ${vehicle.name} ${vehicle.operatorName}`.toLowerCase();
    return (!query.trim() || searchText.includes(query.trim().toLowerCase()))
      && (transportFilter === "All transport" || vehicle.transport === transportFilter)
      && (operatorFilter === "All operators" || vehicle.operatorId === operatorFilter)
      && (statusFilter === "All statuses" || vehicle.status === statusFilter);
  }), [visibleVehicles, query, transportFilter, operatorFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, transportFilter, operatorFilter, statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / pageSize));
  const pageVehicles = filteredVehicles.slice((page - 1) * pageSize, page * pageSize);
  const drawerVehicle = visibleVehicles.find((vehicle) => vehicle.id === drawerId) ?? null;
  const editingVehicle = vehicles.find((vehicle) => vehicle.id === editingId) ?? null;
  const count = (status) => vehicles.filter((vehicle) => vehicle.status === status).length;

  async function saveVehicle(vehicle) {
    const originalId = vehicle.id;
    const isSavedRecord = /^[a-f\d]{24}$/i.test(originalId || "");
    const payload = {
      name: vehicle.name,
      registrationNumber: vehicle.registration,
      transport: vehicle.transport,
      operatorId: vehicle.operatorId,
      seatCapacity: vehicle.seats,
      ...(!isSavedRecord ? { status: vehicle.status } : {}),
    };
    const result = await apiRequest(isSavedRecord ? `/admin/vehicles/${originalId}` : "/admin/vehicles", {
      method: isSavedRecord ? "PUT" : "POST",
      body: payload,
    });
    let saved = vehicleFromApi(result.vehicle);
    setVehicles((current) => current.some((item) => item.id === originalId)
      ? current.map((item) => item.id === originalId ? saved : item)
      : [saved, ...current]);
    try {
      const currentStatus = vehicles.find((item) => item.id === originalId)?.status;
      if (isSavedRecord && currentStatus !== vehicle.status) {
        const statusResult = await apiRequest(`/admin/vehicles/${saved.id}/status`, {
          method: "PATCH",
          body: { status: vehicle.status },
        });
        saved = vehicleFromApi(statusResult.vehicle);
      }
      if (vehicle.imageFile) {
        const uploaded = await uploadImage(`/admin/vehicles/${saved.id}/image`, vehicle.imageFile);
        saved = vehicleFromApi(uploaded.vehicle);
      } else if (vehicle.removeImage && isSavedRecord) {
        const removed = await apiRequest(`/admin/vehicles/${saved.id}/image`, { method: "DELETE" });
        saved = vehicleFromApi(removed.vehicle);
      }
      setVehicles((current) => current.map((item) => item.id === saved.id ? saved : item));
      onToast(isSavedRecord ? "Vehicle updated" : "Vehicle added", `${saved.name} was saved to the database.`);
      return { vehicle: saved };
    } catch (error) {
      onToast("Vehicle saved; image change failed", error.message);
      return { vehicle: saved, uploadError: error.message };
    }
  }

  async function setVehicleStatus(vehicle, status) {
    try {
      const result = await apiRequest(`/admin/vehicles/${vehicle.id}/status`, { method: "PATCH", body: { status } });
      setVehicles((current) => current.map((item) => item.id === vehicle.id ? vehicleFromApi(result.vehicle) : item));
    } catch (error) {
      onToast("Vehicle status not changed", error.message);
      return;
    }
    setDrawerId("");
    setActiveMenu("");
    const label = status === "maintenance" ? "marked for maintenance" : status === "active" ? "activated" : "deactivated";
    onToast(status === "maintenance" ? "Maintenance status updated" : status === "active" ? "Vehicle activated" : "Vehicle deactivated", `${vehicle.name} was ${label}.`);
  }

  function openAction(action, vehicle) {
    setActiveMenu("");
    if (action === "view") setDrawerId(vehicle.id);
    if (action === "edit") {
      setDrawerId("");
      setEditingId(vehicle.id);
    }
    if (action === "delete") {
      setDrawerId("");
      setDeleteTarget(vehicle);
    }
  }

  async function deleteVehicle() {
    if (!deleteTarget) return;
    try {
      await apiRequest(`/admin/vehicles/${deleteTarget.id}`, { method: "DELETE" });
    } catch (error) {
      onToast("Vehicle not deleted", error.message);
      return;
    }
    setVehicles((current) => current.filter((vehicle) => vehicle.id !== deleteTarget.id));
    setDrawerId("");
    onToast("Vehicle archived", `${deleteTarget.name} was safely archived.`);
    setDeleteTarget(null);
  }

  const stats = [
    { label: "Total vehicles", value: vehicles.length, caption: "Registered across all operators", Icon: Bus, tone: "all" },
    { label: "Active vehicles", value: count("active"), caption: "Available for scheduled service", Icon: Check, tone: "active" },
    { label: "Inactive vehicles", value: count("inactive"), caption: "Not currently in service", Icon: Clock3, tone: "inactive" },
    { label: "Maintenance", value: count("maintenance"), caption: "Currently under maintenance", Icon: Wrench, tone: "maintenance" },
  ];

  if (loading) {
    return <section className="vehicle-management"><div className="vehicle-demo-note"><span /> CONNECTING <span>Loading vehicles and operators from the server...</span></div></section>;
  }

  return (
    <section className="vehicle-management">
      <div className="vehicle-demo-note"><span /> LIVE DATA <span>Vehicle profiles and uploaded images are saved to the backend.</span></div>
      <header className="vehicle-page-heading"><div><span className="vehicle-eyebrow">WORKSPACE <ArrowRight size={12} /> VEHICLES</span><h1>Vehicle Management</h1><p>Manage fleet details, operator assignments and vehicle availability.</p></div><button className="vehicle-button primary" type="button" onClick={() => setAdding(true)}><Plus size={16} />Add vehicle</button></header>
      <section className="vehicle-stats-grid" aria-label="Vehicle statistics">{stats.map(({ label, value, caption, Icon, tone }) => <article className="vehicle-stat-card" key={label}><span className={`vehicle-stat-icon ${tone}`}><Icon size={18} /></span><span className="vehicle-stat-label">{label}</span><strong>{value.toLocaleString("en-BD")}</strong><small>{caption}</small></article>)}</section>

      <section className="vehicle-table-card">
        <header className="vehicle-table-heading"><div><h2>Fleet vehicles <span>{vehicles.length}</span></h2><p>A complete list of vehicles registered to transport operators.</p></div><div className="vehicle-search-caption"><Search size={15} /><span>{query ? `Searching “${query}”` : "Search name, registration, ID or operator"}</span></div></header>
        <div className="vehicle-filters">
          <label className="vehicle-search-field"><Search size={15} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search vehicles..." aria-label="Search vehicle name, registration, ID or operator" />{query && <button type="button" aria-label="Clear vehicle search" onClick={() => onQueryChange("")}><X size={14} /></button>}</label>
          <label className="vehicle-filter-select"><Bus size={15} /><select value={transportFilter} onChange={(event) => setTransportFilter(event.target.value)} aria-label="Filter by transport type"><option>All transport</option><option>Bus</option><option>Train</option><option>Launch</option></select><ChevronDown size={14} /></label>
          <label className="vehicle-filter-select"><Bus size={15} /><select value={operatorFilter} onChange={(event) => setOperatorFilter(event.target.value)} aria-label="Filter by operator"><option value="All operators">All operators</option>{operators.map((operator) => <option value={operator.id} key={operator.id}>{operator.name}</option>)}</select><ChevronDown size={14} /></label>
          <label className="vehicle-filter-select"><Wrench size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by vehicle status"><option value="All statuses">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option></select><ChevronDown size={14} /></label>
        </div>
        <div className="vehicle-table-scroll"><table className="vehicle-table"><thead><tr><th>VEHICLE</th><th>VEHICLE ID</th><th>REGISTRATION</th><th>TRANSPORT</th><th>OPERATOR</th><th>SEATS</th><th>STATUS</th><th><span className="vehicle-sr-only">Actions</span></th></tr></thead><tbody>
          {pageVehicles.map((vehicle) => <tr key={vehicle.id}><td><button className="vehicle-name-cell" type="button" onClick={() => setDrawerId(vehicle.id)}><VehicleImage vehicle={vehicle} /><strong>{vehicle.name}</strong></button></td><td><button className="vehicle-id-link" type="button" onClick={() => setDrawerId(vehicle.id)}>{vehicle.id}</button></td><td className="vehicle-registration">{vehicle.registration}</td><td><span className="vehicle-transport"><VehicleTypeIcon type={vehicle.transport} />{vehicle.transport}</span></td><td className="vehicle-operator">{vehicle.operatorName}</td><td className="vehicle-seat-count">{vehicle.seats.toLocaleString("en-BD")} seats</td><td><VehicleStatus status={vehicle.status} /></td><td><VehicleActions vehicle={vehicle} open={activeMenu === vehicle.id} onToggleMenu={() => setActiveMenu((current) => current === vehicle.id ? "" : vehicle.id)} onView={() => openAction("view", vehicle)} onEdit={() => openAction("edit", vehicle)} onSetStatus={setVehicleStatus} onDelete={() => openAction("delete", vehicle)} /></td></tr>)}
          {pageVehicles.length === 0 && <tr><td className="vehicle-empty" colSpan="8"><Search size={20} /><strong>No vehicles found</strong><span>Try changing your search or filters.</span></td></tr>}
        </tbody></table></div>
        <footer className="vehicle-pagination"><span>Showing <strong>{filteredVehicles.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredVehicles.length)}</strong> of <strong>{filteredVehicles.length}</strong> vehicles</span><div className="vehicle-page-controls"><label>Rows per page<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value="8">8</option><option value="12">12</option><option value="20">20</option></select></label><button className="vehicle-icon-button" type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /></button><span>{page} <small>of</small> {totalPages}</span><button className="vehicle-icon-button" type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={17} /></button></div></footer>
      </section>

      {(adding || editingId) && <VehicleModal key={editingId || "new"} vehicle={editingVehicle} vehicles={vehicles} operators={operators} onClose={() => { setAdding(false); setEditingId(null); }} onSave={saveVehicle} />}
      <VehicleDrawer vehicle={drawerVehicle} operatorName={drawerVehicle?.operatorName} onClose={() => setDrawerId("")} onEdit={(vehicle) => openAction("edit", vehicle)} onSetStatus={setVehicleStatus} onDelete={(vehicle) => openAction("delete", vehicle)} />
      <VehicleConfirm vehicle={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={deleteVehicle} />
    </section>
  );
}
