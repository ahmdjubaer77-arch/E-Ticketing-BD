import React, { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { apiRequest } from "./authApi.js";
import "./notification-drawer.css";

export default function NotificationDrawer({ open, onClose, unreadCount, onUnreadCountChange, onToast }) {
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(0);
  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError("");
    apiRequest(`/notifications?page=${page}&limit=20`)
      .then((result) => {
        if (!active) return;
        setNotifications(result.data.notifications);
        setPages(result.data.pagination.pages);
        onUnreadCountChange(result.data.unreadCount);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Notifications could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, page, requestKey, onUnreadCountChange]);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const focusable = drawerRef.current?.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, [open, onClose]);

  async function markAsRead(notification) {
    try {
      const result = await apiRequest(`/notifications/${notification._id}/read`, { method: "PATCH" });
      setNotifications((current) => current.map((item) =>
        item._id === notification._id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item,
      ));
      if (result.data.changed) onUnreadCountChange((count) => Math.max(0, count - 1));
    } catch (requestError) {
      onToast({ type: "error", title: "Could not update notification", description: requestError.message });
    }
  }

  async function markAllAsRead() {
    try {
      await apiRequest("/notifications/read-all", { method: "PATCH" });
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      onUnreadCountChange(0);
    } catch (requestError) {
      onToast({ type: "error", title: "Could not update notifications", description: requestError.message });
    }
  }

  async function deleteNotification(notification) {
    try {
      await apiRequest(`/notifications/${notification._id}`, { method: "DELETE" });
      const remaining = notifications.filter((item) => item._id !== notification._id);
      setNotifications(remaining);
      if (!notification.readAt) onUnreadCountChange((count) => Math.max(0, count - 1));
      if (remaining.length === 0 && page > 1) setPage((current) => current - 1);
      else if (remaining.length === 0) setRequestKey((current) => current + 1);
    } catch (requestError) {
      onToast({ type: "error", title: "Could not delete notification", description: requestError.message });
    }
  }

  return (
    <div className={`notification-drawer-layer${open ? " is-open" : ""}`} aria-hidden={!open}>
      <button className="notification-drawer-backdrop" type="button" tabIndex={open ? 0 : -1} aria-label="Close notifications" onClick={onClose} />
      <aside
        ref={drawerRef}
        className="notification-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-drawer-title"
        aria-hidden={!open}
      >
        <header className="notification-drawer-header">
          <div className="notification-drawer-heading-icon"><Bell size={20} /></div>
          <div className="notification-drawer-heading">
            <h2 id="notification-drawer-title">Notifications</h2>
            <p>{unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "You’re all caught up"}</p>
          </div>
          {unreadCount > 0 && (
            <button className="notification-drawer-mark-all" type="button" onClick={markAllAsRead}>
              <CheckCheck size={15} /> <span>Mark all read</span>
            </button>
          )}
          <button ref={closeButtonRef} className="notification-drawer-close" type="button" aria-label="Close notifications" onClick={onClose}>
            <X size={19} />
          </button>
        </header>

        <div className="notification-drawer-content" aria-live="polite">
          {loading ? (
            <div className="notification-drawer-state"><span className="notification-loader" />Loading notifications…</div>
          ) : error ? (
            <div className="notification-drawer-state notification-drawer-error">
              <p>{error}</p>
              <button type="button" onClick={() => setRequestKey((current) => current + 1)}>Try again</button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-drawer-empty">
              <span><Bell size={23} /></span>
              <strong>No notifications yet</strong>
              <p>Updates about your account and travel will appear here.</p>
            </div>
          ) : (
            <div className="notification-drawer-list">
              {notifications.map((notification) => (
                <article className={`notification-drawer-item${notification.readAt ? "" : " unread"}`} key={notification._id}>
                  <span className="notification-drawer-item-mark" aria-hidden="true" />
                  <div className="notification-drawer-item-body">
                    <span className="notification-drawer-category">{notification.category}</span>
                    <h3>{notification.title}</h3>
                    <p>{notification.message}</p>
                    <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString()}</time>
                  </div>
                  <div className="notification-drawer-item-actions">
                    {!notification.readAt && (
                      <button type="button" aria-label="Mark as read" title="Mark as read" onClick={() => markAsRead(notification)}>
                        <Check size={15} />
                      </button>
                    )}
                    <button type="button" className="delete" aria-label="Delete notification" title="Delete notification" onClick={() => deleteNotification(notification)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {!loading && !error && pages > 1 && (
          <footer className="notification-drawer-pagination">
            <button type="button" aria-label="Previous notifications" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              <ChevronLeft size={17} /> Previous
            </button>
            <span>{page} / {pages}</span>
            <button type="button" aria-label="Next notifications" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>
              Next <ChevronRight size={17} />
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
