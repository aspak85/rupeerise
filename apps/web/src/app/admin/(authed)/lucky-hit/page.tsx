"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save, Sliders, Trophy, History as HistoryIcon, Dices } from "lucide-react";
import { api, formatINR } from "@/lib/api";

type LuckyHitConfig = {
  enabled: boolean;
  minBet: number;
  maxBet: number;
  roundDurationSec: number;
  lockSeconds: number;
  colorPayout: number;
  luckyHitPayout: number;
  redWeight: number;
  blackWeight: number;
  luckyHitWeight: number;
};

type AdminRound = {
  id: string;
  period: string;
  startedAt: string;
  endsAt: string;
  status: "open" | "locked" | "settled";
  result: "red" | "black" | "lucky_hit" | null;
  redTotal: number;
  blackTotal: number;
  luckyHitTotal: number;
  betCount: number;
};

export default function AdminLuckyHitPage() {
  const [cfg, setCfg] = useState<LuckyHitConfig | null>(null);
  const [rounds, setRounds] = useState<AdminRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, r] = await Promise.all([
        api<LuckyHitConfig>("/admin/lucky-hit/config"),
        api<{ rounds: AdminRound[] }>("/admin/lucky-hit/rounds?take=50"),
      ]);
      setCfg(c);
      setRounds(r.rounds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer the initial fetch by a tick so React's "no setState directly inside
    // an effect body" rule is satisfied — the underlying load() does several
    // setState calls inside its own async callbacks. Polling continues every 5s
    // so admins see fresh slots without a manual reload.
    const tick = () => {
      void load();
    };
    const initial = setTimeout(tick, 0);
    const id = setInterval(tick, 5000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [load]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const r = await api<{ ok: boolean; config: LuckyHitConfig }>("/admin/lucky-hit/config", {
        method: "PUT",
        body: JSON.stringify(cfg),
      });
      setCfg(r.config);
      setOkMsg("Saved. New round will use these settings.");
      setTimeout(() => setOkMsg(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm("Restore default Lucky Hit config?")) return;
    setSaving(true);
    try {
      const r = await api<{ config: LuckyHitConfig }>("/admin/lucky-hit/reset", { method: "POST" });
      setCfg(r.config);
      setOkMsg("Defaults restored.");
      setTimeout(() => setOkMsg(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  };

  // Probability normaliser — turns the three weights into percentages so admins
  // can immediately read the win odds for each side.
  const probabilities = useMemo(() => {
    if (!cfg) return { red: 0, black: 0, lucky_hit: 0 };
    const total = cfg.redWeight + cfg.blackWeight + cfg.luckyHitWeight || 1;
    return {
      red: (cfg.redWeight / total) * 100,
      black: (cfg.blackWeight / total) * 100,
      lucky_hit: (cfg.luckyHitWeight / total) * 100,
    };
  }, [cfg]);

  if (!cfg) {
    return (
      <div className="max-w-3xl mx-auto p-10 text-center text-zinc-400 text-sm">
        {loading ? "Loading…" : error || "Loading config…"}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-400/80">
            <Dices size={12} /> Lucky Hit Game
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-white">
            Odds, payouts & live rounds
          </h1>
          <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
            Set the win probability for each side, the per-bet bounds, and the round cadence. Changes take effect on the next round (existing live round keeps its current config).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={load}
            className="rounded-lg border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10 inline-flex items-center gap-2"
          >
            <RefreshCw size={14} /> Reload
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10"
          >
            Reset to defaults
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {okMsg && <div className="glass rounded-xl px-4 py-2 text-emerald-300 text-sm">{okMsg}</div>}
      {error && <div className="glass rounded-xl px-4 py-2 text-red-300 text-sm">{error}</div>}

      {/* Status + bounds */}
      <section className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2 text-white">
            <Sliders size={18} className="text-yellow-300" />
            <h2 className="font-semibold text-lg">Game switches & bounds</h2>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
              className="accent-yellow-400 w-4 h-4"
            />
            <span>{cfg.enabled ? "Enabled (visible to users)" : "Disabled (hidden)"}</span>
          </label>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <NumField
            label="Min bet (₹)"
            value={cfg.minBet}
            onChange={(v) => setCfg({ ...cfg, minBet: v })}
            min={1}
            max={100000}
            int
          />
          <NumField
            label="Max bet (₹)"
            value={cfg.maxBet}
            onChange={(v) => setCfg({ ...cfg, maxBet: v })}
            min={1}
            max={1000000}
            int
          />
          <NumField
            label="Round duration (sec)"
            value={cfg.roundDurationSec}
            onChange={(v) => setCfg({ ...cfg, roundDurationSec: v })}
            min={60}
            max={1800}
            int
            help="Default 180 = 3 min"
          />
          <NumField
            label="Lock window (sec)"
            value={cfg.lockSeconds}
            onChange={(v) => setCfg({ ...cfg, lockSeconds: v })}
            min={5}
            max={300}
            int
            help="Last N sec without bets"
          />
        </div>
      </section>

      {/* Payouts */}
      <section className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 text-white mb-4">
          <Trophy size={18} className="text-yellow-300" />
          <h2 className="font-semibold text-lg">Payout multipliers</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField
            label="Color payout (Red / Black)"
            value={cfg.colorPayout}
            onChange={(v) => setCfg({ ...cfg, colorPayout: v })}
            min={1}
            max={100}
            step={0.1}
            suffix="×"
          />
          <NumField
            label="Lucky Hit payout"
            value={cfg.luckyHitPayout}
            onChange={(v) => setCfg({ ...cfg, luckyHitPayout: v })}
            min={1}
            max={1000}
            step={0.5}
            suffix="×"
          />
        </div>
      </section>

      {/* Probabilities */}
      <section className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 text-white">
              <Sliders size={18} className="text-yellow-300" />
              <h2 className="font-semibold text-lg">Win probability (weights)</h2>
            </div>
            <p className="mt-1 text-xs text-zinc-400 max-w-xl">
              Higher weight = higher chance. Weights are normalised so any non-negative integers work — the live percentage column shows what users will actually experience.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <WeightField
            label="Red"
            value={cfg.redWeight}
            pct={probabilities.red}
            tone="red"
            onChange={(v) => setCfg({ ...cfg, redWeight: v })}
          />
          <WeightField
            label="Black"
            value={cfg.blackWeight}
            pct={probabilities.black}
            tone="black"
            onChange={(v) => setCfg({ ...cfg, blackWeight: v })}
          />
          <WeightField
            label="Lucky Hit"
            value={cfg.luckyHitWeight}
            pct={probabilities.lucky_hit}
            tone="gold"
            onChange={(v) => setCfg({ ...cfg, luckyHitWeight: v })}
          />
        </div>
        <div className="mt-3 text-xs text-zinc-500">
          Tip: Total weight is whatever you want — defaults of 47 / 47 / 6 give an even split between colours plus ~6% Lucky Hit.
        </div>
      </section>

      {/* Recent rounds */}
      <section className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 text-white mb-4">
          <HistoryIcon size={18} className="text-yellow-300" />
          <h2 className="font-semibold text-lg">Recent rounds</h2>
          <span className="text-xs text-zinc-500">(auto-refreshing every 5s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-yellow-300/80 bg-black/30">
              <tr>
                <th className="text-left px-3 py-2.5">Period</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-left px-3 py-2.5">Result</th>
                <th className="text-right px-3 py-2.5">Red pool</th>
                <th className="text-right px-3 py-2.5">Black pool</th>
                <th className="text-right px-3 py-2.5">Lucky pool</th>
                <th className="text-right px-3 py-2.5">Bets</th>
              </tr>
            </thead>
            <tbody className="text-zinc-200">
              {rounds.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">{r.period}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-3 py-2">
                    <ResultPill result={r.result} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(r.redTotal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(r.blackTotal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(r.luckyHitTotal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.betCount}</td>
                </tr>
              ))}
              {rounds.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-zinc-500">
                    No rounds yet — waiting for the first bet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .input {
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 215, 0, 0.2);
          color: white;
          border-radius: 10px;
          padding: 0.5rem 0.6rem;
          font-size: 0.875rem;
          outline: none;
          width: 100%;
        }
        .input:focus {
          border-color: rgba(255, 215, 0, 0.55);
        }
      `}</style>
    </div>
  );
}

/* ──────────────── helpers ──────────────── */

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  int = false,
  suffix,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  int?: boolean;
  suffix?: string;
  help?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const raw = Number(e.target.value);
            if (!Number.isFinite(raw)) return;
            const v = int ? Math.floor(raw) : raw;
            onChange(Math.min(max, Math.max(min, v)));
          }}
          className="rounded-xl border border-yellow-500/20 bg-black/40 px-3 py-2 text-white focus:outline-none focus:border-yellow-500/55 w-full"
        />
        {suffix && <span className="text-zinc-400 text-sm">{suffix}</span>}
      </div>
      {help && <div className="mt-1 text-[10px] text-zinc-500">{help}</div>}
    </label>
  );
}

function WeightField({
  label,
  value,
  pct,
  tone,
  onChange,
}: {
  label: string;
  value: number;
  pct: number;
  tone: "red" | "black" | "gold";
  onChange: (v: number) => void;
}) {
  const toneCls =
    tone === "red"
      ? "border-red-500/30 bg-red-500/5"
      : tone === "black"
      ? "border-zinc-500/30 bg-zinc-800/30"
      : "border-yellow-500/30 bg-yellow-500/5";
  const textCls =
    tone === "red" ? "text-red-300" : tone === "black" ? "text-zinc-200" : "text-yellow-300";
  return (
    <div className={`rounded-2xl border p-4 ${toneCls}`}>
      <div className={`text-xs uppercase tracking-widest ${textCls}`}>{label}</div>
      <input
        type="number"
        min={0}
        max={1000}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(1000, Math.floor(Number(e.target.value) || 0))))}
        className="mt-2 w-full rounded-xl border border-yellow-500/20 bg-black/40 px-3 py-2 text-white focus:outline-none focus:border-yellow-500/55 text-lg font-semibold"
      />
      <div className="mt-2 text-xs text-zinc-300">
        Live odds: <span className="text-white font-semibold">{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: AdminRound["status"] }) {
  const map: Record<AdminRound["status"], string> = {
    open: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    locked: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    settled: "bg-zinc-700/40 text-zinc-200 border-zinc-500/30",
  };
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[status]}`}
    >
      {status}
    </span>
  );
}

function ResultPill({ result }: { result: AdminRound["result"] }) {
  if (!result) return <span className="text-zinc-500 text-xs">—</span>;
  const cls =
    result === "red"
      ? "bg-red-500/15 text-red-300 border-red-500/30"
      : result === "black"
      ? "bg-zinc-700/40 text-zinc-200 border-zinc-500/30"
      : "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  const label = result === "lucky_hit" ? "Lucky Hit ★" : result === "red" ? "Red" : "Black";
  return (
    <span
      className={`inline-flex items-center text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${cls}`}
    >
      {label}
    </span>
  );
}
