"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Sparkles, Trophy, Zap } from "lucide-react";
import { api, API_URL, formatINR, getToken } from "@/lib/api";

// Alternating gold/dark segments — works with any prize count the admin chooses.
function segColor(i: number) { return i % 2 === 0 ? "#FFD700" : "#0F172A"; }

type Status = {
  dayKey: string;
  msUntilNext: number;
  spin: { enabled: boolean; available: boolean; claimedAmount: number; prizes: number[] };
  scratch: { enabled: boolean; available: boolean; claimedAmount: number; maxPrize: number };
};

/**
 * Optimistic default state — shown instantly on first render so the spin wheel
 * and scratch card are interactive before /rewards/status responds. If the API
 * later says the user already claimed today, we swap in the real numbers.
 */
const DEFAULT_STATUS: Status = {
  dayKey: "",
  msUntilNext: 0,
  spin: { enabled: true, available: true, claimedAmount: 0, prizes: [5, 10, 15, 20, 25, 35, 50, 100] },
  scratch: { enabled: true, available: true, claimedAmount: 0, maxPrize: 200 },
};

export default function RewardsPage() {
  const [status, setStatus] = useState<Status>(DEFAULT_STATUS);
  const [toast, setToast] = useState<{ kind: "spin" | "scratch"; amount: number } | null>(null);

  const load = useCallback(async () => {
    // 3s budget for /rewards/status — UI is already mounted with DEFAULT_STATUS.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    try {
      const token = getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/rewards/status`, {
        headers,
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const s = (await res.json()) as Status;
      setStatus(s);
    } catch (e) {
      // Cold start / network blip — keep optimistic defaults so the games stay playable.
      console.warn("Rewards status unavailable, using defaults:", (e as Error)?.message);
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div>
        <div className="text-xs uppercase tracking-widest text-yellow-400/80">Daily Rewards</div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Spin, scratch & win every day</h1>
        <p className="mt-1 text-sm text-zinc-300">
          Free daily prizes credited directly to your <span className="gold-text font-semibold">Bonus Wallet</span>.
          Resets at midnight IST.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {status.spin.enabled && (
          <SpinWheel
            available={status.spin.available}
            claimed={status.spin.claimedAmount}
            prizes={status.spin.prizes}
            onWin={(amount) => {
              setToast({ kind: "spin", amount });
              load();
            }}
          />
        )}
        {status.scratch.enabled && (
          <ScratchCard
            available={status.scratch.available}
            claimed={status.scratch.claimedAmount}
            maxPrize={status.scratch.maxPrize}
            onWin={(amount) => {
              setToast({ kind: "scratch", amount });
              load();
            }}
          />
        )}
        {!status.spin.enabled && !status.scratch.enabled && (
          <div className="md:col-span-2 glass rounded-2xl p-8 text-center text-sm text-zinc-400">
            Daily rewards are temporarily paused. Check back soon!
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 text-white">
          <Trophy size={18} className="text-yellow-300" />
          <h3 className="font-semibold">How it works</h3>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-zinc-300">
          <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> Both games reset every day at <strong>00:00 IST</strong> — play once daily on each.</li>
          <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> Prizes are credited instantly to your Bonus Wallet and count toward weekly withdrawal.</li>
          <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> VIP plans unlock <strong>2× spin amount</strong> + a guaranteed scratch card minimum (coming soon).</li>
        </ul>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 glass rounded-2xl px-5 py-4 border-yellow-500/40 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="text-yellow-300" size={24} />
              <div>
                <div className="text-yellow-300 text-xs uppercase tracking-widest">You won!</div>
                <div className="text-white font-semibold">{formatINR(toast.amount)}</div>
                <div className="text-xs text-zinc-400">Credited to Bonus Wallet</div>
              </div>
              <button onClick={() => setToast(null)} className="ml-2 text-zinc-400 hover:text-white">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────── Spin Wheel ───────────── */
function SpinWheel({
  available,
  claimed,
  prizes,
  onWin,
}: {
  available: boolean;
  claimed: number;
  prizes: number[];
  onWin: (amount: number) => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const radius = 130;
  const cx = 150;
  const cy = 150;
  const segCount = prizes.length;
  const segAngle = 360 / segCount;

  const handleSpin = async () => {
    if (spinning || !available) return;
    setError(null);
    setSpinning(true);
    // Kick the wheel into motion immediately for snappy UX, then reconcile when
    // the API tells us the real prize index.
    const optimisticTarget = 360 * 6;
    setRotation((prev) => prev + optimisticTarget);
    try {
      const r = await api<{ alreadyClaimed: boolean; amount: number; index: number }>(
        "/rewards/spin",
        { method: "POST" }
      );
      if (r.alreadyClaimed) {
        setError("Already claimed today");
        setSpinning(false);
        return;
      }
      // Adjust the final landing so the pointer (top, 12 o'clock) lands on the
      // returned prize segment. Each segment is centered at i * segAngle + segAngle/2 starting at -90°.
      const correction = -(r.index * segAngle + segAngle / 2);
      // We add only the correction here because optimisticTarget already advanced rotation.
      setRotation((prev) => prev + correction);
      setTimeout(() => {
        setSpinning(false);
        onWin(r.amount);
      }, 4200);
    } catch (e: any) {
      setSpinning(false);
      setError(e?.message || "Spin failed");
    }
  };

  return (
    <div className="glass rounded-3xl p-6 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-white">
          <Zap size={18} className="text-yellow-300" />
          <h3 className="font-semibold">Spin & Win</h3>
        </div>
        <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${available ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-400"}`}>
          {available ? "Ready" : "Claimed today"}
        </span>
      </div>

      <div className="relative" style={{ width: 300, height: 320 }}>
        {/* Pointer */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10">
          <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-b-[20px] border-l-transparent border-r-transparent border-b-yellow-400 drop-shadow-[0_2px_6px_rgba(255,215,0,0.6)]" />
        </div>

        <motion.svg
          width="300"
          height="300"
          viewBox="0 0 300 300"
          animate={{ rotate: rotation }}
          transition={{ duration: 4, ease: [0.17, 0.67, 0.21, 0.99] }}
          className="drop-shadow-[0_0_30px_rgba(255,215,0,0.25)]"
        >
          <circle cx={cx} cy={cy} r={radius + 6} fill="#0a0a0a" stroke="#FFD700" strokeWidth="2" />
          {prizes.map((prize, i) => {
            const startAngle = i * segAngle - 90;
            const endAngle = startAngle + segAngle;
            const sX = cx + radius * Math.cos((Math.PI * startAngle) / 180);
            const sY = cy + radius * Math.sin((Math.PI * startAngle) / 180);
            const eX = cx + radius * Math.cos((Math.PI * endAngle) / 180);
            const eY = cy + radius * Math.sin((Math.PI * endAngle) / 180);
            const largeArc = segAngle > 180 ? 1 : 0;
            const d = `M ${cx} ${cy} L ${sX} ${sY} A ${radius} ${radius} 0 ${largeArc} 1 ${eX} ${eY} Z`;
            const textAngle = startAngle + segAngle / 2;
            const tX = cx + (radius * 0.65) * Math.cos((Math.PI * textAngle) / 180);
            const tY = cy + (radius * 0.65) * Math.sin((Math.PI * textAngle) / 180);
            const fill = segColor(i);
            const textColor = fill === "#FFD700" ? "#0F172A" : "#FFD700";
            return (
              <g key={i}>
                <path d={d} fill={fill} stroke="#0F172A" strokeWidth="1" />
                <text
                  x={tX}
                  y={tY}
                  fill={textColor}
                  fontSize="16"
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${textAngle + 90}, ${tX}, ${tY})`}
                >
                  ₹{prize}
                </text>
              </g>
            );
          })}
          {/* Hub */}
          <circle cx={cx} cy={cy} r="20" fill="#0F172A" stroke="#FFD700" strokeWidth="2" />
          <circle cx={cx} cy={cy} r="6" fill="#FFD700" />
        </motion.svg>
      </div>

      <button
        onClick={handleSpin}
        disabled={!available || spinning}
        className="mt-6 w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-black hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {spinning ? "Spinning…" : available ? "Spin Now (Free)" : `Already won ${formatINR(claimed)} today`}
      </button>
      {error && <div className="mt-3 text-xs text-red-300">{error}</div>}
    </div>
  );
}

/* ───────────── Scratch Card ───────────── */
function ScratchCard({
  available,
  claimed,
  maxPrize,
  onWin,
}: {
  available: boolean;
  claimed: number;
  maxPrize: number;
  onWin: (amount: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [prize, setPrize] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const isDrawing = useRef(false);
  const scratchPct = useRef(0);

  // Paint the gold overlay as soon as the canvas mounts. Using requestAnimationFrame
  // ensures we wait for layout before reading width/height — fixes the "blank card"
  // issue where the canvas was painted before its DOM size was finalised.
  useEffect(() => {
    if (!available || revealed) return;
    let raf = 0;
    const paint = () => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const gradient = ctx.createLinearGradient(0, 0, c.width, c.height);
      gradient.addColorStop(0, "#FFD700");
      gradient.addColorStop(0.5, "#FFB800");
      gradient.addColorStop(1, "#FFD700");
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Scratch to reveal", c.width / 2, c.height / 2 - 8);
      ctx.font = "12px sans-serif";
      ctx.fillText(`Win up to ${formatINR(maxPrize)}`, c.width / 2, c.height / 2 + 14);
      setCanvasReady(true);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [available, revealed, maxPrize]);

  const requestPrize = async () => {
    if (prize !== null || !available) return;
    setError(null);
    try {
      const r = await api<{ alreadyClaimed: boolean; amount: number }>("/rewards/scratch", { method: "POST" });
      if (r.alreadyClaimed) {
        setError("Already claimed today");
        return;
      }
      setPrize(r.amount);
    } catch (e: any) {
      setError(e?.message || "Scratch failed");
    }
  };

  const scratchAt = (clientX: number, clientY: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const x = (clientX - rect.left) * (c.width / rect.width);
    const y = (clientY - rect.top) * (c.height / rect.height);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    scratchPct.current += 0.01;
    if (scratchPct.current > 0.35 && !revealed) {
      setRevealed(true);
      // clear remaining
      ctx.clearRect(0, 0, c.width, c.height);
      if (prize !== null) onWin(prize);
    }
  };

  const handleStart = async (e: React.MouseEvent | React.TouchEvent) => {
    if (!available || revealed) return;
    if (prize === null) await requestPrize();
    isDrawing.current = true;
    const ev = "touches" in e ? e.touches[0] : e;
    scratchAt(ev.clientX, ev.clientY);
  };
  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const ev = "touches" in e ? e.touches[0] : e;
    scratchAt(ev.clientX, ev.clientY);
  };
  const handleEnd = () => {
    isDrawing.current = false;
  };

  return (
    <div className="glass rounded-3xl p-6">
      <div className="w-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-white">
          <Gift size={18} className="text-yellow-300" />
          <h3 className="font-semibold">Scratch Card</h3>
        </div>
        <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${available ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-400"}`}>
          {available ? "Ready" : "Claimed today"}
        </span>
      </div>

      <div className="relative mx-auto rounded-2xl overflow-hidden" style={{ width: 280, height: 200, background: "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,215,0,0.04))", border: "1px solid rgba(255,215,0,0.3)" }}>
        {/* Prize layer (behind canvas) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-yellow-300 text-xs uppercase tracking-widest">You won</div>
          <div className="gold-text text-4xl font-bold mt-1">{prize !== null ? formatINR(prize) : "—"}</div>
          <div className="text-xs text-zinc-400 mt-1">Bonus Wallet credited</div>
        </div>
        {/* Static gold placeholder until the canvas paints — guarantees a gold overlay on first paint
            even if the canvas's useEffect hasn't run yet (e.g. very low-end devices). */}
        {available && !revealed && !canvasReady && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: "linear-gradient(135deg, #FFD700, #FFB800, #FFD700)" }}
          >
            <div className="text-slate-900 font-bold text-lg">Scratch to reveal</div>
            <div className="text-slate-900 text-xs mt-1">Win up to {formatINR(maxPrize)}</div>
          </div>
        )}
        {available && !revealed && (
          <canvas
            ref={canvasRef}
            width={280}
            height={200}
            className="absolute inset-0 cursor-crosshair touch-none"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        )}
        {!available && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
            <Sparkles className="text-yellow-300" size={28} />
            <div className="text-white mt-2 text-sm">Already won {formatINR(claimed)}</div>
            <div className="text-xs text-zinc-400">Come back tomorrow</div>
          </div>
        )}
      </div>

      <button
        onClick={requestPrize}
        disabled={!available || prize !== null}
        className="mt-6 w-full rounded-xl border border-yellow-500/30 py-3 font-semibold text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {!available ? `Already won ${formatINR(claimed)}` : prize !== null ? "Scratch the card above!" : "Reveal Prize"}
      </button>
      {error && <div className="mt-3 text-xs text-red-300">{error}</div>}
    </div>
  );
}
