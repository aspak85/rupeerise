"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CircleDot,
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

// How long (ms) we hold the cards on the just-settled previous round so the
// flip animation is actually visible to humans. The server has already moved
// on to the next round by the time the client polls past `endsAt`, so without
// this client-side freeze the user would never see the cards turn over.
const REVEAL_FREEZE_MS = 2500;

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
  // The just-settled round we're freezing the cards on so the flip animation
  // is visible. Cleared automatically after REVEAL_FREEZE_MS.
  const [pendingReveal, setPendingReveal] = useState<Round | null>(null);
  // Track how much wallet balances change between polls so we can briefly
  // flash the deltas — gives the user immediate visual confirmation that a
  // win was credited.
  const [walletDeltas, setWalletDeltas] = useState<Record<string, number>>({});
  const prevBalancesRef = useRef<Record<string, number>>({});

  /* ----- data loaders ---------------------------------------------- */

  const loadWallets = useCallback(async () => {
    try {
      const r = await api<{ wallets: WalletRow[] }>("/me");
      // Diff each wallet against last snapshot — surface wins as a green flash
      // on the Earnings tile, debits as a red flash on Deposit/Bonus.
      const deltas: Record<string, number> = {};
      const next: Record<string, number> = {};
      for (const w of r.wallets) {
        const newBal = Number(w.balance);
        const prev = prevBalancesRef.current[w.type];
        if (prev !== undefined && Math.abs(newBal - prev) > 0.001) {
          deltas[w.type] = newBal - prev;
        }
        next[w.type] = newBal;
      }
      prevBalancesRef.current = next;
      setWallets(r.wallets);
      if (Object.keys(deltas).length) {
        setWalletDeltas(deltas);
        // Auto-clear the flash so it doesn't linger past the reveal.
        setTimeout(() => setWalletDeltas({}), 3500);
      }
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadState = useCallback(async () => {
    try {
      const s = await api<StateResp>("/lucky-hit/state");
      setFetchedAt(Date.now());
      setData(s);
      setError(null);
      setAmount((a) => Math.min(s.config.maxBet, Math.max(s.config.minBet, a)));
      // Detect a round transition: previous round just ended, server moved on.
      // Freeze the cards on the previous round so the user actually sees the flip.
      const oldPeriod = prevPeriodRef.current;
      const newPeriod = s.round.period;
      if (oldPeriod && oldPeriod !== newPeriod) {
        const justSettled = s.history.find((h) => h.period === oldPeriod);
        if (justSettled && justSettled.result) {
          setPendingReveal(justSettled);
          setRevealKey((k) => k + 1);
        }
        // Round flipped — wallets likely changed (winners credited). Refresh now.
        void loadWallets();
      }
      prevPeriodRef.current = newPeriod;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Lucky Hit state");
    }
  }, [loadWallets]);

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
    // Aggressive polling cadence — the round is only 15s long so anything
    // slower than ~1s feels stale.
    const stateTick = setInterval(fireState, 1000);
    const liveTick = setInterval(fireLive, 2000);
    const walletTick = setInterval(fireWallet, 2000);
    const mineTick = setInterval(fireMine, 3000);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
      clearInterval(stateTick); clearInterval(liveTick);
      clearInterval(walletTick); clearInterval(mineTick);
    };
  }, [loadState, loadMyBets, loadLiveBets, loadWallets]);

  // Local clock — drives the countdown text smoothly.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // Auto-clear the pending-reveal freeze.
  useEffect(() => {
    if (!pendingReveal) return;
    const id = setTimeout(() => setPendingReveal(null), REVEAL_FREEZE_MS);
    return () => clearTimeout(id);
  }, [pendingReveal]);

  /* ----- derived ---------------------------------------------------- */

  const liveRound = data?.round;
  const cfg = data?.config;

  const effectiveMs = useMemo(() => {
    if (!liveRound) return 0;
    return Math.max(0, liveRound.msRemaining - (now - fetchedAt));
  }, [liveRound, now, fetchedAt]);

  // What the cards should display: the just-settled previous round during the
  // freeze window, otherwise the current round.
  const displayRound: Round | null = pendingReveal ?? liveRound ?? null;

  // Phase the cards animate against. During the freeze we force "settled"
  // so the flip kicks off; otherwise we trust the server status, with a
  // local-clock fallback so a polling stall doesn't keep showing "open"
  // after the lock window has passed.
  const displayPhase: "open" | "locked" | "settled" = useMemo(() => {
    if (pendingReveal) return "settled";
    if (!liveRound) return "open";
    if (liveRound.status === "settled") return "settled";
    if (liveRound.status === "locked") return "locked";
    return effectiveMs > 0 ? "open" : "locked";
  }, [pendingReveal, liveRound, effectiveMs]);

  // Bets are accepted only against the LIVE current round in its open phase,
  // not against the freeze-target (which is a past round).
  const canBet = !!data?.enabled && !pendingReveal && displayPhase === "open";

  const balanceOf = (t: string) =>
    Number(wallets.find((w) => w.type === t)?.balance ?? 0);

  // The user's bet on the round we're currently revealing — used to colour the
  // result banner with their personal outcome.
  const myBetOnReveal = useMemo(() => {
    if (!pendingReveal) return null;
    return myBets.find((b) => b.period === pendingReveal.period) ?? null;
  }, [myBets, pendingReveal]);

  /* ----- actions --------------------------------------------------- */

  const placeBet = async () => {
    if (!liveRound || !cfg) return;
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
      // Refresh totals + wallet immediately so the user feels the deduction.
      void loadState();
      void loadMyBets();
      void loadLiveBets();
      void loadWallets();
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
  if (!data || !cfg || !liveRound || !displayRound) {
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

      {/* Wallet strip — refreshes every 2s, flashes on change */}
      <WalletStrip
        deposit={balanceOf("deposit")}
        bonus={balanceOf("bonus")}
        earnings={balanceOf("earnings")}
        deltas={walletDeltas}
      />

      {/* Round + cards (cards reflect either current round OR the freeze target) */}
      <RoundPanel
        liveRound={liveRound}
        displayRound={displayRound}
        myBetOnReveal={myBetOnReveal}
        cfg={cfg}
        displayPhase={displayPhase}
        revealKey={revealKey}
      />

      {/* History strip */}
      <HistoryStrip rounds={data.history} />

      {/* Score totals + bet panel + live bets */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <ScorePanel round={liveRound} />
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
            isFreezing={!!pendingReveal}
          />
        </div>
        <LiveBetsPanel bets={liveBets} now={now} />
      </div>

      {/* My record */}
      <MyRecord bets={myBets} />
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
        15 second fast rounds — pick, bet, cards open. Wins credited to <span className="text-yellow-200 font-medium">earnings wallet</span> instantly.
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
  deltas,
}: {
  deposit: number;
  bonus: number;
  earnings: number;
  deltas: Record<string, number>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-3 gap-2 sm:gap-3"
    >
      <WalletTile label="Deposit" amount={deposit} delta={deltas.deposit} icon={<Wallet size={14} />} accent="zinc" sub="bet from here" />
      <WalletTile label="Bonus" amount={bonus} delta={deltas.bonus} icon={<Coins size={14} />} accent="yellow" sub="bet fallback" />
      <WalletTile label="Earnings" amount={earnings} delta={deltas.earnings} icon={<Trophy size={14} />} accent="emerald" sub="wins land here" />
    </motion.div>
  );
}

function WalletTile({
  label,
  amount,
  delta,
  icon,
  accent,
  sub,
}: {
  label: string;
  amount: number;
  delta?: number;
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
    <motion.div
      animate={delta ? { scale: [1, 1.05, 1] } : { scale: 1 }}
      transition={{ duration: 0.45 }}
      className={`relative rounded-2xl border p-3 ${tone}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest opacity-90">
        {icon} {label}
      </div>
      <div className="mt-1 text-base sm:text-lg font-semibold text-white tabular-nums">
        {formatINR(amount)}
      </div>
      <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>

      {/* Delta flash — appears for ~3.5s when the balance changes */}
      <AnimatePresence>
        {delta !== undefined && delta !== 0 && (
          <motion.div
            key={delta + "" + label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`absolute -top-2 right-2 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              delta > 0
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-200"
                : "bg-red-500/20 border-red-500/40 text-red-200"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {formatINR(Math.abs(delta))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ================================================================ */
/*  Round panel + cards                                             */
/* ================================================================ */

function RoundPanel({
  liveRound,
  displayRound,
  myBetOnReveal,
  cfg,
  displayPhase,
  revealKey,
}: {
  liveRound: Round;
  displayRound: Round;
  myBetOnReveal: MyBet | null;
  cfg: StateResp["config"];
  effectiveMs?: number;
  displayPhase: "open" | "locked" | "settled";
  revealKey: number;
  isFreezing?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-5 sm:p-6 relative overflow-hidden"
    >
      {/* Single-line period + phase */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="font-mono font-semibold text-white text-base sm:text-lg tracking-wider">
            #{liveRound.period}
          </div>
          <PhasePill phase={displayPhase} />
        </div>
        <div className="text-[11px] text-zinc-500 inline-flex items-center gap-1">
          <Timer size={10} /> 15s per round
        </div>
      </div>

      {/* Cards stage */}
      <div className="mt-4 relative">
        <VsCards key={revealKey} phase={displayPhase} result={displayRound.result} />

        {/* Big result banner on settle */}
        <AnimatePresence>
          {displayPhase === "settled" && displayRound.result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: 0.9, type: "spring", stiffness: 220, damping: 18 }}
              className="absolute inset-x-0 top-[40%] -translate-y-1/2 flex flex-col items-center pointer-events-none"
            >
              <div
                className={`px-6 py-2 rounded-2xl backdrop-blur-md border-2 shadow-2xl ${
                  displayRound.result === "red"
                    ? "bg-red-500/30 border-red-300 text-red-100"
                    : displayRound.result === "black"
                    ? "bg-zinc-900/70 border-white text-white"
                    : "bg-yellow-400/30 border-yellow-200 text-yellow-50"
                }`}
              >
                <div className="text-2xl sm:text-3xl font-extrabold tracking-wide">
                  {displayRound.result === "red"
                    ? "RED WINS!"
                    : displayRound.result === "black"
                    ? "BLACK WINS!"
                    : "LUCKY HIT ★"}
                </div>
              </div>
              {myBetOnReveal && (
                <div
                  className={`mt-2 text-xs font-semibold px-3 py-1 rounded-full border ${
                    myBetOnReveal.side === displayRound.result
                      ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                      : "bg-red-500/15 text-red-200 border-red-500/30"
                  }`}
                >
                  {myBetOnReveal.side === displayRound.result
                    ? `You won ${formatINR(myBetOnReveal.payout || myBetOnReveal.amount * (displayRound.result === "lucky_hit" ? cfg.luckyHitPayout : cfg.colorPayout))}`
                    : `Lost ${formatINR(myBetOnReveal.amount)}`}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function PhasePill({ phase }: { phase: "open" | "locked" | "settled" }) {
  const map: Record<typeof phase, { label: string; cls: string; pulse?: boolean }> = {
    open: { label: "Betting open", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", pulse: true },
    locked: { label: "Cards opening…", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30", pulse: true },
    settled: { label: "Result", cls: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40" },
  };
  const p = map[phase];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${p.cls}`}>
      <CircleDot size={10} className={p.pulse ? "animate-pulse" : ""} /> {p.label}
    </span>
  );
}

/**
 * 3-vs-3 cards stage. Cards are kept big so the flip is unmissable.
 *   open    — gentle float
 *   locked  — vigorous shake (the "shuffle" suspense beat)
 *   settled — winning side flips face-up with a 0.3s stagger; losing side
 *             dims and fades back so the contrast is obvious.
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
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 min-h-[120px] sm:min-h-[140px]">
      <CardRow side="red" phase={phase} winner={redWins} result={result} />
      <div className="text-center">
        <motion.div
          animate={
            phase === "locked"
              ? { scale: [1, 1.2, 1], rotate: [-3, 3, -3] }
              : phase === "settled"
              ? { scale: [1, 1.5, 1] }
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
 * Single 3D-flip card with a TWO-LAYER animation:
 *   Outer layer — handles the rotateY flip on settle. Animates ONCE per
 *                 phase=settled so the flip is clean and predictable.
 *   Inner layer — handles the perpetual bobbing/shuffle. Loops forever
 *                 during open/locked and resets to neutral on settle.
 *
 * Splitting the two avoids framer-motion's interpolation issues when an
 * `animate` prop switches between keyframe arrays and single values.
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
  // Outer flip — only fires on settled.
  const outerAnimate =
    phase === "settled"
      ? winner
        ? { rotateY: 180, scale: 1.15 }
        : { rotateY: 0, scale: 0.9, opacity: 0.5 }
      : { rotateY: 0, scale: 1, opacity: 1 };
  const outerTransition =
    phase === "settled"
      ? { duration: 0.7, delay: index * 0.3, ease: [0.2, 0.7, 0.2, 1] as const }
      : { duration: 0.3 };

  // Inner shake/bob — loops while not settled.
  const innerAnimate =
    phase === "locked"
      ? { rotate: [-12, 12, -12], y: [0, -8, 0] }
      : phase === "open"
      ? { y: [0, -4, 0], rotate: 0 }
      : { rotate: 0, y: 0 };
  const innerTransition =
    phase === "locked"
      ? { repeat: Infinity, duration: 0.5, delay: index * 0.06 }
      : phase === "open"
      ? { repeat: Infinity, duration: 2.2, delay: index * 0.15 }
      : { duration: 0.2 };

  // Bigger cards so the flip is impossible to miss on mobile.
  return (
    <motion.div
      initial={false}
      animate={outerAnimate}
      transition={outerTransition}
      className="relative w-14 h-20 sm:w-20 sm:h-28 shrink-0"
      style={{ transformStyle: "preserve-3d", perspective: 1000 }}
    >
      <motion.div
        animate={innerAnimate}
        transition={innerTransition}
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Back face (face-down) */}
        <div
          className="absolute inset-0 rounded-lg sm:rounded-xl border-2 shadow-xl"
          style={{
            background:
              side === "red"
                ? "linear-gradient(135deg,#7f1d1d,#dc2626 50%,#7f1d1d)"
                : "linear-gradient(135deg,#0b0b0b,#3f3f46 50%,#0b0b0b)",
            borderColor: side === "red" ? "rgba(248,113,113,0.7)" : "rgba(255,255,255,0.35)",
            backfaceVisibility: "hidden",
          }}
        >
          <div className="absolute inset-1.5 rounded-md border border-white/15" />
          <div className="absolute inset-0 flex items-center justify-center text-white/80 font-bold text-2xl sm:text-3xl">
            {side === "red" ? "R" : "B"}
          </div>
        </div>
        {/* Front face — shown when rotateY = 180 */}
        <div
          className={`absolute inset-0 rounded-lg sm:rounded-xl border-2 flex items-center justify-center font-extrabold text-3xl sm:text-5xl shadow-2xl ${
            isLucky ? "shadow-yellow-400/60" : side === "red" ? "shadow-red-400/60" : "shadow-white/40"
          }`}
          style={{
            background: isLucky
              ? "linear-gradient(135deg,#fef3c7,#facc15 45%,#f59e0b 100%)"
              : side === "red"
              ? "linear-gradient(135deg,#fee2e2,#ef4444 45%,#b91c1c 100%)"
              : "linear-gradient(135deg,#f4f4f5,#71717a 45%,#27272a 100%)",
            borderColor: isLucky ? "#fde68a" : side === "red" ? "#fca5a5" : "#d4d4d8",
            color: isLucky ? "#7c2d12" : side === "red" ? "#7f1d1d" : "#0f172a",
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
          }}
        >
          {isLucky ? "★" : side === "red" ? "R" : "B"}
        </div>
      </motion.div>
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
  isFreezing,
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
  isFreezing: boolean;
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
          : isFreezing
          ? "Showing result… next round opens shortly"
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
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
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
