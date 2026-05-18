"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Gift, History, Loader2, Sparkles, Ticket } from "lucide-react";
import { api, formatINR } from "@/lib/api";

type Claim = {
  id: string;
  code: string;
  amount: number;
  notes: string | null;
  claimedAt: string;
};

export default function RedeemPage() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ code: string; amount: number } | null>(null);
  const [history, setHistory] = useState<Claim[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const r = await api<{ claims: Claim[] }>("/redeem/history");
      setHistory(r.claims);
    } catch {} finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length < 4) {
      setError("Enter a valid gift code");
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; amount: number; code: string; message: string }>("/redeem", {
        method: "POST",
        body: JSON.stringify({ code: cleaned }),
      });
      if (!r.ok) {
        // The backend returns 400 with { ok:false }, which throws inside `api()`.
        // This branch is defensive in case shape changes.
        setError(r.message || "Could not redeem this code");
        return;
      }
      setSuccess({ code: r.code, amount: r.amount });
      setCode("");
      loadHistory();
      // Auto-dismiss the celebration overlay after 5 seconds.
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      setError(e?.message || "Could not redeem this code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto w-full">
      <div className="text-center pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-300 text-xs uppercase tracking-widest">
          <Sparkles size={12} /> Bonus rewards
        </div>
        <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Redeem a <span className="gold-text">Gift Code</span>
        </h1>
        <p className="mt-2 text-sm text-zinc-300 max-w-lg mx-auto">
          Got a code from our Telegram channel, an admin, or a campaign? Drop it in below — the bonus
          credits to your wallet instantly.
        </p>
      </div>

      {/* Hero card with input */}
      <form onSubmit={submit} className="relative">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-yellow-500/30 via-amber-400/40 to-yellow-500/30 blur-xl opacity-60" aria-hidden />
        <div className="relative glass rounded-3xl p-6 sm:p-8 border border-yellow-500/30">
          <div className="flex items-center gap-3 text-white mb-5">
            <div className="rounded-xl bg-yellow-500/15 border border-yellow-500/30 p-2.5">
              <Ticket className="text-yellow-300" size={22} />
            </div>
            <div>
              <div className="font-semibold text-lg">Enter your code</div>
              <div className="text-xs text-zinc-400">Codes are 4–32 characters: letters, numbers, dashes</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              ref={inputRef}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DIWALI-ABCD1234"
              className="font-mono text-lg sm:text-xl tracking-wider text-center sm:text-left rounded-2xl bg-black/40 border border-yellow-500/30 text-white px-5 py-4 outline-none focus:border-yellow-400 placeholder:text-zinc-600 placeholder:font-normal placeholder:tracking-widest"
            />
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="rounded-2xl bg-[var(--primary)] px-6 py-4 font-semibold text-black hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} />}
              <span>{busy ? "Redeeming…" : "Redeem now"}</span>
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
      </form>

      {/* How it works */}
      <div className="grid gap-3 sm:grid-cols-3">
        <InfoBlock icon="🎁" title="Instant credit" text="Amount lands in your Bonus Wallet right away." />
        <InfoBlock icon="📢" title="Follow our channels" text="We drop free codes regularly on Telegram." />
        <InfoBlock icon="🛡️" title="Safe & one-time" text="Each code can only be redeemed once per account." />
      </div>

      {/* History */}
      <section className="glass rounded-2xl">
        <div className="px-5 py-3 border-b border-yellow-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <History size={16} className="text-yellow-300" />
            <span className="font-semibold text-sm">Your redemption history</span>
          </div>
          {historyLoading && <Loader2 size={14} className="text-yellow-300 animate-spin" />}
        </div>
        {history.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-400">
            No redemptions yet. Try your first code above!
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {history.map((c) => (
              <li key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-yellow-200 text-sm">{c.code}</div>
                  {c.notes && <div className="text-xs text-zinc-500 truncate">{c.notes}</div>}
                  <div className="text-xs text-zinc-500">{new Date(c.claimedAt).toLocaleString()}</div>
                </div>
                <div className="text-emerald-300 font-semibold">+{formatINR(c.amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Success overlay */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSuccess(null)}
          >
            <motion.div
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.7, y: 30 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="relative max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Confetti />
              <div className="relative glass rounded-3xl p-8 text-center border border-yellow-500/40 shadow-2xl">
                <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center">
                  <CheckCircle2 className="text-yellow-300" size={36} />
                </div>
                <div className="mt-4 text-yellow-300 text-xs uppercase tracking-widest">You won!</div>
                <div className="mt-1 text-5xl font-bold gold-text">{formatINR(success.amount)}</div>
                <div className="mt-2 text-sm text-zinc-300">credited to your <span className="text-yellow-200 font-semibold">Bonus Wallet</span></div>
                <div className="mt-1 font-mono text-xs text-zinc-500">{success.code}</div>
                <button
                  onClick={() => setSuccess(null)}
                  className="mt-6 rounded-xl bg-[var(--primary)] px-5 py-2.5 font-semibold text-black hover:brightness-95"
                >
                  Awesome!
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoBlock({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 text-white font-semibold text-sm">{title}</div>
      <div className="mt-1 text-xs text-zinc-400">{text}</div>
    </div>
  );
}

/** Tiny CSS-only confetti burst behind the success card. */
function Confetti() {
  const pieces = Array.from({ length: 28 });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const size = 6 + Math.random() * 6;
        const dur = 1.5 + Math.random() * 1.5;
        const delay = Math.random() * 0.4;
        const colors = ["#FFD700", "#FFB800", "#FFFFFF", "#22C55E"];
        const bg = colors[i % colors.length];
        return (
          <motion.div
            key={i}
            initial={{ y: -40, x: 0, rotate: 0, opacity: 0 }}
            animate={{ y: 320, x: (Math.random() - 0.5) * 80, rotate: 360, opacity: [0, 1, 1, 0] }}
            transition={{ duration: dur, delay, ease: "easeOut" }}
            style={{
              position: "absolute",
              top: -10,
              left: `${left}%`,
              width: size,
              height: size,
              background: bg,
              borderRadius: 2,
            }}
          />
        );
      })}
    </div>
  );
}
