"use client";
import { Dialog, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ShieldCheck, Sparkles } from "lucide-react";

export type Plan = { name: string; price: number; daily_income: number; duration_days: number; total_return: number };

export default function PlanModal({ open, onOpenChange, plan }: { open: boolean; onOpenChange: (v: boolean) => void; plan?: Plan }) {
  const router = useRouter();
  const { user } = useAuth();

  const proceed = () => {
    if (!plan) return;
    if (!user) {
      router.push("/login");
    } else {
      router.push("/plans");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {plan && (
        <div>
          <DialogHeader
            title={`Invest in ${plan.name}`}
            subtitle={`${plan.duration_days} days • Daily ₹${plan.daily_income.toLocaleString('en-IN')}`}
          />
          <div className="mt-6 grid gap-3 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span>Price</span>
              <span className="gold-text font-semibold">₹{plan.price.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Daily Reward</span>
              <span className="text-white">₹{plan.daily_income.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total Return ({plan.duration_days} days)</span>
              <span className="text-white">₹{plan.total_return.toLocaleString('en-IN')}</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-xs text-zinc-400">
              <li className="flex items-center gap-2"><Sparkles size={12} className="text-yellow-400" /> Daily claim required to credit earnings</li>
              <li className="flex items-center gap-2"><ShieldCheck size={12} className="text-yellow-400" /> Weekly Sunday withdrawals</li>
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} className="bg-zinc-700 text-white hover:brightness-110">Cancel</Button>
            <Button onClick={proceed}>{user ? "Continue to Plans" : "Login to Invest"}</Button>
          </DialogFooter>
        </div>
      )}
    </Dialog>
  );
}
