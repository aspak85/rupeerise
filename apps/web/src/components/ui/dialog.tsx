"use client";
import * as React from "react";
import { cn } from "./cn";

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={() => onOpenChange(false)} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className={cn("w-full max-w-lg rounded-2xl glass p-6")}>{children}</div>
      </div>
    </div>
  );
}

export function DialogHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h4 className="text-white text-xl font-semibold">{title}</h4>
      {subtitle && <p className="text-zinc-400 mt-1 text-sm">{subtitle}</p>}
    </div>
  );
}

export function DialogFooter({ children }: { children?: React.ReactNode }) {
  return <div className="mt-6 flex items-center justify-end gap-3">{children}</div>;
}
