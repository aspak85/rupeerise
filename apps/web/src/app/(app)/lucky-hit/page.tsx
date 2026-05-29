"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CircleDot,
  Clock,
  Coins,
  Dices,
  History,
  Minus,
  Plus,
  Receipt,
  Sparkles,
  Timer,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { ApiError, api, formatINR } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Side = "red" | "black" | "lucky_hit";

type Round = {
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

type LiveBet = {
  id: string;
  createdAt: string;
  side: Side;
  amount: number;
  status: "pending" | "won" | "lost";
  payout: number;
  period: string;
};

type WalletRow = { type: string; balance: string };

/* ------------------------------------------------------------------ */
/*  Static UI metadata                                                 */
/* ------------------------------------------------------------------ */

const SIDE_META: Record<
  Side,
  { label: string; chip: string; surface: string; selected: string; dot: string }
> = {
  red: {
    label: "Red",
    chip: "bg-red-500/15 text-red-300 border-red-500/30",
    surface: "from-red-500/15 to-red-500/5 border-red-500/40 hover:from-red-500/20",
    selected: "from-red-500/35 to-red-500/15 border-red-300 shadow-lg shadow-red-500/30",
    dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]",
  },
  black: {
    label: "Black",
    chip: "bg-zinc-700/40 text-zinc-200 border-zinc-500/40",
    surface: "from-zinc-700/30 to-zinc-900/40 border-zinc-500/40 hover:from-zinc-700/40",
    selected: "from-zinc-700/60 to-zinc-900/70 border-zinc-300 shadow-lg shadow-white/10",
    dot: "bg-zinc-800 ring-1 ring-white/30",
  },
  lucky_hit: {
    label: "Lucky Hit",
    chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
    surface: "from-yellow-500/15 to-amber-500/5 border-yellow-500/40 hover:from-yellow-500/25",
    selected: "from-yellow-500/35 to-amber-500/15 border-yellow-300 shadow-lg shadow-yellow-500/30",
    dot: "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.7)]",
  },
};

