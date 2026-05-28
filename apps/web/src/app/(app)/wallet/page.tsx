"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Banknote,
  Bitcoin,
  CircleDollarSign,
  Copy,
  FileSearch,
  QrCode,
  Receipt,
  Shield,
  Smartphone,
  Zap,
} from "lucide-react";
import { api, formatINR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import LiveFeed from "@/components/LiveFeed";

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

type DepositBonusConfig = {
  bonusPercent: number;
  message: string;
  enabled: boolean;
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
  const [bonusConfig, setBonusConfig] = useState<DepositBonusConfig | null>(null);
  const [amount, setAmount] = useState<number>(500);
  const [utr, setUtr] = useState("");
  const [method, setMethod] = useState<"razorpay" | "manual_utr" | "upi">("razorpay");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  // Two-step deposit flow:
  //   step 1 — user picks amount + payment channel (or Razorpay fast track)
  //   step 2 — we render the channel-specific payment instructions (QR / bank / crypto)
  const [step, setStep] = useState<1 | 2>(1);
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
    // Fetch deposit bonus config (non-blocking) — uses public endpoint
    try {
      const bonus = await api<{ key: string; value: DepositBonusConfig }>("/settings/deposit_config");
      if (bonus?.value) setBonusConfig(bonus.value);
    } catch {
      /* ignore — no bonus message shown */
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

      {/* === STEP 1 — amount + channel selection === */}
      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 glass rounded-3xl p-6"
          >
            <div className="flex items-center justify-between gap-2 text-white">
              <div className="flex items-center gap-2">
                <CircleDollarSign size={18} className="text-yellow-300" />
                <h3 className="font-semibold">Add Funds · Step 1 of 2</h3>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${
                  razorpayLive
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-zinc-700/30 text-zinc-300 border border-zinc-600"
                }`}
              >
                {razorpayLive ? (<><Zap size={10} /> Instant available</>) : (<><Shield size={10} /> Manual</>)}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-300">
              Enter the amount, then pick how you want to pay. UPI, bank transfer, and crypto are all accepted.
            </p>

            <div className="mt-5 grid gap-4">
              <label className="block">
                <div className="text-xs text-zinc-400 mb-2">📍 Enter Amount (₹)</div>
                <input
                  type="number"
                  min={100}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded-xl border border-yellow-500/30 bg-black/40 px-4 py-4 text-white focus:outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/20 text-2xl font-bold"
                  placeholder="0"
                />
              </label>

              {/* Deposit bonus message */}
              {bonusConfig?.enabled && bonusConfig.message && (
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200 font-medium">
                  🎁 {bonusConfig.message}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {[500, 1000, 2000, 5000, 10000, 25000, 50000].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      amount === v
                        ? "border-yellow-500/60 bg-yellow-500/15 text-yellow-200 shadow-lg shadow-yellow-500/20"
                        : "border-yellow-500/20 text-zinc-200 hover:bg-yellow-500/10 hover:border-yellow-500/30"
                    }`}
                  >
                    ₹{v.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <div className="text-xs text-zinc-400 mb-3 uppercase tracking-widest font-semibold">💳 Choose Payment Method</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {razorpayLive && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      onClick={() => {
                        setMethod("razorpay");
                        setSelectedChannelId(null);
                        if (amount < 100) {
                          setToast({ kind: "err", msg: "Minimum deposit is ₹100" });
                          return;
                        }
                        payWithRazorpay();
                      }}
                      className="text-left rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-4 hover:from-emerald-500/20 hover:to-emerald-500/10 transition shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20"
                    >
                      <div className="flex items-center gap-2 text-emerald-200 font-bold text-sm">
                        <Zap size={18} className="text-emerald-300" /> Razorpay (Instant)
                      </div>
                      <div className="mt-2 text-xs text-emerald-100/70">
                        Cards • UPI • NetBanking • Wallets<br/>Credit within seconds
                      </div>
                    </motion.button>
                  )}

                  {(config?.channels ?? []).map((c) => {
                    const Icon = c.kind === "bank" ? Banknote : c.kind === "crypto" ? Bitcoin : Smartphone;
                    const tone =
                      c.kind === "bank"
                        ? "from-sky-500/15 to-sky-500/5 border-sky-500/40 shadow-sky-500/10 hover:from-sky-500/20 hover:to-sky-500/10 hover:shadow-sky-500/20"
                        : c.kind === "crypto"
                        ? "from-fuchsia-500/15 to-fuchsia-500/5 border-fuchsia-500/40 shadow-fuchsia-500/10 hover:from-fuchsia-500/20 hover:to-fuchsia-500/10 hover:shadow-fuchsia-500/20"
                        : "from-yellow-500/15 to-yellow-500/5 border-yellow-500/40 shadow-yellow-500/10 hover:from-yellow-500/20 hover:to-yellow-500/10 hover:shadow-yellow-500/20";
                    const kindLabel = c.kind === "bank" ? "Bank Transfer" : c.kind === "crypto" ? "Crypto" : "UPI";
                    const colorClass =
                      c.kind === "bank"
                        ? "text-sky-200"
                        : c.kind === "crypto"
                        ? "text-fuchsia-200"
                        : "text-yellow-200";
                    return (
                      <motion.button
                        key={c.id}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => {
                          if (amount < 100) {
                            setToast({ kind: "err", msg: "Minimum deposit is ₹100" });
                            return;
                          }
                          setSelectedChannelId(c.id);
                          setMethod("manual_utr");
                          setStep(2);
                          setToast(null);
                        }}
                        className={`text-left rounded-2xl border p-4 bg-gradient-to-br transition shadow-lg ${tone}`}
                      >
                        <div className={`flex items-center gap-2 font-bold text-sm ${colorClass}`}>
                          <Icon size={18} /> {c.label}
                        </div>
                        <div className="mt-2 text-[11px] uppercase tracking-widest opacity-80">{kindLabel}</div>
                        {c.note && <div className="mt-1.5 text-xs opacity-75 leading-snug">{c.note}</div>}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-lg px-4 py-3 text-sm border font-medium ${
                    toast.kind === "ok"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                      : "bg-red-500/15 border-red-500/40 text-red-200"
                  }`}
                >
                  {toast.msg}
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* live deposit feed strip */}
          <LiveFeed kind="deposit" take={8} title="Live Deposits" className="" />
        </div>
      )}

      {/* === STEP 2 — channel-specific payment details === */}
      {step === 2 && (() => {
        const channels = config?.channels ?? [];
        const selected = channels.find((c) => c.id === selectedChannelId) || null;
        if (!selected) {
          // Selection lost (e.g. admin disabled a channel mid-flow) — reset to step 1.
          setStep(1);
          return null;
        }
        let meta: Record<string, string> = {};
        try { meta = selected.note ? {} : {}; if ((selected as any).metaJson) meta = JSON.parse((selected as any).metaJson) || {}; } catch { /* ignore */ }
        const isUpi = selected.kind === "upi";
        const isBank = selected.kind === "bank";
        const isCrypto = selected.kind === "crypto";
        return (
          <div className="grid gap-4 lg:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 glass rounded-3xl p-6"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setStep(1); setUtr(""); setToast(null); }}
                  className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-yellow-200"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <span className="text-xs uppercase tracking-widest text-zinc-400">Step 2 of 2</span>
              </div>

              <div className="mt-3 flex items-center gap-2 text-white">
                {isUpi && <QrCode size={18} className="text-yellow-300" />}
                {isBank && <Banknote size={18} className="text-sky-300" />}
                {isCrypto && <Bitcoin size={18} className="text-fuchsia-300" />}
                <h3 className="font-bold text-lg">{selected.label}</h3>
                <span className="ml-auto text-lg text-zinc-300">
                  Amount: <span className="gold-text font-bold">{formatINR(amount)}</span>
                </span>
              </div>

              {/* UPI — QR + ID */}
              {isUpi && (
                <div className="mt-6 grid sm:grid-cols-2 gap-6">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl border border-yellow-500/30 bg-white p-6 flex items-center justify-center shadow-lg shadow-yellow-500/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={upiQrUrl(selected, amount)} alt="UPI QR" width={220} height={220} className="rounded-lg" />
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-3 text-sm text-zinc-200"
                  >
                    <a
                      href={upiPayLink(selected, amount)}
                      className="text-center rounded-xl border border-yellow-500/40 bg-yellow-500/15 px-4 py-3.5 font-bold text-yellow-200 hover:bg-yellow-500/25 transition shadow-lg shadow-yellow-500/10 sm:hidden"
                    >
                      📱 Open UPI App
                    </a>
                    <div className="rounded-2xl border border-yellow-500/30 bg-black/40 p-4 backdrop-blur">
                      <div className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-2">UPI Address</div>
                      <button
                        onClick={() => navigator?.clipboard?.writeText(selected.value).catch(() => {})}
                        className="w-full text-left inline-flex items-center gap-3 gold-text font-bold hover:underline break-all group"
                      >
                        {selected.value}
                        <Copy size={14} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
                      </button>
                    </div>
                    <div className="rounded-2xl border border-yellow-500/30 bg-black/40 p-4">
                      <div className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-2">Payee Name</div>
                      <div className="text-white font-semibold">{selected.payeeName}</div>
                    </div>
                    {selected.note && (
                      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-200 font-medium leading-relaxed">
                        💡 {selected.note}
                      </div>
                    )}
                  </motion.div>
                </div>
              )}

              {/* Bank — account details */}
              {isBank && (
                <div className="mt-6 grid gap-3 text-sm">
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-sky-500/30 bg-black/40 p-4 backdrop-blur"
                  >
                    <div className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-2">Account Number</div>
                    <button
                      onClick={() => navigator?.clipboard?.writeText(selected.value).catch(() => {})}
                      className="inline-flex items-center gap-3 text-sky-200 font-bold hover:underline group"
                    >
                      {selected.value}
                      <Copy size={14} className="opacity-0 group-hover:opacity-100 transition" />
                    </button>
                  </motion.div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-sky-500/30 bg-black/40 p-4">
                      <div className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-2">Account Holder</div>
                      <div className="text-white font-bold">{selected.payeeName || "—"}</div>
                    </div>
                    {meta.ifsc && (
                      <div className="rounded-2xl border border-sky-500/30 bg-black/40 p-4">
                        <div className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-2">IFSC Code</div>
                        <button
                          onClick={() => navigator?.clipboard?.writeText(meta.ifsc).catch(() => {})}
                          className="inline-flex items-center gap-3 text-sky-200 font-bold hover:underline group tracking-widest"
                        >
                          {meta.ifsc}
                          <Copy size={14} className="opacity-0 group-hover:opacity-100 transition" />
                        </button>
                      </div>
                    )}
                    {meta.bank && (
                      <div className="rounded-2xl border border-sky-500/30 bg-black/40 p-4">
                        <div className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-2">Bank Name</div>
                        <div className="text-white font-bold">{meta.bank}</div>
                      </div>
                    )}
                    {meta.branch && (
                      <div className="rounded-2xl border border-sky-500/30 bg-black/40 p-4">
                        <div className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-2">Branch</div>
                        <div className="text-white font-bold">{meta.branch}</div>
                      </div>
                    )}
                  </div>
                  {selected.note && <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs text-sky-200 font-medium leading-relaxed">💡 {selected.note}</div>}
                </div>
              )}

              {/* Crypto — wallet address */}
              {isCrypto && (
                <div className="mt-6 grid gap-3 text-sm">
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-fuchsia-500/30 bg-black/40 p-4 backdrop-blur"
                  >
                    <div className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-2">Wallet Address</div>
                    <button
                      onClick={() => navigator?.clipboard?.writeText(selected.value).catch(() => {})}
                      className="inline-flex items-center gap-3 text-fuchsia-200 font-bold hover:underline break-all group"
                    >
                      {selected.value}
                      <Copy size={14} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
                    </button>
                  </motion.div>
                  {meta.network && (
                    <div className="rounded-2xl border border-fuchsia-500/30 bg-black/40 p-4">
                      <div className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-2">Network</div>
                      <div className="text-white font-bold">{meta.network}</div>
                    </div>
                  )}
                  {meta.coin && (
                    <div className="rounded-2xl border border-fuchsia-500/30 bg-black/40 p-4">
                      <div className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-2">Coin Type</div>
                      <div className="text-white font-bold">{meta.coin}</div>
                    </div>
                  )}
                  {selected.note && <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-3 text-xs text-fuchsia-200 font-medium leading-relaxed">💡 {selected.note}</div>}
                </div>
              )}

              {/* UTR / TXID submission — always required for manual channels */}
              <div className="mt-8 grid gap-4">
                <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-xs text-yellow-200">
                  ✅ Copy the {isCrypto ? "transaction hash" : "UTR"} from your {isCrypto ? "wallet/exchange" : "bank app"} after sending, then paste below
                </div>
                <label className="block">
                  <div className="text-xs text-zinc-400 mb-2 uppercase tracking-widest font-semibold">
                    {isCrypto ? "🔗 Transaction Hash (TxID)" : "📋 UTR / Reference Number"}
                  </div>
                  <input
                    value={utr}
                    onChange={(e) => setUtr(e.target.value.slice(0, 64).toUpperCase())}
                    placeholder={isCrypto ? "0x… from your wallet" : "12-digit UTR from your bank app"}
                    className="w-full rounded-xl border border-yellow-500/30 bg-black/40 px-4 py-3.5 text-white focus:outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/20 font-mono text-sm placeholder:text-zinc-600"
                  />
                </label>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={submitManual}
                  disabled={busy}
                  className="rounded-xl bg-[var(--primary)] py-4 font-bold text-black hover:brightness-95 disabled:opacity-60 transition shadow-lg shadow-yellow-500/20"
                >
                  {busy ? "⏳ Verifying…" : `✅ Submit ${formatINR(amount)} Deposit`}
                </motion.button>
                {toast && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg px-4 py-3 text-xs border font-medium ${
                      toast.kind === "ok"
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                        : "bg-red-500/15 border-red-500/40 text-red-200"
                    }`}
                  >
                    {toast.msg}
                  </motion.div>
                )}
              </div>
            </motion.div>

            <LiveFeed kind="deposit" take={8} title="Live Deposits" />
          </div>
        );
      })()}

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
