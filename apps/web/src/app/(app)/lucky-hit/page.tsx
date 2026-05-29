"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dices, History, Minus, Plus, Receipt, Trophy, Users, Wallet } from "lucide-react";
import { ApiError, api, formatINR } from "@/lib/api";

type Side = "red" | "black" | "lucky_hit";
type Round = { id: string; period: string; startedAt: string; endsAt: string; status: "open"|"locked"|"settled"; result: Side|null; redTotal: number; blackTotal: number; luckyHitTotal: number; betCount: number; msRemaining: number };
type StateResp = { enabled: boolean; round: Round; history: Round[]; config: { minBet: number; maxBet: number; colorPayout: number; luckyHitPayout: number; roundDurationSec: number; lockSeconds: number } };
type MyBet = { id: string; createdAt: string; side: Side; amount: number; status: "pending"|"won"|"lost"; payout: number; period: string; roundResult: Side|null };
type LiveBet = { id: string; createdAt: string; side: Side; amount: number; status: string; payout: number; period: string };
type WalletRow = { type: string; balance: string };

const SIDES: Side[] = ["red", "black", "lucky_hit"];
const SIDE_LABEL: Record<Side, string> = { red: "Red", black: "Black", lucky_hit: "Lucky Hit" };
const SIDE_DOT: Record<Side, string> = { red: "bg-red-500", black: "bg-zinc-800 ring-1 ring-white/30", lucky_hit: "bg-yellow-400" };
const REVEAL_MS = 3000;
const CARD_VALUES = ["A","K","Q","J","10","9","8","7","6","5","4","3","2"];
const CARD_PTS: Record<string,number> = { A:14,K:13,Q:12,J:11,"10":10,"9":9,"8":8,"7":7,"6":6,"5":5,"4":4,"3":3,"2":2 };

function genCards(period: string, result: Side|null) {
  let h = 0;
  for (let i = 0; i < period.length; i++) h = ((h << 5) - h + period.charCodeAt(i)) | 0;
  const pick = (s: number) => CARD_VALUES[Math.abs(s) % CARD_VALUES.length];
  const red = [pick(h), pick(h*3+7), pick(h*5+13)];
  const black = [pick(h*2+1), pick(h*4+11), pick(h*7+3)];
  if (result === "red" || result === "lucky_hit") {
    if (red.reduce((s,c)=>s+CARD_PTS[c],0) <= black.reduce((s,c)=>s+CARD_PTS[c],0)) red[0] = "A";
  } else if (result === "black") {
    if (black.reduce((s,c)=>s+CARD_PTS[c],0) <= red.reduce((s,c)=>s+CARD_PTS[c],0)) black[0] = "A";
  }
  return { red, black };
}

