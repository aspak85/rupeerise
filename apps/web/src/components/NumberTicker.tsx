"use client";
import { useEffect, useRef, useState } from "react";

type Props = { from?: number; to: number; durationMs?: number; prefix?: string; suffix?: string; locale?: string };

export default function NumberTicker({ from = 0, to, durationMs = 1500, prefix = "", suffix = "", locale = "en-IN" }: Props) {
  const [value, setValue] = useState(from);
  const raf = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    startRef.current = start;
    const step = (t: number) => {
      const elapsed = t - (startRef.current || start);
      const p = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (to - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [from, to, durationMs]);

  const formatted = new Intl.NumberFormat(locale).format(Math.round(value));
  return <span>{prefix}{formatted}{suffix}</span>;
}
