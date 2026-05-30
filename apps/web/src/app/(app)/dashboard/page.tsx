"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Coins, Sparkles, Users2, Wallet, BadgeIndianRupee, TrendingUp, Trophy,
  Gift, Zap, Flame, ShieldCheck, Award, Rocket, Star, Lock, ArrowDownToLine,
} from "lucide-react";
import Link from "next/link";
import { api, formatINR } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Wallet = { type: string; balance: string | number };
type MeRes = {
  user: { id: string; email: string; phone?: string | null; name?: string | null; referralCode: string; role: string };
  wallets: Wallet[];
  totals: { byType: Record<string, number>; total: number };
  stats: { activeInvestments: number; totalWithdrawn: number };
};
type ClaimStatus = {
  claimedToday: boolean;
  todayAmount: number;
  pendingAmount: number;
  msUntilNext: number;
  dayKey: string;
};
type RewardsStatus = {
  dayKey: string;
  msUntilNext: number;
  spin: { enabled?: boolean; available: boolean; claimedAmount: number; prizes?: number[] };
  scratch: { enabled?: boolean; available: boolean; claimedAmount: number; maxPrize?: number };
};
type Investment = {
  id: string;
  planName: string;
  price: number;
  dailyIncome: number;
  durationDays: number;
  remainingDays: number;
  status: string;
  startedAt: string;
  endsAt: string;
};
type Notification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [me, setMe] = useState<MeRes | null>(null);
  const [claim, setClaim] = useState<ClaimStatus | null>(null);
  const [claimLoading, setClaimLoading] = useState(true);
  const [rewards, setRewards] = useState<RewardsStatus | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    try {
      await api("/notifications/read-all", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  const markOneRead = async (id: string) => {
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch {}
  };

  const openNotifications = () => {
    setNotifOpen((prev) => !prev);
    if (!notifOpen && unreadCount > 0) {
      markAllRead();
    }
  };

  const load = useCallback(async () => {
    const [mRes, cRes, rRes, invRes, notifRes] = await Promise.allSettled([
      api<MeRes>("/me"),
      api<ClaimStatus>("/claims/status"),
      api<RewardsStatus>("/rewards/status"),
      api<{ investments: Investment[] }>("/investments"),
      api<{ notifications: Notification[] }>("/notifications"),
    ]);
    if (mRes.status === "fulfilled") setMe(mRes.value);
    if (cRes.status === "fulfilled") setClaim(cRes.value);
    if (rRes.status === "fulfilled") setRewards(rRes.value);
    if (invRes.status === "fulfilled") setInvestments(invRes.value.investments);
    if (notifRes.status === "fulfilled") setNotifications(notifRes.value.notifications);
    setLoading(false);
    setClaimLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Re-tick the countdown every second
  const [countdown, setCountdown] = useState("--:--:--");
  useEffect(() => {
    if (!claim) return;
    let target = Date.now() + claim.msUntilNext;
    const tick = () => {
      const ms = Math.max(0, target - Date.now());
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [claim]);

  const balanceByType = (t: string) => Number(me?.totals.byType[t] ?? 0);

  const wallets = useMemo(
    () => [
      { key: "deposit", title: "Deposit Wallet", icon: Wallet, color: "from-yellow-500/20 to-yellow-500/0" },
      { key: "earnings", title: "Earnings Wallet", icon: TrendingUp, color: "from-emerald-500/20 to-emerald-500/0" },
      { key: "referral", title: "Referral Wallet", icon: Users2, color: "from-fuchsia-500/20 to-fuchsia-500/0" },
      { key: "bonus", title: "Bonus Wallet", icon: Sparkles, color: "from-sky-500/20 to-sky-500/0" },
    ],
    []
  );

  const onClaim = async () => {
    setBusy(true);
    setToast(null);
    try {
      const r = await api<{ alreadyClaimed: boolean; amount: number; noPlans?: boolean }>("/claims", { method: "POST" });
      if (r.alreadyClaimed) setToast("Already claimed today.");
      else if (r.noPlans) setToast("No active plan to claim from. Buy a plan first!");
      else setToast(`+${formatINR(r.amount)} credited to Earnings Wallet`);
      // Only reload the two endpoints that change after a claim
      const [cRes, mRes] = await Promise.allSettled([
        api<ClaimStatus>("/claims/status"),
        api<MeRes>("/me"),
      ]);
      if (cRes.status === "fulfilled") setClaim(cRes.value);
      if (mRes.status === "fulfilled") setMe(mRes.value);
    } catch (e: any) {
      setToast(e?.message || "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  const dailyIncome = investments.filter((i) => i.status === "active").reduce((s, i) => s + i.dailyIncome, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      {/* Top bar: bell on right */}
      <div className="flex items-center justify-between gap-3">
        <div />
        <div className="relative" ref={notifRef}>
            <button
              onClick={openNotifications}
              className="relative flex items-center justify-center w-10 h-10 rounded-xl glass border border-yellow-500/20 hover:border-yellow-500/40 transition"
              aria-label="Notifications"
            >
              <Bell size={18} className="text-yellow-300" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 z-50 w-80 glass rounded-2xl border border-yellow-500/20 shadow-2xl shadow-black/40 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-yellow-500/10">
                    <span className="text-white font-semibold text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-[11px] text-yellow-300 hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-yellow-500/10">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-zinc-400">No notifications yet</div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => markOneRead(n.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-yellow-500/5 transition ${!n.read ? "bg-yellow-500/5" : ""}`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />}
                            <div className={!n.read ? "" : "ml-4"}>
                              <div className="text-white text-xs font-semibold">{n.title}</div>
                              <div className="text-zinc-400 text-xs mt-0.5 leading-snug">{n.body}</div>
                              <div className="text-zinc-600 text-[10px] mt-1">
                                {new Date(n.createdAt).toLocaleString("en-IN")}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 rounded-xl glass px-4 py-2 text-sm">
            <Trophy size={16} className="text-yellow-400" />
            <span className="text-zinc-300">VIP Level</span>
            <span className="font-semibold text-yellow-300">Bronze</span>
          </div>
        </div>

      {/* Welcome message — centered */}
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-yellow-400/80">Welcome back</div>
        <h1 className="text-xl sm:text-2xl font-semibold text-white mt-1">
          {me?.user.name || me?.user.email || user?.email}
        </h1>
      </div>

      {/* Total balance + Daily Claim — shown immediately with ₹0 placeholders */}
      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 glass rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-yellow-500/10 blur-3xl" />
          <div className="text-xs uppercase tracking-widest text-zinc-400">Total Balance</div>
          <div className={`mt-1 text-4xl sm:text-5xl font-bold gold-text ${loading && !me ? "animate-pulse" : ""}`}>
            {formatINR(me?.totals.total ?? 0)}
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {wallets.map((w) => (
              <div key={w.key} className={`rounded-2xl border border-yellow-500/10 bg-gradient-to-br ${w.color} p-3`}>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <w.icon size={14} />
                  <span>{w.title}</span>
                </div>
                <div className={`mt-1 text-lg font-semibold text-white ${loading && !me ? "skeleton h-6 w-16 rounded animate-pulse" : ""}`}>
                  {loading && !me ? "\u00A0" : formatINR(balanceByType(w.key))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3 sm:flex-nowrap">
            <Link href="/wallet" className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-black">
              <Wallet size={16} /> Deposit
            </Link>
            <Link href="/plans" className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-yellow-500/30 px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-yellow-500/10">
              <BadgeIndianRupee size={16} /> Buy Plan
            </Link>
            <Link href="/withdraw" className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-yellow-500/30 px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-yellow-500/10">
              <ArrowDownToLine size={16} /> Withdraw
            </Link>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-3xl p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-400/80">
            <Coins size={14} /> Daily Reward
          </div>
          <div className="mt-2 text-zinc-300 text-sm">
            {claimLoading
              ? "Checking reward status…"
              : claim?.claimedToday
                ? "You've claimed today's reward."
                : claim?.pendingAmount
                  ? "Today's reward is ready to claim."
                  : "Buy a plan to start daily rewards."}
          </div>
          <div className={`mt-5 text-4xl font-bold gold-text ${claimLoading ? "animate-pulse" : ""}`}>
            +{formatINR(claim?.pendingAmount || claim?.todayAmount || dailyIncome)}
          </div>
          {/* Claim button shown immediately; enabled/disabled once API responds */}
          <button
            onClick={onClaim}
            disabled={busy || claimLoading || !!claim?.claimedToday || !claim?.pendingAmount}
            className="mt-5 w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-black hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Claiming…" : claimLoading ? "Loading…" : claim?.claimedToday ? `Next claim in ${countdown}` : "Claim Now"}
          </button>
          {toast && <div className="mt-3 text-xs text-yellow-200 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">{toast}</div>}
        </motion.div>
      </div>

      {/* Daily Rewards strip */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-white">
            <Gift size={18} className="text-yellow-300" />
            <h3 className="font-semibold">Daily Rewards</h3>
            <span className="text-[10px] uppercase tracking-widest text-zinc-400">Resets in {countdown}</span>
          </div>
          <Link href="/rewards" className="text-xs text-yellow-300/90 hover:underline">All rewards →</Link>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <RewardTile
            icon={Coins}
            title="Claim Daily"
            subtitle={claim?.claimedToday ? "Claimed today" : claim?.pendingAmount ? "Ready to claim" : "Buy a plan first"}
            amount={claim?.pendingAmount || claim?.todayAmount || 0}
            actionLabel={busy ? "Claiming…" : claim?.claimedToday ? "Done ✓" : "Claim"}
            onClick={onClaim}
            disabled={busy || !!claim?.claimedToday || !claim?.pendingAmount}
            available={!claim?.claimedToday && !!claim?.pendingAmount}
          />
          <RewardTile
            icon={Zap}
            title="Spin Wheel"
            subtitle={rewards?.spin.available ? "1 spin available" : `Won ${formatINR(rewards?.spin.claimedAmount ?? 0)}`}
            amount={rewards?.spin.available ? null : rewards?.spin.claimedAmount}
            actionLabel={rewards?.spin.available ? "Spin Now" : "Done ✓"}
            href="/rewards"
            available={!!rewards?.spin.available}
            tone="amber"
          />
          <RewardTile
            icon={Gift}
            title="Scratch Card"
            subtitle={rewards?.scratch.available ? "Up to ₹200" : `Won ${formatINR(rewards?.scratch.claimedAmount ?? 0)}`}
            amount={rewards?.scratch.available ? null : rewards?.scratch.claimedAmount}
            actionLabel={rewards?.scratch.available ? "Scratch" : "Done ✓"}
            href="/rewards"
            available={!!rewards?.scratch.available}
            tone="violet"
          />
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Stat title="Active Plans" value={loading && !me ? "…" : String(me?.stats.activeInvestments ?? 0)} />
        <Stat title="Daily Income" value={loading && investments.length === 0 ? "…" : formatINR(dailyIncome)} />
        <Stat title="Total Withdrawn" value={loading && !me ? "…" : formatINR(me?.stats.totalWithdrawn ?? 0)} />
        <Stat title="Referral Code" value={me?.user.referralCode || user?.referralCode || "--"} />
      </div>

      {/* VIP Progress */}
      <VipProgress totalInvested={investments.reduce((s, i) => s + Number(i.price || 0), 0)} totalEarned={me?.totals.byType.earnings ?? 0} />

      {/* Achievements strip */}
      <Achievements
        hasPlans={(me?.stats.activeInvestments ?? 0) > 0}
        hasClaimed={!!claim?.claimedToday || (me?.totals.byType.earnings ?? 0) > 0}
        hasReferred={false /* TODO from /referrals/me */}
        hasWithdrawn={(me?.stats.totalWithdrawn ?? 0) > 0}
        hasSpun={!!rewards && !rewards.spin.available}
        hasScratched={!!rewards && !rewards.scratch.available}
      />

      {/* Active plans + Recent activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Active Plans</h3>
            <Link href="/plans" className="text-xs text-yellow-300/90 hover:underline">Browse plans →</Link>
          </div>
          <div className="mt-4 space-y-2">
            {investments.length === 0 && (
              <div className="text-sm text-zinc-400">No active plans yet. Buy one to start earning daily.</div>
            )}
            {investments.map((i) => {
              const totalDays = i.durationDays;
              const usedDays = totalDays - i.remainingDays;
              const pct = Math.max(0, Math.min(100, Math.round((usedDays / totalDays) * 100)));
              return (
                <div key={i.id} className="rounded-2xl border border-yellow-500/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-white font-medium">{i.planName}</div>
                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${i.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/60 text-zinc-300"}`}>{i.status}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
                    <span>Daily {formatINR(i.dailyIncome)} • {i.remainingDays}/{i.durationDays} days left</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-zinc-700/60 overflow-hidden">
                    <div className="h-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-3xl p-6">
          <h3 className="text-white font-semibold">Live Activity</h3>
          <ul className="mt-3 divide-y divide-yellow-500/10 text-sm">
            {[
              { name: "Aarav • Mumbai", text: "claimed daily reward", amount: 320, time: "2m ago" },
              { name: "Diya • Pune", text: "purchased Gold plan", amount: 5000, time: "5m ago" },
              { name: "Kabir • Delhi", text: "withdrew earnings", amount: 1450, time: "9m ago" },
              { name: "Isha • Hyderabad", text: "joined via referral", amount: 0, time: "14m ago" },
            ].map((x, i) => (
              <li key={i} className="py-2 flex items-center justify-between text-zinc-300">
                <span>
                  <span className="text-white">{x.name}</span> <span className="text-zinc-400">{x.text}</span>
                </span>
                {x.amount > 0 && <span className="gold-text font-semibold">{formatINR(x.amount)}</span>}
                <span className="text-xs text-zinc-500 ml-3">{x.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs uppercase tracking-widest text-zinc-400">{title}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

/* ─────────── Daily reward tile ─────────── */
function RewardTile({
  icon: Icon,
  title,
  subtitle,
  amount,
  actionLabel,
  onClick,
  href,
  disabled,
  available,
  tone = "gold",
}: {
  icon: any;
  title: string;
  subtitle: string;
  amount?: number | null;
  actionLabel: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  available: boolean;
  tone?: "gold" | "amber" | "violet";
}) {
  const toneMap: Record<string, string> = {
    gold: "from-yellow-500/25 to-yellow-500/5 border-yellow-500/30",
    amber: "from-orange-500/20 to-yellow-500/5 border-orange-500/30",
    violet: "from-fuchsia-500/20 to-fuchsia-500/0 border-fuchsia-500/30",
  };
  const inner = (
    <div className={`relative rounded-2xl p-4 bg-gradient-to-br ${toneMap[tone]} border h-full overflow-hidden group transition`}>
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Icon size={18} className="text-yellow-300" />
          <span className="font-semibold">{title}</span>
        </div>
        <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${available ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700/40 text-zinc-400"}`}>
          {available ? "Ready" : "Claimed"}
        </span>
      </div>
      <div className="mt-3 text-xs text-zinc-400">{subtitle}</div>
      {amount !== null && amount !== undefined && amount > 0 && (
        <div className="mt-1 text-2xl font-bold gold-text">+{formatINR(amount)}</div>
      )}
      <div className="mt-4">
        <span className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition ${
          available
            ? "bg-[var(--primary)] text-black group-hover:brightness-95"
            : "bg-zinc-800/60 text-zinc-400 cursor-not-allowed"
        }`}>
          {actionLabel}
        </span>
      </div>
    </div>
  );

  if (href && available) return <Link href={href} className="block">{inner}</Link>;
  if (onClick) return <button onClick={onClick} disabled={disabled} className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-80">{inner}</button>;
  return <div>{inner}</div>;
}

/* ─────────── VIP Progress ─────────── */
const VIP_TIERS = [
  { name: "Bronze",   threshold: 0,      icon: ShieldCheck, perk: "Daily claim unlocked" },
  { name: "Silver",   threshold: 2000,   icon: Star,        perk: "Spin Wheel bonus +25%" },
  { name: "Gold",     threshold: 5000,   icon: Trophy,      perk: "Scratch min ₹10 guaranteed" },
  { name: "Platinum", threshold: 10000,  icon: Award,       perk: "Withdraw fee 3% instead of 5%" },
  { name: "Diamond",  threshold: 25000,  icon: Rocket,      perk: "Priority approvals + private support" },
];

function VipProgress({ totalInvested, totalEarned }: { totalInvested: number; totalEarned: number }) {
  const score = totalInvested + totalEarned;
  const currentIdx = VIP_TIERS.reduce((acc, t, i) => (score >= t.threshold ? i : acc), 0);
  const current = VIP_TIERS[currentIdx];
  const next = VIP_TIERS[currentIdx + 1];
  const lowerBound = current.threshold;
  const upperBound = next?.threshold ?? lowerBound + 1;
  const pct = next ? Math.min(100, Math.round(((score - lowerBound) / (upperBound - lowerBound)) * 100)) : 100;

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-white">
            <Trophy size={18} className="text-yellow-300" />
            <h3 className="font-semibold">VIP Progress</h3>
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            Score = total invested + earnings. Bigger plans + daily claims = faster level up.
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-zinc-400">Current</div>
          <div className="gold-text font-semibold text-lg">{current.name}</div>
        </div>
      </div>

      <div className="mt-5 h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-yellow-500 via-yellow-300 to-yellow-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
        <span>{formatINR(score)} score</span>
        {next ? <span>{formatINR(upperBound - score)} to {next.name}</span> : <span>Max tier 🎉</span>}
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-2">
        {VIP_TIERS.map((t, i) => {
          const reached = i <= currentIdx;
          const Icon = t.icon;
          return (
            <div key={t.name} className={`rounded-xl border p-3 text-xs ${reached ? "border-yellow-500/40 bg-yellow-500/5" : "border-zinc-700/40 bg-zinc-900/40 opacity-60"}`}>
              <div className="flex items-center gap-1.5">
                {reached ? <Icon size={14} className="text-yellow-300" /> : <Lock size={14} className="text-zinc-500" />}
                <span className={`font-semibold ${reached ? "text-yellow-200" : "text-zinc-400"}`}>{t.name}</span>
              </div>
              <div className="mt-1 text-zinc-400">{formatINR(t.threshold)}</div>
              <div className="mt-1 text-[10px] text-zinc-500 leading-snug">{t.perk}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── Achievements strip ─────────── */
function Achievements({
  hasPlans, hasClaimed, hasReferred, hasWithdrawn, hasSpun, hasScratched,
}: {
  hasPlans: boolean;
  hasClaimed: boolean;
  hasReferred: boolean;
  hasWithdrawn: boolean;
  hasSpun: boolean;
  hasScratched: boolean;
}) {
  const badges = [
    { name: "First Plan",      ok: hasPlans,     icon: BadgeIndianRupee, hint: "Buy any plan" },
    { name: "First Claim",     ok: hasClaimed,   icon: Coins,            hint: "Tap Claim Now" },
    { name: "First Withdraw",  ok: hasWithdrawn, icon: TrendingUp,       hint: "Withdraw on a Sunday" },
    { name: "Bring a Friend",  ok: hasReferred,  icon: Users2,           hint: "Share your referral code" },
    { name: "Spin Master",     ok: hasSpun,      icon: Zap,              hint: "Spin once" },
    { name: "Scratch Pro",     ok: hasScratched, icon: Gift,             hint: "Scratch once" },
  ];
  const earned = badges.filter((b) => b.ok).length;

  return (
    <div className="glass rounded-3xl p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Flame size={18} className="text-yellow-300" />
          <h3 className="font-semibold">Achievements</h3>
        </div>
        <div className="text-xs text-zinc-400">{earned}/{badges.length} unlocked</div>
      </div>
      <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-3">
        {badges.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.name} className={`rounded-2xl p-3 text-center border ${b.ok ? "border-yellow-500/40 bg-yellow-500/5" : "border-zinc-700/40 bg-zinc-900/30 opacity-70"}`}>
              <div className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center ${b.ok ? "bg-yellow-500/15 text-yellow-300" : "bg-zinc-800 text-zinc-500"}`}>
                <Icon size={18} />
              </div>
              <div className={`mt-2 text-[11px] font-semibold ${b.ok ? "text-yellow-200" : "text-zinc-400"}`}>{b.name}</div>
              <div className="mt-1 text-[10px] text-zinc-500 leading-tight">{b.hint}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
