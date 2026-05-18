export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE47A" />
          <stop offset="50%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="48" height="48" rx="12" fill="url(#gold)" opacity="0.2" />
      <path d="M20 40c8-1 11-6 12-12 2 6 6 10 12 12-5 1-9 3-12 8-3-5-7-7-12-8Z" fill="url(#gold)" />
      <path d="M22 24h20" stroke="url(#gold)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
