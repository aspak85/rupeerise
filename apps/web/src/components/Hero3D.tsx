"use client";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Zap, IndianRupee, BadgeCheck } from "lucide-react";
import Link from "next/link";
import { MouseEvent, useEffect, useRef, useState } from "react";

/**
 * Premium 3D-tilt hero. Cursor-driven rotateX/rotateY on the card,
 * floating reward chips, animated grid background, gold accents.
 */
export default function Hero3D() {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  // Disable 3D tilt + spring physics on touch devices and small screens.
  // Touch users can't aim a mouse anyway, and the spring math was the
  // single biggest GPU/CPU hog on low-end Android, causing scroll jank.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  // smooth springs
  const sx = useSpring(mx, { stiffness: 100, damping: 12 });
  const sy = useSpring(my, { stiffness: 100, damping: 12 });

  const rotateX = useTransform(sy, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-12, 12]);

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDesktop) return; // skip on mobile/touch — saves CPU
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mx.set(x);
    my.set(y);
  };
  const handleMouseLeave = () => { mx.set(0); my.set(0); };

  return (
    <section className="relative isolate overflow-hidden px-6 pt-12 pb-16 sm:pt-16 sm:pb-20" style={{ perspective: 1400 }}>
      {/* Animated background glows */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-20 w-[36rem] h-[36rem] rounded-full bg-yellow-500/20 blur-[120px] animate-pulse-slow" />
        <div className="absolute -bottom-32 -right-20 w-[32rem] h-[32rem] rounded-full bg-fuchsia-500/15 blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#000_75%)]" />
        {/* Subtle gridlines */}
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(0deg,rgba(255,215,0,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,215,0,0.6)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="mx-auto max-w-6xl grid items-center gap-10 lg:grid-cols-2">
        {/* Left: copy */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs gold-text">
            <Sparkles size={12} /> India's most-rewarding earning platform
          </div>
          <h1 className="mt-5 text-[clamp(2.25rem,5vw,4rem)] font-bold leading-[1.05] tracking-tight text-white">
            Earn daily.<br />
            Withdraw weekly.<br />
            <span className="gold-text">Grow with referrals.</span>
          </h1>
          <p className="mt-5 max-w-xl text-zinc-300 text-base sm:text-lg">
            RupeeRise turns your investment into a luxury daily-reward experience —
            <span className="text-yellow-200"> spins, scratches, multi-level commissions,</span>
            and one-click instant payouts via Razorpay.
          </p>

          {/* CTAs */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/login?signup=1" className="group inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 font-semibold text-black hover:brightness-95 shadow-[0_8px_30px_-8px_rgba(250,204,21,0.55)] transition">
              Get Started
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="#plans" className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/30 px-5 py-3 font-medium text-zinc-100 hover:bg-yellow-500/10 transition">
              View Plans
            </Link>
          </div>

          {/* Trust strip */}
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-yellow-300" /> 256-bit SSL</span>
            <span className="inline-flex items-center gap-1.5"><Zap size={14} className="text-yellow-300" /> Instant Razorpay</span>
            <span className="inline-flex items-center gap-1.5"><BadgeCheck size={14} className="text-yellow-300" /> KYC Verified</span>
            <span className="inline-flex items-center gap-1.5"><IndianRupee size={14} className="text-yellow-300" /> INR Native</span>
          </div>
        </motion.div>

        {/* Right: 3D tilt card — only enables expensive transforms on desktop */}
        <motion.div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={isDesktop ? { rotateX, rotateY, transformStyle: "preserve-3d" } : undefined}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative mx-auto w-full max-w-md will-change-transform"
        >
          <div className="relative rounded-3xl border border-yellow-500/30 bg-gradient-to-br from-[#1a1305] via-black to-[#1a0e1d] p-6 sm:p-8 shadow-[0_30px_80px_-20px_rgba(255,215,0,0.35)]">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-yellow-500/15 blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-widest text-yellow-400/80">VIP Wallet</div>
              <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-1 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </div>
            </div>
            <div className="mt-3 text-5xl font-bold gold-text">
              ₹1,28,540
            </div>
            <div className="mt-1 text-xs text-zinc-400">+ ₹3,200 earned today</div>

            {/* Mini bars */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Mini label="Daily" value="₹3.2k" tone="gold" />
              <Mini label="Refers" value="₹18k" tone="violet" />
              <Mini label="Bonus" value="₹1.4k" tone="emerald" />
            </div>

            {/* Spinning halo */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <FloatChip icon="🎡" label="Spin" sub="Won ₹50" />
              <FloatChip icon="💎" label="Scratch" sub="Won ₹120" />
              <FloatChip icon="🚀" label="VIP" sub="Gold tier" />
              <FloatChip icon="🎁" label="Referral" sub="+₹450" />
            </div>

            {/* Coin sticker — floating animation only on desktop to keep mobile smooth */}
            <motion.div
              animate={isDesktop ? { y: [0, -8, 0] } : undefined}
              transition={isDesktop ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : undefined}
              className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-amber-600 shadow-[0_10px_30px_rgba(255,215,0,0.4)] grid place-items-center text-3xl"
              style={isDesktop ? { transform: "translateZ(60px)" } : undefined}
              aria-hidden
            >
              💰
            </motion.div>
          </div>
        </motion.div>
      </div>

      <style jsx global>{`
        @keyframes rr-pulse-slow {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.05); }
        }
        .animate-pulse-slow { animation: rr-pulse-slow 6s ease-in-out infinite; }
      `}</style>
    </section>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone: "gold" | "violet" | "emerald" }) {
  const toneMap = {
    gold: "from-yellow-500/30 to-yellow-500/5 text-yellow-100",
    violet: "from-fuchsia-500/30 to-fuchsia-500/5 text-fuchsia-100",
    emerald: "from-emerald-500/30 to-emerald-500/5 text-emerald-100",
  };
  return (
    <div className={`rounded-xl border border-white/10 bg-gradient-to-br ${toneMap[tone]} p-3`}>
      <div className="text-[10px] uppercase tracking-widest text-zinc-400">{label}</div>
      <div className="mt-0.5 font-bold">{value}</div>
    </div>
  );
}

function FloatChip({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/40 p-2.5">
      <div className="text-2xl">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-white">{label}</div>
        <div className="text-[11px] text-zinc-400 truncate">{sub}</div>
      </div>
    </div>
  );
}
