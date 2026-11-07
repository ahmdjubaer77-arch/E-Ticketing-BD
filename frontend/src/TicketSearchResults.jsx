import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Bus,
  CalendarDays,
  Check,
  ChevronDown,
  Filter,
  MapPin,
  RotateCcw,
  Ship,
  SlidersHorizontal,
  Ticket,
  Train,
  UsersRound,
  X,
} from "lucide-react";
import SeatSelectionPage from "./SeatSelectionPage.jsx";
import { apiRequest } from "./authApi.js";
import "./ticket-search-results.css";

const transportOptions = [
  { name: "Bus", Icon: Bus },
  { name: "Train", Icon: Train },
  { name: "Launch", Icon: Ship },
  { name: "Event", Icon: Ticket },
];

const departurePeriods = [
  { id: "morning", label: "Morning", time: "6 AM – 12 PM" },
  { id: "afternoon", label: "Afternoon", time: "12 PM – 6 PM" },
  { id: "evening", label: "Evening", time: "6 PM – 6 AM" },
];

function formatJourneyDate(date) {
  if (!date) return "Choose a date";
  return new Intl.DateTimeFormat("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ""}`;
}

function formatClock(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatDhakaTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(date));
}

function mapSchedule(schedule) {
  const duration = Math.round(
    (new Date(schedule.arrivalAt).getTime() - new Date(schedule.departureAt).getTime()) / 60_000,
  );
  return {
    id: schedule.id,
    operator: schedule.operator,
    type: schedule.transport,
    departure: formatDhakaTime(schedule.departureAt),
    arrival: formatDhakaTime(schedule.arrivalAt),
    duration,
    fare: schedule.fare,
    seats: schedule.availableSeats,
    totalSeats: schedule.totalSeats,
    coach: schedule.coach,
    bookedSeats: schedule.bookedSeats || [],
  };
}

function getPeriod(time) {
  const hour = Number(time.slice(0, 2));
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}

function SearchSummary({ query, onModify }) {
  return (
    <section className="results-summary" aria-label="Your search">
      <div className="summary-route">
        <span className="summary-city">
          <small>FROM</small>
          <strong>{query.from}</strong>
        </span>
        <span className="summary-arrow" aria-hidden="true">
          <ArrowRight size={17} />
        </span>
        <span className="summary-city">
          <small>TO</small>
          <strong>{query.to}</strong>
        </span>
      </div>
      <div className="summary-details">
        <span>
          <CalendarDays size={16} />
          {formatJourneyDate(query.date)}
        </span>
        <span>
          <UsersRound size={16} />
          {query.passengers} passenger{query.passengers === 1 ? "" : "s"}
        </span>
      </div>
      <button className="modify-search-button" type="button" onClick={onModify}>
        <SlidersHorizontal size={16} />
        <span>Modify search</span>
      </button>
    </section>
  );
}

function TransportTabs({ mode, onChange }) {
  return (
    <div className="results-mode-tabs" role="tablist" aria-label="Transport category">
      {transportOptions.map(({ name, Icon }) => (
        <button
          className={`results-mode-tab${mode === name ? " active" : ""}`}
          key={name}
          type="button"
          role="tab"
          aria-selected={mode === name}
          onClick={() => onChange(name)}
        >
          <Icon size={19} />
          <span>{name}</span>
        </button>
      ))}
    </div>
  );
}

