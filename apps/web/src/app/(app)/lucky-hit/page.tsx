"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CircleDot,
  Clock,
  Dices,
  History,
  Minus,
  Plus,
  Receipt,
  Sparkles,
  Trophy,
} from "lucide-react";
import { ApiError, api, formatINR } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types — mirror /lucky-hit/state and /lucky-hit/my-bets responses. */
/* ------------------------------------------------------------------ */

type Side = "red" | "black" | "lucky_hit";

type Round = {
  id: string;
  period: string;
  startedAt: string;
  endsAt: string;
  status: "open" | "locked" | "settled";
  result: Side | null;
  redTotal: number;
  blackTotal: number;
  luckyHitTotal: number;
  betCount: number;
  msRemaining: number;
};

type StateResp = {
  enabled: boolean;
  round: Round;
  history: Round[];
  config: {
    minBet: number;
    maxBet: number;
    colorPayout: number;
    luckyHitPayout: number;
    roundDurationSec: number;
    lockSeconds: number;
  };
};

type MyBet = {
  id: string;
  createdAt: string;
  side: Side;
  amount: number;
  status: "pending" | "won" | "lost";
  payout: number;
  walletSource: string;
  period: string;
  roundResult: Side | null;
  roundStatus: string;
};

/* ------------------------------------------------------------------ */
/*  Static UI metadata for the three bet sides.                        */
/* ------------------------------------------------------------------ */

const SIDE_META: Record<
  Side,
  { label: string; sub: string; chip: string; surface: string; selected: string }
> = {
  red: {
    label: "Red",
    sub: "1.9× payout",
    chip: "bg-red-500/15 text-red-300 border-red-500/30",
    surface:
      "from-red-500/15 to-red-500/5 border-red-500/40 hover:from-red-500/20",
    selected:
      "from-red-500/30 to-red-500/10 border-red-400 shadow-lg shadow-red-500/20",
  },
  black: {
    label: "Black",
    sub: "1.9× payout",
    chip: "bg-zinc-700/40 text-zinc-200 border-zinc-500/40",
    surface:
      "from-zinc-700/30 to-zinc-900/40 border-zinc-500/40 hover:from-zinc-700/40",
    selected:
      "from-zinc-700/60 to-zinc-900/70 border-zinc-300 shadow-lg shadow-white/10",
  },
  lucky_hit: {
    label: "Lucky Hit",
    sub: "9× payout",
    chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
    surface:
      "from-yellow-500/15 to-amber-500/5 border-yellow-500/40 hover:from-yellow-500/25",
    selected:
      "from-yellow-500/35 to-amber-500/15 border-yellow-300 shadow-lg shadow-yellow-500/30",
  },
};

