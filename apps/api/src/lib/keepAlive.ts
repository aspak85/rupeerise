/**
 * Self-ping keep-alive for Render's free tier.
 *
 * Render spins a free web service down after 15 minutes with no inbound
 * traffic, and the next request then pays a ~1 minute cold-start. To avoid
 * that during low-traffic gaps, the server pings its OWN public health
 * endpoint every few minutes. Because the request arrives through the public
 * URL it counts as inbound traffic and resets the idle timer.
 *
 * Design notes (so it never causes lag or hangs):
 *  - Runs ONLY in production and only when RENDER_EXTERNAL_URL is set
 *    (Render injects this automatically). In local dev it's a no-op.
 *  - Each ping has a hard 15s AbortController timeout, so a slow/failed
 *    request can never pile up or block the event loop.
 *  - All errors are swallowed (logged at most once in a while) — a failed
 *    ping must never crash or slow the API.
 *  - Interval is 10 min — comfortably under Render's 15 min spin-down window
 *    while staying well within the 750 free instance-hours/month budget.
 */

const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const PING_TIMEOUT_MS = 15 * 1000; // 15s hard cap per ping

export function startKeepAlive() {
  // Resolve the public base URL. Render provides RENDER_EXTERNAL_URL; allow a
  // manual override via KEEPALIVE_URL for other hosts.
  const base = (process.env.KEEPALIVE_URL || process.env.RENDER_EXTERNAL_URL || '').trim();

  if (process.env.NODE_ENV !== 'production' || !base) {
    // No-op in dev or when no public URL is known.
    return;
  }

  const target = `${base.replace(/\/$/, '')}/health`;
  console.log(`[keepalive] enabled — pinging ${target} every ${PING_INTERVAL_MS / 60000} min`);

  const ping = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    try {
      await fetch(target, { signal: controller.signal, headers: { 'x-keepalive': '1' } });
    } catch {
      // Silent — a missed self-ping is harmless; a real user request will
      // wake the service if it ever did spin down.
    } finally {
      clearTimeout(timer);
    }
  };

  // Use unref() so the interval never keeps the process alive on its own.
  const id = setInterval(() => { void ping(); }, PING_INTERVAL_MS);
  if (typeof id === 'object' && typeof (id as NodeJS.Timeout).unref === 'function') {
    (id as NodeJS.Timeout).unref();
  }
}
