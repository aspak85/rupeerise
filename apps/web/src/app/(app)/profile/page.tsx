"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  BadgeIndianRupee,
  Copy,
  CheckCircle2,
  Dices,
  ExternalLink,
  HeadphonesIcon,
  History,
  Loader2,
  Mail,
  Phone,
  Receipt,
  Send,
  Shield,
  UserCircle2,
  Wallet,
} from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type MeResponse = {
  user: {
    id: string;
    uid: number;
    email: string;
    phone: string | null;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    role: string;
    kycVerified: boolean;
    referralCode: string;
    createdAt: string;
    lastLoginAt: string | null;
    hasPassword: boolean;
  };
  wallets: { type: string; balance: string }[];
  totals: { byType: Record<string, number>; total: number };
  stats: { activeInvestments: number; totalWithdrawn: number };
};

type SupportContact = { kind: string; label: string; handle?: string; url: string; note?: string };
type SupportChannel = { label: string; url: string; icon?: string; note?: string };
type SupportConfig = { contacts: SupportContact[]; channels: SupportChannel[] };

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [support, setSupport] = useState<SupportConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.allSettled([
        api<MeResponse>("/me"),
        api<SupportConfig>("/support/config"),
      ]);
      if (mRes.status === "fulfilled") setMe(mRes.value);
      if (sRes.status === "fulfilled") setSupport(sRes.value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !me) {
    return (
      <div className="max-w-md mx-auto w-full p-6 space-y-4 animate-pulse">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {[0,1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="max-w-md mx-auto p-10 text-center text-zinc-400 text-sm">
        Could not load profile.{" "}
        <button onClick={load} className="text-yellow-300 underline">Retry</button>
      </div>
    );
  }

  const balOf = (t: string) => Number(me.wallets.find(w => w.type === t)?.balance ?? 0);
  const totalBal = me.totals.total;
  const displayName = me.user.name || `${me.user.firstName || ""} ${me.user.lastName || ""}`.trim() || me.user.email.split("@")[0];

  return (
    <div className="max-w-md mx-auto w-full space-y-4 pb-8">
      {/* ═══ Profile header card (green gradient like reference) ═══ */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-xl font-bold shrink-0">
            {displayName[0]?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base truncate">{displayName.toUpperCase()}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                UID | {me.user.uid}
              </span>
              <CopyUID uid={me.user.uid} />
            </div>
            <div className="text-xs text-white/70 mt-1">
              Last login: {me.user.lastLoginAt ? new Date(me.user.lastLoginAt).toLocaleString("en-IN") : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Total Balance card ═══ */}
      <div className="glass rounded-2xl p-4">
        <div className="text-xs text-zinc-400">Total balance</div>
        <div className="text-2xl font-bold text-white mt-0.5">{formatINR(totalBal)}</div>

        {/* Quick action icons */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          <QuickAction href="/wallet" icon={<Wallet size={20} />} label="Wallet" color="text-red-300" />
          <QuickAction href="/wallet" icon={<ArrowDownToLine size={20} />} label="Deposit" color="text-orange-300" />
          <QuickAction href="/withdraw" icon={<Receipt size={20} />} label="Withdraw" color="text-blue-300" />
          <QuickAction href="/plans" icon={<BadgeIndianRupee size={20} />} label="VIP" color="text-emerald-300" />
        </div>
      </div>

      {/* ═══ Safe / Earnings summary ═══ */}
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
          <Shield size={18} className="text-yellow-300" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">Earnings Wallet</div>
          <div className="text-[11px] text-zinc-400">Lucky Hit wins & daily claims land here</div>
        </div>
        <div className="text-sm font-bold text-emerald-300">{formatINR(balOf("earnings"))}</div>
      </div>

      {/* ═══ History tiles (2×2 grid like reference) ═══ */}
      <div className="grid grid-cols-2 gap-3">
        <HistoryTile href="/lucky-hit" icon={<Dices size={18} />} label="Game History" sub="Lucky Hit record" color="emerald" />
        <HistoryTile href="/profile?tab=statement" icon={<History size={18} />} label="Transaction" sub="All activity" color="blue" />
        <HistoryTile href="/profile?tab=deposits" icon={<ArrowDownToLine size={18} />} label="Deposit" sub="Deposit history" color="orange" />
        <HistoryTile href="/profile?tab=withdrawals" icon={<Receipt size={18} />} label="Withdraw" sub="Withdrawal history" color="red" />
      </div>

      {/* ═══ Support section ═══ */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <HeadphonesIcon size={16} className="text-yellow-300" />
          <span className="text-sm font-semibold text-white">Support</span>
        </div>
        {!support ? (
          <div className="text-xs text-zinc-500">Loading support info…</div>
        ) : (
          <div className="space-y-2">
            {support.contacts.map((c, i) => (
              <a
                key={i}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-yellow-500/15 bg-black/20 px-3 py-2.5 hover:bg-yellow-500/5 transition"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Send size={14} className="text-blue-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{c.label}</div>
                  {c.handle && <div className="text-[10px] text-zinc-400 truncate">{c.handle}</div>}
                </div>
                <ExternalLink size={12} className="text-zinc-500" />
              </a>
            ))}
            {support.channels.map((c, i) => (
              <a
                key={`ch-${i}`}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl border border-yellow-500/15 bg-black/20 px-3 py-2.5 hover:bg-yellow-500/5 transition"
              >
                <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center shrink-0">
                  <Send size={14} className="text-yellow-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{c.label}</div>
                  {c.note && <div className="text-[10px] text-zinc-400 truncate">{c.note}</div>}
                </div>
                <ExternalLink size={12} className="text-zinc-500" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Account info ═══ */}
      <div className="glass rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <UserCircle2 size={16} className="text-yellow-300" />
          <span className="text-sm font-semibold text-white">Account</span>
        </div>
        <InfoRow icon={<Mail size={13} />} label="Email" value={me.user.email} />
        <InfoRow icon={<Phone size={13} />} label="Phone" value={me.user.phone ? `+91 ${me.user.phone}` : "Not set"} />
        <InfoRow icon={<Shield size={13} />} label="Referral Code" value={me.user.referralCode} />
        <InfoRow icon={<History size={13} />} label="Joined" value={new Date(me.user.createdAt).toLocaleDateString("en-IN")} />
      </div>

      {/* Logout */}
      <button
        onClick={signOut}
        className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/20 transition"
      >
        Logout
      </button>
    </div>
  );
}

/* ─── Sub-components ─── */

function QuickAction({ href, icon, label, color }: { href: string; icon: React.ReactNode; label: string; color: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5 py-2 rounded-xl hover:bg-white/5 transition">
      <div className={`w-10 h-10 rounded-xl bg-black/30 border border-yellow-500/15 flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <span className="text-[11px] text-zinc-300">{label}</span>
    </Link>
  );
}

function HistoryTile({ href, icon, label, sub, color }: { href: string; icon: React.ReactNode; label: string; sub: string; color: string }) {
  const borderCls = color === "emerald" ? "border-emerald-500/20" : color === "blue" ? "border-blue-500/20" : color === "orange" ? "border-orange-500/20" : "border-red-500/20";
  const iconCls = color === "emerald" ? "text-emerald-300" : color === "blue" ? "text-blue-300" : color === "orange" ? "text-orange-300" : "text-red-300";
  return (
    <Link href={href} className={`glass rounded-xl p-3.5 border ${borderCls} hover:bg-white/5 transition block`}>
      <div className="flex items-center gap-2">
        <span className={iconCls}>{icon}</span>
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="text-[10px] text-zinc-400">{sub}</div>
        </div>
      </div>
    </Link>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-zinc-400">{icon}</span>
      <span className="text-xs text-zinc-400 w-20 shrink-0">{label}</span>
      <span className="text-xs text-white font-medium truncate flex-1">{value}</span>
    </div>
  );
}

function CopyUID({ uid }: { uid: number }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(String(uid)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <button onClick={copy} className="text-white/60 hover:text-white">
      {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
    </button>
  );
}
