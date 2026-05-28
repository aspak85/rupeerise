"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownToLine, BadgeIndianRupee, Users, Wallet,
  TrendingUp, Clock, RefreshCw, ShieldCheck, Image as ImageIcon,
  Gift, QrCode
} from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Stats = {
  users: number;
  activeInvestments: number;
  totalDeposits: number;
  totalWithdrawals: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
};

type ActivityUser = { email?: string | null; phone?: string | null };
type Activity = {
  recentDeposits: { id: string; amount: string; status: string; createdAt: string; User?: ActivityUser }[];
  recentWithdrawals: { id: string; amount: string; netAmount: string; status: string; createdAt: string; User?: ActivityUser }[];
  recentUsers: { id: string; email: string; phone?: string | null; createdAt: string }[];
};

export default function AdminOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.allSettled([
        api<Stats>("/admin/stats"),
        api<Activity>("/admin/activity"),
      ]);
      if (s.status === "fulfilled") setStats(s.value);
      if (a.status === "fulfilled") setActivity(a.value);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const quickLinks = [
    { href: "/admin/users", icon: Users, label: "Users", color: "text-sky-300", bg: "bg-sky-500/10 border-sky-500/20" },
    { href: "/admin/deposits", icon: Wallet, label: "Deposits", color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { href: "/admin/withdrawals", icon: ArrowDownToLine, label: "Withdrawals", color: "text-orange-300", bg: "bg-orange-500/10 border-orange-500/20" },
    { href: "/admin/plans", icon: BadgeIndianRupee, label: "Plans", color: "text-yellow-300", bg: "bg-yellow-500/10 border-yellow-500/20" },
    { href: "/admin/payment-channels", icon: QrCode, label: "Channels", color: "text-fuchsia-300", bg: "bg-fuchsia-500/10 border-fuchsia-500/20" },
    { href: "/admin/posters", icon: ImageIcon, label: "Posters", color: "text-pink-300", bg: "bg-pink-500/10 border-pink-500/20" },
    { href: "/admin/gift-codes", icon: Gift, label: "Gift Codes", color: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/20" },
    { href: "/admin/security", icon: ShieldCheck, label: "Security", color: "text-red-300", bg: "bg-red-500/10 border-red-500/20" },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Admin Console</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">
            Welcome back, {user?.email?.split("@")[0]} 👋
          </h1>
          {lastUpdated && (
            <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
              <Clock size={11} /> Last updated: {lastUpdated.toLocaleTimeString("en-IN")}
            </div>
          )}
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" icon={Users} value={stats?.users ?? "—"} color="sky" loading={loading} />
        <StatCard title="Active Plans" icon={TrendingUp} value={stats?.activeInvestments ?? "—"} color="emerald" loading={loading} />
        <StatCard title="Total Deposits" icon={Wallet} value={formatINR(stats?.totalDeposits ?? 0)} color="yellow" loading={loading} />
        <StatCard title="Total Withdrawals" icon={ArrowDownToLine} value={formatINR(stats?.totalWithdrawals ?? 0)} color="orange" loading={loading} />
      </div>

      {/* Pending actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/deposits" className="glass rounded-2xl p-5 hover:bg-emerald-500/5 border border-transparent hover:border-emerald-500/20 transition group">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <Wallet size={13} className="text-emerald-400" /> Pending Deposits
            </div>
            <span className="text-xs text-emerald-300 group-hover:underline">Review →</span>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <div className="text-4xl font-bold text-white">{stats?.pendingDeposits ?? 0}</div>
            {(stats?.pendingDeposits ?? 0) > 0 && (
              <span className="text-xs text-emerald-300 mb-1 animate-pulse">● Needs attention</span>
            )}
          </div>
        </Link>
        <Link href="/admin/withdrawals" className="glass rounded-2xl p-5 hover:bg-orange-500/5 border border-transparent hover:border-orange-500/20 transition group">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <ArrowDownToLine size={13} className="text-orange-400" /> Pending Withdrawals
            </div>
            <span className="text-xs text-orange-300 group-hover:underline">Review →</span>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <div className="text-4xl font-bold text-white">{stats?.pendingWithdrawals ?? 0}</div>
            {(stats?.pendingWithdrawals ?? 0) > 0 && (
              <span className="text-xs text-orange-300 mb-1 animate-pulse">● Needs attention</span>
            )}
          </div>
        </Link>
      </div>

      {/* Quick links grid */}
      <div>
        <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Quick Access</div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {quickLinks.map((q) => (
            <Link key={q.href} href={q.href}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 hover:scale-105 transition-transform ${q.bg}`}>
              <q.icon size={20} className={q.color} />
              <span className="text-[10px] text-zinc-300 text-center leading-tight">{q.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ActivityCard title="Recent Deposits" rows={(activity?.recentDeposits ?? []).map((d) => ({
          who: d.User?.email || (d.User?.phone ? `+91 ${d.User.phone}` : "—"),
          amount: formatINR(Number(d.amount)),
          status: d.status,
          time: d.createdAt,
        }))} />
        <ActivityCard title="Recent Withdrawals" rows={(activity?.recentWithdrawals ?? []).map((w) => ({
          who: w.User?.email || (w.User?.phone ? `+91 ${w.User.phone}` : "—"),
          amount: formatINR(Number(w.netAmount)),
          status: w.status,
          time: w.createdAt,
        }))} />
        <ActivityCard title="New Users" rows={(activity?.recentUsers ?? []).map((u) => ({
          who: u.email,
          amount: "joined",
          status: "new",
          time: u.createdAt,
        }))} />
      </div>
    </div>
  );
}

type ColorKey = "sky" | "emerald" | "yellow" | "orange";
const colorMap: Record<ColorKey, string> = {
  sky: "text-sky-300",
  emerald: "text-emerald-300",
  yellow: "text-yellow-300",
  orange: "text-orange-300",
};

function StatCard({ title, value, icon: Icon, color, loading }: { title: string; value: any; icon: any; color: ColorKey; loading: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-400">
        <Icon size={14} className={colorMap[color]} />
        <span className="truncate">{title}</span>
      </div>
      <div className={`mt-2 text-2xl font-bold ${loading ? "animate-pulse text-zinc-600" : "text-white"}`}>
        {loading ? "—" : value}
      </div>
    </motion.div>
  );
}

function ActivityCard({ title, rows }: { title: string; rows: { who: string; amount: string; status: string; time: string }[] }) {
  const statusColor = (s: string) => {
    const k = s.toLowerCase();
    if (k === "approved" || k === "new") return "text-emerald-300";
    if (k === "pending") return "text-amber-300";
    if (k === "rejected") return "text-red-300";
    return "text-zinc-400";
  };
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-white font-semibold mb-3">{title}</h3>
      <ul className="divide-y divide-yellow-500/10 text-sm">
        {rows.length === 0 && <li className="py-3 text-zinc-500 text-xs text-center">No activity yet</li>}
        {rows.map((r, i) => (
          <li key={i} className="py-2.5 flex items-center justify-between gap-2">
            <span className="text-white truncate flex-1 min-w-0 text-xs" title={r.who}>{r.who}</span>
            <span className="gold-text font-semibold text-xs whitespace-nowrap">{r.amount}</span>
            <span className={`text-[10px] whitespace-nowrap ${statusColor(r.status)}`}>
              {new Date(r.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
