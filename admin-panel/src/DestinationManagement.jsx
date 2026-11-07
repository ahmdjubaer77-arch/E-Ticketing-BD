import { useEffect, useState } from "react";
import { ImagePlus, MapPin, Plus, RefreshCw, Trash2 } from "lucide-react";
import { apiRequest, uploadImage } from "./api.js";
import { BANGLADESH_DISTRICTS } from "./RouteManagement.jsx";
import "./destination-management.css";

export default function DestinationManagement({ onToast }) {
  const [destinations, setDestinations] = useState([]);
  const [routeLocations, setRouteLocations] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingCover, setChangingCover] = useState("");
  const [error, setError] = useState("");

  async function loadDestinations() {
    setLoading(true);
    setError("");
    try {
      const [{ destinations: records = [] }, routeData] = await Promise.all([
        apiRequest("/admin/destinations"),
        apiRequest("/admin/routes?limit=100"),
      ]);
      setDestinations(records);
      setRouteLocations(routeData.routes.flatMap((route) => [route.departure, route.destination]));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDestinations();
  }, []);

  async function submit(event) {
    event.preventDefault();
    const normalizedName = name.trim().replace(/\s+/g, " ");
    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setError("Enter a destination name between 2 and 120 characters.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { destination } = await apiRequest("/admin/destinations", {
        method: "POST",
        body: { name: normalizedName },
      });
      setDestinations((current) => [...current, destination].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      onToast("Destination added", `${destination.name} is now available in the travel location lists.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeCover(destinationName, file) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPG, or WebP cover image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Destination cover images must be 2 MB or smaller.");
      return;
    }
    setChangingCover(destinationName);
    setError("");
    try {
      const { destination } = await uploadImage(
        `/admin/destinations/cover?name=${encodeURIComponent(destinationName)}`,
        file,
      );
      setDestinations((current) => [
        ...current.filter((item) => item.name.toLocaleLowerCase("en") !== destination.name.toLocaleLowerCase("en")),
        destination,
      ]);
      onToast("Cover image updated", `${destination.name} will use this cover on all its route cards.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setChangingCover("");
    }
  }

  async function removeCover(destinationName) {
    setChangingCover(destinationName);
    setError("");
    try {
      const { destination } = await apiRequest(
        `/admin/destinations/cover?name=${encodeURIComponent(destinationName)}`,
        { method: "DELETE" },
      );
      setDestinations((current) => current.map((item) =>
        item.name.toLocaleLowerCase("en") === destination.name.toLocaleLowerCase("en") ? destination : item));
      onToast("Cover image removed", `${destination.name} will use the default cover image.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setChangingCover("");
    }
  }

  const destinationNames = [...new Set([
    ...BANGLADESH_DISTRICTS,
    ...routeLocations,
    ...destinations.map(({ name: destinationName }) => destinationName),
  ])].sort((a, b) => a.localeCompare(b));

  return (
    <section className="destination-management">
      <div className="destination-live-note"><span /> LIVE DATABASE DATA <span>Destinations are stored in MongoDB and shared with the customer site.</span><button type="button" aria-label="Refresh destinations" onClick={loadDestinations} disabled={loading}><RefreshCw size={14} /></button></div>
      <header className="destination-page-heading">
        <div><span className="destination-eyebrow">WORKSPACE <MapPin size={12} /> DESTINATIONS</span><h1>Destination Management</h1><p>Add locations beyond the built-in Bangladesh district list.</p></div>
      </header>

      <section className="destination-card">
        <header><span className="destination-card-icon"><MapPin size={18} /></span><div><h2>Add a destination</h2><p>New locations will appear in the customer From/To selectors and route management.</p></div></header>
        <form className="destination-add-form" onSubmit={submit}>
          <label><span>Destination name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="e.g. Saint Martin, Benapole, or a terminal name" disabled={saving} /></label>
          <button type="submit" disabled={saving || loading}><Plus size={15} />{saving ? "Adding..." : "Add destination"}</button>
        </form>
        {error && <p className="destination-error" role="alert">{error}<button type="button" onClick={loadDestinations}>Retry</button></p>}
      </section>

      <section className="destination-card destination-list-card">
        <header><span className="destination-card-icon"><ImagePlus size={18} /></span><div><h2>Destination cover images <span>{destinationNames.length}</span></h2><p>Choose one cover per destination. Every route ending at the same destination will use the same image.</p></div></header>
        {loading ? <p className="destination-list-state">Loading destinations...</p> : destinationNames.length ? (
          <ul className="destination-cover-list">{destinationNames.map((destinationName) => {
            const destination = destinations.find((item) => item.name.toLocaleLowerCase("en") === destinationName.toLocaleLowerCase("en"));
            const busy = changingCover === destinationName;
            return (
              <li className="destination-cover-item" key={destinationName}>
                {destination?.image
                  ? <img src={destination.image} alt={`${destinationName} cover preview`} />
                  : <span className="destination-cover-placeholder"><MapPin size={18} /></span>}
                <strong>{destinationName}</strong>
                <label className={`destination-cover-button${changingCover ? " disabled" : ""}`}>
                  <ImagePlus size={14} />{busy ? "Saving..." : destination?.image ? "Change cover" : "Choose cover"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label={`${destination?.image ? "Change" : "Choose"} ${destinationName} cover image`}
                    disabled={Boolean(changingCover)}
                    onChange={(event) => {
                      changeCover(destinationName, event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
                {destination?.image && <button className="destination-cover-remove" type="button" aria-label={`Remove ${destinationName} cover image`} title="Remove cover image" disabled={Boolean(changingCover)} onClick={() => removeCover(destinationName)}><Trash2 size={14} /></button>}
              </li>
            );
          })}</ul>
        ) : <p className="destination-list-state">No destinations are available yet.</p>}
      </section>
    </section>
  );
}