const SIDES: Side[] = ["red", "black", "lucky_hit"];

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LuckyHitPage() {
  const [data, setData] = useState<StateResp | null>(null);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<Side>("red");
  const [amount, setAmount] = useState<number>(100);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  // ms clock that ticks locally so the countdown feels smooth between fetches.
  const [now, setNow] = useState(() => Date.now());
  // Wall-clock instant the most recent state response was taken at — kept in
  // state (not a ref) so it can participate in render-time math without
  // tripping the React "Cannot access ref value during render" rule.
  const [fetchedAt, setFetchedAt] = useState<number>(() => Date.now());
  // Detect a round transition (period change) so the cards animation re-fires.
  // This one stays a ref because it's only read/written inside event callbacks.
  const prevPeriodRef = useRef<string | null>(null);
  // Detect a "just settled" round so we can flash the winning side briefly.
  const [revealKey, setRevealKey] = useState(0);

  const loadState = useCallback(async () => {
    try {
      const s = await api<StateResp>("/lucky-hit/state");
      setFetchedAt(Date.now());
      setData(s);
      setError(null);
      // Snap the bet amount into the allowed range as soon as we know the
      // server's bounds, so the +/- buttons don't drift outside them.
      setAmount((a) => Math.min(s.config.maxBet, Math.max(s.config.minBet, a)));
      // Detect round flip — fire the cards animation by bumping the key.
      if (prevPeriodRef.current && prevPeriodRef.current !== s.round.period) {
        setRevealKey((k) => k + 1);
      }
      prevPeriodRef.current = s.round.period;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Lucky Hit state");
    }
  }, []);

  const loadMyBets = useCallback(async () => {
    try {
      const r = await api<{ bets: MyBet[] }>("/lucky-hit/my-bets?take=30");
      setMyBets(r.bets);
    } catch {
      /* non-fatal — keep previous list */
    }
  }, []);

  // Initial load + 2s state poll + 10s my-bets poll. We schedule both via
  // setTimeout(0) so the effect body itself doesn't synchronously trigger
  // setState (satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    const fireState = () => { void loadState(); };
    const fireBets = () => { void loadMyBets(); };
    const initialState = setTimeout(fireState, 0);
    const initialBets = setTimeout(fireBets, 0);
    const stateTick = setInterval(fireState, 2000);
    const betsTick = setInterval(fireBets, 10000);
    return () => {
      clearTimeout(initialState);
      clearTimeout(initialBets);
      clearInterval(stateTick);
      clearInterval(betsTick);
    };
  }, [loadState, loadMyBets]);

  // Local clock — drives the countdown text without re-rendering the whole page
  // logic on the fast path.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const round = data?.round;
  const cfg = data?.config;

  // Effective remaining ms = server snapshot - elapsed since fetch.
  const effectiveMs = useMemo(() => {
    if (!round) return 0;
    return Math.max(0, round.msRemaining - (now - fetchedAt));
  }, [round, now, fetchedAt]);

  // Round is bettable only while server says "open" AND we haven't drifted into
  // the lock window locally. The server will rebuff the bet anyway, but this
  // keeps the UI honest.
  const canBet = !!data?.enabled && round?.status === "open" && effectiveMs > 0;

  const placeBet = async () => {
    if (!round || !cfg) return;
    setToast(null);
    if (amount < cfg.minBet) return setToast({ kind: "err", msg: `Min bet ₹${cfg.minBet}` });
    if (amount > cfg.maxBet) return setToast({ kind: "err", msg: `Max bet ₹${cfg.maxBet}` });
    setBusy(true);
    try {
      await api("/lucky-hit/bet", {
        method: "POST",
        body: JSON.stringify({ side, amount }),
      });
      setToast({ kind: "ok", msg: `Bet placed: ${formatINR(amount)} on ${SIDE_META[side].label}` });
      // Pull fresh totals immediately so the score updates.
      loadState();
      loadMyBets();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Bet failed";
      setToast({ kind: "err", msg });
    } finally {
      setBusy(false);
    }
  };

  const incAmount = (step: number) => {
    if (!cfg) return;
    setAmount((a) => Math.min(cfg.maxBet, Math.max(cfg.minBet, a + step)));
  };

  /* ----- render -------------------------------------------------- */

  if (error && !data) {
    return (
      <div className="max-w-3xl mx-auto p-10 text-center text-red-300 text-sm">{error}</div>
    );
  }

  if (!data || !cfg || !round) {
    return (
      <div className="max-w-3xl mx-auto p-10 text-center text-zinc-400 text-sm">
        Loading Lucky Hit…
      </div>
    );
  }

  if (!data.enabled) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <Header />
        <div className="mt-6 glass rounded-3xl p-10 text-center">
          <div className="text-4xl mb-3">🎲</div>
          <h3 className="text-white font-semibold text-lg">Lucky Hit is currently paused</h3>
          <p className="text-zinc-400 text-sm mt-2">Check back soon — admin has temporarily disabled this game.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <Header />

      {/* Round status panel */}
      <RoundPanel
        round={round}
        cfg={cfg}
        effectiveMs={effectiveMs}
        revealKey={revealKey}
      />

      {/* History strip */}
      <HistoryStrip rounds={data.history} />

      {/* Score totals */}
      <ScorePanel round={round} />

      {/* Bet picker */}
      <BetPanel
        side={side}
        setSide={setSide}
        amount={amount}
        setAmount={(v) => setAmount(Math.min(cfg.maxBet, Math.max(cfg.minBet, v)))}
        incAmount={incAmount}
        cfg={cfg}
        canBet={canBet}
        busy={busy}
        onPlace={placeBet}
        toast={toast}
      />

      {/* My record */}
      <MyRecord bets={myBets} />
    </div>
  );
}

/* ================================================================ */
/*  Sub-components                                                  */
/* ================================================================ */

function Header() {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-400/80">
        <Dices size={12} /> Lucky Hit · Color Prediction
      </div>
      <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-white">
        Pick a colour, win up to <span className="gold-text">9×</span>
      </h1>
      <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
        New round every 3 minutes. Bet from your <span className="text-yellow-200 font-medium">deposit/bonus wallet</span>; winnings are credited to your <span className="text-yellow-200 font-medium">earnings wallet</span> instantly.
      </p>
    </div>
  );
}

