/** Returns a YYYY-MM-DD key in IST (UTC+5:30) for daily-claim windows. */
export function todayKeyIST(d: Date = new Date()): string {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

/** Returns true if `now` is Sunday in IST. */
export function isSundayIST(d: Date = new Date()): boolean {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCDay() === 0;
}

/** Returns true if `now` is Sunday or Tuesday in IST. */
export function isWithdrawalDayIST(d: Date = new Date()): boolean {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  return day === 0 || day === 2; // 0=Sunday, 2=Tuesday
}

/** Returns next withdrawal day name */
export function nextWithdrawalDayIST(d: Date = new Date()): string {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  if (day === 0 || day === 2) return 'Today';
  if (day < 2) return 'Tuesday';
  return 'Sunday';
}

/** ms until next IST midnight. */
export function msUntilNextISTMidnight(d: Date = new Date()): number {
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const next = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1, 0, 0, 0));
  // convert next-IST-midnight back to UTC
  const targetUtc = next.getTime() - 5.5 * 60 * 60 * 1000;
  return Math.max(0, targetUtc - d.getTime());
}
