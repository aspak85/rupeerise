"use client";
import Logo from "@/components/Logo";
import { Sheet } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  // IMPORTANT: do NOT render any admin links on the public surface
  return (
    <header className="sticky top-0 z-10 backdrop-blur-md bg-black/30 border-b border-yellow-500/10">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={22} />
          <div className="font-semibold gold-text">RupeeRise</div>
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-zinc-300">
          <a href="#plans" className="hover:text-white">Plans</a>
          <a href="#referrals" className="hover:text-white">Referrals</a>
          <a href="#bonuses" className="hover:text-white">Bonuses</a>
          <a href="#faq" className="hover:text-white">FAQ</a>
          {user ? (
            <Link href="/dashboard" className="rounded-lg bg-[var(--primary)] px-3 py-1.5 font-semibold text-black hover:brightness-95">Dashboard</Link>
          ) : (
            <Link href="/login" className="rounded-lg bg-[var(--primary)] px-3 py-1.5 font-semibold text-black hover:brightness-95">Login</Link>
          )}
        </nav>
        <button className="sm:hidden p-2 rounded-lg border border-yellow-500/20" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu size={18} className="text-zinc-200" />
        </button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={18} />
            <div className="font-semibold gold-text">RupeeRise</div>
          </div>
          <button className="text-zinc-400" onClick={() => setOpen(false)}>Close</button>
        </div>
        <nav className="mt-4 grid gap-2 text-zinc-200">
          <a href="#plans" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 hover:bg-yellow-500/10">Plans</a>
          <a href="#referrals" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 hover:bg-yellow-500/10">Referrals</a>
          <a href="#bonuses" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 hover:bg-yellow-500/10">Bonuses</a>
          <a href="#faq" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 hover:bg-yellow-500/10">FAQ</a>
          {user ? (
            <Link href="/dashboard" onClick={() => setOpen(false)} className="rounded-md bg-[var(--primary)] px-2 py-2 text-center font-semibold text-black">Dashboard</Link>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)} className="rounded-md bg-[var(--primary)] px-2 py-2 text-center font-semibold text-black">Login</Link>
          )}
        </nav>
      </Sheet>
    </header>
  );
}
