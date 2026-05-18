"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { api, formatINR } from "@/lib/api";

type Withdrawal = {
  id: string;
  createdAt: string;
  amount: string;
  netAmount: string;
  feePercent: number;
  method: string;
  accountJson: string;
  status: "pending" | "approved" | "rejected" | "processing";
  payoutRef?: string | null;
  User?: { id: string; email: string; phone?: string | null; name?: string | null };
};

export default function AdminWithdrawalsPage() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<{ withdrawals: Withdrawal[] }>(`/admin/withdrawals?status=${status}`);
    setItems(data.withdrawals);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string) => {
    const ref = window.prompt("Payout reference (optional, e.g. UPI txn id)") || "";
    setBusyId(id);
    setErr(null);
    try {
      await api(`/admin/withdrawals/${id}/approve`, { method: "POST", body: JSON.stringify({ payoutRef: ref }) });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    if (!window.confirm("Reject this withdrawal? Funds will be refunded to user's earnings wallet.")) return;
    setBusyId(id);
    setErr(null);
    try {
      await api(`/admin/withdrawals/${id}/reject`, { method: "POST" });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Withdrawals</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Process payouts</h1>
        </div>
        <div className="rounded-xl glass p-1 flex">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-widest ${status === s ? "bg-[var(--primary)] text-black font-semibold" : "text-zinc-300 hover:bg-yellow-500/10"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {err && <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-200">{err}</div>}

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/40 text-zinc-400 text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Gross</th>
                <th className="text-left px-4 py-3">Net</th>
                <th className="text-left px-4 py-3">Method</th>
                <th className="text-left px-4 py-3">Account</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-500/10 text-zinc-200">
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">No withdrawals</td></tr>
              )}
              {items.map((w) => {
                let acct: any = {};
                try { acct = JSON.parse(w.accountJson); } catch {}
                return (
                  <tr key={w.id}>
                    <td className="px-4 py-3 text-xs">{new Date(w.createdAt).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <div className="text-white truncate" title={w.User?.email}>{w.User?.email || "—"}</div>
                      {w.User?.phone && <div className="text-[10px] text-zinc-500">+91 {w.User.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-white">{formatINR(w.amount)}</td>
                    <td className="px-4 py-3 gold-text font-semibold">{formatINR(w.netAmount)}</td>
                    <td className="px-4 py-3 capitalize">{w.method}</td>
                    <td className="px-4 py-3 text-xs">
                      {w.method === "upi" ? (
                        <span>{acct.upi || "—"}</span>
                      ) : (
                        <span>{acct.name || "—"} • {acct.accountNumber || "—"} • {acct.ifsc || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-[10px] uppercase ${
                        w.status === "approved" ? "bg-emerald-500/15 text-emerald-300" :
                        w.status === "rejected" ? "bg-red-500/15 text-red-300" :
                        "bg-yellow-500/15 text-yellow-300"
                      }`}>{w.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      {w.status === "pending" ? (
                        <>
                          <button disabled={busyId === w.id} onClick={() => approve(w.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30">
                            <Check size={12} /> Approve
                          </button>
                          <button disabled={busyId === w.id} onClick={() => reject(w.id)} className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 border border-red-500/40 px-2 py-1 text-xs text-red-200 hover:bg-red-500/30">
                            <X size={12} /> Reject + Refund
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-500">{w.payoutRef || "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
