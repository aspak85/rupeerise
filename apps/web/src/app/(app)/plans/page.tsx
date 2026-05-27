"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { api, formatINR } from "@/lib/api";

type Plan = {
  id: string;
  name: string;
  price: number;
  daily_income: number;
  duration_days: number;
  total_return: number;
  active: boolean;
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [depositBal, setDepositBal] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Use Promise.allSettled to prevent one slow request from blocking the other
      const results = await Promise.allSettled([
        api<{ plans: Plan[] }>("/plans"),
        api<{ totals: { byType: Record<string, number> } }>("/me"),
      ]);
      
      if (results[0].status === "fulfilled") {
        setPlans(results[0].value.plans);
      }
      if (results[1].status === "fulfilled") {
        setDepositBal(Number(results[1].value.totals.byType["deposit"] ?? 0));
      }
    } catch (err) {
      console.error("Failed to load plans:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buy = async (plan: Plan) => {
    setBusyId(plan.id);
    setToast(null);
    try {
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

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass rounded-3xl p-6 animate-pulse">
              <div className="h-4 w-32 bg-zinc-700 rounded mb-2" />
              <div className="h-8 w-24 bg-zinc-700 rounded my-2" />
              <div className="space-y-2">
                <div className="h-3 bg-zinc-700 rounded w-full" />
                <div className="h-3 bg-zinc-700 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : (
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
                  <li className="flex items-center gap-2"><Check size={14} className="text-yellow-400" /> Total Return <span className="ml-auto text-white font-medium">{formatINR(p.total_return)}</span></li>
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
      )}
    </div>
  );
}