const SIDES: Side[] = ["red", "black", "lucky_hit"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatMs(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

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

export default function LuckyHitPage() {
  const [data, setData] = useState<StateResp | null>(null);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<Side>("red");
  const [amount, setAmount] = useState<number>(100);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fetchedAt, setFetchedAt] = useState<number>(() => Date.now());
  const prevPeriodRef = useRef<string | null>(null);
  const [revealKey, setRevealKey] = useState(0);
  // The just-settled round we should flash a "RED WINS!" / etc. banner for.
  // Cleared after the splash auto-dismisses. Stored as just the round —
  // matching myBet is derived at render time so we never need a follow-up
  // setState (which would trip react-hooks/set-state-in-effect).
  const [splashRound, setSplashRound] = useState<Round | null>(null);

  /* ----- data loaders ---------------------------------------------- */

  const loadState = useCallback(async () => {
    try {
      const s = await api<StateResp>("/lucky-hit/state");
      setFetchedAt(Date.now());
      setData(s);
      setError(null);
      setAmount((a) => Math.min(s.config.maxBet, Math.max(s.config.minBet, a)));
      // Round transition detection: when the period flips, fire the cards
      // animation AND surface a result splash for the previous round.
      if (prevPeriodRef.current && prevPeriodRef.current !== s.round.period) {
        setRevealKey((k) => k + 1);
        // The first row of `history` is the just-settled previous round.
        const prev = s.history[0];
        if (prev && prev.period === prevPeriodRef.current && prev.result) {
          setSplashRound(prev);
        }
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
      /* non-fatal */
    }
  }, []);

  const loadLiveBets = useCallback(async () => {
    try {
      const r = await api<{ bets: LiveBet[] }>("/lucky-hit/live-bets?take=25");
      setLiveBets(r.bets);
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadWallets = useCallback(async () => {
    try {
      const r = await api<{ wallets: WalletRow[] }>("/me");
      setWallets(r.wallets);
    } catch {
      /* non-fatal */
    }
  }, []);

  /* ----- timers ----------------------------------------------------- */

  useEffect(() => {
    const fireState = () => { void loadState(); };
    const fireMine = () => { void loadMyBets(); };
    const fireLive = () => { void loadLiveBets(); };
    const fireWallet = () => { void loadWallets(); };
    const t1 = setTimeout(fireState, 0);
    const t2 = setTimeout(fireMine, 0);
    const t3 = setTimeout(fireLive, 0);
    const t4 = setTimeout(fireWallet, 0);
    // State polled fast (1.5s) so the countdown stays close to wall-clock.
    // Live bets polled at 3s — they're decorative. Wallets every 5s.
    const stateTick = setInterval(fireState, 1500);
    const liveTick = setInterval(fireLive, 3000);
    const walletTick = setInterval(fireWallet, 5000);
    const mineTick = setInterval(fireMine, 5000);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
      clearInterval(stateTick); clearInterval(liveTick);
      clearInterval(walletTick); clearInterval(mineTick);
    };
  }, [loadState, loadMyBets, loadLiveBets, loadWallets]);

  // Local clock — drives the countdown text smoothly between fetches.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // When a result splash is shown, look up the user's bet for that round (if
  // any) so the splash can display "you won/lost". Derived at render time —
  // no extra setState needed.
  const splashMyBet = useMemo(() => {
    if (!splashRound) return null;
    return myBets.find((b) => b.period === splashRound.period) ?? null;
  }, [myBets, splashRound]);

  // Auto-dismiss the splash after 4 seconds.
  useEffect(() => {
    if (!splashRound) return;
    const id = setTimeout(() => setSplashRound(null), 4000);
    return () => clearTimeout(id);
  }, [splashRound]);

  /* ----- derived ---------------------------------------------------- */

  const round = data?.round;
  const cfg = data?.config;

  const effectiveMs = useMemo(() => {
    if (!round) return 0;
    return Math.max(0, round.msRemaining - (now - fetchedAt));
  }, [round, now, fetchedAt]);

  // Trust local clock when polling lags: if status says "open" but our local
  // countdown already dropped to zero, treat the round as locked so the user
  // can't keep tapping "Place bet" against a closing round.
  const phase: "open" | "locked" | "settled" = useMemo(() => {
    if (!round) return "open";
    if (round.status === "settled") return "settled";
    if (round.status === "locked") return "locked";
    return effectiveMs > 0 ? "open" : "locked";
  }, [round, effectiveMs]);

  const canBet = !!data?.enabled && phase === "open";

  const balanceOf = (t: string) =>
    Number(wallets.find((w) => w.type === t)?.balance ?? 0);

  /* ----- actions --------------------------------------------------- */

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
      setToast({ kind: "ok", msg: `${formatINR(amount)} on ${SIDE_META[side].label} — locked in!` });
      // Refresh totals + wallets immediately so the UI feels live.
      loadState();
      loadMyBets();
      loadLiveBets();
      loadWallets();
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

  /* ----- render ----------------------------------------------------- */

  if (error && !data) {
    return <div className="max-w-3xl mx-auto p-10 text-center text-red-300 text-sm">{error}</div>;
  }
  if (!data || !cfg || !round) {
    return <div className="max-w-3xl mx-auto p-10 text-center text-zinc-400 text-sm">Loading Lucky Hit…</div>;
  }
  if (!data.enabled) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <Header />
        <div className="mt-6 glass rounded-3xl p-10 text-center">
          <div className="text-4xl mb-3">🎲</div>
          <h3 className="text-white font-semibold text-lg">Lucky Hit is currently paused</h3>
          <p className="text-zinc-400 text-sm mt-2">Check back soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl mx-auto w-full">
      <Header />

      {/* Wallet strip — always-visible balance for confidence at bet time */}
      <WalletStrip
        deposit={balanceOf("deposit")}
        bonus={balanceOf("bonus")}
        earnings={balanceOf("earnings")}
      />

      {/* Round + cards */}
      <RoundPanel
        round={round}
        cfg={cfg}
        effectiveMs={effectiveMs}
        phase={phase}
        revealKey={revealKey}
      />

      {/* History strip */}
      <HistoryStrip rounds={data.history} />

      {/* Live score totals + live bets feed (split layout on desktop) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <ScorePanel round={round} />
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
        </div>
        <LiveBetsPanel bets={liveBets} now={now} />
      </div>

      {/* My record */}
      <MyRecord bets={myBets} />

      {/* Floating result splash overlay — fires for ~4s on every round flip */}
      <AnimatePresence>
        {splashRound && splashRound.result && (
          <ResultSplash round={splashRound} myBet={splashMyBet} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================================================ */
/*  Header                                                          */
/* ================================================================ */

function Header() {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-400/80">
        <Dices size={12} /> Lucky Hit · Color Prediction
      </div>
      <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-white">
        Pick a colour · win up to <span className="gold-text">9×</span>
      </h1>
      <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
        Quick rounds — 15 seconds to bet, then watch the cards open.
      </p>
    </div>
  );
}

/* ================================================================ */
/*  Wallet strip                                                    */
/* ================================================================ */

function WalletStrip({
  deposit,
  bonus,
  earnings,
}: {
  deposit: number;
  bonus: number;
  earnings: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-3 gap-2 sm:gap-3"
    >
      <WalletTile label="Deposit" amount={deposit} icon={<Wallet size={14} />} accent="zinc" sub="bet from here" />
      <WalletTile label="Bonus" amount={bonus} icon={<Coins size={14} />} accent="yellow" sub="bet fallback" />
      <WalletTile label="Earnings" amount={earnings} icon={<Trophy size={14} />} accent="emerald" sub="wins land here" />
    </motion.div>
  );
}

function WalletTile({
  label,
  amount,
  icon,
  accent,
  sub,
}: {
  label: string;
  amount: number;
  icon: React.ReactNode;
  accent: "zinc" | "yellow" | "emerald";
  sub: string;
}) {
  const tone =
    accent === "yellow"
      ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-300"
      : accent === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
      : "border-zinc-500/30 bg-zinc-800/30 text-zinc-200";
  return (
    <div className={`rounded-2xl border p-3 ${tone}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest opacity-90">
        {icon} {label}
      </div>
      <div className="mt-1 text-base sm:text-lg font-semibold text-white tabular-nums">
        {formatINR(amount)}
      </div>
      <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>
    </div>
  );
}

/* ================================================================ */
/*  Round panel + cards                                             */
/* ================================================================ */

function RoundPanel({
  round,
  cfg,
  effectiveMs,
  phase,
  revealKey,
}: {
  round: Round;
  cfg: StateResp["config"];
  effectiveMs: number;
  phase: "open" | "locked" | "settled";
  revealKey: number;
}) {
  // Countdown copy by phase. While "open" the timer counts down to the lock
  // window; while "locked" it counts to settlement.
  const phaseLabel = phase === "open" ? "Bets close in" : phase === "locked" ? "Cards opening in" : "Settled";
  const phaseColor =
    phase === "open" ? "text-emerald-300" : phase === "locked" ? "text-yellow-300" : "text-zinc-300";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-5 sm:p-6 relative overflow-hidden"
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
            <span className="text-3xl sm:text-4xl font-bold tabular-nums text-white">
              {formatMs(effectiveMs)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <PhasePill phase={phase} />
        <span className="text-[11px] text-zinc-500 inline-flex items-center gap-1">
          <Timer size={10} /> Round {Math.round(cfg.roundDurationSec)}s · last {cfg.lockSeconds}s = card flip
        </span>
      </div>

      <div className="mt-5">
        <VsCards key={revealKey} phase={phase} result={round.result} />
      </div>
    </motion.div>
  );
}

function PhasePill({ phase }: { phase: "open" | "locked" | "settled" }) {
  const map: Record<typeof phase, { label: string; cls: string }> = {
    open: { label: "Betting open", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    locked: { label: "Cards opening…", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
    settled: { label: "Settled", cls: "bg-zinc-700/40 text-zinc-200 border-zinc-500/30" },
  };
  const p = map[phase];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${p.cls}`}>
      <CircleDot size={10} /> {p.label}
    </span>
  );
}

/**
 * 3-vs-3 cards animation:
 *   open    — cards float gently face-down
 *   locked  — cards shake intensely (the "shuffle" suspense beat)
 *   settled — winning side flips face-up with a 0.4s stagger between cards
 *
 * The whole component is keyed by `revealKey` from the parent so a fresh
 * round always resets the animation back to the face-down rest state.
 */
function VsCards({
  phase,
  result,
}: {
  phase: "open" | "locked" | "settled";
  result: Side | null;
}) {
  const showResult = phase === "settled" && !!result;
  const redWins = showResult && (result === "red" || result === "lucky_hit");
  const blackWins = showResult && (result === "black" || result === "lucky_hit");
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
      <CardRow side="red" phase={phase} winner={redWins} result={result} />
      <div className="text-center">
        <motion.div
          animate={
            phase === "locked"
              ? { scale: [1, 1.15, 1], rotate: [-3, 3, -3] }
              : phase === "settled"
              ? { scale: [1, 1.4, 1] }
              : { scale: 1 }
          }
          transition={{ repeat: phase === "locked" ? Infinity : 0, duration: 0.5 }}
          className="font-bold text-yellow-300 text-2xl sm:text-4xl gold-text drop-shadow"
        >
          VS
        </motion.div>
      </div>
      <CardRow side="black" phase={phase} winner={blackWins} result={result} />
    </div>
  );
}

function CardRow({
  side,
  phase,
  winner,
  result,
}: {
  side: "red" | "black";
  phase: "open" | "locked" | "settled";
  winner: boolean;
  result: Side | null;
}) {
  const isLucky = winner && result === "lucky_hit";
  const reverse = side === "black";

  return (
    <div className={`flex ${reverse ? "justify-end flex-row-reverse" : "justify-start"} items-center gap-1.5 sm:gap-2`}>
      {[0, 1, 2].map((i) => (
        <FlipCard
          key={i}
          index={i}
          side={side}
          phase={phase}
          winner={winner}
          isLucky={isLucky}
        />
      ))}
    </div>
  );
}

/**
 * Single 3D-flip card. The animate prop changes per phase so framer-motion
 * smoothly drives the same element through hover → shuffle → flip — there's
 * no abrupt state swap.
 */
function FlipCard({
  index,
  side,
  phase,
  winner,
  isLucky,
}: {
  index: number;
  side: "red" | "black";
  phase: "open" | "locked" | "settled";
  winner: boolean;
  isLucky: boolean;
}) {
  // Phase-specific animation:
  //   open    — gentle float (perpetual y bob)
  //   locked  — vigorous shuffle (rotate + translate, perpetual)
  //   settled — flip 180° on Y if this side won, else slight fade-back
  const animate =
    phase === "settled"
      ? winner
        ? { rotateY: 180, scale: 1.08, y: 0, rotate: 0 }
        : { rotateY: 0, scale: 0.92, y: 0, rotate: 0, opacity: 0.55 }
      : phase === "locked"
      ? { rotate: [-10, 10, -10], y: [0, -6, 0], scale: [1, 1.03, 1] }
      : { rotate: 0, y: [0, -3, 0], scale: 1 };

  const transition =
    phase === "settled"
      ? // Stagger the flip so each card opens 0.4s after the previous —
        // makes the reveal feel deliberate, not instant.
        { duration: 0.7, delay: index * 0.4, ease: [0.2, 0.7, 0.2, 1] as const }
      : phase === "locked"
      ? { repeat: Infinity, duration: 0.55, delay: index * 0.07 }
      : { repeat: Infinity, duration: 2.2, delay: index * 0.15 };

  return (
    <motion.div
      initial={false}
      animate={animate}
      transition={transition}
      className="relative w-12 h-16 sm:w-16 sm:h-22 rounded-md sm:rounded-lg shrink-0"
      style={{ transformStyle: "preserve-3d", perspective: 800 }}
    >
      {/* Back face (face-down) */}
      <div
        className="absolute inset-0 rounded-md sm:rounded-lg border shadow-md"
        style={{
          background:
            side === "red"
              ? "linear-gradient(135deg,#7f1d1d,#b91c1c 50%,#7f1d1d)"
              : "linear-gradient(135deg,#0b0b0b,#27272a 50%,#0b0b0b)",
          borderColor: side === "red" ? "rgba(248,113,113,0.55)" : "rgba(255,255,255,0.25)",
          backfaceVisibility: "hidden",
        }}
      >
        <div className="absolute inset-1 rounded border border-white/10" />
        <div className="absolute inset-0 flex items-center justify-center text-white/70 font-bold text-base sm:text-lg">
          {side === "red" ? "R" : "B"}
        </div>
      </div>
      {/* Front face (face-up — only seen when rotateY=180) */}
      <div
        className="absolute inset-0 rounded-md sm:rounded-lg border flex items-center justify-center font-extrabold text-2xl sm:text-3xl shadow-lg"
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
}

/* ================================================================ */
/*  Result splash                                                   */
/* ================================================================ */

function ResultSplash({
  round,
  myBet,
}: {
  round: Round;
  myBet: MyBet | null;
}) {
  const result = round.result!;
  const meta = SIDE_META[result];
  const won = myBet && myBet.side === result;
  const titleColor =
    result === "red" ? "text-red-300" : result === "black" ? "text-zinc-100" : "text-yellow-300";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      className="fixed inset-0 z-40 flex items-start justify-center pointer-events-none px-4 pt-24 sm:pt-28"
    >
      <div className="glass rounded-3xl px-8 py-6 border-2 border-yellow-500/40 shadow-2xl text-center pointer-events-auto">
        <div className={`text-xs uppercase tracking-widest opacity-80 ${titleColor}`}>
          Period {round.period}
        </div>
        <div className={`mt-1 text-3xl sm:text-4xl font-extrabold ${titleColor}`}>
          {meta.label.toUpperCase()} {result === "lucky_hit" ? "★" : ""} WIN!
        </div>
        {myBet ? (
          won ? (
            <div className="mt-2 text-emerald-200 text-base sm:text-lg font-semibold inline-flex items-center gap-2">
              <Trophy size={18} className="text-yellow-300" />
              You won {formatINR(myBet.payout)}!
            </div>
          ) : (
            <div className="mt-2 text-red-200 text-sm">
              Lost {formatINR(myBet.amount)} on {SIDE_META[myBet.side].label}. Better luck next round.
            </div>
          )
        ) : (
          <div className="mt-2 text-zinc-400 text-sm">No bet this round — try the next one.</div>
        )}
      </div>
    </motion.div>
  );
}

/* ================================================================ */
/*  History · Score · Bet panels                                    */
/* ================================================================ */

function HistoryStrip({ rounds }: { rounds: Round[] }) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 text-white">
        <History size={16} className="text-yellow-300" />
        <h3 className="font-semibold text-sm">Last 30 results</h3>
      </div>
      {rounds.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">No history yet — be the first to play.</p>
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
  const cls = result ? SIDE_META[result].dot : "bg-zinc-700";
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
    accent === "red" ? "text-red-300" : accent === "black" ? "text-zinc-200" : "text-yellow-300";
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
  const quick = [10, 50, 100, 500, 1000].filter((q) => q >= cfg.minBet && q <= cfg.maxBet);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
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
                {s === "lucky_hit" ? `${cfg.luckyHitPayout}× payout` : `${cfg.colorPayout}× payout`}
              </div>
            </motion.button>
          );
        })}
      </div>

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
          {quick.map((q) => (
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
          Min ₹{cfg.minBet} · Max ₹{cfg.maxBet} · Debited from deposit, bonus as fallback.
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

/* ================================================================ */
/*  Live bets feed (anonymized)                                     */
/* ================================================================ */

function LiveBetsPanel({ bets, now }: { bets: LiveBet[]; now: number }) {
  return (
    <div className="glass rounded-3xl p-4 sm:p-5 lg:sticky lg:top-4 self-start">
      <div className="flex items-center gap-2 text-white">
        <Users size={16} className="text-yellow-300" />
        <h3 className="font-semibold text-sm">Live bets</h3>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-yellow-400/70">
          {bets.length}
        </span>
      </div>
      {bets.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">No bets yet — be the first.</p>
      ) : (
        <ul className="mt-3 space-y-1.5 max-h-[360px] overflow-y-auto pr-1 no-scrollbar">
          {bets.map((b) => {
            const meta = SIDE_META[b.side];
            return (
              <li
                key={b.id}
                className="flex items-center gap-2 rounded-xl border border-yellow-500/10 bg-black/30 px-3 py-2"
              >
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${meta.dot} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-300 truncate">
                    Anonymous · <span className={`uppercase tracking-widest text-[10px] ${
                      b.side === "red"
                        ? "text-red-300"
                        : b.side === "black"
                        ? "text-zinc-200"
                        : "text-yellow-300"
                    }`}>{meta.label}</span>
                  </div>
                  <div className="text-[10px] text-zinc-500">{timeAgo(b.createdAt, now)}</div>
                </div>
                <div className="text-sm font-semibold text-white tabular-nums">
                  {formatINR(b.amount)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ================================================================ */
/*  My record                                                       */
/* ================================================================ */

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
                      <span className={`inline-block w-2 h-2 rounded-full ${SIDE_META[b.side].dot}`} />
                      {SIDE_META[b.side].label}
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
