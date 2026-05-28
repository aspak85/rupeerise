"use client";
import { useEffect, useState } from "react";
import PlansGrid from "@/components/PlansGrid";

const FALLBACK_PLANS = [
  { name: "Starter", price: 500, daily_income: 25, duration_days: 30, total_return: 750 },
  { name: "Silver", price: 2000, daily_income: 110, duration_days: 45, total_return: 4950 },
  { name: "Gold", price: 5000, daily_income: 320, duration_days: 60, total_return: 19200 },
  { name: "VIP Elite", price: 10000, daily_income: 700, duration_days: 90, total_return: 63000 },
  { name: "Elite Pro", price: 25000, daily_income: 2000, duration_days: 120, total_return: 240000 },
  { name: "Tycoon", price: 50000, daily_income: 4000, duration_days: 150, total_return: 600000 },
  { name: "Emperor", price: 100000, daily_income: 8333, duration_days: 180, total_return: 1499940 },
];

export default function PlansSection() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const ctrl = new AbortController();
    fetch(`${api}/plans`, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) return;
        return res.json();
      })
      .then((data) => {
        if (data?.plans) setPlans(data.plans);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  return <PlansGrid plans={plans} />;
}
