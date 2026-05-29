"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Dices,
  History as HistoryIcon,
  Loader2,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  Trophy,
  Wallet as WalletIcon,
  Wand2,
  XCircle,
  Zap,
} from "lucide-react";
import { api, formatINR } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types — mirror the API responses                                   */
/* ------------------------------------------------------------------ */

type Side = "red" | "black" | "lucky_hit";

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
  result: Side | null;
  forcedResult?: Side | null;
  redTotal: number;
  blackTotal: number;
  luckyHitTotal: number;
  betCount: number;
  msRemaining?: number;
};

type ActivityBet = {
  id: string;
  createdAt: string;
  userId: string;
  userLabel: string | null;
  userEmail: string | null;
  side: Side;
  amount: number;
  status: "pending" | "won" | "lost";
  payout: number;
  walletSource: string;
  period: string;
  roundStatus: string;
  roundResult: Side | null;
  forcedResult: Side | null;
};

type ActivityDeposit = {
  id: string;
  createdAt: string;
  userLabel: string | null;
  amount: number;
  method: string;
  utr: string | null;
  status: string;
};

type ActivityWithdrawal = {
  id: string;
  createdAt: string;
  userLabel: string | null;
  amount: number;
  netAmount: number;
  method: string;
  status: string;
};

type LiveActivity = {
  currentRound: AdminRound | null;
  bets: ActivityBet[];
  deposits: ActivityDeposit[];
  withdrawals: ActivityWithdrawal[];
};

const SIDE_META: Record<Side, { label: string; chip: string; dot: string }> = {
  red: {
    label: "Red",
    chip: "bg-red-500/15 text-red-300 border-red-500/30",
    dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]",
  },
  black: {
    label: "Black",
    chip: "bg-zinc-700/40 text-zinc-200 border-zinc-500/40",
    dot: "bg-zinc-800 ring-1 ring-white/30",
  },
  lucky_hit: {
    label: "Lucky Hit",
    chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
    dot: "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.7)]",
  },
};