function RoundPanel({
  round,
  cfg,
  effectiveMs,
  revealKey,
}: {
  round: Round;
  cfg: StateResp["config"];
  effectiveMs: number;
  revealKey: number;
}) {
  const isOpen = round.status === "open";
  const isLocked = round.status === "locked";

  // Shape the countdown copy by phase. While "open" the timer counts down to
  // the lock window; while "locked" it counts down to settlement.
  const phaseLabel = isOpen ? "Bets close in" : isLocked ? "Result in" : "Settled";
  const phaseColor = isOpen
    ? "text-emerald-300"
    : isLocked
    ? "text-yellow-300"
    : "text-zinc-300";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-400">Period</div>
          <div className="text-white font-mono font-semibold text-lg sm:text-xl">{round.period}</div>
        </div>
        <div className="text-right">
          <div className={`text-xs uppercase tracking-widest ${phaseColor}`}>{phaseLabel}</div>
          <div className="flex items-center gap-2 justify-end">
            <Clock size={16} className={phaseColor} />
            <span className="text-2xl sm:text-3xl font-bold tabular-nums text-white">
              {formatMs(effectiveMs)}
            </span>
          </div>
        </div>
      </div>

      {/* Phase pill */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <PhasePill status={round.status} />
        <span className="text-xs text-zinc-500">Round duration {Math.round(cfg.roundDurationSec / 60)} min · last {cfg.lockSeconds}s locked</span>
      </div>

      {/* VS cards animation */}
      <div className="mt-5">
        <VsCards key={revealKey} status={round.status} result={round.result} />
      </div>
    </motion.div>
  );
}

