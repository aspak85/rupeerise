"use client";
import Marquee from "@/components/Marquee";
import { Star, Quote } from "lucide-react";

const REVIEWS = [
  { name: "Priya S.",   city: "Mumbai",     stars: 5, q: "Razorpay deposit was instant. Withdrawal on Sunday came in 6 mins. Wow!", emoji: "🚀" },
  { name: "Rohit K.",   city: "Jaipur",     stars: 5, q: "I bought the Gold plan and my referral commissions started rolling in immediately.", emoji: "💎" },
  { name: "Meera D.",   city: "Hyderabad",  stars: 5, q: "Best UI of any earning platform. The 3D dashboard looks ultra premium.", emoji: "✨" },
  { name: "Aarav G.",   city: "Pune",       stars: 5, q: "My team is at level 3 — passive income every single day. Game changing.", emoji: "📈" },
  { name: "Anjali R.",  city: "Delhi",      stars: 5, q: "Daily Spin gave me ₹50, Scratch gave me ₹85. Plus daily claim. Love it.", emoji: "🎁" },
  { name: "Karan M.",   city: "Bengaluru",  stars: 5, q: "Tycoon plan paying me ₹4,000 every single day. Already recovered investment.", emoji: "👑" },
  { name: "Diya P.",    city: "Surat",      stars: 5, q: "Customer support is super-fast. Got my KYC done in 4 minutes.", emoji: "⚡" },
  { name: "Vihaan T.",  city: "Indore",     stars: 5, q: "The Emperor plan + L1 commissions paid for my family vacation this month.", emoji: "🏖️" },
  { name: "Isha N.",    city: "Lucknow",    stars: 4, q: "Smooth UPI deposits, never a single failed transaction. Trustworthy.", emoji: "🤝" },
  { name: "Kabir B.",   city: "Ahmedabad",  stars: 5, q: "VIP Diamond tier perks are unreal. 3% withdraw fee instead of 5%.", emoji: "💸" },
];

export default function TestimonialsMarquee() {
  // Split into two rows for stronger visual rhythm
  const rowA = REVIEWS.slice(0, 5);
  const rowB = REVIEWS.slice(5);

  return (
    <section className="relative py-12">
      <div className="px-6 mx-auto max-w-6xl mb-6">
        <div className="text-xs uppercase tracking-widest text-yellow-400/80">Loved by 42,000+ Indians</div>
        <h2 className="mt-1 text-2xl sm:text-3xl font-semibold text-white">What our users say</h2>
        <div className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-300">
          <span className="inline-flex">
            {[0,1,2,3,4].map(i => <Star key={i} size={14} className="fill-yellow-400 text-yellow-400" />)}
          </span>
          <span className="text-yellow-300 font-semibold">4.9 / 5</span>
          <span className="text-zinc-400">across 12,400 reviews</span>
        </div>
      </div>

      <Marquee speedSec={45} direction="left" className="py-3">
        {rowA.map((r) => <ReviewCard key={r.name} {...r} />)}
      </Marquee>
      <div className="h-3" />
      <Marquee speedSec={55} direction="right" className="py-3">
        {rowB.map((r) => <ReviewCard key={r.name} {...r} />)}
      </Marquee>
    </section>
  );
}

function ReviewCard({ name, city, stars, q, emoji }: { name: string; city: string; stars: number; q: string; emoji: string }) {
  return (
    <div className="w-[320px] sm:w-[360px] shrink-0 rounded-2xl border border-yellow-500/15 bg-gradient-to-br from-black/40 to-zinc-900/40 p-5 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400/40 to-yellow-700/40 grid place-items-center text-xl">
          {emoji}
        </div>
        <div className="min-w-0">
          <div className="text-white font-semibold truncate">{name}</div>
          <div className="text-[11px] text-zinc-400">{city}</div>
        </div>
        <div className="ml-auto inline-flex">
          {[0,1,2,3,4].map(i => (
            <Star key={i} size={12} className={i < stars ? "fill-yellow-400 text-yellow-400" : "text-zinc-700"} />
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-2 text-zinc-200 text-sm leading-relaxed">
        <Quote size={14} className="text-yellow-400/70 shrink-0 mt-0.5" />
        <span>{q}</span>
      </div>
    </div>
  );
}
