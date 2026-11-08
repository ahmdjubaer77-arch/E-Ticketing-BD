import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Bus,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  ChevronDown,
  ChevronRight,
  Clock3,
  CircleHelp,
  Headphones,
  Home,
  MapPin,
  Search,
  ShieldCheck,
  Ship,
  Ticket,
  TicketCheck,
  Train,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import TicketSearchResults from "./TicketSearchResults.jsx";
import HotDealsSection from "./HotDealsSection.jsx";
import DestinationShowcase from "./DestinationShowcase.jsx";
import AuthPage from "./AuthPage.jsx";
import UserDashboard from "./UserDashboard.jsx";
import NotificationDrawer from "./NotificationDrawer.jsx";
import { apiRequest, authRequest, getAuthErrorMessage } from "./authApi.js";
import { BANGLADESH_DISTRICTS } from "./bangladeshDistricts.js";
import heroBusImage from "./assets/hero-sakura-bus.png";
import heroLaunchImage from "./assets/hero-manami-launch.jpeg";

const travelModes = [
  { name: "Bus", Icon: Bus },
  { name: "Train", Icon: Train },
  { name: "Launch", Icon: Ship },
  { name: "Event", Icon: Ticket },
];

const heroImages = [
  { src: heroBusImage, alt: "Bus travelling through a scenic landscape", position: "62% center" },
  { src: heroLaunchImage, alt: "Passenger launch cruising on the river at sunset", position: "center 52%" },
];

const routeImages = [
  {
    image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1000&q=85",
    alt: "Scenic green hills and lake",
  },
  {
    image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1000&q=85",
    alt: "Blue ocean waves along the coast",
  },
  {
    image: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1000&q=85",
    alt: "River and open water",
  },
  {
    image: "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1000&q=85",
    alt: "Sunlight across a green forest",
  },
];

const navigation = [
  { name: "Home", Icon: Home },
  { name: "My Tickets", Icon: TicketCheck },
  { name: "Bookings", Icon: CalendarCheck },
  { name: "Support", Icon: Headphones },
];

function dashboardSectionFromSearch(search) {
  const section = new URLSearchParams(search).get("section");
  return ["profile", "bookings", "tickets", "history", "notifications", "settings"].includes(section)
    ? section
    : "profile";
}

function Brand({ onHome }) {
  return (
    <a className="brand" href="#home" aria-label="E-Ticketing home" onClick={onHome}>
      <span className="brand-mark" aria-hidden="true">
        <Ticket size={23} strokeWidth={2.2} />
      </span>
      <span>E-Ticketing</span>
    </a>
  );
}

