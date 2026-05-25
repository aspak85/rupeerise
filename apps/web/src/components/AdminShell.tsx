"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { LayoutDashboard, Users, Wallet, ArrowDownToLine, BadgeIndianRupee, LogOut, ShieldCheck, Settings, QrCode, Ticket, Gift, HeadphonesIcon, Image as ImageIcon } from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/components/ui/cn";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/deposits", label: "Deposits", icon: Wallet },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { href: "/admin/plans", label: "Plans", icon: BadgeIndianRupee },
  { href: "/admin/payment-channels", label: "Channels", icon: QrCode },
  { href: "/admin/posters", label: "Posters", icon: ImageIcon },
  { href: "/admin/gift-codes", label: "Gift Codes", icon: Ticket },
  { href: "/admin/rewards", label: "Rewards", icon: Gift },
  { href: "/admin/support", label: "Support", icon: HeadphonesIcon },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/admin/login");
      return;
    }
    if (user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Verifying admin access…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-yellow-500/10 bg-black/40 backdrop-blur-md">
        <div className="px-6 py-5">
          <div className="flex items-center gap-2">
            <Logo size={22} />
            <div className="font-semibold gold-text">RupeeRise</div>
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-yellow-400/80 flex items-center gap-1">
            <ShieldCheck size={10} /> Admin Console
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {NAV.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
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
        <div className="p-4 border-t border-yellow-500/10">
          <div className="rounded-xl glass p-3 text-xs">
            <div className="text-zinc-400">Admin</div>
            <div className="text-white font-medium truncate" title={user.email}>{user.email}</div>
            <button onClick={signOut} className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-yellow-500/20 px-3 py-1.5 text-zinc-200 hover:bg-yellow-500/10">
              <LogOut size={12} /> Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-10 border-b border-yellow-500/10 bg-black/40 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/admin" className="flex items-center gap-2">
              <Logo size={20} />
              <div className="font-semibold gold-text text-sm">Admin</div>
            </Link>
            <button onClick={signOut} className="p-2 rounded-lg border border-yellow-500/20 text-zinc-300" aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 pb-28 lg:pb-10">{children}</main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 border-t border-yellow-500/10 bg-black/70 backdrop-blur-xl">
          <div className="flex overflow-x-auto no-scrollbar">
            {NAV.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
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