function PhasePill({ status }: { status: Round["status"] }) {
  const map: Record<Round["status"], { label: string; cls: string }> = {
    open: { label: "Betting open", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    locked: { label: "Bets locked", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
    settled: { label: "Result", cls: "bg-zinc-700/40 text-zinc-200 border-zinc-500/30" },
  };
  const p = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${p.cls}`}
    >
      <CircleDot size={10} /> {p.label}
    </span>
  );
}

/**
 * 3-vs-3 card animation. While the round is open the cards stay face-down and
 * drift gently. When locked we shuffle them. When settled we flip the winning
 * side face up. Pure CSS + framer-motion — no images required.
 */
function VsCards({
  status,
  result,
}: {
  status: Round["status"];
  result: Side | null;
}) {
  // Decide which side "wins" the visual reveal:
  //  - "red"        → red side flips up
  //  - "black"      → black side flips up
  //  - "lucky_hit"  → both sides flip up showing gold (handled via result==="lucky_hit")
  const showResult = status === "settled" && !!result;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
      <CardRow side="red" status={status} winner={showResult && (result === "red" || result === "lucky_hit")} result={result} />
      <div className="text-center">
        <div className="font-bold text-yellow-300/90 text-xl sm:text-3xl gold-text drop-shadow">VS</div>
      </div>
      <CardRow side="black" status={status} winner={showResult && (result === "black" || result === "lucky_hit")} result={result} />
    </div>
  );
}

function CardRow({
  side,
  status,
  winner,
  result,
}: {
  side: "red" | "black";
  status: Round["status"];
  winner: boolean;
  result: Side | null;
}) {
  const isLucky = winner && result === "lucky_hit";
  const reverse = side === "black"; // black row leans the other way

  // Per-phase animation:
  //  - open: gentle hover (the cards "wait" for action)
  //  - locked: shuffle / shake to build suspense
  //  - settled: flip on the winning row
  const sway =
    status === "locked"
      ? { rotate: [-6, 6, -6], y: [0, -4, 0], transition: { repeat: Infinity, duration: 0.7 } }
      : status === "open"
      ? { y: [0, -3, 0], transition: { repeat: Infinity, duration: 2.2 } }
      : { rotate: 0, y: 0 };

  return (
    <div className={`flex ${reverse ? "justify-end flex-row-reverse" : "justify-start"} items-center gap-1.5 sm:gap-2`}>
      {[0, 1, 2].map((i) => {
        const flip = winner;
        return (
          <motion.div
            key={i}
            initial={false}
            animate={flip ? { rotateY: 180, scale: 1.05 } : sway}
            transition={{ duration: flip ? 0.6 : undefined, delay: flip ? i * 0.1 : i * 0.08 }}
            className="relative w-10 h-14 sm:w-14 sm:h-20 rounded-md sm:rounded-lg shadow-md shrink-0"
            style={{ transformStyle: "preserve-3d", perspective: 600 }}
          >
            {/* Back face */}
            <div
              className="absolute inset-0 rounded-md sm:rounded-lg border"
              style={{
                background:
                  side === "red"
                    ? "linear-gradient(135deg,#7f1d1d,#b91c1c 50%,#7f1d1d)"
                    : "linear-gradient(135deg,#0b0b0b,#27272a 50%,#0b0b0b)",
                borderColor: side === "red" ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.2)",
                backfaceVisibility: "hidden",
              }}
            >
              <div className="absolute inset-1 rounded border border-white/10" />
              <div className="absolute inset-0 flex items-center justify-center text-white/60 font-bold">
                {side === "red" ? "R" : "B"}
              </div>
            </div>
            {/* Front face — only renders meaningfully when flipped */}
            <div
              className="absolute inset-0 rounded-md sm:rounded-lg border flex items-center justify-center font-bold text-lg sm:text-xl"
              style={{
                background: isLucky
                  ? "linear-gradient(135deg,#fde68a,#facc15 50%,#fde68a)"
                  : side === "red"
                  ? "linear-gradient(135deg,#fecaca,#ef4444 50%,#fecaca)"
                  : "linear-gradient(135deg,#e4e4e7,#52525b 50%,#e4e4e7)",
                borderColor: isLucky ? "#fde68a" : side === "red" ? "#fca5a5" : "#a1a1aa",
                color: isLucky ? "#7c2d12" : side === "red" ? "#7f1d1d" : "#18181b",
                transform: "rotateY(180deg)",
                backfaceVisibility: "hidden",
              }}
            >
              {isLucky ? "★" : side === "red" ? "R" : "B"}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function HistoryStrip({ rounds }: { rounds: Round[] }) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 text-white">
        <History size={16} className="text-yellow-300" />
        <h3 className="font-semibold text-sm">Last 30 results</h3>
      </div>
      {rounds.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">No history yet — be the first to play this slot.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rounds.map((r) => (
            <ResultDot key={r.id} result={r.result} period={r.period} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultDot({ result, period }: { result: Side | null; period: string }) {
  const cls =
    result === "red"
      ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"
      : result === "black"
      ? "bg-zinc-800 ring-1 ring-white/30"
      : result === "lucky_hit"
      ? "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.7)]"
      : "bg-zinc-700";
  const tip =
    result === "red" ? "Red" : result === "black" ? "Black" : result === "lucky_hit" ? "Lucky Hit ★" : "Pending";
  return (
    <span
      className={`inline-block w-3.5 h-3.5 rounded-full ${cls}`}
      title={`${period} — ${tip}`}
    />
  );
}

function ScorePanel({ round }: { round: Round }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <ScoreCard label="Red" value={round.redTotal} accent="red" />
      <ScoreCard label="Black" value={round.blackTotal} accent="black" />
      <ScoreCard label="Lucky Hit" value={round.luckyHitTotal} accent="gold" />
    </div>
  );
}

function ScoreCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "red" | "black" | "gold";
}) {
  const tone =
    accent === "red"
      ? "border-red-500/30 bg-red-500/5"
      : accent === "black"
      ? "border-zinc-500/30 bg-zinc-800/40"
      : "border-yellow-500/30 bg-yellow-500/5";
  const text =
    accent === "red"
      ? "text-red-300"
      : accent === "black"
      ? "text-zinc-200"
      : "text-yellow-300";
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${tone}`}>
      <div className={`text-[10px] uppercase tracking-widest ${text}`}>{label} pool</div>
      <div className="mt-1 text-base sm:text-lg font-semibold text-white tabular-nums">
        {formatINR(value)}
      </div>
    </div>
  );
}