export default function LuckyHitPage() {
  const [data, setData] = useState<StateResp|null>(null);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [side, setSide] = useState<Side>("red");
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{kind:"ok"|"err";msg:string}|null>(null);
  const [now, setNow] = useState(()=>Date.now());
  const [fetchedAt, setFetchedAt] = useState(()=>Date.now());
  const prevPeriodRef = useRef<string|null>(null);
  const [reveal, setReveal] = useState<Round|null>(null);
  const [revealKey, setRevealKey] = useState(0);

  const loadWallets = useCallback(async()=>{ try { const r = await api<{wallets:WalletRow[]}>("/me"); setWallets(r.wallets); } catch{} },[]);
  const loadState = useCallback(async()=>{
    try {
      const s = await api<StateResp>("/lucky-hit/state");
      setFetchedAt(Date.now()); setData(s);
      setAmount(a=>Math.min(s.config.maxBet, Math.max(s.config.minBet, a)));
      const old = prevPeriodRef.current;
      if (old && old !== s.round.period) {
        const prev = s.history.find(h=>h.period===old);
        if (prev?.result) { setReveal(prev); setRevealKey(k=>k+1); }
        void loadWallets();
      }
      prevPeriodRef.current = s.round.period;
    } catch{}
  },[loadWallets]);
  const loadMyBets = useCallback(async()=>{ try { const r = await api<{bets:MyBet[]}>("/lucky-hit/my-bets?take=20"); setMyBets(r.bets); } catch{} },[]);
  const loadLive = useCallback(async()=>{ try { const r = await api<{bets:LiveBet[]}>("/lucky-hit/live-bets?take=20"); setLiveBets(r.bets); } catch{} },[]);

  useEffect(()=>{
    const f=()=>{void loadState();void loadMyBets();void loadLive();void loadWallets();};
    const t=setTimeout(f,0);
    const i1=setInterval(()=>{void loadState();},1000);
    const i2=setInterval(()=>{void loadLive();},2500);
    const i3=setInterval(()=>{void loadWallets();},3000);
    const i4=setInterval(()=>{void loadMyBets();},4000);
    return ()=>{clearTimeout(t);clearInterval(i1);clearInterval(i2);clearInterval(i3);clearInterval(i4);};
  },[loadState,loadMyBets,loadLive,loadWallets]);

  useEffect(()=>{ const id=setInterval(()=>setNow(Date.now()),200); return ()=>clearInterval(id); },[]);
  useEffect(()=>{ if(!reveal) return; const id=setTimeout(()=>setReveal(null),REVEAL_MS); return ()=>clearTimeout(id); },[reveal]);

  const round = data?.round;
  const cfg = data?.config;
  const effectiveMs = useMemo(()=>round ? Math.max(0, round.msRemaining-(now-fetchedAt)) : 0,[round,now,fetchedAt]);
  const displayRound = reveal ?? round ?? null;
  const phase: "open"|"locked"|"settled" = useMemo(()=>{
    if(reveal) return "settled";
    if(!round) return "open";
    if(round.status==="settled") return "settled";
    if(round.status==="locked") return "locked";
    return effectiveMs>0?"open":"locked";
  },[reveal,round,effectiveMs]);
  const canBet = !!data?.enabled && !reveal && phase==="open";
  const balOf = (t:string)=>Number(wallets.find(w=>w.type===t)?.balance??0);
  const totalBal = balOf("deposit")+balOf("bonus")+balOf("earnings")+balOf("referral");
  const myRevealBet = useMemo(()=>reveal?myBets.find(b=>b.period===reveal.period)??null:null,[myBets,reveal]);
  const countdownSec = Math.ceil(effectiveMs/1000);

  const placeBet = async()=>{
    if(!round||!cfg) return;
    setToast(null);
    if(amount<cfg.minBet) return setToast({kind:"err",msg:`Min ₹${cfg.minBet}`});
    if(amount>cfg.maxBet) return setToast({kind:"err",msg:`Max ₹${cfg.maxBet}`});
    setBusy(true);
    try {
      await api("/lucky-hit/bet",{method:"POST",body:JSON.stringify({side,amount})});
      setToast({kind:"ok",msg:`${formatINR(amount)} on ${SIDE_LABEL[side]}`});
      void loadState(); void loadMyBets(); void loadLive(); void loadWallets();
    } catch(e){ setToast({kind:"err",msg:e instanceof ApiError?e.message:"Bet failed"}); }
    finally{ setBusy(false); }
  };

  if(!data||!cfg||!round||!displayRound) return <div className="p-10 text-center text-zinc-400">Loading Lucky Hit…</div>;
  if(!data.enabled) return <div className="p-10 text-center text-zinc-400">Lucky Hit is paused.</div>;

  return (
    <div className="space-y-4 max-w-lg mx-auto w-full pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dices size={18} className="text-yellow-300"/>
          <h1 className="text-lg font-bold text-white">Lucky Hit</h1>
        </div>
        <div className="flex items-center gap-2">
          <Wallet size={14} className="text-yellow-300"/>
          <span className="text-sm font-semibold text-white">{formatINR(totalBal)}</span>
        </div>
      </div>

      {/* Timer + Period */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-400">Period</div>
            <div className="font-mono text-white font-semibold text-sm">{round.period}</div>
          </div>
          <div className="text-right">
            {phase==="open" ? (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-emerald-300">Bet closes in</div>
                <div className="text-3xl font-black tabular-nums text-white">{countdownSec}<span className="text-lg text-zinc-400">s</span></div>
              </div>
            ) : phase==="locked" ? (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-yellow-300 animate-pulse">Opening cards…</div>
              </div>
            ) : (
              <div className="text-[10px] uppercase tracking-widest text-emerald-300">Result!</div>
            )}
          </div>
        </div>
        {/* Progress bar */}
        {phase==="open" && cfg && (
          <div className="mt-3 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-400 to-yellow-400 rounded-full"
              style={{width:`${Math.max(0,(effectiveMs/((cfg.roundDurationSec-cfg.lockSeconds)*1000))*100)}%`}}
              transition={{duration:0.2}}
            />
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="glass rounded-2xl p-4 overflow-hidden">
        <CardsStage key={revealKey} phase={phase} result={displayRound.result} period={displayRound.period}/>
        {/* Result overlay */}
        <AnimatePresence>
          {phase==="settled" && displayRound.result && (
            <motion.div initial={{opacity:0,scale:0.7}} animate={{opacity:1,scale:1}} exit={{opacity:0}} transition={{delay:0.8}} className="mt-3 text-center">
              <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold border ${
                displayRound.result==="red"?"bg-red-500/20 border-red-400 text-red-200":
                displayRound.result==="black"?"bg-zinc-700/60 border-zinc-400 text-white":
                "bg-yellow-500/20 border-yellow-400 text-yellow-200"
              }`}>
                {displayRound.result==="red"?"RED WINS!":displayRound.result==="black"?"BLACK WINS!":"LUCKY HIT ★ WINS!"}
              </div>
              {myRevealBet && (
                <div className={`mt-1.5 text-xs font-semibold ${myRevealBet.side===displayRound.result?"text-emerald-300":"text-red-300"}`}>
                  {myRevealBet.side===displayRound.result?`+${formatINR(myRevealBet.payout||myRevealBet.amount*((displayRound.result==="lucky_hit"?cfg.luckyHitPayout:cfg.colorPayout)))}`:`-${formatINR(myRevealBet.amount)}`}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* History dots */}
      <div className="flex flex-wrap gap-1.5 px-1">
        {data.history.slice(0,30).map(r=>(
          <span key={r.id} className={`w-3 h-3 rounded-full ${r.result?SIDE_DOT[r.result]:"bg-zinc-700"}`} title={`${r.period} ${r.result||""}`}/>
        ))}
      </div>

      {/* Bet options — 3 buttons showing label + total pool amount */}
      <div className="grid grid-cols-3 gap-2">
        {SIDES.map(s=>{
          const pool = s==="red"?round.redTotal:s==="black"?round.blackTotal:round.luckyHitTotal;
          const sel = side===s;
          const bg = s==="red"
            ? sel?"bg-red-600 border-red-300 shadow-lg shadow-red-500/40":"bg-red-900/60 border-red-500/40 hover:bg-red-800/60"
            : s==="black"
            ? sel?"bg-zinc-700 border-white shadow-lg shadow-white/20":"bg-zinc-900/60 border-zinc-500/40 hover:bg-zinc-800/60"
            : sel?"bg-yellow-600/80 border-yellow-200 shadow-lg shadow-yellow-500/40":"bg-yellow-900/40 border-yellow-500/40 hover:bg-yellow-800/40";
          return (
            <button key={s} onClick={()=>setSide(s)} className={`rounded-xl border-2 p-3 text-center transition-all ${bg}`}>
              <div className="text-white font-bold text-sm">{SIDE_LABEL[s]}</div>
              {s==="lucky_hit" && <div className="text-[9px] text-yellow-200/70 uppercase">9× payout</div>}
              {s!=="lucky_hit" && <div className="text-[9px] text-zinc-300/70 uppercase">1.9× payout</div>}
              <div className="mt-1 text-xs text-zinc-300 tabular-nums">{formatINR(pool)}</div>
            </button>
          );
        })}
      </div>

      {/* Amount + place bet */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={()=>setAmount(a=>Math.max(cfg.minBet,a-10))} className="w-10 h-10 rounded-lg border border-yellow-500/30 bg-black/40 text-yellow-200 flex items-center justify-center"><Minus size={16}/></button>
          <input type="number" value={amount} onChange={e=>setAmount(Math.floor(Number(e.target.value)||0))} className="flex-1 h-10 rounded-lg border border-yellow-500/30 bg-black/40 text-center text-lg font-bold text-white focus:outline-none focus:border-yellow-400"/>
          <button onClick={()=>setAmount(a=>Math.min(cfg.maxBet,a+10))} className="w-10 h-10 rounded-lg border border-yellow-500/30 bg-black/40 text-yellow-200 flex items-center justify-center"><Plus size={16}/></button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[10,50,100,500,1000,2000].filter(q=>q>=cfg.minBet&&q<=cfg.maxBet).map(q=>(
            <button key={q} onClick={()=>setAmount(q)} className={`rounded-md border px-2.5 py-1 text-xs font-medium ${amount===q?"border-yellow-400 bg-yellow-500/20 text-yellow-200":"border-yellow-500/20 text-zinc-300 hover:bg-yellow-500/10"}`}>₹{q}</button>
          ))}
        </div>
        <button onClick={placeBet} disabled={!canBet||busy} className="w-full rounded-xl bg-[var(--primary)] py-3.5 font-bold text-black text-base hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-yellow-500/30">
          {busy?"Placing…":!canBet?(phase==="locked"?"Cards opening…":"Wait for next round"):`Bet ${formatINR(amount)} on ${SIDE_LABEL[side]}`}
        </button>
        <AnimatePresence>
          {toast&&(<motion.div initial={{opacity:0,y:-5}} animate={{opacity:1,y:0}} exit={{opacity:0}} className={`rounded-lg px-3 py-2 text-xs border ${toast.kind==="ok"?"bg-emerald-500/15 border-emerald-500/30 text-emerald-200":"bg-red-500/15 border-red-500/30 text-red-200"}`}>{toast.msg}</motion.div>)}
        </AnimatePresence>
      </div>

      {/* Live bets */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Users size={14} className="text-yellow-300"/>
          <span className="text-sm font-semibold text-white">Live Bets</span>
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
        </div>
        {liveBets.length===0?<p className="text-xs text-zinc-500">No bets yet</p>:(
          <div className="space-y-1 max-h-[200px] overflow-y-auto no-scrollbar">
            {liveBets.map(b=>(
              <div key={b.id} className="flex items-center gap-2 rounded-lg bg-black/30 px-2.5 py-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${SIDE_DOT[b.side]}`}/>
                <span className="text-xs text-zinc-300 flex-1">{SIDE_LABEL[b.side]}</span>
                <span className="text-xs font-semibold text-white tabular-nums">{formatINR(b.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My record */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Receipt size={14} className="text-yellow-300"/>
          <span className="text-sm font-semibold text-white">My Record</span>
        </div>
        {myBets.length===0?<p className="text-xs text-zinc-500">No bets yet</p>:(
          <div className="space-y-1 max-h-[250px] overflow-y-auto no-scrollbar">
            {myBets.map(b=>(
              <div key={b.id} className="flex items-center gap-2 rounded-lg bg-black/30 px-2.5 py-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${SIDE_DOT[b.side]}`}/>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-zinc-400 font-mono">{b.period}</div>
                </div>
                <span className="text-xs text-zinc-300">{SIDE_LABEL[b.side]}</span>
                <span className="text-xs font-semibold tabular-nums text-white">{formatINR(b.amount)}</span>
                {b.status==="won"&&<span className="text-[10px] text-emerald-300 font-bold">+{formatINR(b.payout)}</span>}
                {b.status==="lost"&&<span className="text-[10px] text-red-300">Lost</span>}
                {b.status==="pending"&&<span className="text-[10px] text-yellow-300">Pending</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════ Cards Stage ═══════════════════════════ */

function CardsStage({phase,result,period}:{phase:"open"|"locked"|"settled";result:Side|null;period:string}) {
  const cards = genCards(period, result);
  const redWin = phase==="settled"&&(result==="red"||result==="lucky_hit");
  const blackWin = phase==="settled"&&(result==="black"||result==="lucky_hit");
  return (
    <div className="grid grid-cols-[1fr_32px_1fr] items-center gap-1">
      <div className="flex justify-center gap-1">
        {cards.red.map((v,i)=><Card key={i} idx={i} side="red" phase={phase} winner={redWin} value={v} isLucky={redWin&&result==="lucky_hit"}/>)}
      </div>
      <motion.div animate={phase==="locked"?{scale:[1,1.2,1]}:{scale:1}} transition={{repeat:phase==="locked"?Infinity:0,duration:0.4}} className="text-center font-extrabold text-yellow-300 text-lg gold-text">VS</motion.div>
      <div className="flex justify-center gap-1">
        {cards.black.map((v,i)=><Card key={i} idx={i} side="black" phase={phase} winner={blackWin} value={v} isLucky={blackWin&&result==="lucky_hit"}/>)}
      </div>
    </div>
  );
}

function Card({idx,side,phase,winner,value,isLucky}:{idx:number;side:"red"|"black";phase:string;winner:boolean;value:string;isLucky:boolean}) {
  const flip = phase==="settled" && winner;
  const dim = phase==="settled" && !winner;
  const shake = phase==="locked";
  const bob = phase==="open";

  return (
    <motion.div
      initial={false}
      animate={
        flip?{rotateY:180,scale:1.1,opacity:1}:
        dim?{rotateY:0,scale:0.85,opacity:0.4}:
        shake?{rotate:[-8,8,-8],y:[0,-4,0],scale:1,opacity:1}:
        bob?{y:[0,-2,0],rotate:0,scale:1,opacity:1}:
        {rotateY:0,scale:1,opacity:1}
      }
      transition={
        flip?{duration:0.5,delay:idx*0.2,ease:"easeOut"}:
        shake?{repeat:Infinity,duration:0.4,delay:idx*0.05}:
        bob?{repeat:Infinity,duration:2,delay:idx*0.1}:
        {duration:0.3}
      }
      className="relative w-11 h-16 sm:w-14 sm:h-20 shrink-0"
      style={{transformStyle:"preserve-3d",perspective:800}}
    >
      {/* Back */}
      <div className="absolute inset-0 rounded-lg border-2 shadow-md flex items-center justify-center" style={{
        background:side==="red"?"linear-gradient(135deg,#7f1d1d,#dc2626 50%,#7f1d1d)":"linear-gradient(135deg,#18181b,#3f3f46 50%,#18181b)",
        borderColor:side==="red"?"rgba(248,113,113,0.6)":"rgba(161,161,170,0.4)",
        backfaceVisibility:"hidden"
      }}>
        <span className="text-white/70 font-bold text-lg">{side==="red"?"♥":"♠"}</span>
      </div>
      {/* Front */}
      <div className="absolute inset-0 rounded-lg border-2 shadow-xl flex flex-col items-center justify-center" style={{
        background:isLucky?"linear-gradient(135deg,#fef3c7,#facc15 50%,#f59e0b)":side==="red"?"linear-gradient(135deg,#fee2e2,#ef4444 50%,#b91c1c)":"linear-gradient(135deg,#f4f4f5,#71717a 50%,#27272a)",
        borderColor:isLucky?"#fde68a":side==="red"?"#fca5a5":"#d4d4d8",
        color:isLucky?"#78350f":side==="red"?"#7f1d1d":"#0f172a",
        transform:"rotateY(180deg)",
        backfaceVisibility:"hidden"
      }}>
        <span className="font-extrabold text-xl sm:text-2xl">{isLucky?"★":value}</span>
        <span className="text-[9px] opacity-60">{side==="red"?"♥":"♠"}</span>
      </div>
    </motion.div>
  );
}
