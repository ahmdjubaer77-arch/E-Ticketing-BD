import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "./api.js";
import { CreditCard, ExternalLink, Plus, RefreshCw, Save, Search, X } from "lucide-react";
import "./payment-management.css";

const paymentStatuses = ["pending", "paid", "failed", "refunded"];
const emptyMethod = { name: "", accountType: "personal", accountNumber: "", instructions: "", status: "active" };

function amount(value) {
  return `৳${new Intl.NumberFormat("en-BD").format(value)}`;
}

export default function PaymentManagement({ query, onToast }) {
  const [bookings, setBookings] = useState([]);
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("proofs");
  const [editingMethodId, setEditingMethodId] = useState("");
  const [methodForm, setMethodForm] = useState(emptyMethod);
  const [savingMethod, setSavingMethod] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [{ bookings: records }, { paymentMethods }] = await Promise.all([
        apiRequest("/admin/bookings"),
        apiRequest("/admin/payment-methods"),
      ]);
      setBookings(records);
      setMethods(paymentMethods);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const visibleBookings = useMemo(() => bookings.filter((booking) => {
    const text = `${booking.id} ${booking.customerName} ${booking.customerEmail} ${booking.departure} ${booking.destination}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [bookings, query]);

  async function updatePayment(booking, paymentStatus) {
    setSavingId(booking.id);
    try {
      const { booking: updated } = await apiRequest(`/admin/bookings/${booking.id}/payment-status`, {
        method: "PATCH",
        body: { paymentStatus },
      });
      setBookings((current) => current.map((item) => item.id === booking.id ? updated : item));
      onToast("Payment status updated", `${booking.id.slice(-8).toUpperCase()} is now ${paymentStatus}.`);
    } catch (requestError) {
      onToast("Payment update failed", requestError.message);
      await loadPayments();
    } finally {
      setSavingId("");
    }
  }

  function editMethod(method) {
    setEditingMethodId(method.id);
    setMethodForm({
      name: method.name,
      accountType: method.accountType,
      accountNumber: method.accountNumber,
      instructions: method.instructions,
      status: method.status,
    });
    setActiveTab("methods");
  }

  function cancelMethodEdit() {
    setEditingMethodId("");
    setMethodForm(emptyMethod);
  }

  async function saveMethod(event) {
    event.preventDefault();
    setSavingMethod(true);
    try {
      const path = editingMethodId ? `/admin/payment-methods/${editingMethodId}` : "/admin/payment-methods";
      const { paymentMethod } = await apiRequest(path, {
        method: editingMethodId ? "PATCH" : "POST",
        body: methodForm,
      });
      setMethods((current) => editingMethodId
        ? current.map((item) => item.id === paymentMethod.id ? paymentMethod : item)
        : [...current, paymentMethod].sort((first, second) => first.name.localeCompare(second.name)));
      onToast("Payment method saved", `${paymentMethod.name} is ${paymentMethod.status}.`);
      cancelMethodEdit();
    } catch (requestError) {
      onToast("Payment method could not be saved", requestError.message);
    } finally {
      setSavingMethod(false);
    }
  }

  async function toggleMethodStatus(method) {
    const status = method.status === "active" ? "inactive" : "active";
    try {
      const { paymentMethod } = await apiRequest(`/admin/payment-methods/${method.id}`, {
        method: "PATCH",
        body: { status },
      });
      setMethods((current) => current.map((item) => item.id === method.id ? paymentMethod : item));
      onToast("Payment method updated", `${method.name} is now ${status}.`);
    } catch (requestError) {
      onToast("Payment method could not be updated", requestError.message);
    }
  }

  const counts = Object.fromEntries(paymentStatuses.map((status) => [
    status,
    bookings.filter((booking) => booking.paymentStatus === status).length,
  ]));

  return (
    <section className="payment-management">
      <div className="payment-management-live"><span /> MANUAL PAYMENT CONTROL <span>Payment statuses are admin-managed; no gateway charges are processed.</span><button type="button" aria-label="Refresh payments" disabled={loading} onClick={loadPayments}><RefreshCw size={14} /></button></div>
      {error && <div className="payment-management-error" role="alert"><span>{error}</span><button type="button" onClick={loadPayments}>Try again</button></div>}
      <header className="payment-management-heading"><div><span>WORKSPACE · PAYMENTS</span><h1>Payment Management</h1><p>Set payment status for bookings and release unpaid reservations when needed.</p></div><button type="button" disabled={loading} onClick={loadPayments}><RefreshCw size={15} />Refresh</button></header>
      <section className="payment-management-stats" aria-label="Payment status counts">
        {paymentStatuses.map((status) => <article key={status}><small>{status}</small><strong>{counts[status]}</strong></article>)}
      </section>
      <nav className="payment-management-tabs" aria-label="Payment management sections">
        <button type="button" className={activeTab === "proofs" ? "active" : ""} onClick={() => setActiveTab("proofs")}>Payment proofs</button>
        <button type="button" className={activeTab === "methods" ? "active" : ""} onClick={() => setActiveTab("methods")}>Payment methods</button>
      </nav>
      {activeTab === "proofs" ? <section className="payment-management-table-card">
        <header><div><h2>Booking payments <span>{visibleBookings.length}</span></h2><p>Review submitted proof, then approve by marking Paid or reject by marking Failed.</p></div><div className="payment-management-search"><Search size={15} /><span>{query || "Use the dashboard search"}</span></div></header>
        <div className="payment-management-table-scroll"><table><thead><tr><th>BOOKING</th><th>CUSTOMER</th><th>JOURNEY</th><th>AMOUNT</th><th>PAYMENT PROOF</th><th>STATUS</th><th>HOLD EXPIRES</th></tr></thead><tbody>
          {visibleBookings.map((booking) => {
            const active = ["pending", "confirmed"].includes(booking.status);
            return <tr key={booking.id}>
              <td><strong>{booking.id.slice(-8).toUpperCase()}</strong><small>{booking.status}</small></td>
              <td><strong>{booking.customerName}</strong><small>{booking.customerEmail || booking.customerPhone || "No contact details"}</small></td>
              <td><strong>{booking.departure} → {booking.destination}</strong><small>{new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.departureAt))}</small></td>
              <td>{amount(booking.totalAmount)}</td>
              <td className="payment-proof-cell">{booking.paymentProof ? <><strong>{booking.paymentProof.paymentMethodName} · {booking.paymentProof.accountNumber}</strong><small>TrxID: {booking.paymentProof.transactionId}</small><small>{new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.paymentProof.submittedAt))}</small>{booking.paymentProof.hasImage && <a className="payment-proof-image-link" href={`/api/admin/bookings/${booking.id}/payment-proof-image`} target="_blank" rel="noreferrer"><img src={`/api/admin/bookings/${booking.id}/payment-proof-image`} alt={`Payment screenshot for booking ${booking.id}`} /><span><ExternalLink size={12} />View screenshot</span></a>}</> : <small>No proof submitted</small>}</td>
              <td><label className="payment-management-status"><CreditCard size={14} /><select aria-label={`Payment status for booking ${booking.id}`} value={booking.paymentStatus} disabled={!active || savingId === booking.id} onChange={(event) => updatePayment(booking, event.target.value)}>{paymentStatuses.map((status) => <option value={status} key={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select>{savingId === booking.id && <span className="payment-management-saving">Saving…</span>}<small>{booking.paymentProof?.reviewStatus || "manual"}</small></label></td>
              <td>{booking.expiresAt && booking.status === "pending" ? new Intl.DateTimeFormat("en-BD", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(booking.expiresAt)) : "—"}</td>
            </tr>;
          })}
          {!loading && visibleBookings.length === 0 && <tr><td className="payment-management-empty" colSpan="7">No booking payments found.</td></tr>}
          {loading && <tr><td className="payment-management-empty" colSpan="7">Loading payments…</td></tr>}
        </tbody></table></div>
        <footer>Marking a proof-backed booking Paid approves its proof. Failed or Refunded cancels the booking and releases seats. Unpaid holds expire after 3 minutes.</footer>
      </section> : <section className="payment-methods-panel">
        <header><div><h2>Customer payment options</h2><p>Active methods appear in checkout. Update account numbers here; old bookings retain their payment details.</p></div></header>
        <div className="payment-methods-layout">
          <form className="payment-method-form" onSubmit={saveMethod}>
            <h3>{editingMethodId ? "Edit payment method" : "Add payment method"}</h3>
            <label>Method name<input required minLength="2" maxLength="80" value={methodForm.name} onChange={(event) => setMethodForm({ ...methodForm, name: event.target.value })} placeholder="e.g. bKash" /></label>
            <label>Account type<select value={methodForm.accountType} onChange={(event) => setMethodForm({ ...methodForm, accountType: event.target.value })}><option value="personal">Personal</option><option value="merchant">Merchant</option><option value="agent">Agent</option><option value="bank">Bank</option></select></label>
            <label>Account number<input required minLength="4" maxLength="40" value={methodForm.accountNumber} onChange={(event) => setMethodForm({ ...methodForm, accountNumber: event.target.value })} placeholder="Payment account number" /></label>
            <label>Customer instructions<textarea maxLength="300" rows="3" value={methodForm.instructions} onChange={(event) => setMethodForm({ ...methodForm, instructions: event.target.value })} placeholder="Send money and enter the transaction ID." /></label>
            <label>Status<select value={methodForm.status} onChange={(event) => setMethodForm({ ...methodForm, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <div className="payment-method-form-actions"><button type="submit" disabled={savingMethod}><Save size={14} />{savingMethod ? "Saving…" : editingMethodId ? "Save changes" : "Add method"}</button>{editingMethodId && <button type="button" onClick={cancelMethodEdit}><X size={14} />Cancel</button>}</div>
          </form>
          <div className="payment-method-list">{methods.map((method) => <article key={method.id}>
            <div><span className={`payment-method-status-dot ${method.status}`} /><div><strong>{method.name}</strong><small>{method.accountType} · {method.accountNumber}</small>{method.instructions && <p>{method.instructions}</p>}</div></div>
            <div><button type="button" onClick={() => editMethod(method)}>Edit</button><button type="button" onClick={() => toggleMethodStatus(method)}>{method.status === "active" ? "Deactivate" : "Activate"}</button></div>
          </article>)}{!loading && methods.length === 0 && <p className="payment-methods-empty">No payment methods yet. Add one to show payment options at checkout.</p>}</div>
        </div>
      </section>}
    </section>
  );
}
