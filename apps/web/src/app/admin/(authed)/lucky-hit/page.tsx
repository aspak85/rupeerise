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
  RotateCcw,
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
/*  Types                                                              */
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

const SIDE_META: Record<Side, { label: string; chip: string; dot: string; bgGrad: string }> = {
  red: {
    label: "Red",
    chip: "bg-red-500/15 text-red-300 border-red-500/30",
    dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]",
    bgGrad: "from-red-500/30 to-red-700/20 border-red-400 hover:from-red-500/40",
  },
  black: {
    label: "Black",
    chip: "bg-zinc-700/40 text-zinc-200 border-zinc-500/40",
    dot: "bg-zinc-800 ring-1 ring-white/30",
    bgGrad: "from-zinc-700/40 to-zinc-900/40 border-zinc-300 hover:from-zinc-700/60",
  },
  lucky_hit: {
    label: "Lucky Hit ★",
    chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
    dot: "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.7)]",
    bgGrad: "from-yellow-500/30 to-amber-600/30 border-yellow-300 hover:from-yellow-500/40",
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
  const [activityErr, setActivityErr] = useState<string | null>(null);
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
      setActivityErr(null);
    } catch (e) {
      // Surface the error so admins know if the backend hasn't been migrated
      // yet (the live-activity query selects forcedResult — fails on stale DB).
      setActivityErr(e instanceof Error ? e.message : "Live activity unreachable");
    }
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadConfig(), loadRounds(), loadActivity()]);
    setLoading(false);
  }, [loadConfig, loadRounds, loadActivity]);

  useEffect(() => {
    const t1 = setTimeout(() => { void reloadAll(); }, 0);
    // Live activity ticks fast (1.5s) so admins see bets land in near real time.
    const activityTick = setInterval(() => { void loadActivity(); }, 1500);
    const roundsTick = setInterval(() => { void loadRounds(); }, 3000);
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
    if (!confirm("Restore default Lucky Hit config (20s fast rounds)?")) return;
    setSaving(true);
    try {
      const r = await api<{ config: LuckyHitConfig }>("/admin/lucky-hit/reset", { method: "POST" });
      setCfg(r.config);
      flash("Defaults restored — 20s rounds, 5s lock.");
    } catch (e) {
      flash(null, e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  };

  const forceResult = async (roundId: string, result: Side | null) => {
    setActing(true);
    try {
      await api(`/admin/lucky-hit/rounds/${roundId}/force-result`, {
        method: "POST",
        body: JSON.stringify({ result }),
      });
      flash(
        result
          ? `Forced: round will resolve as ${SIDE_META[result].label}.`
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

  const settleNow = async (roundId: string, result: Side) => {
    if (!confirm(`Open the cards NOW with ${SIDE_META[result].label}? All bets on this round settle immediately and wallets get credited.`)) return;
    setActing(true);
    try {
      await api(`/admin/lucky-hit/rounds/${roundId}/settle-now`, {
        method: "POST",
        body: JSON.stringify({ result }),
      });
      flash(`Settled now as ${SIDE_META[result].label}. Winners credited.`);
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
            <Dices size={12} /> Lucky Hit Game · Admin
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-white">
            Live activity, manual control & odds
          </h1>
          <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
            Watch every bet, deposit, and withdrawal in real time. Force the
            result of any active round, or open the cards immediately.
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
      {activityErr && (
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-yellow-200 text-xs">
          ⚠ Live activity API: {activityErr} — typically means the database migration hasn&rsquo;t run yet on the API server. Trigger a redeploy or `npx prisma migrate deploy`.
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 1 — Manual round control (LOUD, top of page)           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <ForceResultPanel
        round={currentRound}
        onForce={forceResult}
        onSettleNow={settleNow}
        busy={acting}
      />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 2 — Live activity (also LOUD, three-column live feed)  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <LiveActivitySection activity={activity} now={now} hasError={!!activityErr} />

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 3 — Config (lower priority, edit-and-save)              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="border-t border-yellow-500/10 pt-2 mt-4 text-xs uppercase tracking-widest text-yellow-400/60">
        Game configuration
      </div>

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
            help="Default 20 — fast game"
          />
          <NumField
            label="Lock window (sec)"
            value={cfg.lockSeconds}
            onChange={(v) => setCfg({ ...cfg, lockSeconds: v })}
            min={3}
            max={300}
            int
            help="Last N sec where cards animate"
          />
        </div>
      </section>

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

      <section className="glass rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="flex items-center gap-2 text-white">
              <Sliders size={18} className="text-yellow-300" />
              <h2 className="font-semibold text-lg">RNG win probabilities</h2>
            </div>
            <p className="mt-1 text-xs text-zinc-400 max-w-xl">
              Used when no admin override is set on a round. Higher weight = higher chance.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <WeightField label="Red" value={cfg.redWeight} pct={probabilities.red} tone="red" onChange={(v) => setCfg({ ...cfg, redWeight: v })} />
          <WeightField label="Black" value={cfg.blackWeight} pct={probabilities.black} tone="black" onChange={(v) => setCfg({ ...cfg, blackWeight: v })} />
          <WeightField label="Lucky Hit" value={cfg.luckyHitWeight} pct={probabilities.lucky_hit} tone="gold" onChange={(v) => setCfg({ ...cfg, luckyHitWeight: v })} />
        </div>
      </section>

      <div className="flex items-center gap-2 flex-wrap sticky bottom-2 z-10">
        <button onClick={reset} className="rounded-lg border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10 inline-flex items-center gap-2">
          <RotateCcw size={14} /> Reset to defaults
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

      <section className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 text-white mb-4">
          <HistoryIcon size={18} className="text-yellow-300" />
          <h2 className="font-semibold text-lg">Recent rounds</h2>
          <span className="text-xs text-zinc-500">(refreshing every 3s)</span>
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
    </div>
  );
}

/* ================================================================ */
/*  Force-result + settle-now (LOUD prominent panel)                */
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
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border-2 border-yellow-400/60 bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-amber-500/5 p-5 sm:p-6 shadow-2xl shadow-yellow-500/10 backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Wand2 size={20} className="text-yellow-300" />
            <h2 className="font-extrabold text-xl text-yellow-100 tracking-wide">MANUAL ROUND CONTROL</h2>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-yellow-400/20 border border-yellow-400/50 text-yellow-200">
              Admin only
            </span>
          </div>
          <p className="mt-1 text-sm text-yellow-100/80 max-w-2xl">
            Force the result of the live round, or open the cards immediately on a side of your choice.
          </p>
        </div>
        {round && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-yellow-300/80">Current period</div>
            <div className="font-mono font-bold text-white text-lg">{round.period}</div>
            <div className="mt-1"><StatusPill status={round.status} /></div>
          </div>
        )}
      </div>

      {!round ? (
        <div className="rounded-xl border border-yellow-500/20 bg-black/30 p-4 text-sm text-zinc-400">
          Waiting for the first round to spawn — open the user page once or send a request to <code className="text-yellow-200">/lucky-hit/state</code> to bootstrap a round.
        </div>
      ) : (
        <>
          {/* Status + pools snapshot */}
          <div className="grid gap-3 sm:grid-cols-2 mb-5">
            <div className="rounded-xl border border-yellow-500/20 bg-black/40 p-3">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400">Currently forced</div>
              <div className="mt-1">
                {round.forcedResult ? (
                  <ResultPill result={round.forcedResult} />
                ) : (
                  <span className="text-zinc-500 text-sm">— RNG will decide —</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-yellow-500/20 bg-black/40 p-3">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400">Live pools · {round.betCount} bets</div>
              <div className="mt-1 text-sm text-zinc-200 flex flex-wrap gap-3">
                <span className="text-red-300">Red {formatINR(round.redTotal)}</span>
                <span className="text-zinc-200">Black {formatINR(round.blackTotal)}</span>
                <span className="text-yellow-300">Lucky {formatINR(round.luckyHitTotal)}</span>
              </div>
            </div>
          </div>

          {/* Force result row */}
          <div className="grid gap-4">
            <div>
              <div className="text-xs text-yellow-200/80 mb-2 uppercase tracking-widest font-semibold">
                Step 1 — Force result for this round
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                {SIDES.map((s) => {
                  const meta = SIDE_META[s];
                  const active = round.forcedResult === s;
                  return (
                    <motion.button
                      key={s}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => onForce(round.id, s)}
                      disabled={busy || round.status === "settled"}
                      className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border-2 bg-gradient-to-br px-4 py-3 text-sm font-bold text-white transition disabled:opacity-50 ${meta.bgGrad} ${
                        active ? "ring-4 ring-yellow-300 shadow-lg shadow-yellow-300/40" : ""
                      }`}
                    >
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                      Force {meta.label}
                    </motion.button>
                  );
                })}
                <button
                  onClick={() => onForce(round.id, null)}
                  disabled={busy || round.status === "settled" || !round.forcedResult}
                  className="rounded-xl border border-zinc-500/40 bg-zinc-700/30 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700/50 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <RotateCcw size={14} /> Clear
                </button>
              </div>
              <p className="mt-2 text-[11px] text-yellow-200/60">
                Round keeps running normally until its endsAt — the forced value just replaces the RNG at settlement.
              </p>
            </div>

            <div>
              <div className="text-xs text-yellow-200/80 mb-2 uppercase tracking-widest font-semibold inline-flex items-center gap-1.5">
                <Zap size={12} className="text-yellow-300" /> Step 2 — OPEN CARDS NOW (instant settle)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SIDES.map((s) => {
                  const meta = SIDE_META[s];
                  return (
                    <motion.button
                      key={s}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => onSettleNow(round.id, s)}
                      disabled={busy || round.status === "settled"}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl border-2 bg-gradient-to-br px-4 py-4 text-base font-extrabold text-white transition disabled:opacity-50 ${meta.bgGrad}`}
                    >
                      <Zap size={16} />
                      {meta.label}
                    </motion.button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-yellow-200/60">
                Wallets are credited immediately for every winning bet. Use only when you need to short-circuit the timer.
              </p>
            </div>
          </div>
        </>
      )}
    </motion.section>
  );
}

/* ================================================================ */
/*  Live activity panel                                             */
/* ================================================================ */

function LiveActivitySection({
  activity,
  now,
  hasError,
}: {
  activity: LiveActivity | null;
  now: number;
  hasError: boolean;
}) {
  return (
    <section className="rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-zinc-900/40 p-5 sm:p-6 shadow-xl shadow-emerald-500/5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={20} className="text-emerald-300" />
        <h2 className="font-extrabold text-xl text-emerald-100 tracking-wide">LIVE ACTIVITY</h2>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
        </span>
        <span className="ml-auto text-xs text-zinc-500">refreshing every 1.5s</span>
      </div>

      {hasError && !activity ? (
        <div className="text-sm text-red-300 py-8 text-center">Live activity API is unreachable. Check API logs.</div>
      ) : !activity ? (
        <div className="text-sm text-zinc-500 py-8 text-center">Waiting for first poll…</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <ActivityColumn
            title="Bets being placed"
            icon={<Sparkles size={14} className="text-yellow-300" />}
            count={activity.bets.length}
            tone="yellow"
          >
            {activity.bets.length === 0 && <EmptyHint text="No bets yet" />}
            {activity.bets.map((b) => (
              <BetRow key={b.id} bet={b} now={now} />
            ))}
          </ActivityColumn>

          <ActivityColumn
            title="Wins / Losses"
            icon={<Trophy size={14} className="text-emerald-300" />}
            count={activity.bets.filter((b) => b.status !== "pending").length}
            tone="emerald"
          >
            {activity.bets.filter((b) => b.status !== "pending").length === 0 && <EmptyHint text="No settled bets yet" />}
            {activity.bets
              .filter((b) => b.status !== "pending")
              .slice(0, 20)
              .map((b) => (
                <WinLossRow key={`wl-${b.id}`} bet={b} now={now} />
              ))}
          </ActivityColumn>

          <ActivityColumn
            title="Deposits / Withdrawals"
            icon={<WalletIcon size={14} className="text-sky-300" />}
            count={activity.deposits.length + activity.withdrawals.length}
            tone="sky"
          >
            {activity.deposits.length + activity.withdrawals.length === 0 && (
              <EmptyHint text="No money flow yet" />
            )}
            {[
              ...activity.deposits.map((d) => ({
                kind: "deposit" as const,
                t: d.createdAt,
                d,
                w: null as ActivityWithdrawal | null,
              })),
              ...activity.withdrawals.map((w) => ({
                kind: "withdraw" as const,
                t: w.createdAt,
                d: null as ActivityDeposit | null,
                w,
              })),
            ]
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
  tone,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  tone: "yellow" | "emerald" | "sky";
  children: React.ReactNode;
}) {
  const toneCls =
    tone === "yellow"
      ? "border-yellow-500/30 bg-yellow-500/5"
      : tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : "border-sky-500/30 bg-sky-500/5";
  return (
    <div className={`rounded-2xl border ${toneCls} p-3`}>
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
        <div className="text-xs text-zinc-200 truncate">{bet.userLabel || "—"}</div>
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
      won ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/20 bg-red-500/5"
    }`}>
      {won ? <CheckCircle2 size={14} className="text-emerald-300 shrink-0" /> : <XCircle size={14} className="text-red-300 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-200 truncate">{bet.userLabel || "—"}</div>
        <div className="text-[10px] text-zinc-500 font-mono">{bet.period} · {timeAgo(bet.createdAt, now)}</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold tabular-nums ${won ? "text-emerald-200" : "text-red-200"}`}>
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
    <li className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2 flex items-center gap-2">
      <ArrowDownToLine size={14} className="text-emerald-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-200 truncate">{dep.userLabel || "—"}</div>
        <div className="text-[10px] text-zinc-500">{dep.method} · {timeAgo(dep.createdAt, now)}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-emerald-200 tabular-nums">+{formatINR(dep.amount)}</div>
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
        <div className="text-sm font-bold text-red-200 tabular-nums">-{formatINR(wd.amount)}</div>
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
