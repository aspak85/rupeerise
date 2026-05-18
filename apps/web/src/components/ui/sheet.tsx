"use client";
import * as React from "react";
import { cn } from "./cn";

export function Sheet({ open, onOpenChange, side = "right", children }: { open: boolean; onOpenChange: (v: boolean) => void; side?: "left"|"right"; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={() => onOpenChange(false)} />
      <div className={cn(
        "absolute top-0 h-full w-80 max-w-[85vw] glass p-5",
        side === "right" ? "right-0" : "left-0"
      )}>
        {children}
      </div>
    </div>
  );
}
