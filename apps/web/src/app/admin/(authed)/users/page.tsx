"use client";
import { useCallback, useEffect, useState } from "react";
import { Search, ShieldCheck, ShieldX, BadgeCheck, Download, FileText, Eye, X, RefreshCw } from "lucide-react";
import { api, downloadFile, formatINR } from "@/lib/api";

type User = {
  id: string;
  email: string;
  phone?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  status: "active" | "blocked";
  kycVerified: boolean;
  referralCode: string;
  createdAt: string;
  lastLoginAt?: string | null;
  lastIp?: string | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState<User | null>(null);
  const [viewOpen, setViewOpen] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ users: User[] }>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setUsers(data.users);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => { load(); }, [load]);

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
    setExporting(true);
    try {
      await downloadFile("/admin/exports/users.csv", "rupeerise-users.csv");
    } catch (e: any) {
      alert(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // PDF export — generated client-side so no server changes needed
  const exportPdf = () => {
    setExporting(true);
    try {
      const rows = users.map((u, i) => `
        <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#fff"}">
          <td>${i + 1}</td>
          <td>${u.email}</td>
          <td>${u.firstName || ""} ${u.lastName || u.name || ""}</td>
          <td>${u.phone ? `+91 ${u.phone}` : "—"}</td>
          <td>${u.referralCode}</td>
          <td>${u.role}</td>
          <td><span style="color:${u.status === "active" ? "green" : "red"}">${u.status}</span></td>
          <td>${u.kycVerified ? "✅" : "❌"}</td>
          <td>${new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
          <td>${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-IN") : "—"}</td>
          <td>${u.lastIp || "—"}</td>
        </tr>
      `).join("");

      const html = `
        <!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <title>RupeeRise Users Report</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
          h1 { color: #b45309; font-size: 20px; margin-bottom: 4px; }
          .meta { color: #666; font-size: 10px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #1e1b4b; color: #fbbf24; text-align: left; padding: 6px 8px; font-size: 10px; }
          td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
          .footer { margin-top: 20px; font-size: 10px; color: #999; }
        </style>
        </head><body>
        <h1>🏆 RupeeRise — User Report</h1>
        <div class="meta">Generated: ${new Date().toLocaleString("en-IN")} | Total Users: ${users.length}</div>
        <table>
          <thead><tr>
            <th>#</th><th>Email</th><th>Name</th><th>Phone</th>
            <th>Referral Code</th><th>Role</th><th>Status</th>
            <th>KYC</th><th>Joined</th><th>Last Login</th><th>Last IP</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">RupeeRise Admin Export · Confidential</div>
        </body></html>
      `;

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) setTimeout(() => w.print(), 800);
    } finally {
      setExporting(false);
    }
  };

  const activeCount = users.filter(u => u.status === "active").length;
  const kycCount = users.filter(u => u.kycVerified).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Users</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">User Management</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10">
            <RefreshCw size={14} />
          </button>
          <button onClick={exportCsv} disabled={exporting}
            className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm font-semibold text-yellow-200 hover:bg-yellow-500/20 inline-flex items-center gap-2">
            <Download size={14} /> CSV
          </button>
          <button onClick={exportPdf} disabled={exporting}
            className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-2 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20 inline-flex items-center gap-2">
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: users.length, color: "text-white" },
          { label: "Active", value: activeCount, color: "text-emerald-300" },
          { label: "Blocked", value: users.length - activeCount, color: "text-red-300" },
          { label: "KYC Verified", value: kycCount, color: "text-yellow-300" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-4">
            <div className="text-xs text-zinc-400">{s.label}</div>
            <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="glass rounded-xl p-3 flex items-center gap-2">
        <Search size={16} className="text-zinc-400 ml-1" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Email, phone ya referral code se search karo…"
          className="flex-1 bg-transparent px-2 py-2 text-white text-sm focus:outline-none" />
        <button onClick={load} className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-black">Search</button>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/40 text-zinc-400 text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Referral</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Last Login</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">KYC</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-500/10 text-zinc-200">
              {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">Loading users…</td></tr>}
              {!loading && users.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">Koi user nahi mila</td></tr>}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium truncate max-w-[200px]" title={u.email}>{u.email}</div>
                    <div className="text-xs text-zinc-500">{[u.firstName, u.lastName || u.name].filter(Boolean).join(" ") || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{u.phone ? `+91 ${u.phone}` : <span className="text-zinc-600">No phone</span>}</td>
                  <td className="px-4 py-3"><code className="text-yellow-300 text-xs bg-yellow-500/10 px-1.5 py-0.5 rounded">{u.referralCode}</code></td>
                  <td className="px-4 py-3 text-xs">{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3 text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-IN") : <span className="text-zinc-600">Never</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-[10px] uppercase font-semibold ${u.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.kycVerified
                      ? <BadgeCheck size={16} className="text-emerald-400" />
                      : <span className="text-xs text-zinc-600">Unverified</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setViewOpen(u)} className="p-1.5 rounded-lg border border-yellow-500/20 text-yellow-300 hover:bg-yellow-500/10" title="View Details">
                        <Eye size={13} />
                      </button>
                      <button disabled={busyId === u.id} onClick={() => update(u.id, { status: u.status === "active" ? "blocked" : "active" })}
                        className="inline-flex items-center gap-1 rounded-lg border border-yellow-500/20 px-2 py-1 text-xs hover:bg-yellow-500/10">
                        {u.status === "active" ? <><ShieldX size={11} /> Block</> : <><ShieldCheck size={11} /> Unblock</>}
                      </button>
                      <button disabled={busyId === u.id} onClick={() => update(u.id, { kycVerified: !u.kycVerified })}
                        className="rounded-lg border border-yellow-500/20 px-2 py-1 text-xs hover:bg-yellow-500/10">
                        {u.kycVerified ? "Revoke KYC" : "KYC ✓"}
                      </button>
                      <button onClick={() => setAdjustOpen(u)}
                        className="rounded-lg bg-[var(--primary)] px-2 py-1 text-xs font-semibold text-black">
                        Adjust
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User detail modal */}
      {viewOpen && (
        <UserDetailModal user={viewOpen} onClose={() => setViewOpen(null)} />
      )}

      {adjustOpen && (
        <AdjustModal user={adjustOpen} onClose={() => setAdjustOpen(null)} onDone={async () => { setAdjustOpen(null); await load(); }} />
      )}
    </div>
  );
}

/* ─── User Detail Modal ─── */
function UserDetailModal({ user, onClose }: { user: User; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl glass p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-white text-lg font-semibold">User Details</h4>
              <p className="text-xs text-zinc-400 mt-0.5">{user.id}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: "Email", value: user.email },
              { label: "Name", value: [user.firstName, user.lastName || user.name].filter(Boolean).join(" ") || "—" },
              { label: "Phone", value: user.phone ? `+91 ${user.phone}` : "—" },
              { label: "Role", value: user.role },
              { label: "Status", value: user.status },
              { label: "KYC", value: user.kycVerified ? "Verified ✅" : "Unverified ❌" },
              { label: "Referral Code", value: user.referralCode },
              { label: "Joined", value: new Date(user.createdAt).toLocaleString("en-IN") },
              { label: "Last Login", value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("en-IN") : "Never" },
              { label: "Last IP", value: user.lastIp || "—" },
            ].map((row) => (
              <div key={row.label} className="rounded-xl bg-black/30 border border-yellow-500/10 p-3">
                <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{row.label}</div>
                <div className="text-white mt-0.5 break-all">{row.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Adjust Wallet Modal ─── */
function AdjustModal({ user, onClose, onDone }: { user: User; onClose: () => void; onDone: () => void }) {
  const [walletType, setWalletType] = useState("deposit");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState<number>(100);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null); setBusy(true);
    try {
      await api(`/admin/users/${user.id}/adjust`, {
        method: "POST", body: JSON.stringify({ walletType, direction, amount, reason }),
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
          <h4 className="text-white text-lg font-semibold">Wallet Adjust</h4>
          <p className="text-xs text-zinc-400 mt-1 truncate">{user.email} · {user.referralCode}</p>

          <div className="mt-4 grid gap-3 text-sm">
            <label className="block">
              <div className="text-xs text-zinc-400 mb-1">Wallet</div>
              <select value={walletType} onChange={(e) => setWalletType(e.target.value)}
                className="w-full rounded-xl border border-yellow-500/20 bg-black/40 px-3 py-2.5 text-white">
                <option value="deposit">Deposit</option>
                <option value="earnings">Earnings</option>
                <option value="referral">Referral</option>
                <option value="bonus">Bonus</option>
                <option value="withdrawal">Withdrawal</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs text-zinc-400 mb-1">Direction</div>
                <select value={direction} onChange={(e) => setDirection(e.target.value as any)}
                  className="w-full rounded-xl border border-yellow-500/20 bg-black/40 px-3 py-2.5 text-white">
                  <option value="credit">Credit (+)</option>
                  <option value="debit">Debit (−)</option>
                </select>
              </label>
              <label className="block">
                <div className="text-xs text-zinc-400 mb-1">Amount (₹)</div>
                <input type="number" min={1} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-xl border border-yellow-500/20 bg-black/40 px-3 py-2.5 text-white" />
              </label>
            </div>
            <label className="block">
              <div className="text-xs text-zinc-400 mb-1">Reason</div>
              <input value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Manual reconciliation…"
                className="w-full rounded-xl border border-yellow-500/20 bg-black/40 px-3 py-2.5 text-white" />
            </label>
            <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs text-yellow-200">
              Preview: {direction === "credit" ? "+" : "−"}{formatINR(amount)} → {walletType} wallet
            </div>
            {err && <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-200">{err}</div>}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl bg-zinc-700 px-4 py-2 text-sm text-white">Cancel</button>
            <button disabled={busy} onClick={submit} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black">
              {busy ? "Applying…" : "Apply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
