// Aggressively warm up Render free-tier API so pages load fast
// Strategy: ping /health first, then prefetch the most-needed endpoints in parallel
let warmed = false;
export function warmupApi() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;

  // 1. Health ping (wakes up Render)
  fetch("/api/health", { cache: "no-store" }).catch(() => {});

  // 2. Also prefetch plans (landing + plans page both need it)
  fetch("/api/plans", { cache: "no-store" }).catch(() => {});
}

// Call this immediately when app loads — before auth even resolves
// Place in layout or _app so it runs on every page
if (typeof window !== "undefined") {
  // Run on page load
  window.addEventListener("load", warmupApi, { once: true });
  // Also run immediately if DOM is ready
  if (document.readyState !== "loading") warmupApi();
}
