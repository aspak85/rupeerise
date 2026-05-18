"use client";
import { useCallback, useEffect, useState } from "react";
import { Search, ShieldCheck, ShieldX, BadgeCheck, Download } from "lucide-react";
import { api, downloadFile, formatINR } from "@/lib/api";

type User = {
  id: string;
  email: string;
  phone?: string | null;
  name?: string | null;
  role: string;
  status: "active" | "blocked";
  kycVerified: boolean;
  referralCode: string;
  createdAt: string;
  lastLoginAt?: string | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState<User | null>(null);

  const load = useCallback(async () => {
    const data = await api<{ users: User[] }>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setUsers(data.users);
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (id: string, patch: any) => {
    setBusyId(id);
    try {
      await api(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const exportCsv = async () => {
    try {
      await downloadFile("/admin/exports/users.csv");
    } catch (e: any) {
      alert(e?.message || "Export failed");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Users</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">User management</h1>
        </div>
        <button
          onClick={exportCsv}
          className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm font-semibold text-yellow-200 hover:bg-yellow-500/20 inline-flex items-center gap-2"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="glass rounded-2xl p-3 flex items-center gap-2">
        <Search size={16} className="text-zinc-400 ml-1" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email, phone or referral code"
          className="flex-1 bg-transparent px-2 py-2 text-white text-sm focus:outline-none"
        />
        <button onClick={load} className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-black">Search</button>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/40 text-zinc-400 text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">KYC</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-500/10 text-zinc-200">
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">No users found</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium truncate" title={u.email}>{u.email}</div>
                    <div className="text-xs text-zinc-500">{u.phone ? `+91 ${u.phone}` : "no phone"}</div>
                  </td>
                  <td className="px-4 py-3"><code className="text-yellow-300 text-xs">{u.referralCode}</code></td>
                  <td className="px-4 py-3 text-xs">{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-[10px] uppercase ${u.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {u.kycVerified ? <BadgeCheck size={16} className="text-emerald-400" /> : <span className="text-xs text-zinc-500">Unverified</span>}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase">{u.role}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      disabled={busyId === u.id}
                      onClick={() => update(u.id, { status: u.status === "active" ? "blocked" : "active" })}
                      className="inline-flex items-center gap-1 rounded-lg border border-yellow-500/20 px-2 py-1 text-xs hover:bg-yellow-500/10"
                    >
                      {u.status === "active" ? <><ShieldX size={12} /> Block</> : <><ShieldCheck size={12} /> Unblock</>}
                    </button>
                    <button
                      disabled={busyId === u.id}
                      onClick={() => update(u.id, { kycVerified: !u.kycVerified })}
                      className="rounded-lg border border-yellow-500/20 px-2 py-1 text-xs hover:bg-yellow-500/10"
                    >
                      {u.kycVerified ? "Revoke KYC" : "Approve KYC"}
                    </button>
                    <button
                      onClick={() => setAdjustOpen(u)}
                      className="rounded-lg bg-[var(--primary)] px-2 py-1 text-xs font-semibold text-black"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {adjustOpen && (
        <AdjustModal user={adjustOpen} onClose={() => setAdjustOpen(null)} onDone={async () => { setAdjustOpen(null); await load(); }} />
      )}
    </div>
  );
}

function AdjustModal({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: () => void }) {
  const [walletType, setWalletType] = useState("deposit");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState<number>(100);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await api(`/admin/users/${user.id}/adjust`, {
        method: "POST",
        body: JSON.stringify({ walletType, direction, amount, reason }),
      });
      onDone();
    } catch (e: any) {
      setErr(e?.message || "Adjust failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl glass p-6">
          <h4 className="text-white text-lg font-semibold">Adjust Wallet</h4>
          <p className="text-xs text-zinc-400 mt-1 truncate">{user.email} • {user.referralCode}</p>

          <div className="mt-4 grid gap-3 text-sm">
            <label className="block">
              <div className="text-xs text-zinc-400 mb-1">Wallet</div>
              <select value={walletType} onChange={(e) => setWalletType(e.target.value)} className="w-full rounded-lg border border-yellow-500/20 bg-black/40 px-3 py-2 text-white">
                <option value="deposit">Deposit</option>
                <option value="earnings">Earnings</option>
                <option value="referral">Referral</option>
                <option value="bonus">Bonus</option>
                <option value="withdrawal">Withdrawal</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs text-zinc-400 mb-1">Direction</div>
              <select value={direction} onChange={(e) => setDirection(e.target.value as any)} className="w-full rounded-lg border border-yellow-500/20 bg-black/40 px-3 py-2 text-white">
                <option value="credit">Credit (+)</option>
                <option value="debit">Debit (−)</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs text-zinc-400 mb-1">Amount</div>
              <input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} className="w-full rounded-lg border border-yellow-500/20 bg-black/40 px-3 py-2 text-white" />
              <div className="mt-1 text-xs text-zinc-500">Preview: {direction === "credit" ? "+" : "−"}{formatINR(amount)} → {walletType}</div>
            </label>
            <label className="block">
              <div className="text-xs text-zinc-400 mb-1">Reason</div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. manual reconciliation" className="w-full rounded-lg border border-yellow-500/20 bg-black/40 px-3 py-2 text-white" />
            </label>
            {err && <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-200">{err}</div>}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg bg-zinc-700 px-3 py-2 text-sm text-white">Cancel</button>
            <button disabled={busy} onClick={submit} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-black">
              {busy ? "Applying…" : "Apply Adjustment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