function Header({ noticeOpen, setNoticeOpen, notificationDrawerOpen, onHome, onAuth, onTickets, onBookings, onOffers, onHelp, page, user, onDashboard, onNotifications, unreadCount = 0 }) {
  return (
    <header className="site-header">
      <Brand onHome={onHome} />
      <nav className="desktop-nav" aria-label="Main navigation">
        <a className={`desktop-nav-link${page === "home" ? " active" : ""}`} href="/" onClick={(event) => { event.preventDefault(); onHome(); }}>
          Home
        </a>
        <a className={`desktop-nav-link${page === "tickets" ? " active" : ""}`} href="/tickets" onClick={(event) => { event.preventDefault(); onTickets(); }}>
          My Tickets
        </a>
        <a className={`desktop-nav-link${page === "bookings" ? " active" : ""}`} href="/bookings" onClick={(event) => { event.preventDefault(); onBookings(); }}>
          My Bookings
        </a>
        <a className={`desktop-nav-link${page === "offers" ? " active" : ""}`} href="/offers" onClick={(event) => { event.preventDefault(); onOffers(); }}>
          Offers
        </a>
        <a className={`desktop-nav-link${page === "help" ? " active" : ""}`} href="/help" onClick={(event) => { event.preventDefault(); onHelp(); }}>
          Help
        </a>
      </nav>
      <div className="header-actions auth-header-actions">
        {!user && <>
          <button className="header-auth-button" type="button" onClick={() => onAuth("login")}>
            Login
          </button>
          <button className="header-auth-button primary" type="button" onClick={() => onAuth("register")}>
            Sign Up
          </button>
        </>}
        <div className="notice-wrap">
          <button
            className="icon-button notification-button"
            type="button"
            aria-label={user && notificationDrawerOpen ? "Close notifications" : "Notifications"}
            aria-expanded={user ? notificationDrawerOpen : noticeOpen}
            onClick={() => user ? onNotifications() : setNoticeOpen(!noticeOpen)}
          >
            <Bell size={22} />
            {unreadCount > 0
              ? <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>
              : !user && <span className="notification-dot" />}
          </button>
          {noticeOpen && (
            <div className="notice-popover" role="status">
              <span className="notice-check">
                <Check size={15} />
              </span>
              <span>
                <strong>You&apos;re all caught up</strong>
                <small>We&apos;ll let you know when there&apos;s something new.</small>
              </span>
            </div>
          )}
        </div>
        <button
          className={`avatar-button${user ? " account-avatar" : ""}`}
          type="button"
          aria-label={user ? `Open ${user.fullName}'s dashboard` : "Login or create an account"}
          onClick={user ? onDashboard : () => onAuth("login")}
        >
          {user?.profileImage ? <img src={user.profileImage} alt="" /> : user ? user.fullName.trim().charAt(0).toUpperCase() : (
            <img
              src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=96&h=96&q=80"
              alt=""
            />
          )}
        </button>
      </div>
    </header>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onClose, 3000);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <aside className={`app-toast${isError ? " error" : ""}`} role={isError ? "alert" : "status"}>
      {isError ? <CircleAlert className="app-toast-icon" size={22} /> : <CheckCircle2 className="app-toast-icon" size={22} />}
      <span className="app-toast-copy">
        <strong>{toast.title}</strong>
        <small>{toast.description}</small>
      </span>
      <button type="button" aria-label="Dismiss notification" onClick={onClose}>
        <X size={17} />
      </button>
    </aside>
  );
}

function routeFromLocation() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/tickets") return "tickets";
  if (pathname === "/bookings") return "bookings";
  if (pathname === "/offers") return "offers";
  if (pathname === "/help") return "help";
  if (pathname === "/signup") return "auth";
  if (pathname === "/login") return "auth";
  return "home";
}

function routePath(page, mode = "login") {
  if (["tickets", "bookings", "offers", "help"].includes(page)) return `/${page}`;
  if (page === "dashboard") {
    const section = dashboardSectionFromSearch(window.location.search);
    return section && section !== "profile" ? `/dashboard?section=${encodeURIComponent(section)}` : "/dashboard";
  }
  if (page === "auth") return mode === "register" ? "/signup" : "/login";
  return "/";
}

