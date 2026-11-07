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
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=280&q=80",
    alt: "Scenic view of a river and green landscape",
  },
  {
    image: "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=280&q=80",
    alt: "Green hills and countryside",
  },
];

const navigation = [
  { name: "Home", Icon: Home },
  { name: "My Tickets", Icon: TicketCheck },
  { name: "Bookings", Icon: CalendarCheck },
  { name: "Support", Icon: Headphones },
];

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

function Header({ noticeOpen, setNoticeOpen, notificationDrawerOpen, onHome, onAuth, onBookings, user, onDashboard, onNotifications, unreadCount = 0 }) {
  return (
    <header className="site-header">
      <Brand onHome={onHome} />
      <nav className="desktop-nav" aria-label="Main navigation">
        <a className="desktop-nav-link active" href="#home" onClick={onHome}>
          Home
        </a>
        <a className="desktop-nav-link" href="#booking">
          Tickets <ChevronDown size={15} />
        </a>
        <a className="desktop-nav-link" href={user ? "/dashboard?section=bookings" : "/login"} onClick={(event) => { event.preventDefault(); onBookings(); }}>
          My Bookings
        </a>
        <a className="desktop-nav-link" href="#benefits">
          Offers
        </a>
        <a className="desktop-nav-link" href="#support">
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
  if (pathname === "/signup") return "auth";
  if (pathname === "/login") return "auth";
  return "home";
}

function routePath(page, mode = "login") {
  if (page === "dashboard") {
    return new URLSearchParams(window.location.search).get("section") === "bookings"
      ? "/dashboard?section=bookings"
      : "/dashboard";
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
          <p className="eyebrow">LIVE FROM OUR DATABASE</p>
          <h2>Available Routes</h2>
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
        {routes.map((route, index) => (
          <button
            className="route-card"
            type="button"
            key={route.id}
            onClick={() => onSelectRoute(route)}
            aria-label={`Search ${route.transport} routes from ${route.departure} to ${route.destination}, starting at ৳${route.startingFare}`}
          >
            <img className="route-image" src={routeImages[index % routeImages.length].image} alt={routeImages[index % routeImages.length].alt} loading="lazy" />
            <span className="route-copy">
              <span className="route-title">
                {route.departure} <ArrowRight size={16} /> {route.destination}
              </span>
              <span className="route-price">
                {route.transport === "Train" ? <Train size={17} /> : route.transport === "Launch" ? <Ship size={17} /> : <Bus size={17} />}
                <span>
                  {route.transport} · From <strong>৳ {Number(route.startingFare).toLocaleString("en-BD")}</strong>
                </span>
              </span>
            </span>
            <ChevronRight className="route-chevron" size={21} />
          </button>
        ))}
        </div>
      ) : (
        <div className="home-data-message" role="status">No active routes are available yet.</div>
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

function BottomNavigation({ active, setActive, onHome, onBookings }) {
  return (
    <nav className="bottom-nav" aria-label="Quick navigation">
      {navigation.map(({ name, Icon }) => (
        <button
          className={`bottom-nav-item${active === name ? " current" : ""}`}
          type="button"
          key={name}
          aria-current={active === name ? "page" : undefined}
          onClick={() => {
            setActive(name);
            if (name === "Home") onHome();
            if (name === "Bookings") onBookings();
          }}
        >
          <Icon size={22} strokeWidth={active === name ? 2.4 : 1.8} />
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
  const [activeNavigation, setActiveNavigation] = useState("Home");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(routeFromLocation);
  const [authMode, setAuthMode] = useState(() => (window.location.pathname === "/signup" ? "register" : "login"));
  const [searchQuery, setSearchQuery] = useState(null);
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dashboardSection, setDashboardSection] = useState(() => new URLSearchParams(window.location.search).get("section") === "bookings" ? "bookings" : "profile");
  const [authChecked, setAuthChecked] = useState(false);
  const [toast, setToast] = useState(null);
  const [homeContent, setHomeContent] = useState({ routes: [], destinations: [], locations: [], deals: [] });
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState("");
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);
  const [heroSlide, setHeroSlide] = useState(0);
  const [returnPath, setReturnPath] = useState(() => (
    window.location.pathname === "/dashboard"
      ? window.location.search.includes("section=bookings") ? "/dashboard?section=bookings" : "/dashboard"
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
    if (page !== "home") return undefined;
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
        if (routeFromLocation() === "dashboard") {
          setReturnPath(new URLSearchParams(window.location.search).get("section") === "bookings" ? "/dashboard?section=bookings" : "/dashboard");
          setAuthMode("login");
          setPage("auth");
          window.history.replaceState({}, "", "/login?returnTo=%2Fdashboard");
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
      if (requestedPage === "dashboard" && authChecked && !user) {
        setReturnPath(new URLSearchParams(window.location.search).get("section") === "bookings" ? "/dashboard?section=bookings" : "/dashboard");
        setAuthMode("login");
        setPage("auth");
        window.history.replaceState({}, "", "/login?returnTo=%2Fdashboard");
        return;
      }
      setPage(requestedPage);
      if (requestedPage === "dashboard") {
        setDashboardSection(new URLSearchParams(window.location.search).get("section") === "bookings" ? "bookings" : "profile");
      }
      if (window.location.pathname === "/signup") setAuthMode("register");
      else if (window.location.pathname === "/login") setAuthMode("login");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [authChecked, user]);

  useEffect(() => {
    if (!authChecked || !user || page !== "dashboard") return undefined;
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
    if (page === "dashboard" || window.location.pathname === "/dashboard") {
      setReturnPath("/dashboard");
    } else {
      setReturnPath(null);
    }
    navigate("auth", mode);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openMyBookings() {
    setDashboardSection("bookings");
    if (user) {
      window.history.pushState({}, "", "/dashboard?section=bookings");
      setPage("dashboard");
      return;
    }
    setReturnPath("/dashboard?section=bookings");
    navigate("auth", "login");
  }

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
    if (returnPath === "/dashboard?section=bookings") {
      setDashboardSection("bookings");
      window.history.pushState({}, "", "/dashboard?section=bookings");
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
    <div className={`app-shell${page === "results" ? " results-app" : ""}${page === "auth" ? " auth-app" : ""}${page === "dashboard" ? " dashboard-app" : ""}`} id="home">
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
            onBookings={openMyBookings}
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
            onBookings={openMyBookings}
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
      ) : page === "dashboard" ? (
        authChecked && user ? (
          <UserDashboard
            user={user}
            initialSection={dashboardSection}
            onUserUpdate={(nextUser) => setUser((current) => ({ ...current, ...nextUser }))}
            onLogout={handleLogout}
            onAccountDeleted={handleAccountDeleted}
            onBrowseTrips={goHome}
            onToast={setToast}
            onUnreadCountChange={setUnreadCount}
          />
        ) : (
          <main className="dashboard-loading" role="status">Checking your secure account session…</main>
        )
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
        <>
          <BottomNavigation
            active={activeNavigation}
            setActive={setActiveNavigation}
            onHome={goHome}
            onBookings={openMyBookings}
          />
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
