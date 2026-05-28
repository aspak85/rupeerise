"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type Poster = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  gradient: string;
  ctaHref?: string | null;
  ctaLabel?: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

const FALLBACK_POSTERS: Poster[] = [
  {
    id: "default-1",
    title: "Welcome to RupeeRise 🏆",
    subtitle: "India's most rewarding investment platform. Start earning daily from ₹500.",
    imageUrl: null,
    gradient: "from-yellow-500/40 via-amber-500/15 to-transparent",
    ctaHref: "/login?signup=1",
    ctaLabel: "Get Started Free",
  },
  {
    id: "default-2",
    title: "Earn Daily. Withdraw Weekly.",
    subtitle: "Buy a plan and claim daily income. Referral commissions credited instantly.",
    imageUrl: null,
    gradient: "from-fuchsia-500/40 via-pink-500/15 to-transparent",
    ctaHref: "#plans",
    ctaLabel: "View Plans",
  },
];

/**
 * Top-of-page promotional carousel. Auto-swipes every 5 seconds, pause on
 * hover, dot indicators + arrow controls. Slides come from the admin-managed
 * /posters endpoint so marketing copy can change without code deploys.
 * Falls back to built-in default posters when admin hasn't added any yet.
 */
export default function PostersStrip() {
  const [posters, setPosters] = useState<Poster[]>(FALLBACK_POSTERS);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/posters`, { cache: "no-store" });
        const data = await r.json();
        if (Array.isArray(data?.posters) && data.posters.length) setPosters(data.posters);
        // else keep FALLBACK_POSTERS
      } catch {
        /* ignore — fallback posters stay visible */
      }
    })();
  }, []);

  // Auto-swipe every 5s, paused while user hovers.
  useEffect(() => {
    if (hovered || posters.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % posters.length), 5000);
    return () => clearInterval(id);
  }, [hovered, posters.length]);

  if (!posters.length) return null;
  const cur = posters[index] || posters[0];
  return (
    <section className="px-4 sm:px-6 pt-4 pb-2">
      <div
        className="mx-auto max-w-6xl"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 h-[180px] sm:h-[230px] md:h-[270px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={cur.id}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0"
            >
              {cur.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={cur.imageUrl}
                  alt={cur.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${cur.gradient}`} />
              )}
              {/* readability overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
              <div className="relative z-10 flex h-full flex-col justify-center gap-2 p-6 sm:p-10 max-w-[80%]">
                <h2 className="text-xl sm:text-3xl md:text-4xl font-bold text-white drop-shadow">
                  {cur.title}
                </h2>
                {cur.subtitle && (
                  <p className="text-zinc-200 text-sm sm:text-base max-w-xl drop-shadow">
                    {cur.subtitle}
                  </p>
                )}
                {cur.ctaHref && cur.ctaLabel && (
                  cur.ctaHref.startsWith("http") ? (
                    <a
                      href={cur.ctaHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex w-fit items-center rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black shadow hover:brightness-95"
                    >
                      {cur.ctaLabel}
                    </a>
                  ) : (
                    <Link
                      href={cur.ctaHref}
                      className="mt-2 inline-flex w-fit items-center rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black shadow hover:brightness-95"
                    >
                      {cur.ctaLabel}
                    </Link>
                  )
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* dot indicators */}
          {posters.length > 1 && (
            <div className="absolute bottom-3 right-4 z-20 flex gap-1.5">
              {posters.map((p, i) => (
                <button
                  key={p.id}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-6 bg-yellow-300" : "w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
