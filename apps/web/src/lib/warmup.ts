// Pings the API on app load to wake up Render free tier
// Called once from AppShell so ALL pages benefit
let warmed = false;
export function warmupApi() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  fetch("/api/health", { cache: "no-store" }).catch(() => {});
}
