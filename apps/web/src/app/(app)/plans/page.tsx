"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { api, API_URL, formatINR, getToken } from "@/lib/api";

type Plan = {
  id: string;
  name: string;
  price: number;
  daily_income: number;
  duration_days: number;
  total_return: number;
  active: boolean;
};

/**
 * Hardcoded fallback so the page is interactive instantly even when the Render
 * API is in cold-start. These mirror the canonical tiers seeded server-side; if
 * the live API responds within the 3s budget we replace them with real data.
 */
const FALLBACK_PLANS: Plan[] = [
  { id: "fallback-starter", name: "Starter", price: 500, daily_income: 50, duration_days: 30, total_return: 1500, active: true },
  { id: "fallback-bronze", name: "Bronze", price: 2000, daily_income: 220, duration_days: 30, total_return: 6600, active: true },
  { id: "fallback-silver", name: "Silver", price: 5000, daily_income: 575, duration_days: 30, total_return: 17250, active: true },
  { id: "fallback-gold-vip", name: "Gold VIP", price: 10000, daily_income: 1200, duration_days: 30, total_return: 36000, active: true },
];

export default function PlansPage() {
  // Seed with fallback so the grid renders on first paint.
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [depositBal, setDepositBal] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = useCallback(async () => {
    // Abort the /plans request after 3s so cold-start latency never blocks the UI.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);

    // Hand-rolled fetch (instead of api()) so we can pipe the AbortSignal through.
    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const plansPromise: Promise<{ plans: Plan[] }> = fetch(`${API_URL}/plans`, {
      headers,
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .finally(() => clearTimeout(timer));

    const results = await Promise.allSettled([
      plansPromise,
      api<{ totals: { byType: Record<string, number> } }>("/me"),
    ]);

    if (results[0].status === "fulfilled" && Array.isArray(results[0].value.plans) && results[0].value.plans.length > 0) {
      setPlans(results[0].value.plans);
    } else if (results[0].status === "rejected") {
      // Keep fallback plans visible; this is the cold-start / offline path.
      console.warn("Plans API unavailable, using fallback:", (results[0].reason as Error)?.message);
    }
    if (results[1].status === "fulfilled") {
      setDepositBal(Number(results[1].value.totals.byType["deposit"] ?? 0));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buy = async (plan: Plan) => {
    setBusyId(plan.id);
    setToast(null);
    try {
      // Fallback plan IDs aren't valid server-side. Force a refresh first.
      if (plan.id.startsWith("fallback-")) {
        setToast({ kind: "err", msg: "Plan list is still loading — please wait a moment and try again." });
        setBusyId(null);
        await load();
        return;
      }
      if (depositBal < plan.price) {
        setToast({ kind: "err", msg: `Insufficient deposit balance. You need ${formatINR(plan.price - depositBal)} more.` });
        setBusyId(null);
        return;
      }
      const r = await api<{ ok: boolean; isFirstPlan: boolean; commissions: any[] }>("/investments", {
        method: "POST",
        body: JSON.stringify({ planId: plan.id }),
      });
      const bonus = r.commissions?.length ? ` (Referral bonuses paid: ${r.commissions.length})` : "";
      setToast({ kind: "ok", msg: `${plan.name} activated!${bonus}` });
      await load();
    } catch (e: any) {
      setToast({ kind: "err", msg: e?.message || "Purchase failed" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Investment Plans</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Pick your earning tier</h1>
          <p className="text-sm text-zinc-300 mt-1">All plans pay daily. Claim every 24 hours and watch it stack.</p>
        </div>
        <div className="rounded-xl glass px-4 py-3">
          <div className="text-xs text-zinc-400">Deposit Wallet</div>
          <div className="text-lg font-semibold text-white">{formatINR(depositBal)}</div>
          <Link href="/wallet" className="text-xs text-yellow-300/90 hover:underline">Add funds →</Link>
        </div>
      </div>

      {toast && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${toast.kind === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-red-500/10 border-red-500/30 text-red-200"}`}>
          {toast.msg}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p, i) => {
          const enough = depositBal >= p.price;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-3xl p-6 flex flex-col"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm uppercase tracking-widest text-zinc-300">{p.name}</div>
                {p.name.toLowerCase().includes("vip") && (
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">Premium</span>
                )}
              </div>
              <div className="mt-2 text-3xl font-bold gold-text">{formatINR(p.price)}</div>
              <ul className="mt-4 space-y-2 text-sm text-zinc-300 flex-1">
                <li className="flex items-center gap-2"><Check size={14} className="text-yellow-400" /> Daily Income <span className="ml-auto text-white font-medium">{formatINR(p.daily_income)}</span></li>
                <li className="flex items-center gap-2"><Check size={14} className="text-yellow-400" /> Duration <span className="ml-auto text-white font-medium">{p.duration_days} days</span></li>
                <li className="flex items-center gap-2"><Check size={14} className="text-yellow-400" /> Total Return <span className="ml-auto text-white font-medium">{p.total_return ? formatINR(p.total_return) : "—"}</span></li>
                <li className="flex items-center gap-2 text-zinc-400"><Sparkles size={14} className="text-yellow-400" /> Daily claim required</li>
              </ul>
              <button
                onClick={() => buy(p)}
                disabled={busyId === p.id}
                className={`mt-6 w-full rounded-xl py-2.5 font-semibold transition ${enough ? "bg-[var(--primary)] text-black hover:brightness-95" : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"} disabled:opacity-60`}
              >
                {busyId === p.id ? "Activating…" : enough ? "Buy with Deposit Wallet" : "Insufficient — Top up first"}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
