import dynamic from "next/dynamic";
import Section from "@/components/Section";
import Reveal from "@/components/Reveal";
import PlansGrid from "@/components/PlansGrid";
import SiteHeader from "@/components/SiteHeader";
import LiveFeed from "@/components/LiveFeed";
import Link from "next/link";

// Heavy client components are dynamically imported so the initial HTML +
// JS bundle stays small. On mobile / 3G this is the difference between a
// flash-of-blank-screen and instantly visible content. SSR is enabled so
// SEO + first-paint stay good.
const Hero3D = dynamic(() => import("@/components/Hero3D"), {
  loading: () => <HeroSkeleton />,
});
const PostersStrip = dynamic(() => import("@/components/PostersStrip"), { ssr: false });
const PartnersMarquee = dynamic(() => import("@/components/PartnersMarquee"), { ssr: false });
const TestimonialsMarquee = dynamic(() => import("@/components/TestimonialsMarquee"), { ssr: false });

function HeroSkeleton() {
  return (
    <section className="relative px-6 pt-12 pb-16 sm:pt-16 sm:pb-20">
      <div className="mx-auto max-w-6xl grid gap-10 lg:grid-cols-2">
        <div>
          <div className="h-6 w-56 rounded-full bg-yellow-500/10 animate-pulse" />
          <div className="mt-5 h-12 w-72 rounded bg-white/5 animate-pulse" />
          <div className="mt-3 h-12 w-80 rounded bg-white/5 animate-pulse" />
          <div className="mt-3 h-12 w-64 rounded bg-white/5 animate-pulse" />
          <div className="mt-7 h-11 w-44 rounded-xl bg-yellow-500/20 animate-pulse" />
        </div>
        <div className="hidden lg:block h-72 rounded-3xl border border-yellow-500/15 bg-black/30 animate-pulse" />
      </div>
    </section>
  );
}
// ISR cache (5 min) so we don't hit the API on every request — critical for
// mobile/cold-start speed. If the API is sleeping (Render free tier), Vercel
// would otherwise block for 30+ seconds and the user gets a blank screen.
export const revalidate = 300;

const FALLBACK_PLANS = [
  { name: 'Starter',   price:    500, daily_income:   25, duration_days:  30, total_return:    750 },
  { name: 'Silver',    price:   2000, daily_income:  110, duration_days:  45, total_return:   4950 },
  { name: 'Gold',      price:   5000, daily_income:  320, duration_days:  60, total_return:  19200 },
  { name: 'VIP Elite', price:  10000, daily_income:  700, duration_days:  90, total_return:  63000 },
  { name: 'Elite Pro', price:  25000, daily_income: 2000, duration_days: 120, total_return: 240000 },
  { name: 'Tycoon',    price:  50000, daily_income: 4000, duration_days: 150, total_return: 600000 },
  { name: 'Emperor',   price: 100000, daily_income: 8333, duration_days: 180, total_return:1499940 },
];

async function getPlans() {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  // Hard 3-second timeout: if the API is asleep we use fallback plans
  // immediately rather than blocking the whole landing page render.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(`${api}/plans`, { signal: ctrl.signal, next: { revalidate: 300 } });
    clearTimeout(timer);
    if (!res.ok) return FALLBACK_PLANS;
    const data = await res.json();
    return (data.plans as typeof FALLBACK_PLANS) || FALLBACK_PLANS;
  } catch {
    clearTimeout(timer);
    return FALLBACK_PLANS;
  }
}

