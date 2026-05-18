"use client";
import Marquee from "@/components/Marquee";

const PARTNERS = [
  "Razorpay", "Cashfree", "Paytm", "PhonePe", "GPay", "BHIM UPI",
  "ICICI Bank", "HDFC Bank", "SBI Pay", "Axis Pay", "Kotak", "PayU",
];

export default function PartnersMarquee() {
  return (
    <section className="px-6 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="text-center text-[11px] uppercase tracking-widest text-zinc-500 mb-3">
          Powered by India's most-trusted payment partners
        </div>
        <Marquee speedSec={30} className="">
          {PARTNERS.map((p) => (
            <div
              key={p}
              className="shrink-0 rounded-xl border border-yellow-500/15 bg-black/30 px-5 py-2.5 text-sm text-zinc-300 backdrop-blur whitespace-nowrap"
            >
              {p}
            </div>
          ))}
        </Marquee>
      </div>
    </section>
  );
}
