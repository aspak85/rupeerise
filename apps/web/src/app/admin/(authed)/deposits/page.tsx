"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { api, formatINR } from "@/lib/api";

type Deposit = {
  id: string;
  createdAt: string;
  amount: string;
  method: string;
  utr?: string | null;
  status: "pending" | "approved" | "rejected";
  note?: string | null;
  User?: { id: string; email: string; phone?: string | null; name?: string | null };
};

export default function AdminDepositsPage() {
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [items, setItems] = useState<Deposit[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<{ deposits: Deposit[] }>(`/admin/deposits?status=${status}`);
    setItems(data.deposits);
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    setErr(null);
    try {
      await api(`/admin/deposits/${id}/${action}`, { method: "POST" });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Deposits</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Approve user deposits</h1>
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
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Method</th>
                <th className="text-left px-4 py-3">UTR</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-500/10 text-zinc-200">
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">No deposits</td></tr>
              )}
              {items.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 text-xs">{new Date(d.createdAt).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <div className="text-white truncate" title={d.User?.email}>{d.User?.email || "—"}</div>
                    <div className="text-[10px] text-zinc-500">{d.User?.phone ? `+91 ${d.User.phone}` : d.User?.id?.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3 gold-text font-semibold">{formatINR(d.amount)}</td>
                  <td className="px-4 py-3 capitalize">{d.method.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-xs">{d.utr || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-[10px] uppercase ${
                      d.status === "approved" ? "bg-emerald-500/15 text-emerald-300" :
                      d.status === "rejected" ? "bg-red-500/15 text-red-300" :
                      "bg-yellow-500/15 text-yellow-300"
                    }`}>{d.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {d.status === "pending" ? (
                      <>
                        <button disabled={busyId === d.id} onClick={() => act(d.id, "approve")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30">
                          <Check size={12} /> Approve
                        </button>
                        <button disabled={busyId === d.id} onClick={() => act(d.id, "reject")} className="inline-flex items-center gap-1 rounded-lg bg-red-500/20 border border-red-500/40 px-2 py-1 text-xs text-red-200 hover:bg-red-500/30">
                          <X size={12} /> Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
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
