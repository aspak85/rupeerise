"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dices, History, Minus, Plus, Receipt, Trophy, Users, Wallet } from "lucide-react";
import { ApiError, api, formatINR } from "@/lib/api";

type Side = "red" | "black" | "lucky_hit";
type Round = { id: string; period: string; startedAt: string; endsAt: string; status: "open"|"locked"|"settled"; result: Side|null; redTotal: number; blackTotal: number; luckyHitTotal: number; betCount: number; msRemaining: number };
type StateResp = { enabled: boolean; round: Round; history: Round[]; config: { minBet: number; maxBet: number; colorPayout: number; luckyHitPayout: number; roundDurationSec: number; lockSeconds: number } };
type MyBet = { id: string; createdAt: string; side: Side; amount: number; status: "pending"|"won"|"lost"; payout: number; period: string; roundResult: Side|null };
type LiveBet = { id: string; createdAt: string; side: Side; amount: number; period: string };
type WalletRow = { type: string; balance: string };

const SIDES: Side[] = ["red", "black", "lucky_hit"];
const LABEL: Record<Side, string> = { red: "Red", black: "Black", lucky_hit: "Lucky Hit" };
const DOT: Record<Side, string> = { red: "bg-red-500", black: "bg-zinc-700 ring-1 ring-white/30", lucky_hit: "bg-yellow-400" };

const CARDS = ["A","K","Q","J","10","9","8","7","6","5","4","3","2"];
const PTS: Record<string,number> = {A:14,K:13,Q:12,J:11,"10":10,"9":9,"8":8,"7":7,"6":6,"5":5,"4":4,"3":3,"2":2};

function hashPeriod(p: string) { let h=0; for(let i=0;i<p.length;i++) h=((h<<5)-h+p.charCodeAt(i))|0; return h; }
function pick(h:number,i:number) { return CARDS[Math.abs(h*(i+1)*7+i*13)%CARDS.length]; }

function genCards(period:string, result:Side|null) {
  const h = hashPeriod(period);
  const red = [pick(h,0),pick(h,1),pick(h,2)];
  const black = [pick(h,3),pick(h,4),pick(h,5)];
  // Ensure winning side has higher total
  const rT = red.reduce((s,c)=>s+PTS[c],0);
  const bT = black.reduce((s,c)=>s+PTS[c],0);
  if((result==="red"||result==="lucky_hit") && rT<=bT) { red[0]="A"; red[1]="K"; }
  if(result==="black" && bT<=rT) { black[0]="A"; black[1]="K"; }
  return { red, black, redTotal: red.reduce((s,c)=>s+PTS[c],0), blackTotal: black.reduce((s,c)=>s+PTS[c],0) };
}

// Cards stay flipped open for 4 seconds so users can clearly see the result.
// The flip animation takes ~0.6s, so effective visible time = ~3.4s.
const REVEAL_MS = 4000;

