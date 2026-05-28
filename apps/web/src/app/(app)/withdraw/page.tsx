"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownToLine, Calendar, ShieldCheck } from "lucide-react";
import { api, formatINR } from "@/lib/api";
import LiveFeed from "@/components/LiveFeed";

const FEE_PCT = 5;
const MIN = 300;

type Withdrawal = {
  id: string;
  createdAt: string;
  amount: number;
  netAmount: number;
  feePercent: number;
  method: string;
  status: "pending" | "approved" | "rejected" | "processing";
};

export default function WithdrawPage() {
  const [wallets, setWallets] = useState<{ type: string; balance: string }[]>([]);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState<number>(MIN);
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [upiId, setUpiId] = useState("");
  const [accName, setAccName] = useState("");
  const [accNo, setAccNo] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Sunday + Tuesday window check (IST) — computed immediately without waiting for API
  const istDay = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCDay();
  const isWithdrawalDay = istDay === 0 || istDay === 2; // 0=Sunday, 2=Tuesday
  const nextWithdrawalDay = istDay === 0 || istDay === 2 ? "Today" : istDay < 2 ? "Tuesday" : "Sunday";

  const load = useCallback(async () => {
    const [meRes, wdRes] = await Promise.allSettled([
      api<{ wallets: { type: string; balance: string }[] }>("/me"),
      api<{ withdrawals: Withdrawal[] }>("/withdrawals"),
    ]);
    if (meRes.status === "fulfilled") setWallets(meRes.value.wallets);
    if (wdRes.status === "fulfilled") setHistory(wdRes.value.withdrawals);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const balanceOf = (t: string) => Number(wallets.find((w) => w.type === t)?.balance ?? 0);
  const withdrawable = balanceOf("earnings") + balanceOf("referral") + balanceOf("bonus");
  const fee = Math.round((amount * FEE_PCT) / 100);
  const net = Math.max(0, amount - fee);

  const submit = async () => {
    setToast(null);
    if (amount < MIN) return setToast({ kind: "err", msg: `Minimum withdrawal is ${formatINR(MIN)}` });
    if (amount > withdrawable) return setToast({ kind: "err", msg: "Amount exceeds withdrawable balance" });
    if (!isWithdrawalDay) return setToast({ kind: "err", msg: "Withdrawals are only allowed on Sundays and Tuesdays (IST)" });

    const account = method === "upi"
      ? { upi: upiId.trim() }
      : { name: accName.trim(), accountNumber: accNo.trim(), ifsc: ifsc.trim().toUpperCase() };

    if (method === "upi" && !account.upi) return setToast({ kind: "err", msg: "Enter your UPI ID" });
    if (method === "bank" && (!account.name || !account.accountNumber || !account.ifsc)) {
      return setToast({ kind: "err", msg: "Fill all bank details" });
    }

    setBusy(true);
    try {
      await api("/withdrawals", { method: "POST", body: JSON.stringify({ amount, method, account }) });
      setToast({ kind: "ok", msg: `Withdrawal request for ${formatINR(amount)} submitted.` });
      await load();
    } catch (e: any) {
      setToast({ kind: "err", msg: e?.message || "Failed to submit withdrawal" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      {/* Header — shown immediately, no API needed */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Withdraw</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Cash out earnings</h1>
          <p className="mt-1 text-sm text-zinc-300">
            Withdrawals are processed on <span className="gold-text font-semibold">Sunday & Tuesday (IST)</span> with a {FEE_PCT}% fee. Min {formatINR(MIN)}.
          </p>
        </div>
        {/* Withdrawal window badge — shown immediately from local clock */}
        <div className={`rounded-xl px-4 py-2 text-xs border flex items-center gap-2 ${isWithdrawalDay ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-zinc-800/50 border-yellow-500/20 text-zinc-300"}`}>
          <Calendar size={14} />
          {isWithdrawalDay ? "Withdrawal window: OPEN 🟢" : `Next withdrawal: ${nextWithdrawalDay}`}
        </div>
      </div>

      {loading ? (
        /* Skeleton while API loads */
        <div className="grid gap-4 lg:grid-cols-3 animate-pulse">
          <div className="lg:col-span-2 glass rounded-3xl p-6 space-y-4">
            <div className="skeleton h-6 w-48 rounded" />
            <div className="skeleton h-12 rounded-xl" />
            <div className="grid grid-cols-4 gap-2">
              {[0,1,2,3].map(i => <div key={i} className="skeleton h-9 rounded-lg" />)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="skeleton h-12 rounded-xl" />
              <div className="skeleton h-12 rounded-xl" />
            </div>
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-16 rounded-2xl" />
            <div className="skeleton h-12 rounded-xl" />
          </div>
          <div className="glass rounded-3xl p-6 space-y-3">
            <div className="skeleton h-6 w-24 rounded" />
            {[0,1,2,3,4].map(i => <div key={i} className="skeleton h-4 rounded" />)}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 glass rounded-3xl p-6" data-mark="withdraw-form">
            <div className="flex items-center gap-2 text-white">
              <ArrowDownToLine size={18} className="text-yellow-300" />
              <h3 className="font-semibold">New Withdrawal Request</h3>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="block">
                <div className="text-xs text-zinc-400 mb-1">Amount (₹)</div>
                <input
                  type="number"
                  min={MIN}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                />
                <div className="mt-1 text-xs text-zinc-500">
                  Withdrawable: <span className="text-white font-medium">{formatINR(withdrawable)}</span>
                  <span className="ml-2 text-zinc-600">(earnings + referral + bonus)</span>
                </div>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[300, 500, 1000, 2000].map((v) => (
                  <button key={v} onClick={() => setAmount(v)} className="rounded-lg border border-yellow-500/20 px-3 py-1.5 text-xs text-zinc-200 hover:bg-yellow-500/10">
                    ₹{v.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                {(["upi", "bank"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`rounded-xl border px-4 py-3 text-sm transition ${
                      method === m ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-200" : "border-yellow-500/20 text-zinc-300 hover:bg-yellow-500/5"
                    }`}
                  >
                    {m === "upi" ? "UPI" : "Bank Transfer"}
                  </button>
                ))}
              </div>

              {method === "upi" ? (
                <label className="block">
                  <div className="text-xs text-zinc-400 mb-1">UPI ID</div>
                  <input
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="yourname@upi"
                    className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                  />
                </label>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="block">
                    <div className="text-xs text-zinc-400 mb-1">Account Holder</div>
                    <input value={accName} onChange={(e) => setAccName(e.target.value)} className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white" />
                  </label>
                  <label className="block">
                    <div className="text-xs text-zinc-400 mb-1">Account Number</div>
                    <input value={accNo} onChange={(e) => setAccNo(e.target.value.replace(/\D/g, ""))} className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white" />
                  </label>
                  <label className="block sm:col-span-2">
                    <div className="text-xs text-zinc-400 mb-1">IFSC</div>
                    <input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white uppercase tracking-widest" />
                  </label>
                </div>
              )}

              <div className="rounded-2xl border border-yellow-500/10 bg-black/30 p-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-xs text-zinc-400">Gross</div>
                  <div className="text-white font-semibold">{formatINR(amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-400">Fee ({FEE_PCT}%)</div>
                  <div className="text-red-300 font-semibold">- {formatINR(fee)}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-400">You receive</div>
                  <div className="gold-text font-semibold">{formatINR(net)}</div>
                </div>
              </div>

              <button
                onClick={submit}
                disabled={busy || !isWithdrawalDay}
                className="rounded-xl bg-[var(--primary)] py-3 font-semibold text-black hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!isWithdrawalDay ? `Window closed (next: ${nextWithdrawalDay})` : busy ? "Submitting…" : "Submit Withdrawal"}
              </button>

              {toast && (
                <div className={`rounded-lg px-3 py-2 text-xs border ${toast.kind === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-red-500/10 border-red-500/30 text-red-200"}`}>
                  {toast.msg}
                </div>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-3xl p-6">
            <div className="flex items-center gap-2 text-white">
              <ShieldCheck size={18} className="text-yellow-300" />
              <h3 className="font-semibold">Rules</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-zinc-300 list-disc pl-4">
              <li>Sunday & Tuesday withdrawal windows (IST).</li>
              <li>Minimum withdrawal: <span className="text-white">{formatINR(MIN)}</span>.</li>
              <li>{FEE_PCT}% platform fee deducted at request.</li>
              <li>Approved payouts settle to UPI within 24h, bank within 48h.</li>
              <li>Rejected withdrawals are refunded to your earnings wallet.</li>
            </ul>
          </motion.div>
        </div>
      )}

      {/* Live withdrawal feed strip — marketing-style social proof */}
      <LiveFeed kind="withdraw" take={10} title="Live Withdrawals" />

      <div className="glass rounded-3xl p-6">
        <h3 className="text-white font-semibold">Withdrawal History</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-400 text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Amount</th>
                <th className="text-left py-2">Net</th>
                <th className="text-left py-2">Method</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-500/10 text-zinc-300">
              {loading && (
                <tr><td colSpan={5} className="py-6 text-center text-zinc-500">Loading history…</td></tr>
              )}
              {!loading && history.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-zinc-500">No withdrawals yet</td></tr>
              )}
              {history.map((w) => (
                <tr key={w.id}>
                  <td className="py-3">{new Date(w.createdAt).toLocaleString("en-IN")}</td>
                  <td className="py-3 text-white font-medium">{formatINR(w.amount)}</td>
                  <td className="py-3 gold-text font-semibold">{formatINR(w.netAmount)}</td>
                  <td className="py-3 capitalize">{w.method}</td>
                  <td className="py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-[10px] uppercase tracking-widest ${
                      w.status === "approved" ? "bg-emerald-500/15 text-emerald-300" :
                      w.status === "rejected" ? "bg-red-500/15 text-red-300" :
                      "bg-yellow-500/15 text-yellow-300"
                    }`}>
                      {w.status}
                    </span>
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
