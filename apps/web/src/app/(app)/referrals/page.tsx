"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Share2, Trophy, Users2, Check, MessageCircle, Send } from "lucide-react";
import { api, formatINR } from "@/lib/api";

type Member = { id: string; email?: string | null; phone?: string | null; name: string | null; createdAt: string };
type RefMe = {
  code: string;
  counts: { l1: number; l2: number; l3: number };
  tree: { level1: Member[]; level2: Member[]; level3: Member[] };
  totalReferralEarnings: number;
  rates: { firstPlanBonusPct: number; levelPct: Record<number, number> };
};

type LB = { rank: number; user?: { id: string; email?: string | null; phone?: string | null; name?: string | null }; amount: number };

export default function ReferralsPage() {
  const [data, setData] = useState<RefMe | null>(null);
  const [board, setBoard] = useState<LB[]>([]);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const load = useCallback(async () => {
    const [me, lb] = await Promise.all([
      api<RefMe>("/referrals/me"),
      api<{ leaderboard: LB[] }>("/referrals/leaderboard"),
    ]);
    setData(me);
    setBoard(lb.leaderboard);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (data?.code && typeof window !== "undefined") {
      setLink(`${window.location.origin}/login?ref=${data.code}`);
    }
  }, [data?.code]);

  const copy = async (text: string, which: "code" | "link") => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers / insecure contexts
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch (e) {
      console.error("copy failed", e);
    }
  };

  const shareMessage = () =>
    `🎉 Join me on RupeeRise — India's premium daily reward investing platform!\n\n` +
    `Use my referral code: ${data?.code}\n` +
    `Sign up here: ${link}\n\n` +
    `✨ Earn daily, withdraw weekly, and grow with multi-level referral income.`;

  const share = async () => {
    const text = shareMessage();
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: "Join RupeeRise", text, url: link });
        return;
      } catch {}
    }
    // Web Share API unavailable → fallback to copy + WhatsApp
    copy(text, "link");
  };

  const shareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage())}`;
    window.open(url, "_blank", "noopener");
  };

  const shareTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareMessage())}`;
    window.open(url, "_blank", "noopener");
  };

  const maskedEmail = (email?: string | null) => {
    if (!email) return "user";
    const [u, d] = email.split("@");
    if (!d) return email;
    const head = u.length <= 3 ? u : u.slice(0, 2) + "***" + u.slice(-1);
    return `${head}@${d}`;
  };
  const display = (m: { name?: string | null; email?: string | null; phone?: string | null }) =>
    m.name || maskedEmail(m.email);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div>
        <div className="text-xs uppercase tracking-widest text-yellow-400/80">Referrals</div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Invite & earn</h1>
        <p className="mt-1 text-sm text-zinc-300">
          Get <span className="gold-text font-semibold">{data?.rates.firstPlanBonusPct ?? 45}%</span> on a friend's first plan + ongoing
          <span className="gold-text font-semibold"> 10% / 5% / 2%</span> across 3 levels.
        </p>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-400">Your Code</div>
            <div className="mt-1 text-3xl font-bold gold-text">{data?.code || "..."}</div>
            <button
              onClick={() => copy(data?.code || "", "code")}
              className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
                copied === "code" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-yellow-500/20 hover:bg-yellow-500/10 text-zinc-200"
              }`}
            >
              {copied === "code" ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy code</>}
            </button>
          </div>
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-widest text-zinc-400">Your Referral Link</div>
            <div className="mt-1 flex flex-wrap gap-2">
              <input readOnly value={link} onClick={(e) => (e.target as HTMLInputElement).select()} className="flex-1 min-w-0 rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-2.5 text-sm text-zinc-200 focus:outline-none cursor-pointer" />
              <button
                onClick={() => copy(link, "link")}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold inline-flex items-center gap-2 transition ${
                  copied === "link" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-yellow-500/30 text-zinc-100 hover:bg-yellow-500/10"
                }`}
              >
                {copied === "link" ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
              </button>
              <button onClick={share} className="rounded-xl bg-[var(--primary)] px-3 py-2.5 text-sm text-black font-semibold inline-flex items-center gap-2">
                <Share2 size={14} /> Share
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={shareWhatsApp} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 px-3 py-1.5 text-xs font-medium hover:bg-emerald-500/15 transition">
                <MessageCircle size={12} /> WhatsApp
              </button>
              <button onClick={shareTelegram} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-200 px-3 py-1.5 text-xs font-medium hover:bg-sky-500/15 transition">
                <Send size={12} /> Telegram
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat title="Total Earnings" value={formatINR(data?.totalReferralEarnings ?? 0)} />
              <Stat title="Direct (L1)" value={data?.counts.l1 ?? 0} />
              <Stat title="Team (L1–L3)" value={(data?.counts.l1 ?? 0) + (data?.counts.l2 ?? 0) + (data?.counts.l3 ?? 0)} />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-2 text-white">
            <Users2 size={18} className="text-yellow-300" />
            <h3 className="font-semibold">My Team</h3>
          </div>
          {([
            { title: "Level 1 — 10%", arr: data?.tree.level1 ?? [] },
            { title: "Level 2 — 5%", arr: data?.tree.level2 ?? [] },
            { title: "Level 3 — 2%", arr: data?.tree.level3 ?? [] },
          ] as const).map((g) => (
            <div key={g.title} className="mt-4">
              <div className="text-xs uppercase tracking-widest text-zinc-400">{g.title}</div>
              {g.arr.length === 0 ? (
                <div className="mt-1 text-sm text-zinc-500">No members yet</div>
              ) : (
                <ul className="mt-2 divide-y divide-yellow-500/10">
                  {g.arr.slice(0, 8).map((u) => (
                    <li key={u.id} className="py-2 flex items-center justify-between text-sm text-zinc-300">
                      <span className="text-white">{display(u)}</span>
                      <span className="text-xs text-zinc-500">{new Date(u.createdAt).toLocaleDateString("en-IN")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-2 text-white">
            <Trophy size={18} className="text-yellow-300" />
            <h3 className="font-semibold">Top Referrers</h3>
          </div>
          {board.length === 0 && <div className="mt-3 text-sm text-zinc-500">No leaderboard data yet.</div>}
          <ul className="mt-3 divide-y divide-yellow-500/10">
            {board.map((row) => (
              <li key={row.rank} className="py-2 flex items-center justify-between text-sm text-zinc-300">
                <span className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full text-[11px] flex items-center justify-center ${row.rank <= 3 ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40" : "bg-zinc-800 text-zinc-300"}`}>{row.rank}</span>
                  <span className="text-white">{display(row.user || {})}</span>
                </span>
                <span className="gold-text font-semibold">{formatINR(row.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-yellow-500/10 bg-black/30 p-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-400">{title}</div>
      <div className="mt-0.5 text-base font-semibold text-white">{value}</div>
    </div>
  );
}
