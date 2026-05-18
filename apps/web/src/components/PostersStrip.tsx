"use client";
import { motion } from "framer-motion";
import { Gift, Zap, Trophy, IndianRupee, Users, ShieldCheck } from "lucide-react";

const POSTERS = [
  {
    title: "Spin & Win Daily",
    sub: "Spin the wheel every 24 hours and bag up to ₹100 free.",
    grad: "from-yellow-500/30 via-amber-500/10 to-transparent",
    icon: Zap,
    chip: "🎡 Daily",
  },
  {
    title: "Scratch Card Jackpot",
    sub: "Reveal up to ₹200 instantly — pure luck, pure rewards.",
    grad: "from-fuchsia-500/30 via-pink-500/10 to-transparent",
    icon: Gift,
    chip: "💎 Surprise",
  },
  {
    title: "VIP Membership",
    sub: "Bronze → Diamond: lower fees, bonus spin, faster payouts.",
    grad: "from-sky-500/30 via-blue-500/10 to-transparent",
    icon: Trophy,
    chip: "👑 Tier",
  },
  {
    title: "Multi-Level Referrals",
    sub: "Earn 45% on first plan + 10/5/2% across 3 levels — auto credited.",
    grad: "from-emerald-500/30 via-green-500/10 to-transparent",
    icon: Users,
    chip: "🤝 Team",
  },
  {
    title: "Instant Razorpay",
    sub: "Pay & receive within seconds. UPI, Cards, Wallets — all native INR.",
    grad: "from-orange-500/30 via-red-500/10 to-transparent",
    icon: IndianRupee,
    chip: "⚡ Fast",
  },
  {
    title: "Bank-grade Security",
    sub: "256-bit SSL, KYC verification, signed payment receipts.",
    grad: "from-rose-500/30 via-red-500/10 to-transparent",
    icon: ShieldCheck,
    chip: "🛡️ Safe",
  },
];

export default function PostersStrip() {
  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-yellow-400/80">Why RupeeRise</div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-semibold text-white">Built for everyday earners.</h2>
          </div>
          <div className="text-sm text-zinc-400">No KYC for ₹500 plan • Withdraw weekly</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {POSTERS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.05, duration: 0.45 }}
              whileHover={{ y: -4, scale: 1.01 }}
              className={`group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${p.grad} p-6 h-full transition`}
            >
              {/* Sheen */}
              <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 bg-[linear-gradient(120deg,transparent_30%,rgba(255,255,255,0.06)_50%,transparent_70%)]" />

              <div className="flex items-center justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/40 border border-white/10">
                  <p.icon size={18} className="text-yellow-300" />
                </div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-300 bg-black/40 rounded-full px-2 py-1 border border-white/10">
                  {p.chip}
                </div>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{p.title}</h3>
              <p className="mt-1 text-sm text-zinc-300/90 leading-relaxed">{p.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
