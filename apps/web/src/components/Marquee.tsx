"use client";
import { ReactNode } from "react";

/**
 * Infinite horizontal marquee using CSS keyframes.
 * Duplicates children so the loop is seamless.
 * Set direction="right" to reverse.
 */
export default function Marquee({
  children,
  direction = "left",
  speedSec = 40,
  className = "",
  fade = true,
}: {
  children: ReactNode;
  direction?: "left" | "right";
  speedSec?: number;
  className?: string;
  fade?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={
        fade
          ? {
              maskImage:
                "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
              WebkitMaskImage:
                "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
            }
          : undefined
      }
    >
      <div
        className="flex w-max gap-6"
        style={{
          animation: `rr-marquee ${speedSec}s linear infinite`,
          animationDirection: direction === "right" ? "reverse" : "normal",
        }}
      >
        <div className="flex shrink-0 gap-6">{children}</div>
        <div className="flex shrink-0 gap-6" aria-hidden>
          {children}
        </div>
      </div>
      <style jsx global>{`
        @keyframes rr-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
