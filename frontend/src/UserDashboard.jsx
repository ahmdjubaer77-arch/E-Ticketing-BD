import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bus,
  Bell,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  CircleUserRound,
  Download,
  History,
  ImagePlus,
  LogOut,
  RefreshCw,
  Search,
  Settings,
  Ship,
  Ticket,
  TicketCheck,
  Trash2,
  TrainFront,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { apiRequest, downloadApiFile } from "./authApi.js";
import "./dashboard.css";

const sections = [
  { id: "profile", label: "My profile", Icon: CircleUserRound },
  { id: "bookings", label: "My bookings", Icon: CalendarCheck },
  { id: "tickets", label: "My tickets", Icon: TicketCheck },
  { id: "history", label: "Booking history", Icon: History },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "settings", label: "Account settings", Icon: Settings },
];

const bookingStatusLabels = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  expired: "Expired",
};

function formatBookingDate(value, options) {
  return new Intl.DateTimeFormat("en-BD", options).format(new Date(value));
}

function formatBookingMoney(value) {
  return `\u09F3 ${new Intl.NumberFormat("en-BD").format(value)}`;
}

function BookingTransportIcon({ transport }) {
  if (transport === "Train") return <TrainFront size={17} />;
  if (transport === "Launch") return <Ship size={17} />;
  return <Bus size={17} />;
}