const SIDES: Side[] = ["red", "black", "lucky_hit"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(iso: string, now: number) {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminLuckyHitPage() {
  const [cfg, setCfg] = useState<LuckyHitConfig | null>(null);
  const [rounds, setRounds] = useState<AdminRound[]>([]);
  const [activity, setActivity] = useState<LiveActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  /* ----- loaders --------------------------------------------------- */

  const loadConfig = useCallback(async () => {
    try {
      const c = await api<LuckyHitConfig>("/admin/lucky-hit/config");
      setCfg(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Config load failed");
    }
  }, []);

  const loadRounds = useCallback(async () => {
    try {
      const r = await api<{ rounds: AdminRound[] }>("/admin/lucky-hit/rounds?take=50");
      setRounds(r.rounds);
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const r = await api<LiveActivity>("/admin/lucky-hit/live-activity?take=30");
      setActivity(r);
    } catch {
      /* non-fatal */
    }
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadConfig(), loadRounds(), loadActivity()]);
    setLoading(false);
  }, [loadConfig, loadRounds, loadActivity]);

  useEffect(() => {
    const t1 = setTimeout(() => { void reloadAll(); }, 0);
    // Live activity ticks fast (2s) so the admin sees bets as they land.
    // Rounds + config tick slower since they change less often.
    const activityTick = setInterval(() => { void loadActivity(); }, 2000);
    const roundsTick = setInterval(() => { void loadRounds(); }, 5000);
    const clockTick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearTimeout(t1);
      clearInterval(activityTick);
      clearInterval(roundsTick);
      clearInterval(clockTick);
    };
  }, [reloadAll, loadActivity, loadRounds]);

  /* ----- actions --------------------------------------------------- */

  const flash = (ok: string | null, err: string | null = null) => {
    setOkMsg(ok);
    setError(err);
    if (ok) setTimeout(() => setOkMsg(null), 2500);
  };

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const r = await api<{ ok: boolean; config: LuckyHitConfig }>(
        "/admin/lucky-hit/config",
        { method: "PUT", body: JSON.stringify(cfg) }
      );
      setCfg(r.config);
      flash("Saved. New round will use these settings.");
    } catch (e) {
      flash(null, e instanceof Error ? e.message : "Save failed");
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
      flash("Defaults restored.");
    } catch (e) {
      flash(null, e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Force the current round's result. The admin clicks Red / Black / Lucky —
   * the round keeps running normally, but settlement uses the forced value
   * instead of RNG.
   */
  const forceResult = async (roundId: string, result: Side | null) => {
    setActing(true);
    try {
      await api(`/admin/lucky-hit/rounds/${roundId}/force-result`, {
        method: "POST",
        body: JSON.stringify({ result }),
      });
      flash(
        result
          ? `Locked: round will resolve as ${SIDE_META[result].label}.`
          : "Override cleared — round will use RNG."
      );
      void loadActivity();
      void loadRounds();
    } catch (e) {
      flash(null, e instanceof Error ? e.message : "Force-result failed");
    } finally {
      setActing(false);
    }
  };

  /**
   * Settle the current round immediately with a chosen result. Used when the
   * admin wants to "open the cards now" — bypasses the remaining countdown.
   */
  const settleNow = async (roundId: string, result: Side) => {
    if (!confirm(`Open the cards NOW with ${SIDE_META[result].label}? All bets on this round will settle immediately.`)) return;
    setActing(true);
    try {
      await api(`/admin/lucky-hit/rounds/${roundId}/settle-now`, {
        method: "POST",
        body: JSON.stringify({ result }),
      });
      flash(`Settled now as ${SIDE_META[result].label}. Wallets credited.`);
      void loadActivity();
      void loadRounds();
    } catch (e) {
      flash(null, e instanceof Error ? e.message : "Settle-now failed");
    } finally {
      setActing(false);
    }
  };

  /* ----- derived --------------------------------------------------- */

  const probabilities = useMemo(() => {
    if (!cfg) return { red: 0, black: 0, lucky_hit: 0 };
    const total = cfg.redWeight + cfg.blackWeight + cfg.luckyHitWeight || 1;
    return {
      red: (cfg.redWeight / total) * 100,
      black: (cfg.blackWeight / total) * 100,
      lucky_hit: (cfg.luckyHitWeight / total) * 100,
    };
  }, [cfg]);

  const currentRound = activity?.currentRound ?? null;

  /* ----- render ---------------------------------------------------- */

  if (!cfg) {
    return (
      <div className="max-w-3xl mx-auto p-10 text-center text-zinc-400 text-sm">
        {loading ? "Loading…" : error || "Loading config…"}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-400/80">
            <Dices size={12} /> Lucky Hit Game
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-white">
            Live activity, odds & manual controls
          </h1>
          <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
            Watch bets, deposits, and withdrawals stream in. Force the result of any active round, or open the cards immediately when you need to.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={reloadAll}
            className="rounded-lg border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10 inline-flex items-center gap-2"
          >
            <RefreshCw size={14} /> Reload
          </button>
        </div>
      </div>

      {okMsg && <div className="glass rounded-xl px-4 py-2 text-emerald-300 text-sm">{okMsg}</div>}
      {error && <div className="glass rounded-xl px-4 py-2 text-red-300 text-sm">{error}</div>}

      {/* ─── Force result + settle now (current round) ─── */}
      <ForceResultPanel
        round={currentRound}
        onForce={forceResult}
        onSettleNow={settleNow}
        busy={acting}
      />

      {/* ─── Live activity (3-column on lg) ─── */}
      <LiveActivitySection activity={activity} now={now} />

      {/* ─── Config: switches & bounds ─── */}
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
          <NumField label="Min bet (₹)" value={cfg.minBet} onChange={(v) => setCfg({ ...cfg, minBet: v })} min={1} max={100000} int />
          <NumField label="Max bet (₹)" value={cfg.maxBet} onChange={(v) => setCfg({ ...cfg, maxBet: v })} min={1} max={1000000} int />
          <NumField
            label="Round duration (sec)"
            value={cfg.roundDurationSec}
            onChange={(v) => setCfg({ ...cfg, roundDurationSec: v })}
            min={20}
            max={1800}
            int
            help="Default 30 — gives ~15s bet + 15s reveal"
          />
          <NumField
            label="Lock window (sec)"
            value={cfg.lockSeconds}
            onChange={(v) => setCfg({ ...cfg, lockSeconds: v })}
            min={5}
            max={300}
            int
            help="Last N sec where cards animate"
          />
        </div>
      </section>

      {/* ─── Payouts ─── */}
      <section className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 text-white mb-4">
          <Trophy size={18} className="text-yellow-300" />
          <h2 className="font-semibold text-lg">Payout multipliers</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <NumField label="Color payout (Red / Black)" value={cfg.colorPayout} onChange={(v) => setCfg({ ...cfg, colorPayout: v })} min={1} max={100} step={0.1} suffix="×" />
          <NumField label="Lucky Hit payout" value={cfg.luckyHitPayout} onChange={(v) => setCfg({ ...cfg, luckyHitPayout: v })} min={1} max={1000} step={0.5} suffix="×" />
        </div>
      </section>

      {/* ─── Probabilities (RNG fallback) ─── */}
      <section className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 text-white">
              <Sliders size={18} className="text-yellow-300" />
              <h2 className="font-semibold text-lg">RNG win probabilities</h2>
            </div>
            <p className="mt-1 text-xs text-zinc-400 max-w-xl">
              Used when no admin override is set on a round. Higher weight = higher chance.
              Live percentage column shows what users will experience.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <WeightField label="Red" value={cfg.redWeight} pct={probabilities.red} tone="red" onChange={(v) => setCfg({ ...cfg, redWeight: v })} />
          <WeightField label="Black" value={cfg.blackWeight} pct={probabilities.black} tone="black" onChange={(v) => setCfg({ ...cfg, blackWeight: v })} />
          <WeightField label="Lucky Hit" value={cfg.luckyHitWeight} pct={probabilities.lucky_hit} tone="gold" onChange={(v) => setCfg({ ...cfg, luckyHitWeight: v })} />
        </div>
      </section>

      {/* Save / reset bar */}
      <div className="flex items-center gap-2 flex-wrap sticky bottom-2 z-10">
        <button onClick={reset} className="rounded-lg border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10">
          Reset to defaults
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Saving…" : "Save config"}
        </button>
      </div>

      {/* ─── Recent rounds ─── */}
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
                <th className="text-left px-3 py-2.5">Forced</th>
                <th className="text-right px-3 py-2.5">Red</th>
                <th className="text-right px-3 py-2.5">Black</th>
                <th className="text-right px-3 py-2.5">Lucky</th>
                <th className="text-right px-3 py-2.5">Bets</th>
              </tr>
            </thead>
            <tbody className="text-zinc-200">
              {rounds.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-mono text-xs">{r.period}</td>
                  <td className="px-3 py-2"><StatusPill status={r.status} /></td>
                  <td className="px-3 py-2"><ResultPill result={r.result} /></td>
                  <td className="px-3 py-2">
                    {r.forcedResult ? <ResultPill result={r.forcedResult} /> : <span className="text-zinc-600 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(r.redTotal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(r.blackTotal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(r.luckyHitTotal)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.betCount}</td>
                </tr>
              ))}
              {rounds.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-zinc-500">
                    No rounds yet — waiting for the first bet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <style jsx>{`
        .input { background: rgba(0,0,0,0.35); border: 1px solid rgba(255,215,0,0.2); color: white; border-radius: 10px; padding: 0.5rem 0.6rem; font-size: 0.875rem; outline: none; width: 100%; }
        .input:focus { border-color: rgba(255,215,0,0.55); }
      `}</style>
    </div>
  );
}

/* ================================================================ */
/*  Force-result + settle-now                                       */
/* ================================================================ */

function ForceResultPanel({
  round,
  onForce,
  onSettleNow,
  busy,
}: {
  round: AdminRound | null;
  onForce: (roundId: string, result: Side | null) => void;
  onSettleNow: (roundId: string, result: Side) => void;
  busy: boolean;
}) {
  if (!round) {
    return (
      <section className="glass rounded-2xl p-5 border border-yellow-500/20">
        <div className="flex items-center gap-2 text-white">
          <Wand2 size={18} className="text-yellow-300" />
          <h2 className="font-semibold text-lg">Manual round control</h2>
        </div>
        <p className="mt-2 text-sm text-zinc-400">No active round yet — waiting for first state read.</p>
      </section>
    );
  }
  const settled = round.status === "settled";
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 border border-yellow-500/30"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2 text-white">
            <Wand2 size={18} className="text-yellow-300" />
            <h2 className="font-semibold text-lg">Manual round control</h2>
          </div>
          <p className="mt-1 text-xs text-zinc-400 max-w-xl">
            Force the result of the current round, or open the cards immediately. Forced results take priority over RNG.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-zinc-400">Current period</div>
          <div className="font-mono font-semibold text-white">{round.period}</div>
          <div className="mt-1"><StatusPill status={round.status} /></div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <div className="rounded-xl border border-yellow-500/15 bg-black/30 p-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-400">Currently forced</div>
          <div className="mt-1">
            {round.forcedResult ? (
              <ResultPill result={round.forcedResult} />
            ) : (
              <span className="text-zinc-500 text-sm">— RNG will decide —</span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-yellow-500/15 bg-black/30 p-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-400">Live pools</div>
          <div className="mt-1 text-sm text-zinc-200 flex flex-wrap gap-3">
            <span className="text-red-300">Red {formatINR(round.redTotal)}</span>
            <span className="text-zinc-200">Black {formatINR(round.blackTotal)}</span>
            <span className="text-yellow-300">Lucky {formatINR(round.luckyHitTotal)}</span>
            <span className="text-zinc-400">· {round.betCount} bets</span>
          </div>
        </div>
      </div>

      {/* Force result row */}
      <div className="grid gap-3">
        <div>
          <div className="text-xs text-zinc-400 mb-2 uppercase tracking-widest font-semibold">Force result for this round</div>
          <div className="flex flex-wrap gap-2">
            {SIDES.map((s) => {
              const meta = SIDE_META[s];
              const active = round.forcedResult === s;
              return (
                <button
                  key={s}
                  onClick={() => onForce(round.id, s)}
                  disabled={busy || settled}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition disabled:opacity-50 ${
                    active ? meta.chip + " ring-2 ring-yellow-400/60" : meta.chip
                  } hover:brightness-110`}
                >
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                  Force {meta.label}
                </button>
              );
            })}
            <button
              onClick={() => onForce(round.id, null)}
              disabled={busy || settled || !round.forcedResult}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-500/40 bg-zinc-700/30 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700/50 disabled:opacity-50"
            >
              Clear override
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs text-zinc-400 mb-2 uppercase tracking-widest font-semibold">Open cards NOW (settle immediately)</div>
          <div className="flex flex-wrap gap-2">
            {SIDES.map((s) => {
              const meta = SIDE_META[s];
              return (
                <button
                  key={s}
                  onClick={() => onSettleNow(round.id, s)}
                  disabled={busy || settled}
                  className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-[var(--primary)]/15 hover:bg-[var(--primary)]/25 px-3 py-2 text-sm font-semibold text-yellow-100 disabled:opacity-50"
                >
                  <Zap size={14} />
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Wallets are credited immediately for winning bets. Use this only when you need to short-circuit the timer.
          </p>
        </div>
      </div>
    </motion.section>
  );
}

/* ================================================================ */
/*  Live activity panel — bets / wins-losses / deposits / withdraws */
/* ================================================================ */

function LiveActivitySection({
  activity,
  now,
}: {
  activity: LiveActivity | null;
  now: number;
}) {
  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-white mb-4">
        <Activity size={18} className="text-yellow-300" />
        <h2 className="font-semibold text-lg">Live activity</h2>
        <span className="text-xs text-zinc-500">(refreshing every 2s)</span>
      </div>
      {!activity ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Waiting for first poll…</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <ActivityColumn title="Bets" icon={<Sparkles size={14} className="text-yellow-300" />} count={activity.bets.length}>
            {activity.bets.length === 0 && <EmptyHint text="No bets yet" />}
            {activity.bets.map((b) => (
              <BetRow key={b.id} bet={b} now={now} />
            ))}
          </ActivityColumn>

          <ActivityColumn title="Wins / Losses" icon={<Trophy size={14} className="text-yellow-300" />} count={activity.bets.filter((b) => b.status !== "pending").length}>
            {activity.bets.filter((b) => b.status !== "pending").length === 0 && (
              <EmptyHint text="No settled bets yet" />
            )}
            {activity.bets
              .filter((b) => b.status !== "pending")
              .slice(0, 20)
              .map((b) => (
                <WinLossRow key={`wl-${b.id}`} bet={b} now={now} />
              ))}
          </ActivityColumn>

          <ActivityColumn title="Money flow" icon={<WalletIcon size={14} className="text-yellow-300" />} count={activity.deposits.length + activity.withdrawals.length}>
            {activity.deposits.length + activity.withdrawals.length === 0 && (
              <EmptyHint text="No deposits or withdrawals yet" />
            )}
            {/* Interleave deposits + withdrawals by timestamp so the column reads
                like a single chronological feed of money movement. */}
            {[...activity.deposits.map((d) => ({ kind: "deposit" as const, t: d.createdAt, d, w: null as ActivityWithdrawal | null })),
              ...activity.withdrawals.map((w) => ({ kind: "withdraw" as const, t: w.createdAt, d: null as ActivityDeposit | null, w }))]
              .sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime())
              .slice(0, 20)
              .map((row) =>
                row.kind === "deposit" && row.d ? (
                  <DepositRow key={`d-${row.d.id}`} dep={row.d} now={now} />
                ) : row.w ? (
                  <WithdrawRow key={`w-${row.w.id}`} wd={row.w} now={now} />
                ) : null
              )}
          </ActivityColumn>
        </div>
      )}
    </section>
  );
}

function ActivityColumn({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-yellow-500/15 bg-black/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <div className="text-sm font-semibold text-white">{title}</div>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-yellow-300/70">{count}</span>
      </div>
      <ul className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1 no-scrollbar">{children}</ul>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <li className="text-xs text-zinc-500 px-2 py-3">{text}</li>;
}

function BetRow({ bet, now }: { bet: ActivityBet; now: number }) {
  const meta = SIDE_META[bet.side];
  return (
    <li className="rounded-lg border border-white/5 bg-zinc-900/40 px-2.5 py-2 flex items-center gap-2">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${meta.dot} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-200 truncate">
          {bet.userLabel || "—"}
        </div>
        <div className="text-[10px] text-zinc-500 font-mono">{bet.period} · {timeAgo(bet.createdAt, now)}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-white tabular-nums">{formatINR(bet.amount)}</div>
        <div className={`text-[10px] uppercase tracking-widest ${
          bet.side === "red" ? "text-red-300" : bet.side === "black" ? "text-zinc-200" : "text-yellow-300"
        }`}>
          {meta.label}
        </div>
      </div>
    </li>
  );
}

function WinLossRow({ bet, now }: { bet: ActivityBet; now: number }) {
  const won = bet.status === "won";
  return (
    <li className={`rounded-lg border px-2.5 py-2 flex items-center gap-2 ${
      won ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
    }`}>
      {won ? <CheckCircle2 size={14} className="text-emerald-300 shrink-0" /> : <XCircle size={14} className="text-red-300 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-200 truncate">{bet.userLabel || "—"}</div>
        <div className="text-[10px] text-zinc-500 font-mono">{bet.period} · {timeAgo(bet.createdAt, now)}</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-semibold tabular-nums ${won ? "text-emerald-200" : "text-red-200"}`}>
          {won ? `+${formatINR(bet.payout)}` : `-${formatINR(bet.amount)}`}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-zinc-400">
          {SIDE_META[bet.side].label}
          {bet.roundResult ? ` → ${SIDE_META[bet.roundResult].label}` : ""}
        </div>
      </div>
    </li>
  );
}

function DepositRow({ dep, now }: { dep: ActivityDeposit; now: number }) {
  return (
    <li className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 flex items-center gap-2">
      <ArrowDownToLine size={14} className="text-emerald-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-200 truncate">{dep.userLabel || "—"}</div>
        <div className="text-[10px] text-zinc-500">{dep.method} · {timeAgo(dep.createdAt, now)}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-emerald-200 tabular-nums">+{formatINR(dep.amount)}</div>
        <div className={`text-[10px] uppercase tracking-widest ${
          dep.status === "approved" ? "text-emerald-300" : dep.status === "rejected" ? "text-red-300" : "text-yellow-300"
        }`}>
          {dep.status}
        </div>
      </div>
    </li>
  );
}

function WithdrawRow({ wd, now }: { wd: ActivityWithdrawal; now: number }) {
  return (
    <li className="rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-2 flex items-center gap-2">
      <ArrowUpFromLine size={14} className="text-red-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-200 truncate">{wd.userLabel || "—"}</div>
        <div className="text-[10px] text-zinc-500">{wd.method} · net {formatINR(wd.netAmount)} · {timeAgo(wd.createdAt, now)}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-red-200 tabular-nums">-{formatINR(wd.amount)}</div>
        <div className={`text-[10px] uppercase tracking-widest ${
          wd.status === "approved" || wd.status === "paid" ? "text-emerald-300" : wd.status === "rejected" ? "text-red-300" : "text-yellow-300"
        }`}>
          {wd.status}
        </div>
      </div>
    </li>
  );
}

/* ================================================================ */
/*  Form helpers                                                    */
/* ================================================================ */

function NumField({
  label, value, onChange, min, max, step = 1, int = false, suffix, help,
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
  label, value, pct, tone, onChange,
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
  const textCls = tone === "red" ? "text-red-300" : tone === "black" ? "text-zinc-200" : "text-yellow-300";
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
    <span className={`inline-flex items-center text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[status]}`}>
      {status}
    </span>
  );
}

function ResultPill({ result }: { result: Side | null | undefined }) {
  if (!result) return <span className="text-zinc-500 text-xs">—</span>;
  const cls =
    result === "red"
      ? "bg-red-500/15 text-red-300 border-red-500/30"
      : result === "black"
      ? "bg-zinc-700/40 text-zinc-200 border-zinc-500/30"
      : "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  const label = result === "lucky_hit" ? "Lucky Hit ★" : result === "red" ? "Red" : "Black";
  return (
    <span className={`inline-flex items-center text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}
