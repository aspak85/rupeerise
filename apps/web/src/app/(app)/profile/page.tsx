"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Gift,
  History,
  Loader2,
  Lock,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { api, downloadFile, formatINR } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type MeResponse = {
  user: {
    id: string;
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

type StatementEvent = {
  kind: string;
  id: string;
  at: string;
  title: string;
  amount: number;
  direction: "credit" | "debit" | "info";
  status?: string;
  ref?: string | null;
};

type Deposit = { id: string; amount: number; method: string; status: string; utr: string | null; createdAt: string };
type Withdrawal = { id: string; amount: number; netAmount: number; feePercent: number; method: string; status: string; createdAt: string };
type GiftClaim = { id: string; code: string; amount: number; notes: string | null; claimedAt: string };

type TabId = "account" | "deposits" | "withdrawals" | "statement" | "security";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "account",     label: "Account",     icon: UserIcon },
  { id: "deposits",    label: "Deposits",    icon: Wallet },
  { id: "withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { id: "statement",   label: "Statement",   icon: FileText },
  { id: "security",    label: "Security",    icon: ShieldCheck },
];


export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [events, setEvents] = useState<StatementEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<"all" | "deposit" | "withdrawal" | "earnings">("all");
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [claims, setClaims] = useState<GiftClaim[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("account");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, stRes, dpRes, wdRes, histRes] = await Promise.allSettled([
        api<MeResponse>("/me"),
        api<{ events: StatementEvent[] }>(`/me/statement?type=${eventFilter}`),
        api<{ deposits: Deposit[] }>("/deposits"),
        api<{ withdrawals: Withdrawal[] }>("/withdrawals"),
        api<{ claims: GiftClaim[] }>("/redeem/history"),
      ]);
      if (mRes.status === "fulfilled") setMe(mRes.value);
      setEvents(stRes.status === "fulfilled" ? stRes.value.events.slice(0, 100) : []);
      setDeposits(dpRes.status === "fulfilled" ? dpRes.value.deposits : []);
      setWithdrawals(wdRes.status === "fulfilled" ? wdRes.value.withdrawals : []);
      setClaims(histRes.status === "fulfilled" ? histRes.value.claims : []);
    } finally {
      setLoading(false);
    }
  }, [eventFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading && !me) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto w-full pb-20 animate-pulse">
        <div className="glass rounded-2xl p-5 flex items-start gap-4 flex-wrap">
          <div className="skeleton w-16 h-16 rounded-2xl" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-7 w-48 rounded" />
            <div className="skeleton h-4 w-36 rounded" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[0,1,2,3].map(i => <div key={i} className="skeleton rounded-xl h-14 w-24" />)}
          </div>
        </div>
        <div className="glass rounded-2xl p-1.5 flex gap-1">
          {[0,1,2,3,4].map(i => <div key={i} className="skeleton h-9 w-24 rounded-xl" />)}
        </div>
        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="skeleton h-5 w-32 rounded" />
          <div className="grid gap-4 md:grid-cols-2">
            {[0,1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
          <div className="skeleton h-10 w-36 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center text-zinc-400 text-sm">
        Could not load profile.{" "}
        <button onClick={load} className="text-yellow-300 underline ml-1">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto w-full pb-20">
      {/* ── Header card ── */}
      <div className="glass rounded-2xl p-5 flex items-start gap-4 flex-wrap">
        <Avatar name={me.user.name || me.user.email} />
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Profile</div>
          <h1 className="text-2xl font-semibold text-white mt-0.5 truncate">
            {me.user.name ||
              `${me.user.firstName ?? ""} ${me.user.lastName ?? ""}`.trim() ||
              "Welcome"}
          </h1>
          <div className="text-sm text-zinc-400 mt-0.5 flex items-center gap-1.5">
            <Mail size={13} /> {me.user.email}
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {me.user.kycVerified ? (
              <Badge color="emerald">KYC Verified</Badge>
            ) : (
              <Badge color="zinc">KYC Pending</Badge>
            )}
            {me.user.role === "admin" && <Badge color="gold">Admin</Badge>}
            <Badge color="zinc">Joined {new Date(me.user.createdAt).toLocaleDateString()}</Badge>
            <ReferralChip code={me.user.referralCode} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
          <MiniStat label="Total balance" value={formatINR(me.totals.total)} />
          <MiniStat label="Active plans" value={String(me.stats.activeInvestments)} />
          <MiniStat label="Withdrawn" value={formatINR(me.stats.totalWithdrawn)} />
          <MiniStat label="Bonus" value={formatINR(me.totals.byType.bonus ?? 0)} />
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div className="glass rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition ${
                activeTab === t.id
                  ? "bg-[var(--primary)] text-black font-semibold"
                  : "text-zinc-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      {activeTab === "account" && (
        <AccountTab me={me} onSaved={() => { load(); refresh(); }} />
      )}
      {activeTab === "deposits" && (
        <DepositsTab deposits={deposits} />
      )}
      {activeTab === "withdrawals" && (
        <WithdrawalsTab withdrawals={withdrawals} />
      )}
      {activeTab === "statement" && (
        <StatementTab
          events={events}
          filter={eventFilter}
          onFilterChange={setEventFilter}
        />
      )}
      {activeTab === "security" && (
        <SecurityTab hasPassword={!!me.user.hasPassword} onChanged={refresh} />
      )}
    </div>
  );
}


