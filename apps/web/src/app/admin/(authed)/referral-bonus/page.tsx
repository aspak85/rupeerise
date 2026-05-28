"use client";
import { useCallback, useEffect, useState } from "react";
import { api, formatINR } from "@/lib/api";
import { Gift, CheckCircle, RefreshCw, Users, AlertCircle } from "lucide-react";

type ReferralRow = {
  // The person who WAS INVITED (joined via referral link)
  inviteeId: string;
  inviteeEmail: string;
  inviteeName: string | null;
  inviteeJoined: string;
  // The person who INVITED (referrer) — THIS person gets the bonus
  referrerId: string;
  referrerEmail: string;
  referrerName: string | null;
  referrerCode: string;
  // Plan details
  activePlanName: string | null;
  activePlanPrice: number | null;
};

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  referralCode: string;
  referredById: string | null;
  createdAt: string;
};

export default function ReferralBonusPage() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [bonusMap, setBonusMap] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  // Custom one-off bonus: referrer id → amount
  const [customBonus, setCustomBonus] = useState<{ userId: string; email: string; amount: number } | null>(null);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ users: AdminUser[] }>("/admin/users?limit=500");
      const users: AdminUser[] = data.users || [];
      setAllUsers(users);

      // Build lookup: id → user
      const byId: Record<string, AdminUser> = {};
      for (const u of users) byId[u.id] = u;

      // Only invited users who have referredById
      const invitees = users.filter((u) => u.referredById);

      // Build rows: for each invitee, find their referrer
      const built: ReferralRow[] = invitees
        .map((invitee) => {
          const referrer = invitee.referredById ? byId[invitee.referredById] : null;
          if (!referrer) return null;
          return {
            inviteeId: invitee.id,
            inviteeEmail: invitee.email,
            inviteeName: invitee.firstName || invitee.name,
            inviteeJoined: invitee.createdAt,
            referrerId: referrer.id,
            referrerEmail: referrer.email,
            referrerName: referrer.firstName || referrer.name,
            referrerCode: referrer.referralCode,
            activePlanName: null,
            activePlanPrice: null,
          } as ReferralRow;
        })
        .filter(Boolean) as ReferralRow[];

      setRows(built);

      // Default bonus 100 per referrer
      const defaults: Record<string, number> = {};
      for (const r of built) {
        if (!defaults[r.referrerId]) defaults[r.referrerId] = 100;
      }
      setBonusMap(defaults);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // Grant bonus TO THE REFERRER (not the invitee)
  const grantBonus = async (row: ReferralRow) => {
    const amount = bonusMap[row.referrerId] || 100;
    if (!confirm(`${row.referrerEmail} ko ₹${amount} referral bonus dena hai?\n\nYeh is liye ki unhone ${row.inviteeEmail} ko invite kiya tha.`)) return;
    setBusy(row.inviteeId);
    try {
      // Credit referrer's bonus wallet
      await api(`/admin/users/${row.referrerId}/adjust`, {
        method: "POST",
        body: JSON.stringify({
          walletType: "referral",
          direction: "credit",
          amount,
          reason: `Referral bonus: ${row.inviteeEmail} joined via your invite`,
        }),
      });
      // Send notification to referrer
      // (This goes via API so use the notifications endpoint if available, else skip)
      showToast("ok", `✅ ₹${amount} referral bonus credited to ${row.referrerEmail}!`);
    } catch (e: any) {
      showToast("err", `❌ Failed: ${e?.message}`);
    } finally {
      setBusy(null);
    }
  };

  // Custom extra bonus to any user
  const grantCustomBonus = async () => {
    if (!customBonus) return;
    if (!confirm(`${customBonus.email} ko extra ₹${customBonus.amount} bonus dena hai?`)) return;
    setBusy("custom");
    try {
      await api(`/admin/users/${customBonus.userId}/adjust`, {
        method: "POST",
        body: JSON.stringify({
          walletType: "bonus",
          direction: "credit",
          amount: customBonus.amount,
          reason: "Admin granted extra referral bonus",
        }),
      });
      showToast("ok", `✅ ₹${customBonus.amount} extra bonus credited to ${customBonus.email}!`);
      setCustomBonus(null);
    } catch (e: any) {
      showToast("err", `❌ Failed: ${e?.message}`);
    } finally {
      setBusy(null);
    }
  };

  // Group rows by referrer so we can see how many people each one invited
  const byReferrer: Record<string, ReferralRow[]> = {};
  for (const r of rows) {
    if (!byReferrer[r.referrerId]) byReferrer[r.referrerId] = [];
    byReferrer[r.referrerId].push(r);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Admin · Referrals</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Referral Bonus Approval</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Jo log invite karte hain <strong className="text-white">unko</strong> bonus milta hai — yahan approve karo.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Info box */}
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-sm text-blue-200 flex gap-2">
        <AlertCircle size={16} className="shrink-0 mt-0.5" />
        <span>
          <strong>Logic:</strong> Jab koi user apne dost ko invite karta hai aur woh join karta hai — tab <strong>inviter (referrer)</strong> ko bonus milta hai, invitee ko nahi. Neeche har invitee ke saath uske referrer ka naam dikh raha hai.
        </span>
      </div>

      {toast && (
        <div className={`rounded-xl px-4 py-3 text-sm border ${toast.kind === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-red-500/10 border-red-500/30 text-red-200"}`}>
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="glass rounded-xl p-4">
          <div className="text-xs text-zinc-400">Total Invitees</div>
          <div className="text-2xl font-bold text-white mt-1">{rows.length}</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-xs text-zinc-400">Unique Referrers</div>
          <div className="text-2xl font-bold text-yellow-300 mt-1">{Object.keys(byReferrer).length}</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-xs text-zinc-400">Total Users</div>
          <div className="text-2xl font-bold text-zinc-300 mt-1">{allUsers.length}</div>
        </div>
      </div>

      {/* Custom bonus section */}
      <div className="glass rounded-2xl p-5">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
          <Gift size={16} className="text-yellow-300" />
          Kisi Bhi User ko Extra Bonus Do
        </h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-zinc-400 mb-1">User Email ya Name se Search</div>
            <select
              className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-2.5 text-white focus:outline-none"
              value={customBonus?.userId || ""}
              onChange={(e) => {
                const u = allUsers.find((x) => x.id === e.target.value);
                if (u) setCustomBonus({ userId: u.id, email: u.email, amount: customBonus?.amount || 100 });
                else setCustomBonus(null);
              }}
            >
              <option value="">-- User select karo --</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.email} {u.firstName ? `(${u.firstName})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <div className="text-xs text-zinc-400 mb-1">Amount (₹)</div>
            <input
              type="number"
              min={1}
              value={customBonus?.amount ?? 100}
              onChange={(e) => setCustomBonus((prev) => prev ? { ...prev, amount: Number(e.target.value) } : null)}
              className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-2.5 text-white focus:outline-none"
            />
          </div>
          <button
            onClick={grantCustomBonus}
            disabled={!customBonus || busy === "custom"}
            className="rounded-xl bg-[var(--primary)] px-5 py-2.5 font-semibold text-black hover:brightness-95 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Gift size={14} />
            {busy === "custom" ? "Crediting…" : "Give Bonus"}
          </button>
        </div>
      </div>

      {/* Main table - grouped by referrer */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-yellow-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Users size={16} className="text-yellow-300" />
            <h3 className="font-semibold">Referral Pairs — Inviter → Invitee</h3>
          </div>
          <div className="text-xs text-zinc-500">Bonus milega: Inviter (left column) ko</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/40 text-zinc-400 text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-3">👤 Inviter (Referrer) — Bonus Pane Wala</th>
                <th className="text-left px-4 py-3">🎯 Invitee — Jo Join Hua</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Bonus (₹)</th>
                <th className="text-right px-4 py-3">Approve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-500/10 text-zinc-200">
              {loading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Koi referral pair nahi mila</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.inviteeId} className="hover:bg-white/[0.02]">
                  {/* REFERRER — who gets the bonus */}
                  <td className="px-4 py-3">
                    <div className="text-emerald-300 font-semibold truncate">{row.referrerEmail}</div>
                    <div className="text-xs text-zinc-500">
                      {row.referrerName || "—"} · Code: <span className="font-mono text-yellow-400/80">{row.referrerCode}</span>
                    </div>
                  </td>
                  {/* INVITEE — who joined */}
                  <td className="px-4 py-3">
                    <div className="text-zinc-300 truncate">{row.inviteeEmail}</div>
                    <div className="text-xs text-zinc-500">{row.inviteeName || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {new Date(row.inviteeJoined).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={bonusMap[row.referrerId] ?? 100}
                      onChange={(e) => setBonusMap((m) => ({ ...m, [row.referrerId]: Number(e.target.value) }))}
                      className="w-24 rounded-lg border border-yellow-500/20 bg-black/40 px-2 py-1.5 text-white focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={busy === row.inviteeId}
                      onClick={() => grantBonus(row)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-black hover:brightness-95 disabled:opacity-60"
                    >
                      <CheckCircle size={12} />
                      {busy === row.inviteeId ? "Crediting…" : "Approve Bonus"}
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
