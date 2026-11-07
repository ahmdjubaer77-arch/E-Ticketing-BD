import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Ticket,
} from "lucide-react";
import "./hot-deals.css";

function DealCard({ deal, onBookNow }) {
  return (
    <article className="hot-deal-card">
      <div className="hot-deal-image-wrap">
        {deal.image ? (
          <img
            className="hot-deal-image"
            src={deal.image}
            alt={deal.imageAlt || `${deal.operator} service`}
            loading="lazy"
          />
        ) : (
          <div className="hot-deal-image-placeholder" aria-hidden="true">
            <Ticket size={30} />
          </div>
        )}
        {deal.discountLabel && (
          <span className="hot-deal-discount">{deal.discountLabel}</span>
        )}
        {deal.transport && <span className="hot-deal-transport">{deal.transport}</span>}
      </div>

      <div className="hot-deal-content">
        <p className="hot-deal-operator">{deal.operator}</p>
        <h3 className="hot-deal-route">
          <span>{deal.from}</span>
          <ArrowRight size={15} aria-hidden="true" />
          <span>{deal.to}</span>
        </h3>
        <div className="hot-deal-price">
          <span className="hot-deal-price-current">৳ {Number(deal.discountedPrice).toLocaleString("en-BD")}</span>
          <span className="hot-deal-price-original">৳ {Number(deal.originalPrice).toLocaleString("en-BD")}</span>
        </div>
        {deal.validity && (
          <p className="hot-deal-validity">
            {deal.validUntil ? <CalendarDays size={13} /> : <Clock3 size={13} />}
            {deal.validity}
          </p>
        )}
        <button
          className="hot-deal-book-button"
          type="button"
          onClick={() => onBookNow(deal)}
        >
          Book now <ArrowUpRight size={15} />
        </button>
      </div>
    </article>
  );
}

export default function HotDealsSection({ deals, onBookDeal }) {
  const carouselRef = useRef(null);
  const resumeTimerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  const liveDeals = Array.isArray(deals)
    ? deals.filter((deal) =>
        deal
        && typeof deal.id === "string"
        && typeof deal.operator === "string"
        && typeof deal.from === "string"
        && typeof deal.to === "string"
        && Number.isFinite(Number(deal.originalPrice))
        && Number.isFinite(Number(deal.discountedPrice))
        && Number(deal.originalPrice) > Number(deal.discountedPrice),
      )
    : [];

  useEffect(() => () => window.clearTimeout(resumeTimerRef.current), []);

  useEffect(() => {
    if (autoPaused || liveDeals.length < 2) return undefined;
    const timer = window.setInterval(() => {
      const carousel = carouselRef.current;
      if (!carousel) return;
      const maxScroll = carousel.scrollWidth - carousel.clientWidth;
      const nextLeft = carousel.scrollLeft + carousel.clientWidth * 0.78;
      carousel.scrollTo({
        left: nextLeft >= maxScroll - 8 ? 0 : nextLeft,
        behavior: "smooth",
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [autoPaused, liveDeals.length]);

  function pauseAfterInteraction() {
    setAutoPaused(true);
    window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => setAutoPaused(false), 5000);
  }

  function moveCarousel(direction) {
    const carousel = carouselRef.current;
    if (!carousel) return;
    pauseAfterInteraction();
    carousel.scrollBy({
      left: direction * carousel.clientWidth * 0.78,
      behavior: "smooth",
    });
  }

  function handleScroll() {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const card = carousel.querySelector(".hot-deal-card");
    if (!card) return;
    const gap = Number.parseFloat(window.getComputedStyle(carousel).columnGap) || 0;
    setActiveIndex(Math.round(carousel.scrollLeft / (card.offsetWidth + gap)));
  }

  return (
    <section className="hot-deals-section" aria-labelledby="hot-deals-title">
      <div className="hot-deals-heading">
        <div>
          <p className="hot-deals-eyebrow">A LITTLE MORE FOR YOUR JOURNEY</p>
          <h2 id="hot-deals-title">Hot Deals!</h2>
          <p>Explore exclusive travel offers and save more.</p>
        </div>
        {liveDeals.length > 0 && (
          <div className="hot-deals-controls" aria-label="Deal carousel controls">
            <button type="button" aria-label="Previous deals" onClick={() => moveCarousel(-1)}>
              <ArrowLeft size={17} />
            </button>
            <button type="button" aria-label="Next deals" onClick={() => moveCarousel(1)}>
              <ArrowRight size={17} />
            </button>
          </div>
        )}
      </div>

      {liveDeals.length ? (
        <>
          <div
            className="hot-deals-carousel"
            ref={carouselRef}
            onScroll={handleScroll}
            onPointerDown={pauseAfterInteraction}
            onTouchStart={pauseAfterInteraction}
            onWheel={pauseAfterInteraction}
            onKeyDown={pauseAfterInteraction}
            onMouseEnter={() => setAutoPaused(true)}
            onMouseLeave={() => {
              window.clearTimeout(resumeTimerRef.current);
              setAutoPaused(false);
            }}
            tabIndex={0}
            aria-label="Travel deals"
          >
            {liveDeals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onBookNow={onBookDeal}
              />
            ))}
          </div>
          <div className="hot-deals-pagination" aria-label={`Deal ${Math.min(activeIndex + 1, liveDeals.length)} of ${liveDeals.length}`}>
            {liveDeals.map((deal, index) => (
              <span className={index === activeIndex ? "active" : ""} key={deal.id} />
            ))}
          </div>
        </>
      ) : (
        <div className="hot-deals-empty" role="status">
          <span><Ticket size={19} /></span>
          <div>
            <strong>No live offers right now</strong>
            <p>New travel deals will appear here as soon as they are available.</p>
          </div>
        </div>
      )}
    </section>
  );
}
