"use client";
import { useEffect, useState } from "react";
import { TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

type FeedItem = {
  kind: "deposit" | "withdraw" | string;
  username: string;
  city: string | null;
  amount: number;
  minutesAgo: number;
};

type Props = {
  /** which kind to fetch; "all" mixes deposit+withdraw */
  kind?: "all" | "deposit" | "withdraw";
  /** how many rows */
  take?: number;
  /** optional title shown above the strip */
  title?: string;
  /** when true, the strip refreshes every 8s for a "live" feel */
  autoRefresh?: boolean;
  className?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Marketing-style live feed strip used on landing page, deposit page, and
 * withdraw page. Reads from the public `/feed/live` endpoint and shuffles
 * automatically every few seconds so the page never feels stale.
 */
export default function LiveFeed({
  kind = "all",
  take = 10,
  title,
  autoRefresh = true,
  className = "",
}: Props) {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await fetch(`${API_BASE}/feed/live?kind=${kind}&take=${take}`, {
          cache: "no-store",
        });
        const data = await r.json();
        if (!cancelled && Array.isArray(data?.items)) setItems(data.items);
      } catch {
        /* ignore — strip stays empty */
      }
    };
    fetchOnce();
    if (!autoRefresh) return () => { cancelled = true; };
    const id = setInterval(fetchOnce, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [kind, take, autoRefresh]);

  return (
    <div className={`glass rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white">
          <TrendingUp size={16} className="text-yellow-300" />
          <h3 className="font-semibold text-sm">
            {title ?? (kind === "withdraw" ? "Live Withdrawals" : kind === "deposit" ? "Live Deposits" : "Live Activity")}
          </h3>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-1 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
        </span>
      </div>
      <ul className="divide-y divide-yellow-500/10 max-h-[260px] overflow-y-auto pr-1">
        {items.length === 0 && (
          <li className="py-4 text-xs text-zinc-500 text-center">Loading live activity…</li>
        )}
        {items.map((x, i) => {
          const isWithdraw = x.kind === "withdraw";
          return (
            <li key={i} className="py-2 flex items-center gap-2 text-sm">
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                isWithdraw ? "bg-rose-500/10 border-rose-500/30 text-rose-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              }`}>
                {isWithdraw ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-white truncate text-[13px] font-medium">
                  {x.username}
                  {x.city ? <span className="text-zinc-500"> · {x.city}</span> : null}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {isWithdraw ? "withdrew" : "deposited"} · {x.minutesAgo}m ago
                </div>
              </div>
              <div className="gold-text font-semibold text-sm">
                ₹{x.amount.toLocaleString("en-IN")}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
