"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CircleDollarSign, FileSearch, QrCode, Receipt, Shield, Zap } from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Deposit = {
  id: string;
  createdAt: string;
  amount: string;
  method: string;
  utr?: string;
  status: "pending" | "approved" | "rejected";
  note?: string | null;
};

type Wallet = { type: string; balance: string };

type PaymentChannel = {
  id: string;
  kind: "upi" | "bank" | "crypto" | "other" | string;
  label: string;
  value: string;
  payeeName: string;
  note: string | null;
  isDefault: boolean;
};

type DepositConfig = {
  razorpay: { enabled: boolean; keyId: string | null };
  upiId: string;
  defaultChannel: PaymentChannel | null;
  channels: PaymentChannel[];
  minDeposit: number;
};

// Build the UPI deep link with amount embedded so the user doesn't need to type it in their UPI app.
function upiPayLink(ch: { value: string; payeeName: string }, amount: number, note = "RupeeRise Deposit") {
  const params = new URLSearchParams({
    pa: ch.value,
    pn: ch.payeeName || "RupeeRise",
    am: String(amount),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

// Render that same UPI deep link as a real scannable PNG QR via qrserver.com.
function upiQrUrl(ch: { value: string; payeeName: string }, amount: number) {
  const data = encodeURIComponent(upiPayLink(ch, amount));
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&qzone=1&data=${data}`;
}

// Inject Razorpay Checkout script once when needed (no SSR side-effect).
function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  // @ts-ignore
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function WalletPage() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [config, setConfig] = useState<DepositConfig | null>(null);
  const [amount, setAmount] = useState<number>(500);
  const [utr, setUtr] = useState("");
  const [method, setMethod] = useState<"razorpay" | "manual_utr" | "upi">("razorpay");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = useCallback(async () => {
    const [me, dep, cfg] = await Promise.all([
      api<{ wallets: Wallet[] }>("/me"),
      api<{ deposits: Deposit[] }>("/deposits"),
      api<DepositConfig>("/deposits/config").catch(() => null),
    ]);
    setWallets(me.wallets);
    setDeposits(dep.deposits);
    if (cfg) {
      setConfig(cfg);
      // If Razorpay is enabled, default to it; else fall back to manual UTR.
      setMethod(cfg.razorpay.enabled ? "razorpay" : "manual_utr");
      // Pre-select the admin-marked default channel for the QR display.
      setSelectedChannelId((prev) => prev || cfg.defaultChannel?.id || cfg.channels[0]?.id || null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const payWithRazorpay = async () => {
    setToast(null);
    if (amount < 100) return setToast({ kind: "err", msg: "Minimum deposit is INR 100" });
    setBusy(true);
    try {
      const ok = await loadRazorpayCheckout();
      if (!ok) throw new Error("Could not load Razorpay. Check your internet.");
      const { keyId, order } = await api<{ keyId: string; order: any; depositId: string }>(
        "/deposits/razorpay/order",
        { method: "POST", body: JSON.stringify({ amount }) }
      );

      // @ts-ignore
      const Razorpay = window.Razorpay;
      const checkout = new Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "RupeeRise",
        description: `Wallet top-up of ${formatINR(amount)}`,
        order_id: order.id,
        theme: { color: "#facc15" },
        prefill: {
          email: user?.email || "",
          contact: user?.phone || "",
          name: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.name || "",
        },
        handler: async (resp: any) => {
          try {
            await api("/deposits/razorpay/verify", {
              method: "POST",
              body: JSON.stringify({
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }),
            });
            setToast({ kind: "ok", msg: `Payment received! ${formatINR(amount)} credited to your deposit wallet.` });
            await load();
          } catch (e: any) {
            setToast({ kind: "err", msg: e?.message || "Payment verification failed. Contact support with your payment id." });
          }
        },
        modal: {
          ondismiss: () => setToast({ kind: "err", msg: "Payment cancelled." }),
        },
      });
      checkout.open();
    } catch (e: any) {
      setToast({ kind: "err", msg: e?.message || "Could not start checkout" });
    } finally {
      setBusy(false);
    }
  };

  const submitManual = async () => {
    setToast(null);
    if (amount < 100) return setToast({ kind: "err", msg: "Minimum deposit is INR 100" });
    if (method === "manual_utr" && !utr.trim()) return setToast({ kind: "err", msg: "Enter the UTR / reference number" });
    setBusy(true);
    try {
      await api("/deposits", {
        method: "POST",
        body: JSON.stringify({ amount, method, utr: utr || undefined }),
      });
      setToast({ kind: "ok", msg: "Deposit submitted! Awaiting admin approval." });
      setUtr("");
      await load();
    } catch (e: any) {
      setToast({ kind: "err", msg: e?.message || "Failed to submit deposit" });
    } finally {
      setBusy(false);
    }
  };

  const submit = () => (method === "razorpay" ? payWithRazorpay() : submitManual());

  const balanceOf = (t: string) => Number(wallets.find((w) => w.type === t)?.balance ?? 0);
  const razorpayLive = !!config?.razorpay.enabled;

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div>
        <div className="text-xs uppercase tracking-widest text-yellow-400/80">Wallet</div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Add funds & view history</h1>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {(["deposit", "earnings", "referral", "bonus", "withdrawal"] as const).map((t) => (
          <div key={t} className="glass rounded-2xl p-4">
            <div className="text-xs uppercase tracking-widest text-zinc-400">{t}</div>
            <div className="mt-1 text-lg font-semibold text-white">{formatINR(balanceOf(t))}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between gap-2 text-white">
            <div className="flex items-center gap-2">
              <CircleDollarSign size={18} className="text-yellow-300" />
              <h3 className="font-semibold">Add Funds</h3>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${
              razorpayLive ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-zinc-700/30 text-zinc-300 border border-zinc-600"
            }`}>
              {razorpayLive ? (<><Zap size={10} /> Instant</>) : (<><Shield size={10} /> Manual</>)}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-300">
            {razorpayLive
              ? "Pay securely with Cards, UPI, NetBanking or Wallets. Funds auto-credit to your Deposit Wallet."
              : (
                <>Scan the QR on the right and pay via any UPI app. Submit the UTR to credit your wallet.</>
              )}
          </p>

          <div className="mt-4 grid gap-3">
            <label className="block">
              <div className="text-xs text-zinc-400 mb-1">Amount (₹)</div>
              <input
                type="number"
                min={100}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white focus:outline-none focus:border-yellow-500/50 text-lg font-semibold"
              />
            </label>
            <div className="flex gap-2 flex-wrap">
              {[500, 1000, 2000, 5000, 10000, 25000, 50000].map((v) => (
                <button key={v} onClick={() => setAmount(v)} className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                  amount === v
                    ? "border-yellow-500/60 bg-yellow-500/15 text-yellow-200"
                    : "border-yellow-500/20 text-zinc-200 hover:bg-yellow-500/10"
                }`}>
                  ₹{v.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
            <label className="block">
              <div className="text-xs text-zinc-400 mb-1">Payment Method</div>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white focus:outline-none focus:border-yellow-500/50"
              >
                {razorpayLive && <option value="razorpay">Razorpay — Cards / UPI / NetBanking (instant)</option>}
                <option value="manual_utr">UPI / UTR (admin verifies)</option>
              </select>
            </label>
            {method === "manual_utr" && (
              <label className="block">
                <div className="text-xs text-zinc-400 mb-1">UTR / Reference Number</div>
                <input
                  value={utr}
                  onChange={(e) => setUtr(e.target.value.toUpperCase().slice(0, 24))}
                  placeholder="12-digit UTR from your bank app"
                  className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white focus:outline-none focus:border-yellow-500/50"
                />
              </label>
            )}
            <button onClick={submit} disabled={busy} className="rounded-xl bg-[var(--primary)] py-3 font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {busy ? "Working…" : method === "razorpay" ? (<><Zap size={16} /> Pay ₹{amount.toLocaleString("en-IN")} via Razorpay</>) : "Submit Deposit Request"}
            </button>
            {toast && (
              <div className={`rounded-lg px-3 py-2 text-xs border ${toast.kind === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-red-500/10 border-red-500/30 text-red-200"}`}>
                {toast.msg}
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-3xl p-6">
          <div className="flex items-center justify-between gap-2 text-white">
            <div className="flex items-center gap-2">
              <QrCode size={18} className="text-yellow-300" />
              <h3 className="font-semibold">Scan & Pay (UPI)</h3>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-zinc-400">amount ₹{amount.toLocaleString("en-IN")}</span>
          </div>

          {(() => {
            const channels = config?.channels ?? [];
            const upiChannels = channels.filter((c) => c.kind === "upi");
            const selected =
              upiChannels.find((c) => c.id === selectedChannelId) ||
              upiChannels.find((c) => c.isDefault) ||
              upiChannels[0] ||
              ({ id: "fallback", kind: "upi", label: "Primary UPI", value: config?.upiId || "rupeerise@upi", payeeName: "RupeeRise", note: null, isDefault: true } as PaymentChannel);

            return (
              <>
                {upiChannels.length > 1 && (
                  <label className="block mt-4">
                    <div className="text-xs text-zinc-400 mb-1">Payment Channel</div>
                    <select
                      value={selected.id}
                      onChange={(e) => setSelectedChannelId(e.target.value)}
                      className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500/50"
                    >
                      {upiChannels.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}{c.isDefault ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="mt-4 rounded-2xl border border-yellow-500/20 bg-white p-4 flex items-center justify-center">
                  {/* Real scannable UPI QR — encodes the deep link with the exact amount. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={upiQrUrl(selected, amount)}
                    alt="UPI QR code"
                    width={220}
                    height={220}
                    className="rounded-lg"
                  />
                </div>
                <div className="mt-4 grid gap-2">
                  <a
                    href={upiPayLink(selected, amount)}
                    className="text-center rounded-xl border border-yellow-500/30 px-3 py-2.5 text-sm font-semibold text-yellow-200 hover:bg-yellow-500/10 transition sm:hidden"
                  >
                    Open in UPI app
                  </a>
                  <div className="text-sm text-zinc-300 text-center">
                    <span className="text-zinc-500">{selected.label} · </span>UPI ID:{" "}
                    <button
                      type="button"
                      onClick={() => navigator?.clipboard?.writeText(selected.value).catch(() => {})}
                      className="gold-text font-semibold hover:underline inline-flex items-center gap-1"
                      title="Tap to copy"
                    >
                      {selected.value}
                    </button>
                  </div>
                  {selected.note && (
                    <div className="text-xs text-yellow-200/80 text-center">{selected.note}</div>
                  )}
                  <div className="text-xs text-zinc-500 text-center">
                    Scan with GPay / PhonePe / Paytm / BHIM, then copy the UTR from the success screen and paste it on the left.
                  </div>
                </div>
              </>
            );
          })()}
        </motion.div>
      </div>

      {/* Deposit history */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-2 text-white">
          <Receipt size={18} className="text-yellow-300" />
          <h3 className="font-semibold">Deposit History</h3>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-400 text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Amount</th>
                <th className="text-left py-2">Method</th>
                <th className="text-left py-2">UTR</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-500/10 text-zinc-300">
              {deposits.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-zinc-500 flex items-center justify-center gap-2">
                    <FileSearch size={14} /> No deposits yet
                  </td>
                </tr>
              )}
              {deposits.map((d) => (
                <tr key={d.id}>
                  <td className="py-3">{new Date(d.createdAt).toLocaleString("en-IN")}</td>
                  <td className="py-3 text-white font-medium">{formatINR(d.amount)}</td>
                  <td className="py-3">{d.method}</td>
                  <td className="py-3 text-xs">{d.utr || "—"}</td>
                  <td className="py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-[10px] uppercase tracking-widest ${
                      d.status === "approved" ? "bg-emerald-500/15 text-emerald-300" : d.status === "rejected" ? "bg-red-500/15 text-red-300" : "bg-yellow-500/15 text-yellow-300"
                    }`}>
                      {d.status}
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