function LocationPicker({ label, value, locations, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const optionsRef = useRef([]);
  const listboxId = `location-options-${label.toLowerCase()}`;

  useEffect(() => {
    if (!open) return undefined;
    optionsRef.current[activeIndex]?.focus();
    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  function showOptions() {
    setActiveIndex(Math.max(0, locations.indexOf(value)));
    setOpen(true);
  }

  function selectLocation(location) {
    onChange(location);
    setOpen(false);
  }

  function handleOptionKeyDown(event, index) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = Math.min(index + 1, locations.length - 1);
      setActiveIndex(nextIndex);
      optionsRef.current[nextIndex]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = Math.max(index - 1, 0);
      setActiveIndex(nextIndex);
      optionsRef.current[nextIndex]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0 : locations.length - 1;
      setActiveIndex(nextIndex);
      optionsRef.current[nextIndex]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div className="form-field location-field" ref={containerRef}>
      <span className="field-caption">{label}</span>
      <div className="field-control">
        <MapPin size={20} aria-hidden="true" />
        <button
          ref={triggerRef}
          className={`location-picker-trigger${value ? "" : " placeholder"}`}
          type="button"
          aria-label={`${label}: ${value || placeholder}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => (open ? setOpen(false) : showOptions())}
        >
          <span>{value || placeholder}</span>
          <ChevronDown className={`location-select-chevron${open ? " open" : ""}`} size={16} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="location-picker-menu">
          <div className="location-picker-options" id={listboxId} role="listbox" aria-label={`${label} districts`}>
            {locations.map((location, index) => (
              <button
                className={`location-picker-option${location === value ? " selected" : ""}${index === activeIndex ? " active" : ""}`}
                id={`${listboxId}-${index}`}
                ref={(element) => { optionsRef.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={location === value}
                key={location}
                onMouseEnter={() => setActiveIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                onClick={() => selectLocation(location)}
              >
                <span>{location}</span>
                {location === value && <Check size={16} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BookingCard({
  mode,
  setMode,
  from,
  setFrom,
  to,
  setTo,
  date,
  setDate,
  passengers,
  setPassengers,
  onSearch,
  message,
  locations,
}) {
  const availableLocations = [...new Set([...BANGLADESH_DISTRICTS, ...locations, from, to].filter(Boolean))]
    .sort((first, second) => first.localeCompare(second));

  return (
    <section className="booking-card" id="booking" aria-label="Search for tickets">
      <div className="mode-tabs" role="tablist" aria-label="Choose transport type">
        {travelModes.map(({ name, Icon }) => (
          <button
            className={`mode-tab${mode === name ? " selected" : ""}`}
            key={name}
            type="button"
            role="tab"
            aria-selected={mode === name}
            onClick={() => setMode(name)}
          >
            <Icon size={23} strokeWidth={1.9} />
            <span>{name}</span>
          </button>
        ))}
      </div>

      <form className="booking-form" onSubmit={onSearch}>
        <div className="locations-row">
          <LocationPicker
            label="From"
            value={from}
            locations={availableLocations}
            placeholder="Select district"
            onChange={setFrom}
          />
          <button
            className="swap-button"
            type="button"
            aria-label="Swap departure and destination"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
          >
            <ArrowLeftRight size={19} />
          </button>
          <LocationPicker
            label="To"
            value={to}
            locations={availableLocations}
            placeholder="Select destination"
            onChange={setTo}
          />
        </div>
        <div className="date-passengers-row">
          <label className="form-field date-field">
            <CalendarDays size={21} aria-hidden="true" />
            <span className="date-content">
              <span className="field-caption">Journey Date</span>
              <input
                aria-label="Journey date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </span>
          </label>
          <label className="form-field passengers-field">
            <UsersRound size={21} aria-hidden="true" />
            <span className="passenger-content">
              <span className="field-caption">Passengers</span>
              <span className="passenger-control">
                <button
                  type="button"
                  aria-label="Remove one passenger"
                  disabled={passengers <= 1}
                  onClick={() => setPassengers(Math.max(1, passengers - 1))}
                >
                  −
                </button>
                <input
                  aria-label="Number of passengers"
                  type="number"
                  min="1"
                  max="9"
                  value={passengers}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setPassengers(Math.min(9, Math.max(1, value || 1)));
                  }}
                />
                <button
                  type="button"
                  aria-label="Add one passenger"
                  disabled={passengers >= 9}
                  onClick={() => setPassengers(Math.min(9, passengers + 1))}
                >
                  +
                </button>
              </span>
            </span>
          </label>
        </div>
        <button className="search-button" type="submit">
          <Search size={22} strokeWidth={2.2} />
          <span>Search Tickets</span>
        </button>
        {message && (
          <p className="search-message" role="status">
            {message}
          </p>
        )}
      </form>
    </section>
  );
}

function PopularRoutes({ routes, loading, error, onRetry, onSelectRoute }) {
  return (
    <section className="popular-section" id="routes">
      <div className="section-heading">
        <div>
          <p className="eyebrow">HANDPICKED JOURNEYS</p>
          <h2>Featured Routes</h2>
        </div>
        <a className="view-all" href="#booking">
          Search <ArrowRight size={17} />
        </a>
      </div>
      {error ? (
        <div className="home-data-message error" role="alert">
          <span>Route information is temporarily unavailable.</span>
          <button type="button" onClick={onRetry}>Try again</button>
        </div>
      ) : loading ? (
        <div className="home-data-message" role="status">Loading routes from the database…</div>
      ) : routes.length ? (
        <div className="route-list">
        {routes.slice(0, 6).map((route, index) => (
          <button
            className="route-card"
            type="button"
            key={route.id}
            onClick={() => onSelectRoute(route)}
            aria-label={`Search ${route.transport} routes from ${route.departure} to ${route.destination}, starting at ৳${route.startingFare}`}
          >
            <img
              className="route-image"
              src={route.image || routeImages[index % routeImages.length].image}
              alt={route.image ? `${route.destination} destination cover` : routeImages[index % routeImages.length].alt}
              loading="lazy"
            />
            <span className="route-card-shade" aria-hidden="true" />
            <span className="route-card-content">
              <span className="route-card-feature-label"><MapPin size={12} /> FEATURED JOURNEY</span>
              <span className="route-title">
                <span>{route.departure}</span>
                <ArrowRight size={17} />
                <span>{route.destination}</span>
              </span>
              <span className="route-card-meta">
                <span>{route.transport === "Train" ? <Train size={15} /> : route.transport === "Launch" ? <Ship size={15} /> : <Bus size={15} />}{route.transport}</span>
                {route.estimatedDurationMinutes > 0 && <span><Clock3 size={14} />{Math.floor(route.estimatedDurationMinutes / 60)}h {String(route.estimatedDurationMinutes % 60).padStart(2, "0")}m</span>}
                {route.distanceKm > 0 && <span>{Number(route.distanceKm).toLocaleString("en-BD")} km</span>}
                <strong>From ৳{Number(route.startingFare).toLocaleString("en-BD")}</strong>
              </span>
            </span>
            <span className="route-card-arrow" aria-hidden="true"><ArrowRight size={17} /></span>
          </button>
        ))}
        </div>
      ) : (
        <div className="home-data-message" role="status">No featured routes selected yet.</div>
      )}
    </section>
  );
}

function Benefits() {
  const benefits = [
    { title: "Instant Booking", detail: "Book in seconds", Icon: Zap },
    { title: "Secure Payment", detail: "100% safe & encrypted", Icon: ShieldCheck },
    { title: "E-Ticket", detail: "No physical ticket needed", Icon: TicketCheck },
    { title: "24/7 Support", detail: "We are always with you", Icon: Headphones },
  ];

  return (
    <section className="benefits" id="benefits" aria-label="Why book with us">
      {benefits.map(({ title, detail, Icon }) => (
        <div className="benefit" key={title}>
          <span className="benefit-icon">
            <Icon size={23} strokeWidth={1.8} />
          </span>
          <span className="benefit-copy">
            <strong>{title}</strong>
            <small>{detail}</small>
          </span>
        </div>
      ))}
    </section>
  );
}

function InformationPage({ page, deals, onBookDeal, onHome }) {
  if (page === "offers") return (
    <main className="information-page">
      <section className="information-hero"><span>TRAVEL MORE FOR LESS</span><h1>Offers for your next journey</h1><p>Explore current travel deals and book your next trip in a few easy steps.</p></section>
      <HotDealsSection deals={deals} onBookDeal={onBookDeal} />
      <Benefits />
    </main>
  );
  return (
    <main className="information-page help-page">
      <section className="information-hero"><span>WE’RE HERE TO HELP</span><h1>How can we help?</h1><p>Find quick answers about booking, payment, tickets, and your account.</p></section>
      <section className="help-grid" aria-label="Help topics">
        {[
          ["How do I book a ticket?", "Choose your transport, route, date, and seats. Add passenger details, then follow the payment instructions to submit your booking."],
          ["Where can I find my ticket?", "Sign in and open My Tickets to see ticket details and booking status."],
          ["How does payment work?", "Pay using an active method shown at checkout, then submit the transaction ID for review."],
          ["Need help with a booking?", "Email our support team with your booking reference and the email address used to book."],
        ].map(([title, text]) => <article className="help-card" key={title}><h2>{title}</h2><p>{text}</p></article>)}
      </section>
      <a className="help-contact" href="mailto:support@eticketing.example"><CircleHelp size={18} /> Contact support</a>
    </main>
  );
}

function BottomNavigation({ active, onHome, onTickets, onBookings, onSupport }) {
  const activeIndex = Math.max(0, navigation.findIndex(({ name }) => name === active));
  const previousIndex = useRef(activeIndex);
  const slideFromIndex = previousIndex.current;
  previousIndex.current = activeIndex;

  return (
    <nav className="bottom-nav" aria-label="Quick navigation">
      {active && <span key={active} className="bottom-nav-indicator" aria-hidden="true" style={{ "--active-index": activeIndex, "--slide-from-index": slideFromIndex }} />}
      {navigation.map(({ name, Icon }) => (
        <button
          className={`bottom-nav-item${active === name ? " current" : ""}`}
          type="button"
          key={name}
          aria-current={active === name ? "page" : undefined}
          onClick={() => {
            if (name === "Home") onHome();
            if (name === "My Tickets") onTickets();
            if (name === "Bookings") onBookings();
            if (name === "Support") onSupport();
          }}
        >
          <Icon size={19} strokeWidth={active === name ? 2 : 1.7} />
          <span>{name}</span>
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const [mode, setMode] = useState("Bus");
  const [from, setFrom] = useState("Dhaka");
  const [to, setTo] = useState("Chattogram");
  const [date, setDate] = useState("2026-11-10");
  const [passengers, setPassengers] = useState(1);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(routeFromLocation);
  const [authMode, setAuthMode] = useState(() => (window.location.pathname === "/signup" ? "register" : "login"));
  const [searchQuery, setSearchQuery] = useState(null);
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dashboardSection, setDashboardSection] = useState(() => dashboardSectionFromSearch(window.location.search));
  const [authChecked, setAuthChecked] = useState(false);
  const [toast, setToast] = useState(null);
  const [homeContent, setHomeContent] = useState({ routes: [], destinations: [], locations: [], deals: [] });
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState("");
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);
  const [heroSlide, setHeroSlide] = useState(0);
  const [returnPath, setReturnPath] = useState(() => (
    ["/dashboard", "/tickets", "/bookings"].includes(window.location.pathname)
      ? window.location.pathname === "/dashboard"
      ? dashboardSectionFromSearch(window.location.search) !== "profile" ? `/dashboard?section=${dashboardSectionFromSearch(window.location.search)}` : "/dashboard"
      : window.location.pathname
      : null
  ));
  const authRequestVersion = useRef(0);
  const closeToast = useCallback(() => setToast(null), []);
  const closeNotificationDrawer = useCallback(() => setNotificationDrawerOpen(false), []);

  useEffect(() => {
    if (page !== "home") return undefined;
    const timer = window.setInterval(() => {
      setHeroSlide((current) => (current + 1) % heroImages.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [page]);

  useEffect(() => {
    if (!["home", "offers", "help"].includes(page)) return undefined;
    let active = true;
    setHomeLoading(true);
    setHomeError("");
    apiRequest("/public/home")
      .then((result) => {
        if (active) setHomeContent(result.data);
      })
      .catch((error) => {
        if (active) setHomeError(getAuthErrorMessage(error));
      })
      .finally(() => {
        if (active) setHomeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, homeRefreshKey]);

  function navigate(nextPage, nextMode = authMode, replace = false) {
    const path = routePath(nextPage, nextMode);
    window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    setPage(nextPage);
    if (nextPage === "auth") setAuthMode(nextMode);
  }

  useEffect(() => {
    const requestVersion = authRequestVersion.current;
    async function restoreSession() {
      try {
        const result = await apiRequest("/users/me");
        if (requestVersion !== authRequestVersion.current) return;
        setUser(result.data.user);
        apiRequest("/notifications?limit=1")
          .then((notifications) => setUnreadCount(notifications.data.unreadCount))
          .catch((error) => {
            setToast({ type: "error", title: "Notifications unavailable", description: getAuthErrorMessage(error) });
          });
        if (routeFromLocation() === "auth") navigate("dashboard", "login", true);
      } catch (error) {
        if (requestVersion !== authRequestVersion.current) return;
        setUser(null);
        if (["dashboard", "tickets", "bookings"].includes(routeFromLocation())) {
          const requestedPage = routeFromLocation();
          const requestedPath = requestedPage === "dashboard"
            ? dashboardSectionFromSearch(window.location.search) !== "profile" ? `/dashboard?section=${dashboardSectionFromSearch(window.location.search)}` : "/dashboard"
            : `/${requestedPage}`;
          setReturnPath(requestedPath);
          setAuthMode("login");
          setPage("auth");
          window.history.replaceState({}, "", `/login?returnTo=${encodeURIComponent(requestedPath)}`);
          if (error.networkError || error.status >= 500) {
            setToast({ type: "error", title: "Unable to verify your session", description: getAuthErrorMessage(error) });
          }
        }
      } finally {
        if (requestVersion === authRequestVersion.current) setAuthChecked(true);
      }
    }
    restoreSession();
  }, []);

  useEffect(() => {
    function handlePopState() {
      const requestedPage = routeFromLocation();
      if (["dashboard", "tickets", "bookings"].includes(requestedPage) && authChecked && !user) {
        const requestedPath = requestedPage === "dashboard"
          ? dashboardSectionFromSearch(window.location.search) !== "profile" ? `/dashboard?section=${dashboardSectionFromSearch(window.location.search)}` : "/dashboard"
          : `/${requestedPage}`;
        setReturnPath(requestedPath);
        setAuthMode("login");
        setPage("auth");
        window.history.replaceState({}, "", `/login?returnTo=${encodeURIComponent(requestedPath)}`);
        return;
      }
      setPage(requestedPage);
      if (requestedPage === "dashboard") {
        setDashboardSection(dashboardSectionFromSearch(window.location.search));
      }
      if (window.location.pathname === "/signup") setAuthMode("register");
      else if (window.location.pathname === "/login") setAuthMode("login");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [authChecked, user]);

  useEffect(() => {
    if (!authChecked || !user || !["dashboard", "tickets", "bookings"].includes(page)) return undefined;
    let active = true;
    async function checkSession() {
      try {
        const result = await apiRequest("/users/me");
        if (active) setUser(result.data.user);
      } catch (error) {
        if (!active) return;
        if (error.status !== 401) {
          setToast({ type: "error", title: "Session check failed", description: getAuthErrorMessage(error) });
          return;
        }
        let logoutErrorMessage = "";
        try {
          await authRequest("/logout", { method: "POST" });
        } catch (logoutError) {
          logoutErrorMessage = getAuthErrorMessage(logoutError);
        }
        if (!active) return;
        authRequestVersion.current += 1;
        setUser(null);
        setReturnPath("/dashboard");
        setToast({
          type: "error",
          title: "Session expired",
          description: logoutErrorMessage || "Please sign in again to continue.",
        });
        navigate("auth", "login");
      }
    }
    const timer = window.setInterval(checkSession, 5 * 60 * 1000);
    window.addEventListener("focus", checkSession);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", checkSession);
    };
  }, [authChecked, page, user?.id]);

  function openAuth(mode = "login") {
    if (["dashboard", "tickets", "bookings"].includes(page)) {
      setReturnPath(window.location.pathname === "/dashboard" ? "/dashboard" : window.location.pathname);
    } else {
      setReturnPath(null);
    }
    navigate("auth", mode);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openMyBookings() {
    setDashboardSection("bookings");
    if (user) {
      navigate("bookings");
      return;
    }
    setReturnPath("/bookings");
    navigate("auth", "login");
  }

  function openMyTickets() {
    setDashboardSection("tickets");
    if (user) {
      navigate("tickets");
      return;
    }
    setReturnPath("/tickets");
    navigate("auth", "login");
  }

  function openOffers() { navigate("offers"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function openHelp() { navigate("help"); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function goHome() {
    navigate("home");
  }

  function openNotifications() {
    setNotificationDrawerOpen((isOpen) => !isOpen);
  }

  function handleAuthenticated(nextUser, method = "login") {
    authRequestVersion.current += 1;
    setUser(nextUser);
    apiRequest("/notifications?limit=1")
      .then((result) => setUnreadCount(result.data.unreadCount))
      .catch((error) => {
        setUnreadCount(0);
        setToast({ type: "error", title: "Notifications unavailable", description: getAuthErrorMessage(error) });
      });
    setAuthChecked(true);
    setToast(method === "login"
      ? {
          type: "success",
          title: "Sign in successfully!",
          description: `Welcome back, ${nextUser.fullName}.`,
        }
      : {
          type: "success",
          title: "Email verified!",
          description: `Welcome, ${nextUser.fullName}.`,
        });
    setReturnPath(null);
    if (returnPath === "/tickets" || returnPath === "/bookings") {
      setDashboardSection(returnPath === "/tickets" ? "tickets" : "bookings");
      window.history.pushState({}, "", returnPath);
      setPage(returnPath.slice(1));
    } else if (returnPath?.startsWith("/dashboard?section=")) {
      const section = dashboardSectionFromSearch(`?${returnPath.split("?")[1]}`);
      setDashboardSection(section);
      window.history.pushState({}, "", returnPath);
      setPage("dashboard");
    } else {
      navigate(returnPath === "/dashboard" || method !== "login" ? "dashboard" : "home");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleAuthError(messageText) {
    setToast({ type: "error", title: "Sign in failed", description: messageText });
  }

  async function handleLogout() {
    try {
      await authRequest("/logout", { method: "POST" });
    } catch (error) {
      setToast({ type: "error", title: "Could not sign out", description: getAuthErrorMessage(error) });
      throw error;
    }
    authRequestVersion.current += 1;
    setUser(null);
    setUnreadCount(0);
    setToast({ type: "success", title: "Signed out", description: "You have safely signed out of your account." });
    setReturnPath(null);
    navigate("auth", "login");
  }

  function handleAccountDeleted() {
    authRequestVersion.current += 1;
    setUser(null);
    setUnreadCount(0);
    setReturnPath(null);
    navigate("auth", "login");
  }

  function handleSearch(event) {
    event.preventDefault();
    if (!from.trim() || !to.trim()) {
      setMessage("Enter both a departure and destination to search.");
      return;
    }
    if (from.trim().toLowerCase() === to.trim().toLowerCase()) {
      setMessage("Choose two different cities for your journey.");
      return;
    }
    setMessage("");
    setSearchQuery({
      from: from.trim(),
      to: to.trim(),
      date,
      passengers,
      mode,
    });
    setPage("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function modifySearch() {
    setPage("home");
    window.setTimeout(() => {
      document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function selectRoute(route) {
    setMode(route.transport);
    setFrom(route.departure);
    setTo(route.destination);
    setMessage("");
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function searchDestination(destination) {
    const destinationName = destination.name;
    const origin = destination.departure
      ?? homeContent.routes.find((route) => route.destination === destinationName)?.departure
      ?? homeContent.locations.find((location) => location !== destinationName)
      ?? "";
    if (!origin) {
      setMessage("No active route is available for this destination yet.");
      document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const transport = destination.transport || "Bus";
    setMode(transport);
    setFrom(origin);
    setTo(destinationName);
    setMessage("");
    setSearchQuery({
      from: origin,
      to: destinationName,
      date,
      passengers,
      mode: transport,
    });
    setPage("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className={`app-shell${page === "results" ? " results-app" : ""}${page === "auth" ? " auth-app" : ""}${["dashboard", "tickets", "bookings"].includes(page) ? " dashboard-app" : ""}`} id="home">
      {page === "home" ? (
        <section className="hero">
          <div className="hero-image-carousel" aria-hidden="true">
            {heroImages.map((image, index) => (
              <div
                className={`hero-image-layer${heroSlide === index ? " active" : ""}`}
                key={image.src}
                style={{
                  backgroundImage: `url("${image.src}")`,
                  backgroundPosition: image.position,
                }}
              />
            ))}
          </div>
          <Header
            noticeOpen={noticeOpen}
            setNoticeOpen={setNoticeOpen}
            notificationDrawerOpen={notificationDrawerOpen}
            onHome={goHome}
            onTickets={openMyTickets}
            onBookings={openMyBookings}
            onOffers={openOffers}
            onHelp={openHelp}
            page={page}
            onAuth={openAuth}
            user={user}
            onDashboard={() => navigate("dashboard")}
            onNotifications={openNotifications}
            unreadCount={unreadCount}
          />
          <div className="hero-content">
            <div className="hero-copy">
              <span className="hero-kicker">
                <span aria-hidden="true">✦</span> Travel made easy
              </span>
              <h1>
                Book Your Tickets <span>Online</span>
              </h1>
              <p>Bus, Train, Launch or Event — all in one place.</p>
              <div className="slide-dots" aria-label={`Hero image ${heroSlide + 1} of ${heroImages.length}`}>
                {heroImages.map((image, index) => (
                  <button
                    className={heroSlide === index ? "selected" : ""}
                    key={image.src}
                    type="button"
                    aria-label={`Show ${image.alt}`}
                    aria-current={heroSlide === index ? "true" : undefined}
                    onClick={() => setHeroSlide(index)}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="hero-bottom-shape" aria-hidden="true" />
        </section>
      ) : (
        <div className="results-header-shell">
          <Header
            noticeOpen={noticeOpen}
            setNoticeOpen={setNoticeOpen}
            notificationDrawerOpen={notificationDrawerOpen}
            onHome={goHome}
            onTickets={openMyTickets}
            onBookings={openMyBookings}
            onOffers={openOffers}
            onHelp={openHelp}
            page={page}
            onAuth={openAuth}
            user={user}
            onDashboard={() => navigate("dashboard")}
            onNotifications={openNotifications}
            unreadCount={unreadCount}
          />
        </div>
      )}

      {page === "auth" ? (
        <AuthPage
          initialMode={authMode}
          onHome={goHome}
          onAuthenticated={handleAuthenticated}
          onAuthError={handleAuthError}
        />
      ) : ["dashboard", "tickets", "bookings"].includes(page) ? (
        authChecked && user ? (
          <UserDashboard
            user={user}
            initialSection={page === "tickets" ? "tickets" : page === "bookings" ? "bookings" : dashboardSection}
            onUserUpdate={(nextUser) => setUser((current) => ({ ...current, ...nextUser }))}
            onLogout={handleLogout}
            onAccountDeleted={handleAccountDeleted}
            onBrowseTrips={goHome}
            onToast={setToast}
            onUnreadCountChange={setUnreadCount}
            onSectionNavigate={(section) => {
              setDashboardSection(section);
              const destination = section === "tickets" || section === "bookings" ? `/${section}` : section === "profile" ? "/dashboard" : `/dashboard?section=${encodeURIComponent(section)}`;
              window.history.pushState({}, "", destination);
              setPage(section === "tickets" || section === "bookings" ? section : "dashboard");
            }}
          />
        ) : (
          <main className="dashboard-loading" role="status">Checking your secure account session…</main>
        )
      ) : page === "offers" || page === "help" ? (
        <InformationPage
          page={page}
          deals={homeContent.deals}
          onHome={goHome}
          onBookDeal={(deal) => {
            setMode(deal.mode || "Bus");
            setFrom(deal.from);
            setTo(deal.to);
            navigate("home");
            window.setTimeout(() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
          }}
        />
      ) : page === "results" && searchQuery ? (
        <TicketSearchResults
          query={searchQuery}
          onModify={modifySearch}
          onModeChange={setMode}
          onHome={goHome}
        />
      ) : (
        <main className="main-content">
          <BookingCard
            mode={mode}
            setMode={setMode}
            from={from}
            setFrom={setFrom}
            to={to}
            setTo={setTo}
            date={date}
            setDate={setDate}
            passengers={passengers}
            setPassengers={setPassengers}
            onSearch={handleSearch}
            message={message}
            locations={homeContent.locations}
          />
          <PopularRoutes
            routes={homeContent.routes}
            loading={homeLoading}
            error={homeError}
            onRetry={() => setHomeRefreshKey((key) => key + 1)}
            onSelectRoute={selectRoute}
          />
          <HotDealsSection
            deals={homeContent.deals}
            onBookDeal={(deal) => {
              setMode(deal.mode || "Bus");
              setFrom(deal.from);
              setTo(deal.to);
              setMessage("");
              document.getElementById("booking")?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }}
          />
          <DestinationShowcase
            destinations={homeContent.destinations}
            loading={homeLoading}
            error={homeError}
            onSelectDestination={searchDestination}
          />
          <Benefits />
        </main>
      )}
      <NotificationDrawer
        open={notificationDrawerOpen && Boolean(user)}
        onClose={closeNotificationDrawer}
        unreadCount={unreadCount}
        onUnreadCountChange={setUnreadCount}
        onToast={setToast}
      />
      {page !== "auth" && page !== "dashboard" && (
        <BottomNavigation
          active={page === "tickets" ? "My Tickets" : page === "bookings" ? "Bookings" : page === "help" ? "Support" : ["home", "results"].includes(page) ? "Home" : null}
          onHome={goHome}
          onTickets={openMyTickets}
          onBookings={openMyBookings}
          onSupport={openHelp}
        />
      )}
      {page !== "auth" && !["dashboard", "tickets", "bookings"].includes(page) && (
        <>
          <footer className="desktop-footer" id="support">
            <span>Travel a little easier with E-Ticketing.</span>
            <a href="mailto:support@eticketing.example">
              <CircleHelp size={16} /> Need a hand?
            </a>
          </footer>
        </>
      )}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
