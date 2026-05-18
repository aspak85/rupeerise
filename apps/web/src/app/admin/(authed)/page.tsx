"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownToLine, BadgeIndianRupee, Users, Wallet } from "lucide-react";
import { api, formatINR } from "@/lib/api";

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
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);

  const load = useCallback(async () => {
    const [s, a] = await Promise.all([api<Stats>("/admin/stats"), api<Activity>("/admin/activity")]);
    setStats(s);
    setActivity(a);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div>
        <div className="text-xs uppercase tracking-widest text-yellow-400/80">Overview</div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Platform stats</h1>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card title="Total Users" icon={Users} value={stats?.users ?? "—"} />
        <Card title="Active Plans" icon={BadgeIndianRupee} value={stats?.activeInvestments ?? "—"} />
        <Card title="Total Deposits" icon={Wallet} value={formatINR(stats?.totalDeposits ?? 0)} />
        <Card title="Total Withdrawals" icon={ArrowDownToLine} value={formatINR(stats?.totalWithdrawals ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Link href="/admin/deposits" className="glass rounded-2xl p-5 hover:bg-yellow-500/5 transition group">
          <div className="text-xs uppercase tracking-widest text-zinc-400">Pending Deposits</div>
          <div className="mt-1 flex items-end justify-between">
            <div className="text-3xl font-bold text-white">{stats?.pendingDeposits ?? 0}</div>
            <span className="text-xs text-yellow-300/90 group-hover:underline">Review →</span>
          </div>
        </Link>
        <Link href="/admin/withdrawals" className="glass rounded-2xl p-5 hover:bg-yellow-500/5 transition group">
          <div className="text-xs uppercase tracking-widest text-zinc-400">Pending Withdrawals</div>
          <div className="mt-1 flex items-end justify-between">
            <div className="text-3xl font-bold text-white">{stats?.pendingWithdrawals ?? 0}</div>
            <span className="text-xs text-yellow-300/90 group-hover:underline">Review →</span>
          </div>
        </Link>
      </div>

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

function Card({ title, value, icon: Icon }: { title: string; value: any; icon: any }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-zinc-400">
        <Icon size={14} />
        {title}
      </div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </motion.div>
  );
}

function ActivityCard({ title, rows }: { title: string; rows: { who: string; amount: string; status: string; time: string }[] }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-white font-semibold">{title}</h3>
      <ul className="mt-3 divide-y divide-yellow-500/10 text-sm">
        {rows.length === 0 && <li className="py-3 text-zinc-500 text-xs">No activity yet</li>}
        {rows.map((r, i) => (
          <li key={i} className="py-2 flex items-center justify-between text-zinc-300 gap-2">
            <span className="text-white truncate flex-1 min-w-0" title={r.who}>{r.who}</span>
            <span className="gold-text font-semibold text-xs whitespace-nowrap">{r.amount}</span>
            <span className="text-[10px] text-zinc-500 whitespace-nowrap">{new Date(r.time).toLocaleTimeString("en-IN")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
