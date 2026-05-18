"use client";
import { useState } from "react";
import PlanModal, { type Plan } from "@/components/PlanModal";
import Reveal from "@/components/Reveal";
import { Crown, Sparkles, TrendingUp, Zap } from "lucide-react";

const PLAN_META: Record<string, { tone: string; icon: any; badge?: string }> = {
  Starter:     { tone: "from-zinc-500/20 to-zinc-700/10 border-zinc-500/30",                icon: Sparkles },
  Silver:      { tone: "from-slate-300/15 to-slate-500/5 border-slate-400/30",              icon: TrendingUp },
  Gold:        { tone: "from-yellow-500/25 to-amber-700/10 border-yellow-500/40",           icon: TrendingUp, badge: "Popular" },
  "VIP Elite": { tone: "from-yellow-500/30 to-fuchsia-500/10 border-yellow-500/50",         icon: Crown, badge: "Best Value" },
  "Elite Pro": { tone: "from-orange-500/25 to-yellow-500/10 border-orange-500/40",          icon: Zap, badge: "9.6× ROI" },
  Tycoon:      { tone: "from-fuchsia-500/30 to-pink-500/10 border-fuchsia-500/40",          icon: Crown, badge: "12× ROI" },
  Emperor:     { tone: "from-amber-500/30 via-yellow-500/20 to-rose-500/10 border-amber-500/50", icon: Crown, badge: "15× ROI 🔥" },
};

export default function PlansGrid({ plans }: { plans: Plan[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Plan | undefined>(undefined);

  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {plans.map((p, idx) => {
          const meta = PLAN_META[p.name] || { tone: "from-zinc-500/20 to-zinc-700/10 border-zinc-500/30", icon: Sparkles };
          const Icon = meta.icon;
          const multiplier = (p.total_return / Math.max(1, p.price)).toFixed(1);
          return (
            <Reveal key={p.name} delay={idx * 0.04}>
              <div className={`relative rounded-2xl border bg-gradient-to-br ${meta.tone} p-6 backdrop-blur-md h-full overflow-hidden`}>
                {meta.badge && (
                  <span className="absolute top-3 right-3 text-[10px] uppercase tracking-widest rounded-full bg-black/60 border border-yellow-500/30 text-yellow-200 px-2 py-1">
                    {meta.badge}
                  </span>
                )}
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-black/30 border border-white/10">
                  <Icon size={18} className="text-yellow-300" />
                </div>
                <div className="mt-4 text-sm uppercase tracking-wide text-zinc-300">{p.name}</div>
                <div className="mt-1 text-3xl font-bold gold-text">₹{p.price.toLocaleString("en-IN")}</div>
                <ul className="mt-4 space-y-1 text-sm text-zinc-300">
                  <li>Daily: <span className="text-white font-medium">₹{p.daily_income.toLocaleString("en-IN")}</span></li>
                  <li>Duration: <span className="text-white font-medium">{p.duration_days} days</span></li>
                  <li>Total Return: <span className="text-white font-medium">₹{p.total_return.toLocaleString("en-IN")} <span className="text-yellow-300">({multiplier}×)</span></span></li>
                </ul>
                <button
                  className="mt-5 w-full rounded-lg bg-[var(--primary)] py-2.5 font-semibold text-black transition hover:brightness-95"
                  onClick={() => { setSelected(p); setOpen(true); }}
                >
                  Invest Now
                </button>
              </div>
            </Reveal>
          );
        })}
      </div>
      <PlanModal open={open} onOpenChange={setOpen} plan={selected} />
    </>
  );
}
