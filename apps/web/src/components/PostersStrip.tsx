"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
    gradient: "from-yellow-500/50 via-amber-500/20 to-transparent",
    ctaHref: "/login?signup=1",
    ctaLabel: "Get Started Free",
  },
  {
    id: "default-2",
    title: "Earn Daily. Withdraw Weekly. 💸",
    subtitle: "Buy a plan and claim daily income. Referral commissions credited instantly.",
    imageUrl: null,
    gradient: "from-fuchsia-500/50 via-pink-500/20 to-transparent",
    ctaHref: "#plans",
    ctaLabel: "View Plans",
  },
  {
    id: "default-3",
    title: "3-Level Referral System 🤝",
    subtitle: "Earn 45% on first plan + 10%/5%/2% ongoing commissions across 3 levels.",
    imageUrl: null,
    gradient: "from-emerald-500/50 via-green-500/20 to-transparent",
    ctaHref: "/login?signup=1",
    ctaLabel: "Start Earning",
  },
];

const SLIDE_INTERVAL = 4500; // ms

export default function PostersStrip() {
  const [posters, setPosters] = useState<Poster[]>(FALLBACK_POSTERS);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/posters`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.posters) && data.posters.length > 0) {
          setPosters(data.posters);
          setIndex(0);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-advance
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (posters.length < 2) return;
    timerRef.current = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % posters.length);
    }, SLIDE_INTERVAL);
  };

  useEffect(() => {
    if (!paused) startTimer();
    else if (timerRef.current) clearInterval(timerRef.current);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, posters.length]);

  const goTo = (i: number) => {
    setDirection(i > index ? 1 : -1);
    setIndex(i);
    startTimer(); // reset timer on manual nav
  };

  const prev = () => {
    const i = (index - 1 + posters.length) % posters.length;
    setDirection(-1);
    setIndex(i);
    startTimer();
  };

  const next = () => {
    const i = (index + 1) % posters.length;
    setDirection(1);
    setIndex(i);
    startTimer();
  };

  if (!posters.length) return null;
  const cur = posters[index] ?? posters[0];

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  return (
    <section className="px-4 sm:px-6 pt-4 pb-2">
      <div className="mx-auto max-w-6xl"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40"
          style={{ height: "clamp(160px, 28vw, 280px)" }}>

          <AnimatePresence custom={direction} mode="wait" initial={false}>
            <motion.div
              key={cur.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
              className="absolute inset-0"
            >
              {/* Background */}
              {cur.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cur.imageUrl} alt={cur.title}
                  className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${cur.gradient}`} />
              )}

              {/* Dark overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />

              {/* Content */}
              <div className="relative z-10 flex h-full flex-col justify-center gap-2 p-6 sm:p-10 max-w-[75%]">
                <motion.h2
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-xl sm:text-3xl md:text-4xl font-bold text-white drop-shadow-md leading-tight"
                >
                  {cur.title}
                </motion.h2>
                {cur.subtitle && (
                  <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.18 }}
                    className="text-zinc-200 text-sm sm:text-base max-w-xl drop-shadow"
                  >
                    {cur.subtitle}
                  </motion.p>
                )}
                {cur.ctaHref && cur.ctaLabel && (
                  <motion.div
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="mt-1"
                  >
                    {cur.ctaHref.startsWith("http") ? (
                      <a href={cur.ctaHref} target="_blank" rel="noreferrer"
                        className="inline-flex items-center rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black shadow hover:brightness-95 transition">
                        {cur.ctaLabel}
                      </a>
                    ) : (
                      <Link href={cur.ctaHref}
                        className="inline-flex items-center rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black shadow hover:brightness-95 transition">
                        {cur.ctaLabel}
                      </Link>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Prev / Next arrows — only show when multiple posters */}
          {posters.length > 1 && (
            <>
              <button onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70 transition backdrop-blur-sm border border-white/10"
                aria-label="Previous slide">
                <ChevronLeft size={18} />
              </button>
              <button onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70 transition backdrop-blur-sm border border-white/10"
                aria-label="Next slide">
                <ChevronRight size={18} />
              </button>
            </>
          )}

          {/* Dot indicators */}
          {posters.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
              {posters.map((p, i) => (
                <button key={p.id} aria-label={`Slide ${i + 1}`} onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? "w-6 bg-yellow-300" : "w-1.5 bg-white/40 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Slide counter badge */}
          {posters.length > 1 && (
            <div className="absolute top-3 right-3 z-20 text-[10px] text-white/50 bg-black/30 rounded-full px-2 py-0.5 backdrop-blur-sm">
              {index + 1} / {posters.length}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
