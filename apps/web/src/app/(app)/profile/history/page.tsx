"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowDownToLine, Dices, FileText, Receipt, Wallet } from "lucide-react";
import { api, formatINR } from "@/lib/api";

type TabId = "transaction" | "deposit" | "withdraw" | "game";

type StatementEvent = { kind: string; id: string; at: string; title: string; amount: number; direction: "credit"|"debit"|"info"; status?: string };
type Deposit = { id: string; amount: number; method: string; status: string; utr: string|null; createdAt: string };
type Withdrawal = { id: string; amount: number; netAmount: number; method: string; status: string; createdAt: string };
type GameBet = { id: string; createdAt: string; side: string; amount: number; status: string; payout: number; period: string; roundResult: string|null };

export default function HistoryPage() {
  const params = useSearchParams();
  const router = useRouter();
  const initialTab = (params.get("tab") as TabId) || "transaction";
  const [tab, setTab] = useState<TabId>(initialTab);
  const [events, setEvents] = useState<StatementEvent[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [gameBets, setGameBets] = useState<GameBet[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d, w, g] = await Promise.allSettled([
        api<{ events: StatementEvent[] }>("/me/statement?type=all"),
        api<{ deposits: Deposit[] }>("/deposits"),
        api<{ withdrawals: Withdrawal[] }>("/withdrawals"),
        api<{ bets: GameBet[] }>("/lucky-hit/my-bets?take=50"),
      ]);
      if (s.status === "fulfilled") setEvents(s.value.events.slice(0, 100));
      if (d.status === "fulfilled") setDeposits(d.value.deposits);
      if (w.status === "fulfilled") setWithdrawals(w.value.withdrawals);
      if (g.status === "fulfilled") setGameBets(g.value.bets);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "transaction", label: "Transaction", icon: <FileText size={14} /> },
    { id: "deposit", label: "Deposit", icon: <Wallet size={14} /> },
    { id: "withdraw", label: "Withdraw", icon: <ArrowDownToLine size={14} /> },
    { id: "game", label: "Game", icon: <Dices size={14} /> },
  ];

  return (
    <div className="max-w-md mx-auto w-full space-y-4 pb-8">
      {/* Back arrow + title */}
      <div className="flex items-center gap-3">
        <button onClick={()=>router.back()} className="w-8 h-8 rounded-lg border border-yellow-500/20 bg-black/30 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-yellow-500/10">
          <ArrowLeft size={16}/>
        </button>
        <h1 className="text-lg font-bold text-white">History</h1>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar glass rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              tab === t.id ? "bg-[var(--primary)] text-black font-semibold" : "text-zinc-300 hover:bg-white/5"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-zinc-400 text-sm">Loading…</div>
      ) : (
        <>
          {/* Transaction tab */}
          {tab === "transaction" && (
            <div className="glass rounded-xl overflow-hidden">
              {events.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">No transactions yet</div>
              ) : (
                <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                  {events.map(e => (
                    <div key={`${e.kind}:${e.id}`} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        e.direction === "credit" ? "bg-emerald-500/15 text-emerald-300" :
                        e.direction === "debit" ? "bg-red-500/10 text-red-300" : "bg-yellow-500/10 text-yellow-300"
                      }`}>
                        {e.direction === "credit" ? "↓" : e.direction === "debit" ? "↑" : "•"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white truncate">{e.title}</div>
                        <div className="text-[10px] text-zinc-500">{new Date(e.at).toLocaleString("en-IN")}</div>
                      </div>
                      <div className={`text-sm font-semibold ${
                        e.direction === "credit" ? "text-emerald-300" : e.direction === "debit" ? "text-red-300" : "text-zinc-400"
                      }`}>
                        {e.direction === "credit" ? "+" : e.direction === "debit" ? "-" : ""}{formatINR(e.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Deposit tab */}
          {tab === "deposit" && (
            <div className="glass rounded-xl overflow-hidden">
              {deposits.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">No deposits yet</div>
              ) : (
                <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                  {deposits.map(d => (
                    <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-300 shrink-0">↓</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white">{formatINR(d.amount)}</div>
                        <div className="text-[10px] text-zinc-500">{d.method} · {new Date(d.createdAt).toLocaleString("en-IN")}</div>
                        {d.utr && <div className="text-[10px] text-zinc-600 font-mono">UTR: {d.utr}</div>}
                      </div>
                      <StatusPill status={d.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Withdraw tab */}
          {tab === "withdraw" && (
            <div className="glass rounded-xl overflow-hidden">
              {withdrawals.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">No withdrawals yet</div>
              ) : (
                <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                  {withdrawals.map(w => (
                    <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-300 shrink-0">↑</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white">{formatINR(w.amount)} → Net {formatINR(w.netAmount)}</div>
                        <div className="text-[10px] text-zinc-500">{w.method} · {new Date(w.createdAt).toLocaleString("en-IN")}</div>
                      </div>
                      <StatusPill status={w.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Game history tab */}
          {tab === "game" && (
            <div className="glass rounded-xl overflow-hidden">
              {gameBets.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">No game bets yet</div>
              ) : (
                <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                  {gameBets.map(b => (
                    <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        b.status === "won" ? "bg-emerald-500/15 text-emerald-300" :
                        b.status === "lost" ? "bg-red-500/10 text-red-300" : "bg-yellow-500/10 text-yellow-300"
                      }`}>
                        <Dices size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white">#{b.period} · <span className="capitalize">{b.side.replace("_", " ")}</span></div>
                        <div className="text-[10px] text-zinc-500">Bet {formatINR(b.amount)} · {new Date(b.createdAt).toLocaleString("en-IN")}</div>
                      </div>
                      <div className={`text-xs font-semibold ${
                        b.status === "won" ? "text-emerald-300" : b.status === "lost" ? "text-red-300" : "text-yellow-300"
                      }`}>
                        {b.status === "won" ? `+${formatINR(b.payout)}` : b.status === "lost" ? "Lost" : "Pending"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === "approved" || status === "paid" ? "bg-emerald-500/15 text-emerald-300" :
    status === "pending" ? "bg-yellow-500/15 text-yellow-300" : "bg-red-500/15 text-red-300";
  return <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}