function BetPanel({
  side,
  setSide,
  amount,
  setAmount,
  incAmount,
  cfg,
  canBet,
  busy,
  onPlace,
  toast,
}: {
  side: Side;
  setSide: (s: Side) => void;
  amount: number;
  setAmount: (n: number) => void;
  incAmount: (step: number) => void;
  cfg: StateResp["config"];
  canBet: boolean;
  busy: boolean;
  onPlace: () => void;
  toast: { kind: "ok" | "err"; msg: string } | null;
}) {
  const quick = [10, 50, 100, 500, 1000];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-5 sm:p-6"
    >
      <div className="flex items-center gap-2 text-white">
        <Sparkles size={18} className="text-yellow-300" />
        <h3 className="font-semibold">Place your bet</h3>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {SIDES.map((s) => {
          const meta = SIDE_META[s];
          const selected = s === side;
          const cls = selected ? meta.selected : meta.surface;
          return (
            <motion.button
              key={s}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSide(s)}
              className={`rounded-2xl border bg-gradient-to-br p-3 sm:p-4 text-left transition ${cls}`}
            >
              <div className="text-white font-bold text-sm sm:text-base">{meta.label}</div>
              <div className={`mt-1 text-[10px] sm:text-xs uppercase tracking-widest inline-flex px-2 py-0.5 rounded-full border ${meta.chip}`}>
                {s === "lucky_hit"
                  ? `${cfg.luckyHitPayout}× payout`
                  : `${cfg.colorPayout}× payout`}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Amount stepper */}
      <div className="mt-5 grid gap-3">
        <div className="text-xs text-zinc-400 uppercase tracking-widest font-semibold">Bet amount</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => incAmount(-10)}
            disabled={amount <= cfg.minBet}
            className="h-12 w-12 rounded-xl border border-yellow-500/30 bg-black/40 text-yellow-200 hover:bg-yellow-500/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center"
            aria-label="Decrease"
          >
            <Minus size={18} />
          </button>
          <input
            type="number"
            value={amount}
            min={cfg.minBet}
            max={cfg.maxBet}
            onChange={(e) => setAmount(Math.floor(Number(e.target.value) || 0))}
            className="flex-1 h-12 rounded-xl border border-yellow-500/30 bg-black/40 px-4 text-center text-xl font-bold text-white focus:outline-none focus:border-yellow-500/60"
          />
          <button
            onClick={() => incAmount(10)}
            disabled={amount >= cfg.maxBet}
            className="h-12 w-12 rounded-xl border border-yellow-500/30 bg-black/40 text-yellow-200 hover:bg-yellow-500/10 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center"
            aria-label="Increase"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {quick.filter((q) => q >= cfg.minBet && q <= cfg.maxBet).map((q) => (
            <button
              key={q}
              onClick={() => setAmount(q)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                amount === q
                  ? "border-yellow-500/60 bg-yellow-500/15 text-yellow-200"
                  : "border-yellow-500/20 text-zinc-200 hover:bg-yellow-500/10"
              }`}
            >
              ₹{q}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-zinc-500">
          Min ₹{cfg.minBet} · Max ₹{cfg.maxBet} · Funds debited from deposit, bonus as fallback.
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onPlace}
        disabled={!canBet || busy}
        className="mt-5 w-full rounded-xl bg-[var(--primary)] py-4 font-bold text-black hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-yellow-500/20"
      >
        {busy
          ? "Placing…"
          : !canBet
          ? "Bets locked — wait for next round"
          : `Bet ${formatINR(amount)} on ${SIDE_META[side].label}`}
      </motion.button>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-3 rounded-lg px-4 py-2.5 text-xs border font-medium ${
              toast.kind === "ok"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                : "bg-red-500/15 border-red-500/40 text-red-200"
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MyRecord({ bets }: { bets: MyBet[] }) {
  return (
    <div className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex items-center gap-2 text-white">
        <Receipt size={16} className="text-yellow-300" />
        <h3 className="font-semibold">My Lucky Hit Record</h3>
      </div>
      {bets.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No bets yet. Pick a side above to start.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-yellow-300/80 bg-black/30">
              <tr>
                <th className="text-left px-2 py-2">Period</th>
                <th className="text-left px-2 py-2">Pick</th>
                <th className="text-right px-2 py-2">Bet</th>
                <th className="text-left px-2 py-2">Result</th>
                <th className="text-right px-2 py-2">Payout</th>
              </tr>
            </thead>
            <tbody className="text-zinc-200">
              {bets.map((b) => (
                <tr key={b.id} className="border-t border-white/5">
                  <td className="px-2 py-2 font-mono text-[11px] text-zinc-300">{b.period}</td>
                  <td className="px-2 py-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${SIDE_META[b.side].chip}`}>
                      <ResultDot result={b.side} period="" /> {SIDE_META[b.side].label}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-medium tabular-nums">{formatINR(b.amount)}</td>
                  <td className="px-2 py-2">
                    {b.status === "pending" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-zinc-700/40 text-zinc-300">
                        Pending
                      </span>
                    ) : b.status === "won" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200">
                        <Trophy size={10} /> Won {b.roundResult ? SIDE_META[b.roundResult].label : ""}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-500/15 text-red-200">
                        Lost {b.roundResult ? `(${SIDE_META[b.roundResult].label})` : ""}
                      </span>
                    )}
                  </td>
                  <td className={`px-2 py-2 text-right tabular-nums ${b.status === "won" ? "gold-text font-semibold" : "text-zinc-400"}`}>
                    {b.status === "won" ? `+${formatINR(b.payout)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
