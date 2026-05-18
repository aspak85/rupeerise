"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Save, Sparkles, Trash2, Trophy, Zap } from "lucide-react";
import { api, formatINR } from "@/lib/api";

type RewardConfig = {
  spin: { enabled: boolean; prizes: number[]; weights?: number[] };
  scratch: { enabled: boolean; table: { amount: number; weight: number }[] };
};

export default function AdminRewardsPage() {
  const [cfg, setCfg] = useState<RewardConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<RewardConfig>("/admin/rewards/config");
      setCfg(r);
    } catch (e: any) {
      setError(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      await api("/admin/rewards/config", { method: "PUT", body: JSON.stringify(cfg) });
      setOkMsg("Saved. Live for users now.");
      setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm("Restore default spin & scratch tables?")) return;
    setSaving(true);
    try {
      const r = await api<{ config: RewardConfig }>("/admin/rewards/reset", { method: "POST" });
      setCfg(r.config);
      setOkMsg("Defaults restored.");
      setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Reset failed");
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) {
    return (
      <div className="max-w-3xl mx-auto p-10 text-center text-zinc-400 text-sm">
        {loading ? "Loading…" : error || "Loading config…"}
      </div>
    );
  }

  /* spin helpers */
  const setSpinPrize = (i: number, v: number) => {
    setCfg({ ...cfg, spin: { ...cfg.spin, prizes: cfg.spin.prizes.map((p, idx) => (idx === i ? v : p)) } });
  };
  const setSpinWeight = (i: number, v: number) => {
    const weights = cfg.spin.weights ? [...cfg.spin.weights] : cfg.spin.prizes.map(() => 1);
    weights[i] = v;
    setCfg({ ...cfg, spin: { ...cfg.spin, weights } });
  };
  const addSpinSlot = () => {
    if (cfg.spin.prizes.length >= 16) return;
    setCfg({
      ...cfg,
      spin: {
        ...cfg.spin,
        prizes: [...cfg.spin.prizes, 10],
        weights: cfg.spin.weights ? [...cfg.spin.weights, 1] : undefined,
      },
    });
  };
  const removeSpinSlot = (i: number) => {
    if (cfg.spin.prizes.length <= 2) return;
    setCfg({
      ...cfg,
      spin: {
        ...cfg.spin,
        prizes: cfg.spin.prizes.filter((_, idx) => idx !== i),
        weights: cfg.spin.weights ? cfg.spin.weights.filter((_, idx) => idx !== i) : undefined,
      },
    });
  };

  /* scratch helpers */
  const setScratchRow = (i: number, key: "amount" | "weight", v: number) => {
    setCfg({
      ...cfg,
      scratch: {
        ...cfg.scratch,
        table: cfg.scratch.table.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)),
      },
    });
  };
  const addScratchRow = () => {
    if (cfg.scratch.table.length >= 20) return;
    setCfg({ ...cfg, scratch: { ...cfg.scratch, table: [...cfg.scratch.table, { amount: 5, weight: 10 }] } });
  };
  const removeScratchRow = (i: number) => {
    if (cfg.scratch.table.length <= 1) return;
    setCfg({ ...cfg, scratch: { ...cfg.scratch, table: cfg.scratch.table.filter((_, idx) => idx !== i) } });
  };

  const spinTotalWeight = (cfg.spin.weights || cfg.spin.prizes.map(() => 1)).reduce((a, b) => a + b, 0);
  const scratchTotalWeight = cfg.scratch.table.reduce((a, b) => a + b.weight, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Daily Rewards Config</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Spin wheel & scratch card</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Edit prize amounts and probabilities. Changes go live within ~30 seconds (or instantly for the next spin).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-lg border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10 inline-flex items-center gap-2">
            <RefreshCw size={14} /> Reload
          </button>
          <button onClick={reset} className="rounded-lg border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10">
            Reset to defaults
          </button>
          <button onClick={save} disabled={saving} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {okMsg && <div className="glass rounded-xl px-4 py-2 text-emerald-300 text-sm">{okMsg}</div>}
      {error && <div className="glass rounded-xl px-4 py-2 text-red-300 text-sm">{error}</div>}

      {/* Spin Wheel */}
      <section className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2 text-white">
            <Zap size={18} className="text-yellow-300" />
            <h2 className="font-semibold text-lg">Spin Wheel</h2>
            <span className="text-xs text-zinc-500">({cfg.spin.prizes.length} segments)</span>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={cfg.spin.enabled} onChange={(e) => setCfg({ ...cfg, spin: { ...cfg.spin, enabled: e.target.checked } })} className="accent-yellow-400 w-4 h-4" />
            <span>{cfg.spin.enabled ? "Enabled (visible to users)" : "Disabled (hidden)"}</span>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-yellow-300/80 bg-black/30">
              <tr>
                <th className="text-left px-3 py-2.5 w-12">#</th>
                <th className="text-left px-3 py-2.5">Prize amount (₹)</th>
                <th className="text-left px-3 py-2.5">Weight</th>
                <th className="text-left px-3 py-2.5">Probability</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {cfg.spin.prizes.map((p, i) => {
                const w = cfg.spin.weights?.[i] ?? 1;
                const pct = spinTotalWeight > 0 ? ((w / spinTotalWeight) * 100).toFixed(1) : "0";
                return (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-2 text-zinc-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <input type="number" min={0} value={p} onChange={(e) => setSpinPrize(i, Math.max(0, Math.floor(Number(e.target.value))))} className="w-32 input" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min={1} value={w} onChange={(e) => setSpinWeight(i, Math.max(1, Math.floor(Number(e.target.value))))} className="w-24 input" />
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{pct}%</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeSpinSlot(i)} disabled={cfg.spin.prizes.length <= 2} className="text-zinc-400 hover:text-red-300 disabled:opacity-30">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
          <button onClick={addSpinSlot} disabled={cfg.spin.prizes.length >= 16} className="inline-flex items-center gap-1 text-yellow-300 hover:text-yellow-200 disabled:opacity-30">
            <Plus size={14} /> Add segment
          </button>
          <div>Total weight: {spinTotalWeight}</div>
        </div>
      </section>

      {/* Scratch Card */}
      <section className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2 text-white">
            <Sparkles size={18} className="text-yellow-300" />
            <h2 className="font-semibold text-lg">Scratch Card</h2>
            <span className="text-xs text-zinc-500">({cfg.scratch.table.length} prize tiers)</span>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={cfg.scratch.enabled} onChange={(e) => setCfg({ ...cfg, scratch: { ...cfg.scratch, enabled: e.target.checked } })} className="accent-yellow-400 w-4 h-4" />
            <span>{cfg.scratch.enabled ? "Enabled (visible to users)" : "Disabled (hidden)"}</span>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-yellow-300/80 bg-black/30">
              <tr>
                <th className="text-left px-3 py-2.5 w-12">#</th>
                <th className="text-left px-3 py-2.5">Prize amount (₹)</th>
                <th className="text-left px-3 py-2.5">Weight</th>
                <th className="text-left px-3 py-2.5">Probability</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {cfg.scratch.table.map((r, i) => {
                const pct = scratchTotalWeight > 0 ? ((r.weight / scratchTotalWeight) * 100).toFixed(1) : "0";
                return (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-2 text-zinc-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <input type="number" min={0} value={r.amount} onChange={(e) => setScratchRow(i, "amount", Math.max(0, Math.floor(Number(e.target.value))))} className="w-32 input" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min={1} value={r.weight} onChange={(e) => setScratchRow(i, "weight", Math.max(1, Math.floor(Number(e.target.value))))} className="w-24 input" />
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{pct}%</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeScratchRow(i)} disabled={cfg.scratch.table.length <= 1} className="text-zinc-400 hover:text-red-300 disabled:opacity-30">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
          <button onClick={addScratchRow} disabled={cfg.scratch.table.length >= 20} className="inline-flex items-center gap-1 text-yellow-300 hover:text-yellow-200 disabled:opacity-30">
            <Plus size={14} /> Add prize tier
          </button>
          <div>Max prize: {formatINR(Math.max(...cfg.scratch.table.map((r) => r.amount)))}</div>
        </div>
      </section>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 text-white">
          <Trophy size={18} className="text-yellow-300" />
          <h3 className="font-semibold">Tips</h3>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-zinc-400">
          <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> Spin wheel needs 2–16 segments. The frontend renders exactly the segments you configure.</li>
          <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> Higher <em>weight</em> = higher chance. Use small weights (e.g. 1) for jackpot tiers.</li>
          <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> Disabling a game hides it from users immediately on next page load.</li>
        </ul>
      </div>

      <style jsx>{`
        .input {
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 215, 0, 0.2);
          color: white;
          border-radius: 10px;
          padding: 0.45rem 0.6rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus { border-color: rgba(255, 215, 0, 0.55); }
      `}</style>
    </div>
  );
}