function FilterPanel({
  mode,
  schedules,
  maxPrice,
  onMaxPriceChange,
  periods,
  onPeriodChange,
  selectedOperators,
  onOperatorChange,
  onReset,
  onClose,
  mobile = false,
}) {
  const availableOperators = [
    ...new Set(schedules.filter((schedule) => schedule.type === mode).map((schedule) => schedule.operator)),
  ];

  return (
    <aside className={`results-filter-panel${mobile ? " mobile-filter-panel" : ""}`}>
      <div className="filter-heading">
        <span>
          <SlidersHorizontal size={17} />
          Filters
        </span>
        {mobile ? (
          <button type="button" className="filter-close" onClick={onClose} aria-label="Close filters">
            <X size={19} />
          </button>
        ) : (
          <button className="filter-reset" type="button" onClick={onReset}>
            Reset
          </button>
        )}
      </div>

      <fieldset className="filter-group price-filter">
        <legend>Maximum price</legend>
        <div className="price-range-label">
          <span>Up to</span>
          <strong>৳ {Number(maxPrice).toLocaleString("en-BD")}</strong>
        </div>
        <input
          aria-label="Maximum ticket price"
          type="range"
          min="500"
          max="3000"
          step="50"
          value={maxPrice}
          onChange={(event) => onMaxPriceChange(Number(event.target.value))}
        />
        <div className="range-limits">
          <span>৳ 500</span>
          <span>৳ 3,000+</span>
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Departure time</legend>
        <div className="filter-checkbox-list">
          {departurePeriods.map(({ id, label, time }) => (
            <label className="filter-checkbox" key={id}>
              <input
                type="checkbox"
                checked={periods.includes(id)}
                onChange={() => onPeriodChange(id)}
              />
              <span className="custom-checkbox" aria-hidden="true">
                <Check size={12} />
              </span>
              <span className="checkbox-copy">
                <strong>{label}</strong>
                <small>{time}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group operator-filter">
        <legend>Operator</legend>
        <div className="filter-checkbox-list">
          {availableOperators.map((operator) => (
            <label className="filter-checkbox operator-checkbox" key={operator}>
              <input
                type="checkbox"
                checked={selectedOperators.includes(operator)}
                onChange={() => onOperatorChange(operator)}
              />
              <span className="custom-checkbox" aria-hidden="true">
                <Check size={12} />
              </span>
              <span className="checkbox-copy">
                <strong>{operator}</strong>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {mobile && (
        <button className="apply-filter-button" type="button" onClick={onClose}>
          Show results
        </button>
      )}
    </aside>
  );
}

function TicketCard({ schedule, from, to, passengers, onSelectSeats }) {
  const isEvent = schedule.type === "Event";

  return (
    <article className="ticket-result-card">
      <div className="ticket-operator">
        <span className="operator-mark" aria-hidden="true">
          {schedule.type === "Train" ? (
            <Train size={19} />
          ) : schedule.type === "Launch" ? (
            <Ship size={19} />
          ) : schedule.type === "Event" ? (
            <Ticket size={19} />
          ) : (
            <Bus size={19} />
          )}
        </span>
        <span className="operator-name">
          <strong>{schedule.operator}</strong>
          <small>
            {schedule.coach} <span>·</span> {schedule.type}
          </small>
        </span>
        <span className="seat-count">
          {schedule.seats} seats left
        </span>
      </div>

      <div className="ticket-journey">
        <div className="journey-stop">
          <strong>{formatClock(schedule.departure)}</strong>
          <span>{isEvent ? "Doors open" : from}</span>
        </div>
        <div className="journey-duration">
          <small>{formatDuration(schedule.duration)}</small>
          <span className="journey-line">
            <span />
          </span>
          <small>{isEvent ? "Entry duration" : "Direct"}</small>
        </div>
        <div className="journey-stop destination-stop">
          <strong>{formatClock(schedule.arrival)}</strong>
          <span>{isEvent ? "Event ends" : to}</span>
        </div>
      </div>

      <div className="ticket-card-footer">
        <div className="ticket-fare">
          <small>Per passenger</small>
          <strong>৳ {schedule.fare.toLocaleString("en-BD")}</strong>
          {passengers > 1 && <span>Total ৳ {(schedule.fare * passengers).toLocaleString("en-BD")}</span>}
        </div>
        <button
          className="select-seats-button"
          type="button"
          disabled={schedule.type !== "Bus"}
          onClick={onSelectSeats}
        >
          {schedule.type === "Bus" ? "View seats" : "Bus layout only"}
          <ArrowRight size={16} />
        </button>
      </div>
    </article>
  );
}

function LoadingResults() {
  return (
    <div className="results-loading" role="status" aria-label="Loading schedules">
      <span className="loading-title skeleton-block" />
      {[1, 2, 3].map((item) => (
        <div className="loading-ticket" key={item}>
          <span className="skeleton-block skeleton-logo" />
          <span className="skeleton-lines">
            <span className="skeleton-block" />
            <span className="skeleton-block" />
          </span>
          <span className="skeleton-block skeleton-action" />
        </div>
      ))}
    </div>
  );
}

function EmptyResults({ onReset }) {
  return (
    <div className="empty-results" role="status">
      <span className="empty-results-icon">
        <MapPin size={24} />
      </span>
      <h2>No schedules found</h2>
      <p>There are no available schedules for this journey and date, or your filters are too specific.</p>
      <button type="button" onClick={onReset}>
        <RotateCcw size={15} /> Clear filters
      </button>
    </div>
  );
}

export default function TicketSearchResults({ query, onModify, onModeChange, onHome }) {
  const [mode, setMode] = useState(query.mode || "Bus");
  const [maxPrice, setMaxPrice] = useState(2000);
  const [periods, setPeriods] = useState([]);
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [sortBy, setSortBy] = useState("departure");
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [scheduleError, setScheduleError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  useEffect(() => {
    setMode(query.mode || "Bus");
  }, [query.mode]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      from: query.from,
      to: query.to,
      date: query.date,
      transport: mode,
    });
    setLoading(true);
    setScheduleError("");
    setSchedules([]);
    apiRequest(`/public/schedules?${params}`)
      .then((result) => {
        if (active) setSchedules(result.data.schedules.map(mapSchedule));
      })
      .catch((error) => {
        if (active) setScheduleError(error.message || "Schedules could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, query.date, query.from, query.to, retryCount]);

  function showMode(nextMode) {
    setMode(nextMode);
    onModeChange(nextMode);
    setSelectedOperators([]);
    setSelectedSchedule(null);
  }

  function resetFilters() {
    setMaxPrice(2000);
    setPeriods([]);
    setSelectedOperators([]);
  }

  function togglePeriod(period) {
    setPeriods((current) =>
      current.includes(period) ? current.filter((value) => value !== period) : [...current, period],
    );
  }

  function toggleOperator(operator) {
    setSelectedOperators((current) =>
      current.includes(operator)
        ? current.filter((value) => value !== operator)
        : [...current, operator],
    );
  }

  const results = useMemo(() => {
    const filtered = schedules.filter((schedule) => {
      if (schedule.type !== mode || schedule.fare > maxPrice) return false;
      if (periods.length && !periods.includes(getPeriod(schedule.departure))) return false;
      if (selectedOperators.length && !selectedOperators.includes(schedule.operator)) return false;
      return true;
    });

    return [...filtered].sort((first, second) =>
      sortBy === "price"
        ? first.fare - second.fare
        : first.departure.localeCompare(second.departure),
    );
  }, [maxPrice, mode, periods, schedules, selectedOperators, sortBy]);

  const filterProps = {
    mode,
    schedules,
    maxPrice,
    onMaxPriceChange: setMaxPrice,
    periods,
    onPeriodChange: togglePeriod,
    selectedOperators,
    onOperatorChange: toggleOperator,
    onReset: resetFilters,
  };

  const hasActiveFilters = maxPrice !== 2000 || periods.length > 0 || selectedOperators.length > 0;

  if (selectedSchedule) {
    return (
      <SeatSelectionPage
        key={selectedSchedule.id}
        query={query}
        schedule={selectedSchedule}
        onBack={() => setSelectedSchedule(null)}
        onHome={onHome}
      />
    );
  }

  return (
    <main className="search-results-page">
      <div className="results-container">
        <div className="results-breadcrumb">
          <span>Tickets</span>
          <ChevronDown size={14} className="breadcrumb-chevron" />
          <strong>Search results</strong>
        </div>

        <div className="results-page-heading">
          <div>
            <p className="results-eyebrow">YOUR NEXT JOURNEY</p>
            <h1>Find your ride</h1>
          </div>
          <span className="database-data-note">
            <span /> Database schedules
          </span>
        </div>

        <SearchSummary query={query} onModify={onModify} />

        <TransportTabs mode={mode} onChange={showMode} />

        <div className="results-content-grid">
          <div className={`mobile-filter-backdrop${filtersOpen ? " open" : ""}`} onClick={() => setFiltersOpen(false)} />
          <div className={`mobile-filter-drawer${filtersOpen ? " open" : ""}`}>
            <FilterPanel {...filterProps} mobile onClose={() => setFiltersOpen(false)} />
          </div>
          <div className="desktop-filter-column">
            <FilterPanel {...filterProps} />
          </div>

          <section className="results-list-section" aria-label="Available schedules">
            <div className="results-toolbar">
              <div className="results-count">
                <strong>{results.length} schedules</strong>
                <span>for your journey</span>
              </div>
              <button
                className="mobile-filter-button"
                type="button"
                onClick={() => setFiltersOpen(true)}
              >
                <Filter size={16} />
                Filters{hasActiveFilters ? <span className="active-filter-dot" /> : null}
              </button>
              <label className="sort-control">
                <ArrowDownUp size={15} />
                <span>Sort by</span>
                <select
                  aria-label="Sort schedules"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option value="departure">Departure time</option>
                  <option value="price">Lowest price</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>

            {loading ? (
              <LoadingResults />
            ) : scheduleError ? (
              <div className="schedule-error" role="alert">
                <p>{scheduleError}</p>
                <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
                  Try again
                </button>
              </div>
            ) : results.length ? (
              <div className="ticket-results-list">
                {results.map((schedule) => (
                  <TicketCard
                    key={schedule.id}
                    schedule={schedule}
                    from={query.from}
                    to={query.to}
                    passengers={query.passengers}
                    onSelectSeats={() => setSelectedSchedule(schedule)}
                  />
                ))}
              </div>
            ) : (
              <EmptyResults onReset={resetFilters} />
            )}
          </section>
        </div>

        <div className="results-trust-note">
          <span>
            <Check size={15} /> Secure booking
          </span>
          <span>
            <Check size={15} /> Instant e-ticket
          </span>
          <span>
            <Check size={15} /> Helpful support
          </span>
        </div>
      </div>
    </main>
  );
}