/* ─── Account Tab ─── */
function AccountTab({ me, onSaved }: { me: MeResponse; onSaved: () => void }) {
  return (
    <div className="space-y-4">
      <EditProfileForm me={me} onSaved={onSaved} />
    </div>
  );
}

/* ─── Deposits Tab ─── */
function DepositsTab({ deposits }: { deposits: Deposit[] }) {
  const downloadCSV = () => {
    const header = "Date,Amount,Method,UTR,Status\n";
    const rows = deposits
      .map((d) =>
        [
          new Date(d.createdAt).toLocaleString(),
          d.amount,
          d.method,
          d.utr || "",
          d.status,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deposits.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Wallet size={16} className="text-yellow-300" /> Deposits History
        </h2>
        <button
          onClick={downloadCSV}
          disabled={deposits.length === 0}
          className="inline-flex items-center gap-1.5 text-xs rounded-lg border border-yellow-500/20 px-2.5 py-1.5 text-zinc-200 hover:bg-yellow-500/10 disabled:opacity-40"
        >
          <Download size={12} /> CSV
        </button>
      </div>
      {deposits.length === 0 ? (
        <div className="p-8 text-center text-sm text-zinc-400">No deposits yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-yellow-300/80 bg-black/30">
              <tr>
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-right px-4 py-2.5">Amount</th>
                <th className="text-center px-4 py-2.5">Method</th>
                <th className="text-left px-4 py-2.5">UTR</th>
                <th className="text-center px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr
                  key={d.id}
                  className="border-t border-white/5 hover:bg-white/3 transition cursor-pointer"
                >
                  <td className="px-4 py-2.5 text-zinc-300 text-xs whitespace-nowrap">
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-white font-semibold">
                    {formatINR(d.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-center text-zinc-300 text-xs uppercase">
                    {d.method.replace("_", " ")}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400 text-xs font-mono">{d.utr || "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Withdrawals Tab ─── */
function WithdrawalsTab({ withdrawals }: { withdrawals: Withdrawal[] }) {
  const downloadCSV = () => {
    const header = "Date,Amount,Net Amount,Method,Status\n";
    const rows = withdrawals
      .map((w) =>
        [
          new Date(w.createdAt).toLocaleString(),
          w.amount,
          w.netAmount,
          w.method,
          w.status,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "withdrawals.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <ArrowDownToLine size={16} className="text-yellow-300" /> Withdrawals History
        </h2>
        <button
          onClick={downloadCSV}
          disabled={withdrawals.length === 0}
          className="inline-flex items-center gap-1.5 text-xs rounded-lg border border-yellow-500/20 px-2.5 py-1.5 text-zinc-200 hover:bg-yellow-500/10 disabled:opacity-40"
        >
          <Download size={12} /> CSV
        </button>
      </div>
      {withdrawals.length === 0 ? (
        <div className="p-8 text-center text-sm text-zinc-400">No withdrawal requests yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-yellow-300/80 bg-black/30">
              <tr>
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-right px-4 py-2.5">Requested</th>
                <th className="text-right px-4 py-2.5">Net (after fee)</th>
                <th className="text-center px-4 py-2.5">Method</th>
                <th className="text-center px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => (
                <tr key={w.id} className="border-t border-white/5 hover:bg-white/3 transition cursor-pointer">
                  <td className="px-4 py-2.5 text-zinc-300 text-xs whitespace-nowrap">
                    {new Date(w.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-white">{formatINR(w.amount)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-300 font-semibold">
                    {formatINR(w.netAmount)}
                  </td>
                  <td className="px-4 py-2.5 text-center text-zinc-300 text-xs uppercase">{w.method}</td>
                  <td className="px-4 py-2.5 text-center">
                    <StatusBadge status={w.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


/* ─── Statement Tab ─── */
function StatementTab({
  events,
  filter,
  onFilterChange,
}: {
  events: StatementEvent[];
  filter: "all" | "deposit" | "withdrawal" | "earnings";
  onFilterChange: (v: "all" | "deposit" | "withdrawal" | "earnings") => void;
}) {
  const [busyCSV, setBusyCSV] = useState(false);
  const [busyPDF, setBusyPDF] = useState(false);

  const dlCSV = async () => {
    setBusyCSV(true);
    try { await downloadFile("/me/statement.csv"); } catch (e: any) { alert(e?.message || "Download failed"); } finally { setBusyCSV(false); }
  };
  const dlPDF = async () => {
    setBusyPDF(true);
    try { await downloadFile("/me/statement.pdf"); } catch (e: any) { alert(e?.message || "Download failed"); } finally { setBusyPDF(false); }
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/5 flex-wrap">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <FileText size={16} className="text-yellow-300" /> Statement
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as any)}
            className="text-xs rounded-lg bg-black/40 border border-yellow-500/20 text-zinc-200 px-2 py-1.5 focus:outline-none"
          >
            <option value="all">All activity</option>
            <option value="deposit">Deposits</option>
            <option value="withdrawal">Withdrawals</option>
            <option value="earnings">Earnings</option>
          </select>
          <button onClick={dlCSV} disabled={busyCSV}
            className="inline-flex items-center gap-1 text-xs rounded-lg border border-yellow-500/20 px-2.5 py-1.5 text-zinc-200 hover:bg-yellow-500/10 disabled:opacity-50">
            {busyCSV ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} CSV
          </button>
          <button onClick={dlPDF} disabled={busyPDF}
            className="inline-flex items-center gap-1 text-xs rounded-lg border border-yellow-500/20 px-2.5 py-1.5 text-zinc-200 hover:bg-yellow-500/10 disabled:opacity-50">
            {busyPDF ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
          </button>
        </div>
      </div>
      {events.length === 0 ? (
        <div className="p-8 text-center text-sm text-zinc-400">No activity for this filter.</div>
      ) : (
        <ul className="divide-y divide-white/5">
          {events.map((e) => (
            <li key={`${e.kind}:${e.id}`} className="px-5 py-3 flex items-center gap-4">
              <EventIcon kind={e.kind} direction={e.direction} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{e.title}</div>
                <div className="text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
                  <span>{new Date(e.at).toLocaleString()}</span>
                  {e.status && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${statusCls(e.status)}`}>
                      {e.status}
                    </span>
                  )}
                  {e.ref && <span className="font-mono truncate">· {e.ref}</span>}
                </div>
              </div>
              <div className={`text-sm font-semibold shrink-0 ${
                e.direction === "credit" ? "text-emerald-300" :
                e.direction === "debit" ? "text-red-300" : "text-zinc-400"
              }`}>
                {e.direction === "credit" ? "+" : e.direction === "debit" ? "−" : ""}
                {formatINR(e.amount)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── Security Tab ─── */
function SecurityTab({ hasPassword, onChanged }: { hasPassword: boolean; onChanged: () => Promise<void> }) {
  return (
    <div className="space-y-4">
      <PasswordCard hasPassword={hasPassword} onChanged={onChanged} />
    </div>
  );
}


/* ─── Shared helpers ─── */

function statusCls(s: string) {
  const k = s.toLowerCase();
  if (k === "approved" || k === "active" || k === "ok" || k === "completed") return "bg-emerald-500/15 text-emerald-300";
  if (k === "pending") return "bg-amber-500/15 text-amber-300";
  if (k === "rejected" || k === "blocked" || k === "failed") return "bg-red-500/15 text-red-300";
  return "bg-zinc-700/40 text-zinc-300";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold ${statusCls(status)}`}>
      {status}
    </span>
  );
}

function EventIcon({ kind, direction }: { kind: string; direction: string }) {
  const isCredit = direction === "credit";
  const icon =
    kind === "deposit" ? Wallet
    : kind === "withdrawal" ? ArrowDownToLine
    : kind === "investment" ? FileText
    : kind === "spin" || kind === "scratch" ? Sparkles
    : kind === "claim" ? Gift
    : History;
  const Icon = icon as any;
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
      isCredit ? "bg-emerald-500/15 text-emerald-300" :
      direction === "debit" ? "bg-red-500/10 text-red-300" :
      "bg-yellow-500/10 text-yellow-300"
    }`}>
      <Icon size={18} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/30 border border-yellow-500/15 px-3 py-2 min-w-[100px]">
      <div className="text-[10px] uppercase tracking-widest text-yellow-400/80 truncate">{label}</div>
      <div className="text-sm font-semibold text-white truncate">{value}</div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/30 to-amber-500/20 border border-yellow-500/40 flex items-center justify-center text-2xl font-bold text-yellow-200 shrink-0">
      {initials}
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: "emerald" | "zinc" | "gold" | "amber" }) {
  const cls =
    color === "emerald" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : color === "gold" ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
    : color === "amber" ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : "bg-zinc-700/40 text-zinc-300 border-white/10";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  );
}

function ReferralChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-[10px] uppercase tracking-wider hover:bg-yellow-500/20"
      title="Tap to copy referral code"
    >
      <Sparkles size={10} />
      <span className="font-mono normal-case">{code}</span>
      {copied ? <CheckCircle2 size={10} /> : <Copy size={10} />}
    </button>
  );
}


/* ─── Edit Profile Form ─── */
function EditProfileForm({ me, onSaved }: { me: MeResponse; onSaved: () => void }) {
  const [firstName, setFirstName] = useState(me.user.firstName || "");
  const [lastName, setLastName] = useState(me.user.lastName || "");
  const [phone, setPhone] = useState(me.user.phone || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const dirty = useMemo(
    () =>
      firstName !== (me.user.firstName || "") ||
      lastName !== (me.user.lastName || "") ||
      phone !== (me.user.phone || ""),
    [firstName, lastName, phone, me.user]
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(false);
    setBusy(true);
    try {
      await api("/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        }),
      });
      setOk(true);
      onSaved();
      setTimeout(() => setOk(false), 2000);
    } catch (e: any) {
      setErr(e?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-5 grid gap-4 md:grid-cols-2">
      <Field label="First name" icon={<UserIcon size={14} />}>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, 40))}
          className="inp"
          placeholder="Aarav"
        />
      </Field>
      <Field label="Last name" icon={<UserIcon size={14} />}>
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, 40))}
          className="inp"
          placeholder="Sharma"
        />
      </Field>
      <Field label="Email (cannot change)" icon={<Mail size={14} />}>
        <input value={me.user.email} disabled className="inp opacity-60 cursor-not-allowed" />
      </Field>
      <Field label="Mobile" icon={<Phone size={14} />} prefix="+91">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          className="inp"
          placeholder="10-digit mobile"
        />
      </Field>
      <div className="md:col-span-2 flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={!dirty || busy}
          className="rounded-xl bg-[var(--primary)] px-5 py-2.5 font-semibold text-black hover:brightness-95 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {busy ? "Saving…" : "Save changes"}
        </button>
        {ok && <span className="text-xs text-emerald-300">✓ Saved</span>}
        {err && <span className="text-xs text-red-300">{err}</span>}
      </div>
      <style jsx>{`
        .inp {
          width: 100%;
          background: rgba(0,0,0,0.35);
          border: 1px solid rgba(255,215,0,0.2);
          color: white;
          border-radius: 10px;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .inp:focus { border-color: rgba(255,215,0,0.55); }
      `}</style>
    </form>
  );
}

function Field({
  label,
  icon,
  prefix,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  prefix?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest text-zinc-400 mb-1 inline-flex items-center gap-1.5">
        {icon} {label}
      </div>
      {prefix ? (
        <div className="flex items-stretch rounded-xl border border-yellow-500/20 bg-black/30 overflow-hidden focus-within:border-yellow-500/55">
          <span className="px-3 py-2 text-zinc-400 border-r border-yellow-500/10 text-sm self-center">{prefix}</span>
          <div className="flex-1">{children}</div>
        </div>
      ) : (
        children
      )}
    </label>
  );
}


/* ─── Password Card ─── */
function PasswordCard({ hasPassword, onChanged }: { hasPassword: boolean; onChanged: () => Promise<void> }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(false);
    if (next.length < 6) return setErr("New password must be at least 6 characters");
    if (next !== confirm) return setErr("Passwords do not match");
    setBusy(true);
    try {
      if (hasPassword) {
        await api("/auth/change-password", {
          method: "POST",
          body: JSON.stringify({ currentPassword: current, newPassword: next }),
        });
      } else {
        await api("/auth/set-password", {
          method: "POST",
          body: JSON.stringify({ password: next }),
        });
      }
      setOk(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      await onChanged();
      setTimeout(() => setOk(false), 2500);
    } catch (e: any) {
      setErr(e?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-5 grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2 text-sm text-zinc-300">
        {hasPassword ? (
          <>Change your login password. You&apos;ll stay signed in on this device.</>
        ) : (
          <>You haven&apos;t set a password yet. Create one so you can log in without OTP next time.</>
        )}
      </div>

      {hasPassword && (
        <Field label="Current password" icon={<Lock size={14} />}>
          <div className="flex items-stretch rounded-xl border border-yellow-500/20 bg-black/30 overflow-hidden focus-within:border-yellow-500/55">
            <input
              type={show ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              className="flex-1 bg-transparent px-3 py-2.5 text-white text-sm outline-none"
            />
          </div>
        </Field>
      )}

      <Field label="New password" icon={<Lock size={14} />}>
        <div className="flex items-stretch rounded-xl border border-yellow-500/20 bg-black/30 overflow-hidden focus-within:border-yellow-500/55">
          <input
            type={show ? "text" : "password"}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            className="flex-1 bg-transparent px-3 py-2.5 text-white text-sm outline-none"
          />
        </div>
      </Field>

      <Field label="Confirm new password" icon={<Lock size={14} />}>
        <div className="flex items-stretch rounded-xl border border-yellow-500/20 bg-black/30 overflow-hidden focus-within:border-yellow-500/55">
          <input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            className="flex-1 bg-transparent px-3 py-2.5 text-white text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="px-3 text-zinc-400 hover:text-yellow-300"
            tabIndex={-1}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </Field>

      <div className="md:col-span-2 flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[var(--primary)] px-5 py-2.5 font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {busy ? "Saving…" : hasPassword ? "Change password" : "Set password"}
        </button>
        {ok && <span className="text-xs text-emerald-300">✓ Updated</span>}
        {err && <span className="text-xs text-red-300">{err}</span>}
      </div>
    </form>
  );
}
