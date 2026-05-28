"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { LayoutDashboard, Wallet, Users2, ArrowDownToLine, BadgeIndianRupee, LogOut, BellRing, Gift, Ticket, HeadphonesIcon, UserCircle2 } from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/components/ui/cn";
import { warmupApi } from "@/lib/warmup";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/plans", label: "Plans", icon: BadgeIndianRupee },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/redeem", label: "Redeem", icon: Ticket },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/referrals", label: "Refer", icon: Users2 },
  { href: "/withdraw", label: "Withdraw", icon: ArrowDownToLine },
  { href: "/profile", label: "Profile", icon: UserCircle2 },
  { href: "/support", label: "Support", icon: HeadphonesIcon },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Warm up the Render free-tier API as early as possible
  warmupApi();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Legacy users that haven't created a password yet are forced through
    // /set-password before they can access the rest of the app.
    if ((user as any).hasPassword === false && pathname !== "/set-password") {
      router.replace("/set-password");
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-yellow-500/10 bg-black/30 backdrop-blur-md">
        <div className="px-6 py-5 flex items-center gap-2">
          <Logo size={22} />
          <div className="font-semibold gold-text">RupeeRise</div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-yellow-500/15 text-yellow-200 border border-yellow-500/30"
                    : "text-zinc-300 hover:bg-yellow-500/5 hover:text-white"
                )}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-yellow-500/10 text-xs text-zinc-400">
          <div className="rounded-xl glass p-3">
            <div className="text-zinc-400">Logged in as</div>
            <div className="text-white font-medium truncate" title={user.email}>{user.email}</div>
            {user.phone && <div className="text-zinc-500 text-[11px]">+91 {user.phone}</div>}
            <div className="mt-1 text-yellow-300/90 text-[10px] uppercase tracking-widest">{user.referralCode}</div>
            <button onClick={signOut} className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-yellow-500/20 px-3 py-1.5 hover:bg-yellow-500/10">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-10 border-b border-yellow-500/10 bg-black/30 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Logo size={20} />
              <div className="font-semibold gold-text text-sm">RupeeRise</div>
            </Link>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg border border-yellow-500/20 text-zinc-300" aria-label="Notifications">
                <BellRing size={16} />
              </button>
              <button onClick={signOut} className="p-2 rounded-lg border border-yellow-500/20 text-zinc-300" aria-label="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 pb-28 lg:pb-10">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-yellow-500/10 bg-black/70 backdrop-blur-xl">
          <div className="flex overflow-x-auto no-scrollbar">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 min-w-[72px] flex flex-col items-center justify-center py-2 text-[10px] gap-0.5 transition px-2",
                    active ? "text-yellow-300" : "text-zinc-400"
                  )}
                >
                  <item.icon size={16} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
