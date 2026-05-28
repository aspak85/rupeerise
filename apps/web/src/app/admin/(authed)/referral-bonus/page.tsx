"use client";
import { useCallback, useEffect, useState } from "react";
import { api, formatINR } from "@/lib/api";
import { Gift, CheckCircle, RefreshCw } from "lucide-react";

type ReferralUser = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  createdAt: string;
  referredBy: { email: string; referralCode: string } | null;
  activeInvestments: number;
  totalDeposited: number;
};

export default function ReferralBonusPage() {
  const [users, setUsers] = useState<ReferralUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [bonusMap, setBonusMap] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Use admin users endpoint with filter
      const data = await api<{ users: any[] }>("/admin/users?limit=200");
      // Filter users who were referred
      const referred = data.users.filter((u: any) => u.referredById);
      setUsers(referred.map((u: any) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        firstName: u.firstName,
        createdAt: u.createdAt,
        referredBy: null, // would need separate lookup
        activeInvestments: 0,
        totalDeposited: 0,
      })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grantBonus = async (userId: string, email: string) => {
    const amount = bonusMap[userId] || 100;
    if (!confirm(`Grant ₹${amount} referral bonus to ${email}?`)) return;
    setBusy(userId);
    try {
      await api(`/admin/users/${userId}/adjust`, {
        method: "POST",
        body: JSON.stringify({ walletType: "bonus", direction: "credit", amount, reason: "Referral join bonus - admin approved" }),
      });
      setToast(`✅ ₹${amount} bonus credited to ${email}`);
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      setToast(`❌ Failed: ${e?.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Admin · Referrals</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Referral Bonus Approval</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Yahan par referred users ko manual bonus approve kar sakte ho.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {toast && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-200">
          {toast}
        </div>
      )}

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-yellow-500/10 flex items-center gap-2 text-white">
          <Gift size={16} className="text-yellow-300" />
          <h3 className="font-semibold">Referred Users ({users.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/40 text-zinc-400 text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Bonus Amount (₹)</th>
                <th className="text-right px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-500/10 text-zinc-200">
              {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Loading...</td></tr>}
              {!loading && users.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">Koi referred user nahi mila</td></tr>}
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="text-white truncate">{u.email}</div>
                    <div className="text-xs text-zinc-500">{u.firstName || u.name || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{new Date(u.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={bonusMap[u.id] ?? 100}
                      onChange={(e) => setBonusMap((m) => ({ ...m, [u.id]: Number(e.target.value) }))}
                      className="w-24 rounded-lg border border-yellow-500/20 bg-black/40 px-2 py-1.5 text-white focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={busy === u.id}
                      onClick={() => grantBonus(u.id, u.email)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-black hover:brightness-95 disabled:opacity-60"
                    >
                      <CheckCircle size={12} />
                      {busy === u.id ? "Crediting…" : "Grant Bonus"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