export default async function Home() {
  const plans = await getPlans();
  return (
    <>
    <SiteHeader />
    <main className="flex-1">
      {/* Auto-swiping promotional carousel — admin manages slides via /admin/posters */}
      <PostersStrip />

      {/* HERO with 3D tilt card */}
      <Hero3D />

      {/* Partners marquee */}
      <PartnersMarquee />

      {/* Live counters */}
      <section className="px-6">
        <div className="mx-auto max-w-6xl grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Reveal>
          <div className="glass rounded-2xl p-6 text-center">
            <div className="text-zinc-400 text-xs uppercase">Total Users</div>
            <Counter to={42850} suffix="+" />
          </div>
          </Reveal>
          <Reveal delay={0.05}>
          <div className="glass rounded-2xl p-6 text-center">
            <div className="text-zinc-400 text-xs uppercase">Paid Out</div>
            <Counter to={127_50_000} prefix="₹" />
          </div>
          </Reveal>
          <Reveal delay={0.1}>
          <div className="glass rounded-2xl p-6 text-center">
            <div className="text-zinc-400 text-xs uppercase">Active Investments</div>
            <Counter to={96540} suffix="+" />
          </div>
          </Reveal>
          <Reveal delay={0.15}>
          <div className="glass rounded-2xl p-6 text-center">
            <div className="text-zinc-400 text-xs uppercase">Daily Claims</div>
            <Counter to={321_000} suffix="+" />
          </div>
          </Reveal>
        </div>
      </section>

      {/* Live withdrawal feed (driven by /feed/live, admin-manageable) */}
      <section className="px-6 pt-2">
        <div className="mx-auto max-w-6xl grid gap-4 lg:grid-cols-3">
          <Reveal>
          <div className="lg:col-span-2">
            <LiveFeed kind="all" take={10} title="Live Activity" />
          </div>
          </Reveal>
          <Reveal delay={0.05}>
          <div className="glass rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-3">Top Investors</h3>
            <ul className="space-y-2 text-zinc-300">
              {[
                { name: "Aditi • Mumbai", amount: 100000, plan: "Emperor" },
                { name: "Rahul • Delhi", amount: 50000, plan: "Tycoon" },
                { name: "Sneha • Pune", amount: 25000, plan: "Elite Pro" },
                { name: "Arjun • Bengaluru", amount: 10000, plan: "VIP Elite" },
              ].map((x) => (
                <li key={x.name} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    <span className="text-white">{x.name}</span>
                    <span className="text-zinc-500"> • {x.plan}</span>
                  </span>
                  <span className="gold-text font-semibold">₹{x.amount.toLocaleString("en-IN")}</span>
                </li>
              ))}
            </ul>
          </div>
          </Reveal>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="px-6 pt-16 pb-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-yellow-400/80">Investment Plans</div>
              <h2 className="mt-1 text-2xl sm:text-3xl font-semibold text-white">From <span className="gold-text">₹500</span> to <span className="gold-text">₹1,00,000</span> — pick your tier</h2>
            </div>
            <div className="text-sm text-zinc-400">All plans pay daily • Withdraw on Sundays</div>
          </div>
          <PlansGrid plans={plans as any} />
        </div>
      </section>

      {/* Testimonials marquee */}
      <TestimonialsMarquee />

      {/* Referrals */}
      <Section id="referrals" title="Referral Rewards" subtitle="Invite and earn up to 45% on first purchase + tiered multi-level commissions that grow with plan size.">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { t: "First Plan Bonus", d: "45% instant payout to direct referrer when their invitee buys their first plan." },
            { t: "Level 1 — 10%", d: "On every plan your direct referrals buy." },
            { t: "Level 2 — 5%", d: "Earn from your team-of-team." },
            { t: "Level 3 — 2%", d: "Extended 3-deep network commissions." },
            { t: "Tier multiplier", d: "VIP Elite +10%, Elite Pro +25%, Tycoon +40%, Emperor +60% on top of base." },
            { t: "Leaderboard", d: "Top weekly sponsors get bonus rewards & priority support." },
          ].map((i) => (
            <div key={i.t} className="glass rounded-2xl p-5">
              <div className="font-semibold text-white">{i.t}</div>
              <div className="mt-1 text-zinc-300 text-sm">{i.d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Bonuses */}
      <Section id="bonuses" title="Daily Bonuses & Gamification" subtitle="Spin Wheel, Scratch Cards, Daily Claims, Achievements — all auto-credited to your Bonus Wallet.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Daily Claim", e: "🪙" },
            { t: "Spin Wheel", e: "🎡" },
            { t: "Scratch Cards", e: "💎" },
            { t: "Streak Rewards", e: "🔥" },
            { t: "Reward Boxes", e: "🎁" },
            { t: "VIP Progress", e: "👑" },
            { t: "Achievements", e: "🏆" },
            { t: "Leaderboards", e: "📈" },
          ].map((b) => (
            <div key={b.t} className="glass rounded-2xl p-5 text-white flex items-center gap-3">
              <span className="text-2xl">{b.e}</span>
              <span>{b.t}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" title="Frequently Asked Questions">
        <div className="space-y-3">
          {[
            { q: "How does the daily reward work?", a: "Buy any plan, then tap Claim once every 24 hours (IST) from your dashboard. The plan's daily income is credited to your Earnings Wallet." },
            { q: "How are deposits made?", a: "Through Razorpay (cards, UPI, NetBanking) — funds credit instantly. UPI/UTR manual deposits are also accepted and reviewed by admins." },
            { q: "When can I withdraw?", a: "Withdrawals are processed every Sunday with a 5% fee (3% for Platinum+ VIPs). KYC required above ₹2000." },
            { q: "How do referrals pay out?", a: "45% instant bonus on your invitee's first plan, then 10%/5%/2% across L1/L2/L3. Bigger plans pay even higher commissions (up to +60%)." },
            { q: "Is there an app?", a: "RupeeRise is a Progressive Web App — installable on Android, iPhone, desktop. Android APK launching soon." },
          ].map((x) => (
            <div key={x.q} className="glass rounded-2xl p-5">
              <div className="font-medium text-white">{x.q}</div>
              <div className="mt-1 text-zinc-300 text-sm">{x.a}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section id="download">
        <div className="relative glass rounded-3xl p-8 sm:p-14 text-center overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-yellow-500/20 blur-3xl" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="relative">
            <div className="text-xs uppercase tracking-widest text-yellow-400/80">Get Started in 60 seconds</div>
            <h3 className="mt-2 text-3xl sm:text-4xl font-bold text-white">Your first ₹100 reward is one tap away.</h3>
            <p className="mt-3 text-zinc-300 max-w-xl mx-auto">No paperwork. Just your Gmail, an OTP, and you're earning daily from your dashboard.</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link className="rounded-xl bg-[var(--primary)] px-6 py-3 font-semibold text-black hover:brightness-95 shadow-[0_8px_30px_-8px_rgba(250,204,21,0.55)]" href="/login?signup=1">Create free account</Link>
              <a className="rounded-xl border border-yellow-500/30 px-6 py-3 font-medium text-zinc-200 hover:bg-yellow-500/10" href="#plans">View Plans</a>
            </div>
          </div>
        </div>
      </Section>
      <section className="px-6 pb-10">
        <div className="mx-auto max-w-6xl grid items-center gap-4 sm:grid-cols-3 text-sm">
          <div className="text-zinc-400">SSL Secured • INR Payments</div>
          <div className="flex justify-center gap-4 text-zinc-400">
            <span className="rounded-full border border-yellow-500/20 px-3 py-1">Razorpay</span>
            <span className="rounded-full border border-yellow-500/20 px-3 py-1">Cashfree</span>
            <span className="rounded-full border border-yellow-500/20 px-3 py-1">UPI</span>
          </div>
          <div className="flex justify-end gap-4 text-zinc-400">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Support</a>
          </div>
        </div>
      </section>
    </main>
    <footer className="mt-auto border-t border-yellow-500/10 bg-black/30">
      <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-zinc-400">© {new Date().getFullYear()} RupeeRise. All rights reserved.</div>
    </footer>
    </>
  );
}

// Client components used inside the page
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Counter({ to, prefix = "", suffix = "" }: { to: number; prefix?: string; suffix?: string }) {
  // dynamic import to avoid SSR mismatch
  const Ticker = (require("next/dynamic").default as any)(
    () => import("@/components/NumberTicker"),
    { ssr: false }
  );
  return (
    <div className="mt-1 text-3xl font-bold gold-text">
      {/* @ts-ignore */}
      <Ticker to={to} prefix={prefix} suffix={suffix} />
    </div>
  );
}

// (LiveFeed is now imported from "@/components/LiveFeed" — admin-managed)
