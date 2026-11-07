import React from "react";
import { ArrowRight, MapPin } from "lucide-react";
import "./destination-showcase.css";

const destinationImages = [
  {
    image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "Blue ocean waves along the coast",
  },
  {
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "A broad river through a green landscape",
  },
  {
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "Peaceful landscape framed by hills and water",
  },
  {
    image: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1000&q=85",
    imageAlt: "Calm river and open water",
  },
  {
    image: "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1500&q=85",
    imageAlt: "Green forest and rolling countryside",
  },
  {
    image: "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1500&q=85",
    imageAlt: "Sunlight filtering through dense green forest",
  },
];

function DestinationCard({ destination, onSelect }) {
  return (
    <button
      className={`destination-card destination-card-${destination.size}`}
      type="button"
      onClick={() => onSelect(destination)}
      aria-label={`Search routes to ${destination.name}, starting at ৳${destination.startingFare}`}
    >
      <img
        className="destination-card-image"
        src={destination.image}
        alt={destination.imageAlt}
        loading="lazy"
      />
      <span className="destination-card-overlay" aria-hidden="true" />
      <span className="destination-card-content">
        <span className="destination-card-location"><MapPin size={13} /> DESTINATION</span>
        <span className="destination-card-name">{destination.name}</span>
        <span className="destination-card-fare">
          <span>
            <small>Starting from</small>
            <strong>৳ {Number(destination.startingFare).toLocaleString("en-BD")}</strong>
          </span>
          <span className="destination-fare-unavailable">{destination.routeCount} active route{destination.routeCount === 1 ? "" : "s"}</span>
        </span>
      </span>
      <span className="destination-card-arrow" aria-hidden="true">
        <ArrowRight size={17} />
      </span>
    </button>
  );
}

export default function DestinationShowcase({ destinations, loading, error, onSelectDestination }) {
  const cards = destinations.map((destination, index) => ({
    ...destination,
    ...destinationImages[index % destinationImages.length],
    image: destination.image || destinationImages[index % destinationImages.length].image,
    imageAlt: destination.image ? `${destination.name} destination cover` : destinationImages[index % destinationImages.length].imageAlt,
    size: index < 4 ? "small" : "large",
  }));
  const compactDestinations = cards.filter(({ size }) => size === "small");
  const featureDestinations = cards.filter(({ size }) => size === "large");

  return (
    <section className="destination-showcase" aria-labelledby="destination-showcase-title">
      <header className="destination-showcase-heading">
        <div>
          <p>LIVE ROUTE INFORMATION</p>
          <h2 id="destination-showcase-title">Destinations on our network</h2>
          <span>Starting fares are based on routes saved in the database.</span>
        </div>
      </header>

      {loading ? (
        <p className="destination-data-message" role="status">Loading destinations…</p>
      ) : error ? (
        <p className="destination-data-message error" role="status">Destination data is unavailable until the server reconnects.</p>
      ) : destinations.length ? (
        <div className="destination-bento-grid">
          {compactDestinations.length > 0 && <div className="destination-small-grid">
            {compactDestinations.map((destination) => (
              <DestinationCard
                key={destination.name}
                destination={destination}
                onSelect={onSelectDestination}
              />
            ))}
          </div>}
          {featureDestinations.length > 0 && <div className="destination-feature-stack">
            {featureDestinations.map((destination) => (
              <DestinationCard
                key={destination.name}
                destination={destination}
                onSelect={onSelectDestination}
              />
            ))}
          </div>}
        </div>
      ) : <p className="destination-data-message">No active destinations are available yet.</p>}
    </section>
  );
}