function MyBookings({ onBrowseTrips, ticketsOnly = false }) {
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedId, setExpandedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey((key) => key + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const nextExpiry = bookings
      .filter((booking) => booking.status === "pending" && booking.expiresAt)
      .map((booking) => new Date(booking.expiresAt).getTime())
      .filter((expiresAt) => expiresAt > Date.now())
      .sort((first, second) => first - second)[0];
    if (!nextExpiry) return undefined;
    const timer = window.setTimeout(
      () => setRefreshKey((key) => key + 1),
      Math.max(0, nextExpiry - Date.now() + 250),
    );
    return () => window.clearTimeout(timer);
  }, [bookings]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (ticketsOnly) params.set("status", "tickets");
      else if (status) params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      apiRequest(`/users/bookings?${params}`, { signal: controller.signal })
        .then((result) => {
          if (!active) return;
          setBookings(result.data.bookings);
          setPagination(result.data.pagination);
          setExpandedId((current) => result.data.bookings.some((booking) => booking.id === current) ? current : "");
        })
        .catch((requestError) => {
          if (!active || requestError.name === "AbortError") return;
          setError(requestError.message || "Your bookings could not be loaded.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, search ? 250 : 0);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [page, refreshKey, search, status]);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  async function downloadTicket(booking, ticketIndex) {
    if (!["confirmed", "completed"].includes(booking.status) || booking.paymentStatus !== "paid") return;
    try {
      const ticketCode = booking.ticketCodes[ticketIndex];
      await downloadApiFile(`/tickets/${encodeURIComponent(ticketCode)}/pdf`, {
        filename: `e-ticket-${booking.seatNumbers[ticketIndex]}-${ticketCode}.pdf`,
      });
    } catch (requestError) {
      setError(requestError.message || "The ticket PDF could not be downloaded. Please refresh and try again.");
    }
  }
  function timeRemaining(expiresAt) {
    const milliseconds = Math.max(0, new Date(expiresAt).getTime() - now);
    return `${Math.floor(milliseconds / 60_000)}:${String(Math.floor(milliseconds % 60_000 / 1000)).padStart(2, "0")}`;
  }

  return (
    <div className={`my-bookings${ticketsOnly ? " tickets-only" : ""}`}>
      <div className="my-bookings-toolbar">
        <label className="my-bookings-search"><Search size={16} /><input type="search" value={search} maxLength={100} placeholder={ticketsOnly ? "Search ticket, route, seat or reference" : "Search reference, route, seat or transaction ID"} aria-label={ticketsOnly ? "Search my tickets" : "Search my bookings"} onChange={(event) => { setPage(1); setSearch(event.target.value); }} />{search && <button type="button" aria-label="Clear booking search" onClick={() => { setPage(1); setSearch(""); }}>Ã—</button>}</label>
        {!ticketsOnly && <label className="my-bookings-status"><span>Booking status</span><select value={status} aria-label="Filter bookings by status" onChange={(event) => { setPage(1); setStatus(event.target.value); }}><option value="">All bookings</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></label>}
        <button className="dashboard-secondary-button my-bookings-refresh" type="button" disabled={loading} onClick={() => setRefreshKey((key) => key + 1)}><RefreshCw size={15} />{loading ? "Refreshingâ€¦" : "Refresh"}</button>
      </div>

      {error && <div className="my-bookings-error" role="alert"><TriangleAlert size={17} /><span>{error}</span><button type="button" onClick={() => setRefreshKey((key) => key + 1)}>Try again</button></div>}

      {loading && bookings.length === 0 && !error && <div className="my-bookings-message" role="status">{ticketsOnly ? "Loading your ticketsâ€¦" : "Loading your bookingsâ€¦"}</div>}
      {!loading && !error && bookings.length === 0 && (
        <div className="my-bookings-empty">
          <span><CalendarCheck size={25} /></span>
          <h3>{ticketsOnly ? (search ? "No matching tickets" : "No tickets available yet") : search || status ? "No matching bookings" : "No bookings yet"}</h3>
          <p>{ticketsOnly ? (search ? "Try another search term." : "Tickets appear here after payment is confirmed for a booking.") : search || status ? "Try a different search or status filter." : "Your reservations and tickets will appear here after you book."}</p>
          {!search && !status && <button className="dashboard-primary-button" type="button" onClick={onBrowseTrips}>Browse trips <ArrowRight size={15} /></button>}
        </div>
      )}

      <div className={`my-bookings-list${loading ? " is-loading" : ""}`}>
        {bookings.map((booking) => {
          const expanded = expandedId === booking.id;
          const hasActiveTimer = booking.status === "pending" && booking.expiresAt;
          const isPaid = booking.paymentStatus === "paid" && ["confirmed", "completed"].includes(booking.status);
          return (
            <article className="my-booking-card" key={booking.id}>
              <button className={`my-booking-summary${ticketsOnly ? " my-ticket-summary" : ""}`} type="button" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? "" : booking.id)}>
                <span className="my-booking-icon"><BookingTransportIcon transport={booking.transport} /></span>
                <span className="my-booking-primary">
                  <strong>{booking.departure} <ArrowRight size={14} /> {booking.destination}</strong>
                  <small>{booking.transport} Â· {booking.operatorName} Â· {formatBookingDate(booking.departureAt, { day: "2-digit", month: "short", year: "numeric" })}</small>
                </span>
                <span className="my-ticket-summary-meta">
                  <span className={`my-booking-status ${booking.status}`}><i />{bookingStatusLabels[booking.status] || booking.status}</span>
                  <span className="my-booking-total">{formatBookingMoney(booking.totalAmount)}</span>
                  <span className="my-booking-expand">{expanded ? "Hide details" : "Details"}</span>
                </span>
              </button>
              {ticketsOnly && (
                <div className="my-ticket-downloads">
                  <div className="my-ticket-download-heading"><strong><TicketCheck size={16} /> Your issued tickets</strong><span>{booking.ticketCodes.length} {booking.ticketCodes.length === 1 ? "ticket" : "tickets"}</span></div>
                  <div className="my-ticket-options">
                    {booking.ticketCodes.map((code, index) => (
                      <div className="my-ticket-option" key={code}>
                        <div className="my-ticket-option-info">
                          <span className="my-ticket-seat-label">SEAT {booking.seatNumbers[index]}</span>
                          <strong>{booking.ticketPassengerNames?.[index] || booking.customerName}</strong>
                          <small>Ticket ID <b>{code}</b></small>
                        </div>
                        {booking.ticketQrCodes?.[index] && <img className="my-ticket-qr" src={booking.ticketQrCodes[index]} alt={`QR code for ticket ${code}`} />}
                        <button className="dashboard-primary-button" type="button" onClick={() => downloadTicket(booking, index)}>
                          <Download size={15} /> Download PDF
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {expanded && (
                <div className="my-booking-details">
                  <div className="my-booking-detail-grid">
                    <div><small>BOOKING REFERENCE</small><strong>{booking.reference}</strong></div>
                    <div><small>DEPARTURE</small><strong>{formatBookingDate(booking.departureAt, { dateStyle: "medium", timeStyle: "short" })}</strong></div>
                    <div><small>ARRIVAL</small><strong>{formatBookingDate(booking.arrivalAt, { dateStyle: "medium", timeStyle: "short" })}</strong></div>
                    <div><small>SEATS</small><strong>{booking.seatNumbers.join(", ")}</strong></div>
                    <div><small>PAYMENT</small><strong className={`my-booking-payment ${booking.paymentStatus}`}>{booking.paymentStatus}</strong></div>
                    <div><small>BOOKED ON</small><strong>{formatBookingDate(booking.bookedAt, { dateStyle: "medium", timeStyle: "short" })}</strong></div>
                  </div>
                  {hasActiveTimer && <p className="my-booking-notice pending"><Clock3 size={15} />Seat hold expires in <strong>{timeRemaining(booking.expiresAt)}</strong>. Submit payment proof before the timer ends.</p>}
                  {booking.paymentProof && <p className={`my-booking-notice ${booking.paymentProof.reviewStatus}`}><CreditCard size={15} />Payment proof {booking.paymentProof.reviewStatus === "submitted" ? "is waiting for admin review" : `was ${booking.paymentProof.reviewStatus}`}{booking.paymentProof.transactionId && <> Â· Transaction ID <strong>{booking.paymentProof.transactionId}</strong></>}</p>}
                  {!booking.paymentProof && booking.paymentStatus === "pending" && <p className="my-booking-notice pending"><Clock3 size={15} />Payment proof has not been submitted for this reservation.</p>}
                  {isPaid && booking.ticketCodes.length > 0 && <div className="my-booking-tickets"><div><Ticket size={16} /><strong>Your ticket codes</strong></div>{booking.ticketCodes.map((code, index) => <span key={code}>{booking.ticketPassengerNames?.[index] || booking.customerName} · Seat {booking.seatNumbers[index]} <strong>{code}</strong>{booking.ticketQrCodes?.[index] && <img className="my-ticket-qr" src={booking.ticketQrCodes[index]} alt={`QR code for ticket ${code}`} />}</span>)}</div>}
                  <div className="my-booking-actions">
                    {isPaid && booking.ticketCodes.map((code, index) => <button className="dashboard-primary-button" type="button" key={code} onClick={() => downloadTicket(booking, index)}><Download size={15} />Download seat {booking.seatNumbers[index]} PDF</button>)}
                    <span>{isPaid ? <><CheckCircle2 size={15} /> Payment confirmed</> : <><CalendarDays size={15} />Booking and payment updates appear here</>}</span>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {pagination.pages > 1 && <div className="my-bookings-pagination"><span>Showing {((page - 1) * 10) + 1}â€“{Math.min(page * 10, pagination.total)} of {pagination.total}</span><div><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pagination.pages}</span><button type="button" disabled={page >= pagination.pages || loading} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>}
    </div>
  );
}

export default function UserDashboard({ user, initialSection = "profile", onUserUpdate, onLogout, onAccountDeleted, onToast, onUnreadCountChange, onBrowseTrips, onSectionNavigate }) {
  const [section, setSection] = useState(initialSection);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ fullName: user.fullName, phone: user.phone || "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationPage, setNotificationPage] = useState(1);
  const [notificationPages, setNotificationPages] = useState(1);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: "", password: "", confirmPassword: "" });
  const [emailDraft, setEmailDraft] = useState({ email: "", currentPassword: "" });
  const [emailOtp, setEmailOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [securityBusy, setSecurityBusy] = useState(false);
  const [deletion, setDeletion] = useState({ currentPassword: "", confirmation: "" });
  const fileInput = useRef(null);

  useEffect(() => {
    setProfileDraft({ fullName: user.fullName, phone: user.phone || "" });
  }, [user.fullName, user.phone]);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  useEffect(() => {
    if (section !== "notifications") return undefined;
    let active = true;
    setNotificationsLoading(true);
    setNotificationsError("");
    apiRequest(`/notifications?page=${notificationPage}&limit=20`)
      .then((result) => {
        if (!active) return;
        setNotifications(result.data.notifications);
        setUnreadCount(result.data.unreadCount);
        setNotificationPages(result.data.pagination.pages);
      })
      .catch((error) => {
        if (!active) return;
        setNotificationsError(error.message || "Notifications could not be loaded.");
      })
      .finally(() => {
        if (active) setNotificationsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [notificationPage, section]);

  async function handleLogout() {
    if (!window.confirm("Are you sure you want to log out?")) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await onLogout();
    } catch {
      setLogoutError("We could not confirm sign out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const result = await apiRequest("/users/me", {
        method: "PATCH",
        body: profileDraft,
      });
      onUserUpdate(result.data.user);
      setEditingProfile(false);
      onToast({ type: "success", title: "Profile updated", description: "Your account information was saved." });
    } catch (error) {
      onToast({ type: "error", title: "Profile update failed", description: error.message });
    } finally {
      setSavingProfile(false);
    }
  }

  async function prepareImage(file) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      onToast({ type: "error", title: "Unsupported image", description: "Choose a JPEG, PNG, or WebP image." });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      onToast({ type: "error", title: "Image is too large", description: "Choose an image smaller than 8 MB." });
      return;
    }
    setUploadingImage(true);
    try {
      const resized = await resizeProfileImage(file);
      const result = await apiRequest("/users/me/avatar", {
        method: "POST",
        body: resized,
        headers: { "Content-Type": resized.type },
      });
      onUserUpdate(result.data.user);
      onToast({ type: "success", title: "Profile picture updated", description: "Your new picture is now on your profile." });
    } catch (error) {
      onToast({ type: "error", title: "Upload failed", description: error.message });
    } finally {
      setUploadingImage(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeImage() {
    try {
      const result = await apiRequest("/users/me/avatar", { method: "DELETE" });
      onUserUpdate(result.data.user);
      onToast({ type: "success", title: "Picture removed", description: "Your profile picture was removed." });
    } catch (error) {
      onToast({ type: "error", title: "Could not remove picture", description: error.message });
    }
  }

  async function updatePassword(event) {
    event.preventDefault();
    setSecurityBusy(true);
    try {
      const result = await apiRequest("/users/change-password", { method: "PATCH", body: passwordDraft });
      setPasswordDraft({ currentPassword: "", password: "", confirmPassword: "" });
      onToast({ type: "success", title: "Password changed", description: result.message });
    } catch (error) {
      onToast({ type: "error", title: "Password change failed", description: error.message });
    } finally {
      setSecurityBusy(false);
    }
  }

  async function changeEmail(event) {
    event?.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDraft.email.trim()) || !emailDraft.currentPassword) {
      onToast({ type: "error", title: "Check email details", description: "Enter a valid new email address and your current password." });
      return;
    }
    setSecurityBusy(true);
    try {
      const result = await apiRequest("/users/change-email", { method: "POST", body: emailDraft });
      setPendingEmail(result.data.email);
      setEmailOtp("");
      onToast({ type: "success", title: "Verification sent", description: result.message });
    } catch (error) {
      onToast({ type: "error", title: "Email change failed", description: error.message });
    } finally {
      setSecurityBusy(false);
    }
  }

  async function verifyEmailChange(event) {
    event.preventDefault();
    setSecurityBusy(true);
    try {
      const result = await apiRequest("/users/verify-new-email", {
        method: "POST",
        body: { otp: emailOtp },
      });
      onUserUpdate(result.data.user);
      setPendingEmail("");
      setEmailDraft({ email: "", currentPassword: "" });
      onToast({ type: "success", title: "Email updated", description: result.message });
    } catch (error) {
      onToast({ type: "error", title: "Email verification failed", description: error.message });
    } finally {
      setSecurityBusy(false);
    }
  }

  async function resendEmailOtp() {
    setSecurityBusy(true);
    try {
      const result = await apiRequest("/users/resend-email-verification", { method: "POST" });
      onToast({ type: "success", title: "Verification sent", description: result.message });
    } catch (error) {
      onToast({ type: "error", title: "Could not resend code", description: error.message });
    } finally {
      setSecurityBusy(false);
    }
  }

  async function deleteAccount(event) {
    event.preventDefault();
    if (!window.confirm("Permanently delete your account and notifications? Booking and payment records are retained separately. This cannot be undone.")) return;
    setSecurityBusy(true);
    try {
      const result = await apiRequest("/users/me", { method: "DELETE", body: deletion });
      onToast({ type: "success", title: "Account deleted", description: result.message });
      onAccountDeleted();
    } catch (error) {
      onToast({ type: "error", title: "Could not delete account", description: error.message });
    } finally {
      setSecurityBusy(false);
    }
  }

  async function markNotificationRead(notificationId) {
    try {
      const result = await apiRequest(`/notifications/${notificationId}/read`, { method: "PATCH" });
      setNotifications((current) => current.map((item) => item._id === notificationId ? { ...item, readAt: new Date().toISOString() } : item));
      if (result.data.changed) setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      onToast({ type: "error", title: "Could not update notification", description: error.message });
    }
  }

  async function markAllRead() {
    try {
      await apiRequest("/notifications/read-all", { method: "PATCH" });
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      onToast({ type: "error", title: "Could not update notifications", description: error.message });
    }
  }

  async function deleteNotification(notification) {
    try {
      await apiRequest(`/notifications/${notification._id}`, { method: "DELETE" });
      setNotifications((current) => current.filter((item) => item._id !== notification._id));
      if (!notification.readAt) setUnreadCount((count) => Math.max(0, count - 1));
    } catch (error) {
      onToast({ type: "error", title: "Could not delete notification", description: error.message });
    }
  }

  const activeSection = sections.find((item) => item.id === section);
  const ActiveIcon = activeSection.Icon;

  return (
    <main className="user-dashboard">
      <section className="dashboard-welcome">
        <div>
          <span className="dashboard-kicker">YOUR ACCOUNT</span>
          <h1>Welcome back, {user.fullName}.</h1>
          <p>Manage your profile and keep your travel information close at hand.</p>
        </div>
        <button className="dashboard-welcome-avatar" type="button" onClick={() => setSection("profile")} aria-label="View my profile">
          {user.profileImage ? <img src={user.profileImage} alt="" /> : user.fullName.trim().charAt(0).toUpperCase()}
        </button>
      </section>

      <div className="dashboard-layout">
        <nav className="dashboard-sidebar" aria-label="Account sections">
          {sections.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={section === id ? "active" : ""}
              aria-current={section === id ? "page" : undefined}
              onClick={() => {
                setSection(id);
                if (onSectionNavigate) {
                  onSectionNavigate(id);
                  return;
                }
                const url = new URL(window.location.href);
                if (id !== "profile") url.searchParams.set("section", id);
                else url.searchParams.delete("section");
                window.history.pushState({}, "", `${url.pathname}${url.search}`);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "notifications" && unreadCount > 0 && <span className="dashboard-unread-count">{unreadCount}</span>}
            </button>
          ))}
          <button type="button" className="dashboard-logout" onClick={handleLogout} disabled={loggingOut}>
            <LogOut size={18} />
            <span>{loggingOut ? "Signing outâ€¦" : "Logout"}</span>
          </button>
          {logoutError && <p className="dashboard-logout-error" role="alert">{logoutError}</p>}
        </nav>

        <section className="dashboard-panel" aria-live="polite">
          <div className="dashboard-panel-heading">
            <span className="dashboard-panel-icon"><ActiveIcon size={19} /></span>
            <div>
              <h2>{activeSection.label}{section === "notifications" && unreadCount > 0 ? ` (${unreadCount} unread)` : ""}</h2>
              <p>Your E-Ticketing account</p>
            </div>
            {section === "notifications" && notifications.length > 0 && unreadCount > 0 && (
              <button className="dashboard-text-action" type="button" onClick={markAllRead}>Mark all read</button>
            )}
          </div>

          {section === "profile" && (
            <div className="dashboard-profile">
              <div className="dashboard-profile-image-wrap">
                <div className="dashboard-profile-avatar">
                  {user.profileImage ? <img src={user.profileImage} alt={`${user.fullName}'s profile`} /> : user.fullName.trim().charAt(0).toUpperCase()}
                </div>
                <button type="button" className="dashboard-image-action" onClick={() => fileInput.current?.click()} disabled={uploadingImage}>
                  <ImagePlus size={15} /> {uploadingImage ? "Uploadingâ€¦" : "Change photo"}
                </button>
                {user.profileImage && <button className="dashboard-remove-image" type="button" onClick={removeImage}>Remove</button>}
                <input ref={fileInput} className="dashboard-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => prepareImage(event.target.files?.[0])} />
              </div>

              {editingProfile ? (
                <form className="dashboard-profile-form" onSubmit={saveProfile}>
                  <label><span>Full name</span><input required minLength={2} maxLength={100} value={profileDraft.fullName} onChange={(event) => setProfileDraft((draft) => ({ ...draft, fullName: event.target.value }))} /></label>
                  <label><span>Mobile number</span><input type="tel" maxLength={24} value={profileDraft.phone} onChange={(event) => setProfileDraft((draft) => ({ ...draft, phone: event.target.value }))} /></label>
                  <div className="dashboard-form-actions">
                    <button className="dashboard-primary-button" disabled={savingProfile}>{savingProfile ? "Savingâ€¦" : "Save changes"}</button>
                    <button className="dashboard-secondary-button" type="button" onClick={() => { setProfileDraft({ fullName: user.fullName, phone: user.phone || "" }); setEditingProfile(false); }}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <dl className="dashboard-profile-details">
                    <div><dt>Full name</dt><dd>{user.fullName}</dd></div>
                    <div><dt>Email address</dt><dd>{user.email}</dd></div>
                    <div><dt>Mobile number</dt><dd>{user.phone || "Not provided"}</dd></div>
                    <div><dt>Email verification</dt><dd className="dashboard-verified"><CheckCircle2 size={15} /> Verified</dd></div>
                    <div><dt>Account created</dt><dd>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "â€”"}</dd></div>
                  </dl>
                  <button type="button" className="dashboard-primary-button dashboard-edit-button" onClick={() => setEditingProfile(true)}>Edit profile</button>
                </>
              )}
            </div>
          )}

          {section === "notifications" && (
            <div className="dashboard-notifications">
              {notificationsLoading ? <p className="dashboard-loading-copy">Loading notificationsâ€¦</p> : notificationsError ? (
                <div className="dashboard-inline-error" role="alert">{notificationsError}</div>
              ) : notifications.length === 0 ? (
                <div className="dashboard-empty-state"><span><Bell size={23} /></span><h3>You&apos;re all caught up</h3><p>New account and booking notifications will appear here.</p></div>
              ) : notifications.map((notification) => (
                <article className={`dashboard-notification${notification.readAt ? "" : " unread"}`} key={notification._id}>
                  <div><span className="dashboard-notification-category">{notification.category}</span><strong>{notification.title}</strong><p>{notification.message}</p><time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time></div>
                  <div className="dashboard-notification-actions">
                    {!notification.readAt && <button type="button" onClick={() => markNotificationRead(notification._id)}>Mark read</button>}
                    <button type="button" aria-label="Delete notification" onClick={() => deleteNotification(notification)}><Trash2 size={15} /></button>
                  </div>
                </article>
              ))}
              {!notificationsLoading && !notificationsError && notificationPages > 1 && (
                <div className="dashboard-pagination">
                  <button type="button" disabled={notificationPage <= 1} onClick={() => setNotificationPage((page) => page - 1)}>Previous</button>
                  <span>Page {notificationPage} of {notificationPages}</span>
                  <button type="button" disabled={notificationPage >= notificationPages} onClick={() => setNotificationPage((page) => page + 1)}>Next</button>
                </div>
              )}
            </div>
          )}

          {section === "settings" && (
            <div className="dashboard-settings">
              <form className="dashboard-settings-form" onSubmit={updatePassword}>
                <h3>Change password</h3>
                <label><span>Current password</span><input type="password" autoComplete="current-password" required value={passwordDraft.currentPassword} onChange={(event) => setPasswordDraft((draft) => ({ ...draft, currentPassword: event.target.value }))} /></label>
                <label><span>New password</span><input type="password" autoComplete="new-password" minLength={8} required value={passwordDraft.password} onChange={(event) => setPasswordDraft((draft) => ({ ...draft, password: event.target.value }))} /></label>
                <label><span>Confirm new password</span><input type="password" autoComplete="new-password" required value={passwordDraft.confirmPassword} onChange={(event) => setPasswordDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))} /></label>
                <button className="dashboard-primary-button" disabled={securityBusy}>{securityBusy ? "Savingâ€¦" : "Update password"}</button>
              </form>
              <section className="dashboard-settings-form">
                <h3>Email security</h3>
                <p>Verified email: <strong>{user.email}</strong></p>
                {!pendingEmail ? (
                  <>
                    <label><span>New email address</span><input type="email" required value={emailDraft.email} onChange={(event) => setEmailDraft((draft) => ({ ...draft, email: event.target.value }))} /></label>
                    <label><span>Current password</span><input type="password" autoComplete="current-password" required value={emailDraft.currentPassword} onChange={(event) => setEmailDraft((draft) => ({ ...draft, currentPassword: event.target.value }))} /></label>
                    <button className="dashboard-secondary-button" type="button" disabled={securityBusy} onClick={(event) => changeEmail(event)}>Send verification code</button>
                  </>
                ) : (
                  <form onSubmit={verifyEmailChange}>
                    <p>Enter the code sent to <strong>{pendingEmail}</strong>.</p>
                    <label><span>6-digit code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={emailOtp} onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
                    <div className="dashboard-form-actions">
                      <button className="dashboard-primary-button" disabled={securityBusy}>Verify new email</button>
                      <button className="dashboard-secondary-button" type="button" disabled={securityBusy} onClick={resendEmailOtp}>Resend code</button>
                    </div>
                  </form>
                )}
              </section>
              <form className="dashboard-settings-form dashboard-deactivate" onSubmit={deleteAccount}>
                <h3>Delete account</h3>
                <p>This permanently deletes your account and notifications. Booking and payment records are retained separately and are not deleted with your account.</p>
                <label><span>Current password</span><input type="password" autoComplete="current-password" required value={deletion.currentPassword} onChange={(event) => setDeletion((current) => ({ ...current, currentPassword: event.target.value }))} /></label>
                <label><span>Type DELETE ACCOUNT to confirm</span><input required value={deletion.confirmation} onChange={(event) => setDeletion((current) => ({ ...current, confirmation: event.target.value }))} /></label>
                <button className="dashboard-danger-button" type="submit" disabled={securityBusy}>{securityBusy ? "Deletingâ€¦" : "Permanently delete account"}</button>
              </form>
            </div>
          )}

          {section === "bookings" && <MyBookings onBrowseTrips={onBrowseTrips} />}
          {section === "tickets" && <MyBookings onBrowseTrips={onBrowseTrips} ticketsOnly />}

          {section === "history" && (
            <div className="dashboard-empty-state dashboard-integration-state">
              <span><ActiveIcon size={23} /></span>
              <h3>Booking history</h3>
              <p>Your past and current reservations are available in My bookings.</p>
              <button className="dashboard-secondary-button" type="button" onClick={() => setSection("bookings")}>Open My bookings</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

async function resizeProfileImage(file) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable in this browser.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("The selected image could not be processed.");
  if (blob.size > 400 * 1024) throw new Error("Choose a smaller image; the processed image exceeds 400 KB.");
  return blob;
}
