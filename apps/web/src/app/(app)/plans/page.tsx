"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { api, API_URL, formatINR, getToken } from "@/lib/api";

// API returns snake_case — keep type consistent with what the server actually sends
type Plan = {
  id: string;
  name: string;
  price: number;
  daily_income: number;
  duration_days: number;
  total_return: number;
  active: boolean;
};

const FALLBACK_PLANS: Plan[] = [
  { id: "fallback-starter",  name: "Starter",  price: 500,   daily_income: 25,   duration_days: 30,  total_return: 750,   active: true },
  { id: "fallback-silver",   name: "Silver",   price: 2000,  daily_income: 110,  duration_days: 45,  total_return: 4950,  active: true },
  { id: "fallback-gold",     name: "Gold",     price: 5000,  daily_income: 320,  duration_days: 60,  total_return: 19200, active: true },
  { id: "fallback-vip",      name: "VIP Elite",price: 10000, daily_income: 700,  duration_days: 90,  total_return: 63000, active: true },
];

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [depositBal, setDepositBal] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [loadedReal, setLoadedReal] = useState(false);

  const load = useCallback(async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);

    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const results = await Promise.allSettled([
      fetch(`${API_URL}/plans`, { headers, cache: "no-store", signal: ctrl.signal })
        .then(async (res) => { clearTimeout(timer); if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); }),
      api<{ totals: { byType: Record<string, number> } }>("/me"),
    ]);

    if (results[0].status === "fulfilled") {
      const data = results[0].value;
      const list: Plan[] = data.plans ?? [];
      if (list.length > 0) {
        setPlans(list);
        setLoadedReal(true);
      }
    } else {
      clearTimeout(timer);
    }

    if (results[1].status === "fulfilled") {
      setDepositBal(Number(results[1].value.totals.byType["deposit"] ?? 0));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const buy = async (plan: Plan) => {
    setBusyId(plan.id);
    setToast(null);
    try {
      if (plan.id.startsWith("fallback-")) {
        setToast({ kind: "err", msg: "Plans load ho rahi hain — ek second ruko phir try karo." });
        setBusyId(null);
        load();
        return;
      }
      if (depositBal < plan.price) {
        setToast({ kind: "err", msg: `Balance kam hai. ${formatINR(plan.price - depositBal)} aur chahiye.` });
        setBusyId(null);
        return;
      }
      const r = await api<{ ok: boolean; isFirstPlan: boolean; commissions: any[] }>("/investments", {
        method: "POST",
        body: JSON.stringify({ planId: plan.id }),
      });
      const bonus = r.commissions?.length ? ` (Referral bonus credited!)` : "";
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

      {!loadedReal && (
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 text-xs text-yellow-200 flex items-center gap-2">
          <span className="animate-pulse">⏳</span> Real plans load ho rahi hain… (Render warm-up ~30s)
        </div>
      )}

      {toast && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${toast.kind === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-red-500/10 border-red-500/30 text-red-200"}`}>
          {toast.msg}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p, i) => {
          const enough = depositBal >= p.price;
          const isFallback = p.id.startsWith("fallback-");
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`glass rounded-3xl p-6 flex flex-col ${isFallback ? "opacity-70" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm uppercase tracking-widest text-zinc-300">{p.name}</div>
                {p.name.toLowerCase().includes("vip") && (
                  <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">Premium</span>
                )}
              </div>
              <div className="mt-2 text-3xl font-bold gold-text">{formatINR(p.price)}</div>
              <ul className="mt-4 space-y-2 text-sm text-zinc-300 flex-1">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-yellow-400 shrink-0" />
                  Daily Income
                  <span className="ml-auto text-white font-medium">{formatINR(p.daily_income)}</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-yellow-400 shrink-0" />
                  Duration
                  <span className="ml-auto text-white font-medium">{p.duration_days} days</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-yellow-400 shrink-0" />
                  Total Return
                  <span className="ml-auto text-white font-medium">{formatINR(p.total_return)}</span>
                </li>
                <li className="flex items-center gap-2 text-zinc-400">
                  <Sparkles size={14} className="text-yellow-400 shrink-0" />
                  Daily claim required
                </li>
              </ul>
              <button
                onClick={() => buy(p)}
                disabled={busyId === p.id}
                className={`mt-6 w-full rounded-xl py-2.5 font-semibold transition ${
                  isFallback
                    ? "bg-zinc-700 text-zinc-400 cursor-wait"
                    : enough
                    ? "bg-[var(--primary)] text-black hover:brightness-95"
                    : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
                } disabled:opacity-60`}
              >
                {busyId === p.id ? "Activating…" : isFallback ? "Loading…" : enough ? "Buy with Deposit Wallet" : "Insufficient — Top up first"}
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
