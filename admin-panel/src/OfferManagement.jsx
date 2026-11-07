import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  CalendarDays,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiRequest, uploadImage } from "./api.js";
import "./offer-management.css";

const emptyOffer = {
  operator: "",
  from: "",
  to: "",
  transport: "Bus",
  originalPrice: "",
  discountedPrice: "",
  discountLabel: "",
  validity: "",
  validUntil: "",
  imageAlt: "",
  status: "active",
};

function offerToForm(offer) {
  return {
    ...offer,
    validUntil: offer.validUntil ? new Date(offer.validUntil).toISOString().slice(0, 10) : "",
  };
}

function OfferForm({ offer, onClose, onSaved, onToast }) {
  const [persistedOffer, setPersistedOffer] = useState(offer);
  const [values, setValues] = useState(offer ? offerToForm(offer) : emptyOffer);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(offer?.image || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!imageFile) return undefined;
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!persistedOffer && !imageFile) {
      setError("Choose a cover image before creating the deal.");
      return;
    }
    if (imageFile && (!["image/jpeg", "image/png", "image/webp"].includes(imageFile.type) || imageFile.size > 2 * 1024 * 1024)) {
      setError("Cover image must be JPEG, PNG, or WebP and no larger than 2 MB.");
      return;
    }
    const body = {
      ...values,
      originalPrice: Number(values.originalPrice),
      discountedPrice: Number(values.discountedPrice),
      validUntil: values.validUntil || null,
    };
    delete body.image;
    delete body.createdAt;
    delete body.updatedAt;
    delete body.id;
    setSaving(true);
    try {
      const result = persistedOffer
        ? await apiRequest(`/admin/offers/${persistedOffer.id}`, { method: "PUT", body })
        : await apiRequest("/admin/offers", { method: "POST", body });
      const savedOffer = result.offer;
      if (!persistedOffer) setPersistedOffer(savedOffer);
      if (imageFile) {
        await uploadImage(`/admin/offers/${savedOffer.id}/image`, imageFile);
      }
      onToast(persistedOffer ? "Deal updated" : "Deal created", `${savedOffer.from} to ${savedOffer.to} offer has been saved.`);
      await onSaved();
      onClose();
    } catch (requestError) {
      setError(requestError.message || "The deal could not be saved.");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="offer-modal-scrim" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="offer-modal" role="dialog" aria-modal="true" aria-labelledby="offer-form-title">
        <header className="offer-modal-heading">
          <div>
            <span className="offer-eyebrow">HOT DEALS</span>
            <h2 id="offer-form-title">{persistedOffer ? "Edit deal" : "Add a deal"}</h2>
            <p>Add offer details and a cover image for the homepage.</p>
          </div>
          <button type="button" className="offer-icon-button" aria-label="Close dialog" disabled={saving} onClick={onClose}><X size={18} /></button>
        </header>
        <form className="offer-form" onSubmit={submit}>
          <label className="offer-cover-upload">
            {previewUrl ? <img src={previewUrl} alt="Offer cover preview" /> : <span className="offer-cover-placeholder"><ImagePlus size={27} /><strong>Upload cover image</strong><small>JPEG, PNG or WebP · up to 2 MB</small></span>}
            <span className="offer-cover-edit"><Upload size={15} />{previewUrl ? "Change cover" : "Choose image"}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] || null)} />
          </label>
          <div className="offer-form-grid">
            <label><span>Operator / deal name</span><input required minLength="2" maxLength="120" value={values.operator} onChange={(event) => update("operator", event.target.value)} placeholder="e.g. Green Line Paribahan" /></label>
            <label><span>Transport</span><select value={values.transport} onChange={(event) => update("transport", event.target.value)}><option>Bus</option><option>Train</option><option>Launch</option><option>Event</option></select></label>
            <label><span>From</span><input required minLength="2" maxLength="120" value={values.from} onChange={(event) => update("from", event.target.value)} placeholder="Departure" /></label>
            <label><span>To</span><input required minLength="2" maxLength="120" value={values.to} onChange={(event) => update("to", event.target.value)} placeholder="Destination" /></label>
            <label><span>Original price (৳)</span><input required type="number" min="0" max="100000000" step="1" value={values.originalPrice} onChange={(event) => update("originalPrice", event.target.value)} placeholder="2800" /></label>
            <label><span>Discounted price (৳)</span><input required type="number" min="0" max="100000000" step="1" value={values.discountedPrice} onChange={(event) => update("discountedPrice", event.target.value)} placeholder="2600" /></label>
            <label><span>Discount badge</span><input maxLength="40" value={values.discountLabel} onChange={(event) => update("discountLabel", event.target.value)} placeholder="৳200 OFF" /></label>
            <label><span>Validity text</span><input maxLength="120" value={values.validity} onChange={(event) => update("validity", event.target.value)} placeholder="Valid on selected trips" /></label>
            <label><span>Offer valid until</span><input type="date" value={values.validUntil} onChange={(event) => update("validUntil", event.target.value)} /></label>
            <label><span>Cover image description</span><input maxLength="200" value={values.imageAlt} onChange={(event) => update("imageAlt", event.target.value)} placeholder="Coach by the sea" /></label>
          </div>
          {persistedOffer && <label className="offer-status-field"><span>Homepage visibility</span><select value={values.status} onChange={(event) => update("status", event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}
          {error && <p className="offer-form-error" role="alert">{error}</p>}
          <footer className="offer-form-actions">
            <button type="button" className="offer-button secondary" disabled={saving} onClick={onClose}>Cancel</button>
            <button type="submit" className="offer-button primary" disabled={saving}>{saving ? <><LoaderCircle size={15} className="offer-spinner" /> Saving…</> : <><BadgePercent size={15} /> {persistedOffer ? "Save changes" : "Add deal"}</>}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function OfferManagement({ query, onToast }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingOffer, setEditingOffer] = useState(null);
  const [creating, setCreating] = useState(false);
  const [busyOfferId, setBusyOfferId] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const filteredOffers = useMemo(() => {
    const term = (localSearch.trim() || query.trim()).toLocaleLowerCase();
    return term ? offers.filter((offer) =>
      `${offer.operator} ${offer.from} ${offer.to} ${offer.transport}`.toLocaleLowerCase().includes(term),
    ) : offers;
  }, [offers, query, localSearch]);

  async function loadOffers() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("/admin/offers?limit=100");
      setOffers(result.offers);
    } catch (loadError) {
      setError(loadError.message || "Offers could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOffers();
  }, [refreshKey]);

  async function removeOffer(offer) {
    if (!window.confirm(`Delete the deal "${offer.operator}: ${offer.from} to ${offer.to}"?`)) return;
    setBusyOfferId(offer.id);
    try {
      await apiRequest(`/admin/offers/${offer.id}`, { method: "DELETE" });
      onToast("Deal deleted", "The offer and its cover image have been removed.");
      await loadOffers();
    } catch (deleteError) {
      onToast("Could not delete deal", deleteError.message);
    } finally {
      setBusyOfferId("");
    }
  }

  async function removeImage(offer) {
    setBusyOfferId(offer.id);
    try {
      await apiRequest(`/admin/offers/${offer.id}/image`, { method: "DELETE" });
      onToast("Cover removed", "The deal is hidden from the homepage until another cover image is uploaded.");
      await loadOffers();
    } catch (removeError) {
      onToast("Could not remove cover", removeError.message);
    } finally {
      setBusyOfferId("");
    }
  }

  return (
    <section className="offer-management">
      <div className="offer-page-heading">
        <div><span className="offer-eyebrow"><BadgePercent size={13} /> HOMEPAGE CONTENT</span><h1>Hot Deals</h1><p>Create travel offers and publish them to the home page.</p></div>
        <div className="offer-heading-actions">
          <button className="offer-button secondary" type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}><RefreshCw size={15} /> Refresh</button>
          <button className="offer-button primary" type="button" onClick={() => setCreating(true)}><Plus size={16} /> Add deal</button>
        </div>
      </div>
      <div className="offer-list-heading"><div><h2>Offer library <span>{offers.length}</span></h2><p>Active offers with a cover image appear on the home page.</p></div><label className="offer-list-search"><Search size={15} /><input value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} placeholder="Search offers..." aria-label="Search offers" /></label></div>
      {error && <div className="offer-page-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button></div>}
      {loading ? <div className="offer-page-state"><LoaderCircle size={20} className="offer-spinner" /> Loading offers…</div>
        : filteredOffers.length ? (
          <div className="offer-grid">
            {filteredOffers.map((offer) => (
              <article className={`offer-admin-card${offer.status === "inactive" ? " is-inactive" : ""}`} key={offer.id}>
                <div className="offer-admin-image">
                  {offer.image ? <img src={offer.image} alt={offer.imageAlt || `${offer.operator} cover`} /> : <span><ImagePlus size={26} />No cover image</span>}
                  <span className={`offer-status-badge ${offer.status}`}>{offer.status}</span>
                  {offer.discountLabel && <span className="offer-discount-badge">{offer.discountLabel}</span>}
                </div>
                <div className="offer-admin-card-content">
                  <div className="offer-admin-card-title"><span>{offer.transport} · {offer.operator}</span><strong>{offer.from} <i>→</i> {offer.to}</strong></div>
                  <div className="offer-admin-card-price"><strong>৳ {Number(offer.discountedPrice).toLocaleString("en-BD")}</strong><del>৳ {Number(offer.originalPrice).toLocaleString("en-BD")}</del></div>
                  <div className="offer-admin-validity"><CalendarDays size={13} />{offer.validity || (offer.validUntil ? `Until ${new Date(offer.validUntil).toLocaleDateString()}` : "No expiry date")}</div>
                  <div className="offer-admin-card-actions">
                    <button className="offer-button secondary" type="button" onClick={() => setEditingOffer(offer)}><Pencil size={14} /> Edit</button>
                    {offer.image && <button className="offer-button secondary" type="button" disabled={busyOfferId === offer.id} onClick={() => removeImage(offer)}><ImagePlus size={14} /> Remove cover</button>}
                    <button className="offer-icon-button danger" type="button" aria-label={`Delete ${offer.operator} offer`} disabled={busyOfferId === offer.id} onClick={() => removeOffer(offer)}><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="offer-empty"><span><Tag size={22} /></span><strong>{query ? "No matching offers" : "No offers yet"}</strong><p>{query ? "Try a different search term." : "Create a deal and add a cover image to publish it on the homepage."}</p>{!query && <button className="offer-button primary" type="button" onClick={() => setCreating(true)}><Plus size={15} /> Add your first deal</button>}</div>
        )}
      {(creating || editingOffer) && <OfferForm offer={editingOffer} onClose={() => { setCreating(false); setEditingOffer(null); }} onSaved={loadOffers} onToast={onToast} />}
    </section>
  );
}