export default function LuckyHitPage() {
  const [data,setData] = useState<StateResp|null>(null);
  const [myBets,setMyBets] = useState<MyBet[]>([]);
  const [liveBets,setLiveBets] = useState<LiveBet[]>([]);
  const [wallets,setWallets] = useState<WalletRow[]>([]);
  const [side,setSide] = useState<Side>("red");
  const [amount,setAmount] = useState(100);
  const [busy,setBusy] = useState(false);
  const [toast,setToast] = useState<{kind:"ok"|"err";msg:string}|null>(null);
  const [now,setNow] = useState(()=>Date.now());
  const [fetchedAt,setFetchedAt] = useState(()=>Date.now());
  const prevPeriodRef = useRef<string|null>(null);
  // When a round ends, we freeze the SETTLED round here for REVEAL_MS so both
  // sides' cards can flip open visibly before resetting for next round.
  const [reveal,setReveal] = useState<Round|null>(null);
  const [winBanner,setWinBanner] = useState<{amount:number;side:Side}|null>(null);

  const loadWallets = useCallback(async()=>{try{const r=await api<{wallets:WalletRow[]}>("/me");setWallets(r.wallets);}catch{}},[]);
  const loadState = useCallback(async()=>{
    try {
      const s = await api<StateResp>("/lucky-hit/state");
      setFetchedAt(Date.now()); setData(s);
      setAmount(a=>Math.min(s.config.maxBet,Math.max(s.config.minBet,a)));
      const old=prevPeriodRef.current;
      if(old&&old!==s.round.period){
        const prev=s.history.find(h=>h.period===old);
        if(prev?.result){setReveal(prev);}
        void loadWallets();
        void loadMyBets();
      }
      prevPeriodRef.current=s.round.period;
    }catch{}
  },[loadWallets]);
  const loadMyBets = useCallback(async()=>{try{const r=await api<{bets:MyBet[]}>("/lucky-hit/my-bets?take=20");setMyBets(r.bets);}catch{}},[]);
  const loadLive = useCallback(async()=>{try{const r=await api<{bets:LiveBet[]}>("/lucky-hit/live-bets?take=15");setLiveBets(r.bets);}catch{}},[]);

  useEffect(()=>{
    void loadState();void loadMyBets();void loadLive();void loadWallets();
    const i1=setInterval(()=>{void loadState();},1000);
    const i2=setInterval(()=>{void loadLive();},2500);
    const i3=setInterval(()=>{void loadWallets();},3000);
    const i4=setInterval(()=>{void loadMyBets();},4000);
    return()=>{clearInterval(i1);clearInterval(i2);clearInterval(i3);clearInterval(i4);};
  },[loadState,loadMyBets,loadLive,loadWallets]);

  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),200);return()=>clearInterval(id);},[]);
  useEffect(()=>{if(!reveal)return;const id=setTimeout(()=>setReveal(null),REVEAL_MS);return()=>clearTimeout(id);},[reveal]);

  // Show win/loss banner when reveal + user had a bet on that round
  useEffect(()=>{
    if(!reveal||!reveal.result) return;
    const myBet = myBets.find(b=>b.period===reveal.period);
    if(myBet){
      if(myBet.side===reveal.result){
        const payout = myBet.payout || myBet.amount * (reveal.result==="lucky_hit"?9:1.9);
        setWinBanner({amount:payout,side:reveal.result});
      } else {
        // Show loss banner too so user always knows the outcome
        setWinBanner({amount:-myBet.amount,side:myBet.side});
      }
      const id=setTimeout(()=>setWinBanner(null),4500);
      return()=>clearTimeout(id);
    }
  },[reveal,myBets]);

  const round=data?.round; const cfg=data?.config;
  const effectiveMs=useMemo(()=>round?Math.max(0,round.msRemaining-(now-fetchedAt)):0,[round,now,fetchedAt]);
  const phase:"open"|"locked"|"settled"=useMemo(()=>{
    if(reveal) return "settled";
    if(!round) return "open";
    if(round.status==="settled") return "settled";
    if(round.status==="locked") return "locked";
    return effectiveMs>0?"open":"locked";
  },[reveal,round,effectiveMs]);
  const displayRound = reveal??round??null;
  const canBet = !!data?.enabled&&!reveal&&phase==="open";
  const balOf=(t:string)=>Number(wallets.find(w=>w.type===t)?.balance??0);
  const totalBal=balOf("deposit")+balOf("bonus")+balOf("earnings")+balOf("referral");
  const myRevealBet=useMemo(()=>reveal?myBets.find(b=>b.period===reveal.period)??null:null,[myBets,reveal]);
  const countdownSec=Math.ceil(effectiveMs/1000);

  const placeBet=async()=>{
    if(!round||!cfg)return;setToast(null);
    if(amount<cfg.minBet)return setToast({kind:"err",msg:`Min ₹${cfg.minBet}`});
    if(amount>cfg.maxBet)return setToast({kind:"err",msg:`Max ₹${cfg.maxBet}`});
    if(amount>totalBal)return setToast({kind:"err",msg:"Insufficient balance"});
    // OPTIMISTIC: show success instantly, deduct balance locally
    setBusy(true);
    setToast({kind:"ok",msg:`✓ ${formatINR(amount)} on ${LABEL[side]}`});
    // Optimistically update local wallet display
    setWallets(prev=>prev.map(w=>{
      if(w.type==="deposit"){const b=Number(w.balance);if(b>=amount)return{...w,balance:String(b-amount)};}
      return w;
    }));
    // Fire API in background — if it fails, reload will correct the state
    try{
      await api("/lucky-hit/bet",{method:"POST",body:JSON.stringify({side,amount})});
      // Refresh all data after successful bet
      void loadState();void loadMyBets();void loadLive();void loadWallets();
    }catch(e){
      setToast({kind:"err",msg:e instanceof ApiError?e.message:"Bet failed — balance restored"});
      void loadWallets(); // Restore correct balance
    }finally{setBusy(false);}
  };

  if(!data||!cfg||!round||!displayRound)return<div className="p-10 text-center text-zinc-400">Loading…</div>;
  if(!data.enabled)return<div className="p-10 text-center text-zinc-400">Lucky Hit paused</div>;

  return(
    <div className="space-y-3 max-w-md mx-auto w-full pb-8">
      {/* Win/Loss notification banner — slides in from top */}
      <AnimatePresence>
        {winBanner&&(
          <motion.div initial={{opacity:0,y:-40}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-40}} className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-2 px-4 pointer-events-none">
            <div className={`rounded-xl border-2 px-5 py-3 flex items-center gap-3 shadow-2xl pointer-events-auto backdrop-blur-md ${
              winBanner.amount>0
                ? "border-emerald-400/60 bg-emerald-500/30 shadow-emerald-500/30"
                : "border-red-400/60 bg-red-500/30 shadow-red-500/30"
            }`}>
              <Trophy size={20} className={winBanner.amount>0?"text-yellow-300":"text-red-300"}/>
              <div>
                <div className={`text-xs font-semibold uppercase ${winBanner.amount>0?"text-emerald-200":"text-red-200"}`}>
                  {winBanner.amount>0?"🎉 You Won!":"You Lost"}
                </div>
                <div className="text-lg font-bold text-white">
                  {winBanner.amount>0?`+${formatINR(winBanner.amount)}`:`-${formatINR(Math.abs(winBanner.amount))}`}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header + balance */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2"><Dices size={16} className="text-yellow-300"/><span className="font-bold text-white">Lucky Hit</span></div>
        <div className="flex items-center gap-1.5 text-sm"><Wallet size={13} className="text-yellow-300"/><span className="font-semibold text-white">{formatINR(totalBal)}</span></div>
      </div>

      {/* Timer bar */}
      <div className="glass rounded-xl p-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-400">Period <span className="text-white font-mono font-bold">#{round.period}</span></div>
          {phase==="open"?(
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase text-emerald-300">Bet closes</span>
              <span className="text-xl font-black text-white tabular-nums">{countdownSec}s</span>
            </div>
          ):phase==="locked"?(
            <span className="text-xs text-yellow-300 animate-pulse font-semibold">Opening cards…</span>
          ):(
            <span className="text-xs text-emerald-300 font-semibold">Result!</span>
          )}
        </div>
        {phase==="open"&&cfg&&(
          <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-yellow-400 rounded-full transition-all duration-200" style={{width:`${(effectiveMs/((cfg.roundDurationSec-cfg.lockSeconds)*1000))*100}%`}}/>
          </div>
        )}
      </div>

      {/* === CARDS — BOTH SIDES OPEN (key forces re-mount on round change for clean animation) === */}
      <CardsArea key={displayRound.period} phase={phase} displayRound={displayRound} cfg={cfg} myRevealBet={myRevealBet}/>

      {/* Results grid — last 50 in a 10-column pattern grid */}
      <div className="glass rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 flex items-center gap-1"><History size={10}/> Last 50 results</span>
          <div className="flex items-center gap-2 text-[9px] text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Red</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-700 ring-1 ring-white/30 inline-block"/>Black</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"/>Lucky</span>
          </div>
        </div>
        <div className="grid grid-cols-10 gap-1">
          {data.history.slice(0,50).map((r,i)=>(
            <div key={r.id} className="flex flex-col items-center gap-0.5">
              <span className={`w-3 h-3 rounded-full ${r.result?DOT[r.result]:"bg-zinc-700"}`}/>
              <span className="text-[7px] text-zinc-600 tabular-nums">{r.period.slice(-3)}</span>
            </div>
          ))}
          {data.history.length===0&&<div className="col-span-10 text-center text-xs text-zinc-500 py-2">No results yet</div>}
        </div>
      </div>

      {/* Bet buttons with pool amounts */}
      <div className="grid grid-cols-3 gap-2">
        {SIDES.map(s=>{
          const pool=s==="red"?round.redTotal:s==="black"?round.blackTotal:round.luckyHitTotal;
          const sel=side===s;
          const base=s==="red"?"border-red-500":"border-zinc-500";
          const selCls=s==="red"?"bg-red-600 border-red-300 shadow-red-500/40":s==="black"?"bg-zinc-700 border-white shadow-white/20":"bg-yellow-600 border-yellow-200 shadow-yellow-500/40";
          const normCls=s==="red"?"bg-red-900/50 border-red-500/50":s==="black"?"bg-zinc-900/50 border-zinc-500/50":"bg-yellow-900/30 border-yellow-500/40";
          return(
            <button key={s} onClick={()=>setSide(s)} className={`rounded-xl border-2 p-2.5 text-center transition-all ${sel?selCls+" shadow-lg":normCls}`}>
              <div className="text-white font-bold text-xs sm:text-sm">{LABEL[s]}</div>
              <div className="text-[9px] text-zinc-300/80">{s==="lucky_hit"?`${cfg.luckyHitPayout}×`:`${cfg.colorPayout}×`}</div>
              <div className="mt-1 text-[10px] text-zinc-400 tabular-nums">{formatINR(pool)}</div>
            </button>
          );
        })}
      </div>

      {/* Amount + bet */}
      <div className="glass rounded-xl p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <button onClick={()=>setAmount(a=>Math.max(cfg.minBet,a-10))} className="w-9 h-9 rounded-lg border border-yellow-500/30 bg-black/40 text-yellow-200 flex items-center justify-center"><Minus size={14}/></button>
          <input type="number" value={amount} onChange={e=>setAmount(Math.floor(Number(e.target.value)||0))} className="flex-1 h-9 rounded-lg border border-yellow-500/30 bg-black/40 text-center text-base font-bold text-white focus:outline-none"/>
          <button onClick={()=>setAmount(a=>Math.min(cfg.maxBet,a+10))} className="w-9 h-9 rounded-lg border border-yellow-500/30 bg-black/40 text-yellow-200 flex items-center justify-center"><Plus size={14}/></button>
        </div>
        <div className="flex gap-1 flex-wrap">
          {[10,50,100,500,1000,2000].filter(q=>q>=cfg.minBet&&q<=cfg.maxBet).map(q=>(
            <button key={q} onClick={()=>setAmount(q)} className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${amount===q?"border-yellow-400 bg-yellow-500/20 text-yellow-200":"border-yellow-500/20 text-zinc-300"}`}>₹{q}</button>
          ))}
        </div>
        <button onClick={placeBet} disabled={!canBet||busy} className="w-full rounded-lg bg-[var(--primary)] py-3 font-bold text-black text-sm hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/30">
          {busy?"Placing…":!canBet?(phase==="locked"?"Opening cards…":"Wait…"):`Bet ${formatINR(amount)} → ${LABEL[side]}`}
        </button>
        <AnimatePresence>{toast&&(<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className={`rounded-md px-3 py-1.5 text-[11px] border ${toast.kind==="ok"?"bg-emerald-500/15 border-emerald-500/30 text-emerald-200":"bg-red-500/15 border-red-500/30 text-red-200"}`}>{toast.msg}</motion.div>)}</AnimatePresence>
      </div>

      {/* Live bets */}
      <div className="glass rounded-xl p-3">
        <div className="flex items-center gap-2 mb-1.5"><Users size={12} className="text-yellow-300"/><span className="text-xs font-semibold text-white">Live Bets</span><span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/></div>
        {liveBets.length===0?<p className="text-[11px] text-zinc-500">Waiting for bets…</p>:(
          <div className="space-y-0.5 max-h-[150px] overflow-y-auto no-scrollbar">
            {liveBets.map(b=>(<div key={b.id} className="flex items-center gap-2 px-2 py-1 rounded bg-black/20"><span className={`w-2 h-2 rounded-full ${DOT[b.side]}`}/><span className="text-[11px] text-zinc-300 flex-1">{LABEL[b.side]}</span><span className="text-[11px] font-semibold text-white">{formatINR(b.amount)}</span></div>))}
          </div>
        )}
      </div>

      {/* My record */}
      <div className="glass rounded-xl p-3">
        <div className="flex items-center gap-2 mb-1.5"><Receipt size={12} className="text-yellow-300"/><span className="text-xs font-semibold text-white">My Record</span></div>
        {myBets.length===0?<p className="text-[11px] text-zinc-500">No bets yet</p>:(
          <div className="space-y-0.5 max-h-[200px] overflow-y-auto no-scrollbar">
            {myBets.map(b=>(<div key={b.id} className="flex items-center gap-2 px-2 py-1 rounded bg-black/20">
              <span className={`w-2 h-2 rounded-full ${DOT[b.side]}`}/>
              <span className="text-[10px] text-zinc-400 font-mono">#{b.period}</span>
              <span className="text-[11px] text-zinc-300">{LABEL[b.side]}</span>
              <span className="text-[11px] font-semibold text-white ml-auto">{formatINR(b.amount)}</span>
              {b.status==="won"&&<span className="text-[10px] text-emerald-300 font-bold">+{formatINR(b.payout)}</span>}
              {b.status==="lost"&&<span className="text-[10px] text-red-300">Lost</span>}
              {b.status==="pending"&&<span className="text-[10px] text-yellow-300">⏳</span>}
            </div>))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
/* CARDS AREA — Both sides flip open, winner has bigger cards         */
/* ═══════════════════════════════════════════════════════════════════ */

function CardsArea({phase,displayRound,cfg,myRevealBet}:{phase:"open"|"locked"|"settled";displayRound:Round;cfg:StateResp["config"];myRevealBet:MyBet|null}) {
  const cards = genCards(displayRound.period, displayRound.result);
  const result = displayRound.result;
  // Both sides flip. Winner side scales up, loser scales down slightly.
  const redWin = result==="red"||result==="lucky_hit";
  const blackWin = result==="black"||result==="lucky_hit";

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      {/* Card grid: red left, VS center, black right */}
      <div className="grid grid-cols-[1fr_28px_1fr] items-center">
        {/* RED SIDE */}
        <div className="flex justify-center gap-1">
          {cards.red.map((v,i)=>(
            <GameCard key={`r${i}`} idx={i} side="red" phase={phase} value={v} isWinner={phase==="settled"&&redWin} isLucky={phase==="settled"&&result==="lucky_hit"}/>
          ))}
        </div>
        {/* VS */}
        <div className="flex items-center justify-center">
          <motion.span animate={phase==="locked"?{scale:[1,1.3,1]}:{}} transition={{repeat:phase==="locked"?Infinity:0,duration:0.4}} className="text-yellow-300 font-extrabold text-sm gold-text">VS</motion.span>
        </div>
        {/* BLACK SIDE */}
        <div className="flex justify-center gap-1">
          {cards.black.map((v,i)=>(
            <GameCard key={`b${i}`} idx={i} side="black" phase={phase} value={v} isWinner={phase==="settled"&&blackWin} isLucky={phase==="settled"&&result==="lucky_hit"}/>
          ))}
        </div>
      </div>

      {/* Totals + result text */}
      {phase==="settled"&&result&&(
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.6}} className="text-center space-y-1">
          <div className="flex justify-center gap-4 text-xs">
            <span className={`font-bold ${redWin?"text-red-300":"text-zinc-500"}`}>Red: {cards.redTotal}</span>
            <span className={`font-bold ${blackWin?"text-white":"text-zinc-500"}`}>Black: {cards.blackTotal}</span>
          </div>
          <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
            result==="red"?"bg-red-500/20 border-red-400 text-red-200":
            result==="black"?"bg-zinc-700/60 border-zinc-300 text-white":
            "bg-yellow-500/20 border-yellow-300 text-yellow-200"
          }`}>
            {result==="red"?"RED WINS!":result==="black"?"BLACK WINS!":"★ LUCKY HIT!"}
          </div>
          {myRevealBet&&(
            <div className={`text-[11px] font-semibold ${myRevealBet.side===result?"text-emerald-300":"text-red-300"}`}>
              {myRevealBet.side===result?`You won ${formatINR(myRevealBet.payout||myRevealBet.amount*(result==="lucky_hit"?cfg.luckyHitPayout:cfg.colorPayout))}`:`Lost ${formatINR(myRevealBet.amount)}`}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

/**
 * Single playing card. Uses CSS @keyframes for bob/shake (no framer-motion
 * repeat:Infinity which causes lag). Framer-motion only handles the one-shot
 * flip on settle.
 */
function GameCard({idx,side,phase,value,isWinner,isLucky}:{idx:number;side:"red"|"black";phase:"open"|"locked"|"settled";value:string;isWinner:boolean;isLucky:boolean}) {
  const settled = phase==="settled";
  // Framer handles ONLY the flip + scale
  const animate = settled
    ? { rotateY: 180, scale: isWinner ? 1.1 : 0.85, opacity: isWinner ? 1 : 0.5 }
    : { rotateY: 0, scale: 1, opacity: 1 };
  const transition = settled
    ? { duration: 0.45, delay: idx * 0.15, ease: "easeOut" as const }
    : { duration: 0.2 };

  // CSS class for bob/shake (performant, no React re-renders)
  const cssAnim = phase === "open" ? "animate-card-bob" : phase === "locked" ? "animate-card-shake" : "";

  return (
    <motion.div
      initial={{ rotateY: 0, scale: 1, opacity: 1 }}
      animate={animate}
      transition={transition}
      className={`relative w-10 h-14 sm:w-12 sm:h-[68px] shrink-0 ${cssAnim}`}
      style={{transformStyle:"preserve-3d",perspective:600,animationDelay:`${idx*80}ms`}}
    >
      {/* BACK (face-down) */}
      <div className="absolute inset-0 rounded-md border shadow flex items-center justify-center" style={{
        background:side==="red"?"linear-gradient(135deg,#991b1b,#dc2626,#991b1b)":"linear-gradient(135deg,#18181b,#3f3f46,#18181b)",
        borderColor:side==="red"?"#f87171":"#71717a",
        backfaceVisibility:"hidden"
      }}>
        <span className="text-white/60 text-base font-bold">{side==="red"?"♥":"♠"}</span>
      </div>
      {/* FRONT (face-up) */}
      <div className="absolute inset-0 rounded-md border shadow-lg flex flex-col items-center justify-center" style={{
        background:isLucky?"linear-gradient(135deg,#fef3c7,#fbbf24,#f59e0b)":side==="red"?"linear-gradient(135deg,#fef2f2,#ef4444,#b91c1c)":"linear-gradient(135deg,#fafafa,#71717a,#27272a)",
        borderColor:isLucky?"#fde68a":side==="red"?"#fca5a5":"#a1a1aa",
        color:isLucky?"#78350f":side==="red"?"#7f1d1d":"#09090b",
        transform:"rotateY(180deg)",
        backfaceVisibility:"hidden"
      }}>
        <span className="font-extrabold text-lg sm:text-xl leading-none">{isLucky?"★":value}</span>
        <span className="text-[8px] opacity-50 mt-0.5">{side==="red"?"♥":"♠"}</span>
      </div>
    </motion.div>
  );
}
