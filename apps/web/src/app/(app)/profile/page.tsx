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

const SECTIONS: { id: string; label: string; icon: any }[] = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "statement", label: "Statement", icon: FileText },
  { id: "deposits", label: "Deposits", icon: Wallet },
  { id: "withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { id: "redeem", label: "Gift codes", icon: Gift },
  { id: "security", label: "Security", icon: ShieldCheck },
];

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [events, setEvents] = useState<StatementEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<"all" | "deposit" | "withdrawal" | "earnings">("all");
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [claims, setClaims] = useState<GiftClaim[]>([]);
  const [active, setActive] = useState<string>("account");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
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
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [eventFilter]);

  useEffect(() => { load(); }, [load]);

  // Smooth-scroll to section + highlight active section on scroll
  useEffect(() => {
    const handler = () => {
      const ys = SECTIONS.map((s) => {
        const el = document.getElementById(s.id);
        if (!el) return { id: s.id, top: Number.POSITIVE_INFINITY };
        return { id: s.id, top: Math.abs(el.getBoundingClientRect().top - 120) };
      });
      ys.sort((a, b) => a.top - b.top);
      setActive(ys[0].id);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  if (loading && !me) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto w-full pb-20 animate-pulse">
        {/* Header skeleton */}
        <div className="glass rounded-2xl p-5 flex items-start gap-4 flex-wrap">
          <div className="skeleton w-16 h-16 rounded-2xl" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-7 w-48 rounded" />
            <div className="skeleton h-4 w-36 rounded" />
            <div className="flex gap-2 mt-2">
              <div className="skeleton h-5 w-20 rounded-full" />
              <div className="skeleton h-5 w-24 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
            {[0,1,2,3].map(i => (
              <div key={i} className="skeleton rounded-xl h-14 w-24" />
            ))}
          </div>
        </div>
        {/* Nav skeleton */}
        <div className="glass rounded-2xl p-1.5 flex gap-1">
          {[0,1,2,3,4,5].map(i => (
            <div key={i} className="skeleton h-9 w-20 rounded-xl" />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="skeleton h-5 w-32 rounded" />
          <div className="grid gap-4 md:grid-cols-2">
            {[0,1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
          <div className="skeleton h-10 w-36 rounded-xl" />
        </div>
        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="skeleton h-5 w-32 rounded" />
          {[0,1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-4">
              <div className="skeleton w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-4 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
              <div className="skeleton h-4 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center text-zinc-400 text-sm">
        Could not load profile. <button onClick={load} className="text-yellow-300 underline ml-1">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-20">
      {/* Header */}
      <div className="glass rounded-2xl p-5 flex items-start gap-4 flex-wrap">
        <Avatar name={me.user.name || me.user.email} />
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Profile</div>
          <h1 className="text-2xl font-semibold text-white mt-0.5 truncate">
            {me.user.name || `${me.user.firstName ?? ""} ${me.user.lastName ?? ""}`.trim() || "Welcome"}
          </h1>
          <div className="text-sm text-zinc-400 mt-0.5 inline-flex items-center gap-1.5">
            <Mail size={13} /> {me.user.email}
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
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

      {/* Sticky section nav */}
      <div className="sticky top-2 z-10 glass rounded-2xl p-1.5 overflow-x-auto no-scrollbar">
        <div className="flex gap-1 min-w-max">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition ${
                active === s.id
                  ? "bg-[var(--primary)] text-black font-semibold"
                  : "text-zinc-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <s.icon size={14} /> {s.label}
            </a>
          ))}
        </div>
      </div>

      {/* ━━━ Account Section ━━━ */}
      <section id="account" className="scroll-mt-24">
        <SectionHeading icon={UserIcon} title="Account info" />
        <EditProfileForm me={me} onSaved={() => { load(); refresh(); }} />
      </section>

      {/* ━━━ Statement Section ━━━ */}
      <section id="statement" className="scroll-mt-24">
        <SectionHeading
          icon={FileText}
          title="Statement"
          right={
            <div className="flex items-center gap-2">
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value as any)}
                className="text-xs rounded-lg bg-black/40 border border-yellow-500/20 text-zinc-200 px-2 py-1.5"
              >
                <option value="all">All activity</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
                <option value="earnings">Earnings</option>
              </select>
              <DownloadButton path="/me/statement.csv" label="CSV" />
              <DownloadButton path="/me/statement.pdf" label="PDF" />
            </div>
          }
        />
        {events.length === 0 ? (
          <Empty text="No activity yet for this filter." />
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            <ul className="divide-y divide-white/5">
              {events.map((e) => (
                <li key={`${e.kind}:${e.id}`} className="px-5 py-3 flex items-center gap-4">
                  <EventIcon kind={e.kind} direction={e.direction} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{e.title}</div>
                    <div className="text-xs text-zinc-500 inline-flex items-center gap-2">
                      <span>{new Date(e.at).toLocaleString()}</span>
                      {e.status && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${statusCls(e.status)}`}>
                          {e.status}
                        </span>
                      )}
                      {e.ref && <span className="font-mono truncate">· {e.ref}</span>}
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${e.direction === "credit" ? "text-emerald-300" : e.direction === "debit" ? "text-red-300" : "text-zinc-400"}`}>
                    {e.direction === "credit" ? "+" : e.direction === "debit" ? "−" : ""}
                    {formatINR(e.amount)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ━━━ Deposits Section ━━━ */}
      <section id="deposits" className="scroll-mt-24">
        <SectionHeading icon={Wallet} title="Deposits history" />
        {deposits.length === 0 ? (
          <Empty text="You haven't made any deposits yet." />
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-widest text-yellow-300/80 bg-black/30">
                  <tr>
                    <th className="text-left px-4 py-2.5">Date</th>
                    <th className="text-right px-4 py-2.5">Amount</th>
                    <th className="text-center px-4 py-2.5">Method</th>
                    <th className="text-center px-4 py-2.5">Status</th>
                    <th className="text-left px-4 py-2.5">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d) => (
                    <tr key={d.id} className="border-t border-white/5">
                      <td className="px-4 py-2.5 text-zinc-300 text-xs">{new Date(d.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-white font-semibold">{formatINR(d.amount)}</td>
                      <td className="px-4 py-2.5 text-center text-zinc-300 text-xs uppercase">{d.method.replace("_", " ")}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${statusCls(d.status)}`}>{d.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 text-xs font-mono truncate">{d.utr || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ━━━ Withdrawals Section ━━━ */}
      <section id="withdrawals" className="scroll-mt-24">
        <SectionHeading icon={ArrowDownToLine} title="Withdrawals history" />
        {withdrawals.length === 0 ? (
          <Empty text="No withdrawal requests yet." />
        ) : (
          <div className="glass rounded-2xl overflow-hidden">
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
                    <tr key={w.id} className="border-t border-white/5">
                      <td className="px-4 py-2.5 text-zinc-300 text-xs">{new Date(w.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-white">{formatINR(w.amount)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-300 font-semibold">{formatINR(w.netAmount)}</td>
                      <td className="px-4 py-2.5 text-center text-zinc-300 text-xs uppercase">{w.method}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${statusCls(w.status)}`}>{w.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ━━━ Redeem Section ━━━ */}
      <section id="redeem" className="scroll-mt-24">
        <SectionHeading icon={Gift} title="Gift codes" />
        <RedeemBlock onRedeemed={load} claims={claims} />
      </section>

      {/* ━━━ Security Section ━━━ */}
      <section id="security" className="scroll-mt-24">
        <SectionHeading icon={ShieldCheck} title="Security" />
        <PasswordCard hasPassword={!!me.user.hasPassword} onChanged={refresh} />
      </section>
    </div>
  );
}

/* ─── Reusable building blocks ─── */

function SectionHeading({
  icon: Icon,
  title,
  right,
}: {
  icon: any;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2 text-white">
        <Icon size={18} className="text-yellow-300" />
        <h2 className="font-semibold text-lg">{title}</h2>
      </div>
      {right}
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
  return <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] uppercase tracking-wider ${cls}`}>{children}</span>;
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

function Empty({ text }: { text: string }) {
  return <div className="glass rounded-2xl p-8 text-center text-sm text-zinc-400">{text}</div>;
}

function statusCls(s: string) {
  const k = s.toLowerCase();
  if (k === "approved" || k === "active" || k === "ok" || k === "completed") return "bg-emerald-500/15 text-emerald-300";
  if (k === "pending") return "bg-amber-500/15 text-amber-300";
  if (k === "rejected" || k === "blocked" || k === "failed") return "bg-red-500/15 text-red-300";
  return "bg-zinc-700/40 text-zinc-300";
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
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCredit ? "bg-emerald-500/15 text-emerald-300" : direction === "debit" ? "bg-red-500/10 text-red-300" : "bg-yellow-500/10 text-yellow-300"}`}>
      <Icon size={18} />
    </div>
  );
}

function DownloadButton({ path, label }: { path: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const click = async () => {
    setBusy(true);
    try {
      await downloadFile(path);
    } catch (e: any) {
      alert(e?.message || "Download failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={click}
      disabled={busy}
      className="inline-flex items-center gap-1 text-xs rounded-lg border border-yellow-500/20 px-2.5 py-1.5 text-zinc-200 hover:bg-yellow-500/10 disabled:opacity-50"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} {label}
    </button>
  );
}

/* ─── Edit Profile ─── */
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
          className="input"
          placeholder="Aarav"
        />
      </Field>
      <Field label="Last name" icon={<UserIcon size={14} />}>
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, 40))}
          className="input"
          placeholder="Sharma"
        />
      </Field>
      <Field label="Email (cannot change)" icon={<Mail size={14} />}>
        <input value={me.user.email} disabled className="input opacity-60 cursor-not-allowed" />
      </Field>
      <Field label="Mobile" icon={<Phone size={14} />} prefix="+91">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          className="input"
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
        .input {
          width: 100%;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 215, 0, 0.2);
          color: white;
          border-radius: 10px;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus { border-color: rgba(255, 215, 0, 0.55); }
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

/* ─── Redeem block (compact, on-profile) ─── */

function RedeemBlock({ onRedeemed, claims }: { onRedeemed: () => void; claims: GiftClaim[] }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<{ amount: number; code: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    const c = code.trim().toUpperCase();
    if (c.length < 4) return setErr("Enter a valid gift code");
    setBusy(true);
    try {
      const r = await api<{ ok: boolean; amount: number; code: string; message: string }>("/redeem", {
        method: "POST",
        body: JSON.stringify({ code: c }),
      });
      if (!r.ok) return setErr(r.message || "Could not redeem");
      setOk({ amount: r.amount, code: r.code });
      setCode("");
      onRedeemed();
    } catch (e: any) {
      setErr(e?.message || "Could not redeem");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <form onSubmit={submit} className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 text-white mb-3">
          <Sparkles size={16} className="text-yellow-300" />
          <div className="font-semibold text-sm">Redeem a gift code</div>
        </div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="DIWALI-ABCD1234"
          className="w-full font-mono text-center sm:text-left rounded-xl bg-black/40 border border-yellow-500/30 text-white px-4 py-3 outline-none focus:border-yellow-400"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="mt-3 w-full rounded-xl bg-[var(--primary)] py-2.5 font-semibold text-black hover:brightness-95 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
          {busy ? "Redeeming…" : "Redeem now"}
        </button>
        {ok && (
          <div className="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-emerald-300 text-sm">
            ✓ +{formatINR(ok.amount)} credited! Code <span className="font-mono">{ok.code}</span>
          </div>
        )}
        {err && (
          <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-red-300 text-xs">{err}</div>
        )}
      </form>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 text-white mb-3">
          <History size={16} className="text-yellow-300" />
          <div className="font-semibold text-sm">Your redemptions</div>
        </div>
        {claims.length === 0 ? (
          <div className="text-center text-sm text-zinc-400 py-6">
            No redemptions yet. Try a code on the left!
          </div>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {claims.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-black/20">
                <div className="min-w-0">
                  <div className="font-mono text-yellow-200 text-sm truncate">{c.code}</div>
                  <div className="text-[11px] text-zinc-500">{new Date(c.claimedAt).toLocaleString()}</div>
                </div>
                <div className="text-emerald-300 font-semibold text-sm shrink-0">+{formatINR(c.amount)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Password card ─── */

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
          <>Change your login password. You'll stay signed in on this device.</>
        ) : (
          <>You haven't set a password yet. Create one so you can log in without OTP next time.</>
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
