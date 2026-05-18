type Entry = { code: string; expiresAt: number };

const store = new Map<string, Entry>();

const norm = (key: string) => key.trim().toLowerCase();

export function issueOtp(key: string): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  store.set(norm(key), { code, expiresAt });
  return code;
}

export function verifyOtp(key: string, code: string): boolean {
  const k = norm(key);
  const e = store.get(k);
  if (!e) return false;
  if (Date.now() > e.expiresAt) {
    store.delete(k);
    return false;
  }
  const ok = e.code === code;
  if (ok) store.delete(k);
  return ok;
}
