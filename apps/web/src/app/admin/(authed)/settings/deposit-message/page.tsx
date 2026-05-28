"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Save, Check, X } from "lucide-react";
import { api } from "@/lib/api";

type DepositConfig = {
  bonusPercent: number;
  message: string;
  enabled: boolean;
};

const DEFAULT_CONFIG: DepositConfig = {
  bonusPercent: 0,
  message: "",
  enabled: false,
};

export default function DepositMessagePage() {
  const [config, setConfig] = useState<DepositConfig>(DEFAULT_CONFIG);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ key: string; value: DepositConfig }>("/admin/settings?key=deposit_config");
      if (r?.value) {
        setConfig({ ...DEFAULT_CONFIG, ...r.value });
      }
    } catch {
      /* No config yet — defaults kept */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setToast(null);
    try {
      await api("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ key: "deposit_config", value: config }),
      });
      setToast({ ok: true, msg: "Deposit bonus settings saved successfully." });
    } catch (e: any) {
      setToast({ ok: false, msg: e?.message || "Save failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto w-full">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-400/80">
          <MessageSquare size={12} /> Deposit Settings
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-white">Deposit Bonus Message</h1>
        <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
          Configure a bonus percentage and promotional message shown to users on the deposit page.
          Enable it to encourage higher deposits.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 space-y-6"
      >
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-semibold">Enable Deposit Bonus Message</div>
            <div className="text-xs text-zinc-400 mt-0.5">
              When enabled, users will see the bonus info box on the deposit page.
            </div>
          </div>
          <button
            onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              config.enabled ? "bg-yellow-500" : "bg-zinc-700"
            }`}
            role="switch"
            aria-checked={config.enabled}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                config.enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="border-t border-yellow-500/10" />

        {/* Bonus percent */}
        <div className="grid gap-2">
          <label className="text-sm text-zinc-300 font-medium">
            Bonus Percentage (%)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={100}
              value={config.bonusPercent}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  bonusPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                }))
              }
              className="w-32 rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-2.5 text-white focus:outline-none focus:border-yellow-500/50 text-lg font-bold"
            />
            <span className="text-zinc-400 text-sm">
              e.g. <span className="text-yellow-200">10</span> = "10% bonus on qualifying deposits"
            </span>
          </div>
        </div>

        {/* Message text */}
        <div className="grid gap-2">
          <label className="text-sm text-zinc-300 font-medium">
            Bonus Message
          </label>
          <textarea
            rows={3}
            value={config.message}
            onChange={(e) => setConfig((c) => ({ ...c, message: e.target.value }))}
            placeholder="e.g. Get 10% extra on deposits above ₹500"
            className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-4 py-3 text-white focus:outline-none focus:border-yellow-500/50 text-sm resize-none placeholder:text-zinc-600"
          />
          <div className="text-xs text-zinc-500">
            This message is shown below the deposit amount input as a highlighted info box.
          </div>
        </div>

        {/* Preview */}
        {config.enabled && config.message && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200 font-medium">
            🎁 {config.message}
          </div>
        )}

        {/* Save */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 font-semibold text-black hover:brightness-95 disabled:opacity-60 transition"
          >
            <Save size={16} />
            {busy ? "Saving…" : "Save Settings"}
          </button>
        </div>

        {toast && (
          <div
            className={`rounded-lg px-4 py-3 text-sm border flex items-center gap-2 ${
              toast.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                : "bg-red-500/10 border-red-500/30 text-red-200"
            }`}
          >
            {toast.ok ? <Check size={14} /> : <X size={14} />}
            {toast.msg}
          </div>
        )}
      </motion.div>

      {/* Info card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-2xl p-4 text-sm text-zinc-300 space-y-2"
      >
        <div className="text-white font-semibold flex items-center gap-2">
          <MessageSquare size={16} className="text-yellow-300" /> How it works
        </div>
        <ul className="space-y-1 text-zinc-400 list-disc list-inside text-xs">
          <li>The bonus message is fetched from the admin settings on the wallet/deposit page.</li>
          <li>When enabled, a highlighted box appears below the amount input field.</li>
          <li>The bonus percent field is informational — it does not automatically apply any bonus to deposits; use it for display purposes.</li>
          <li>Disable the toggle to hide the message without deleting it.</li>
        </ul>
      </motion.div>
    </div>
  );
}
