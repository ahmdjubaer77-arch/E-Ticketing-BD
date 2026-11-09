import React, { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Headphones, Search, Send, X } from "lucide-react";
import { apiRequest } from "./authApi.js";

const faqs = [
  ["How do I book a ticket?", "Choose your transport, route, date, and seats. Add passenger details, then follow the payment instructions to submit your booking."],
  ["Where can I find my ticket?", "Sign in and open My Tickets to see ticket details and download a separate PDF for each passenger."],
  ["How does payment work?", "Pay using an active method shown at checkout, then submit the transaction ID for review. Your tickets appear after payment is confirmed."],
  ["My payment is pending. What should I do?", "Open My Bookings to check your payment status. If it stays pending, send support your booking reference and payment method. Never share an OTP or password."],
  ["Can I change or cancel a booking?", "Contact support with your booking reference as soon as possible. Changes depend on the operator's policy and journey time."],
  ["How do I verify a ticket?", "Open the QR verification link or scan the QR on the PDF ticket. It shows whether the ticket is valid and the journey details."],
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [openFaq, setOpenFaq] = useState("");
  const [draft, setDraft] = useState({ name: "", email: "", bookingReference: "", topic: "Booking help", message: "" });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const visibleFaqs = useMemo(() => faqs.filter(([question, answer]) => `${question} ${answer}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError("");
    setResult("");
    try {
      const response = await apiRequest("/public/support", { method: "POST", body: draft });
      setResult(response.message || "Your request was sent. Our support team will get back to you.");
      setDraft({ name: "", email: "", bookingReference: "", topic: "Booking help", message: "" });
    } catch (requestError) {
      setError(requestError.message || "We couldn't send your request. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="information-page help-page">
      <section className="information-hero"><span>WE’RE HERE TO HELP</span><h1>How can we help?</h1><p>Search quick answers, or send our team a message and we’ll help you with your journey.</p></section>
      <label className="help-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search booking, payment, tickets…" aria-label="Search help topics" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} /></button>}</label>
      <h2 className="help-section-title">Frequently asked questions</h2>
      <section className="help-grid" aria-label="Help topics">
        {visibleFaqs.length ? visibleFaqs.map(([title, text]) => <article className={`help-card${openFaq === title ? " open" : ""}`} key={title}><button type="button" aria-expanded={openFaq === title} onClick={() => setOpenFaq(openFaq === title ? "" : title)}><span>{title}</span><ChevronDown size={17} /></button>{openFaq === title && <p>{text}</p>}</article>) : <p className="help-no-results">No answers match that search. Send us a message below and we’ll help.</p>}
      </section>
      <section className="help-support" aria-labelledby="help-contact-title">
        <div className="help-support-intro"><span><Headphones size={19} /></span><div><h2 id="help-contact-title">Still need help?</h2><p>Send a message to our team. Include your booking reference for faster assistance.</p></div></div>
        <form onSubmit={submit}>
          <div className="help-form-grid">
            <label>Your name<input required maxLength={80} autoComplete="name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Full name" /></label>
            <label>Email address<input required type="email" maxLength={254} autoComplete="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="you@example.com" /></label>
            <label>Topic<select value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })}><option>Booking help</option><option>Payment issue</option><option>Ticket or QR code</option><option>Change or cancellation</option><option>Account help</option><option>Other</option></select></label>
            <label>Booking reference <span>(optional)</span><input maxLength={80} value={draft.bookingReference} onChange={(event) => setDraft({ ...draft, bookingReference: event.target.value })} placeholder="e.g. ET123456" /></label>
            <label className="help-message-field">How can we help?<textarea required minLength={10} maxLength={2000} rows={4} value={draft.message} onChange={(event) => setDraft({ ...draft, message: event.target.value })} placeholder="Tell us what happened…" /></label>
          </div>
          {error && <p className="help-form-message error" role="alert">{error}</p>}
          {result && <p className="help-form-message success" role="status"><CheckCircle2 size={17} />{result}</p>}
          <button className="help-contact" type="submit" disabled={sending}><Send size={16} />{sending ? "Sending…" : "Send message"}</button>
          <small className="help-privacy-note">We’ll use your email only to reply to this request. Never include passwords, OTPs, or full card details.</small>
        </form>
      </section>
    </main>
  );
}
