"use client";
import Logo from "@/components/Logo";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, ShieldCheck, Lock, Eye, EyeOff } from "lucide-react";
import { api, AuthUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === "admin") router.replace("/admin");
  }, [user, router]);

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!EMAIL_RE.test(email)) return setError("Enter a valid email");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setError(null);
    setBusy(true);
    try {
      const data = await api<{ token: string; user: AuthUser }>("/auth/admin-login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (data.user.role !== "admin") {
        setError("This account is not authorised for admin access.");
        setBusy(false);
        return;
      }
      signIn(data.token, data.user);
      router.replace("/admin");
    } catch (e: any) {
      setError(e?.message || "Invalid credentials");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <Logo size={28} />
          <div className="text-xl font-semibold gold-text">RupeeRise</div>
        </Link>

        <div className="glass rounded-3xl p-8 border-yellow-500/30">
          <div className="flex items-center gap-2 text-yellow-400/90 text-xs uppercase tracking-widest">
            <ShieldCheck size={14} />
            <span>Admin Console</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Restricted Login</h1>
          <p className="mt-1 text-sm text-zinc-300">
            Sign in with your administrator email and password.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <div className="text-xs text-zinc-400 mb-1">Admin Email</div>
              <div className="flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-black/30 px-3 focus-within:border-yellow-500/50 transition">
                <Mail size={16} className="text-zinc-400" />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                  placeholder="you@yourdomain.com"
                  className="flex-1 bg-transparent py-3 text-white focus:outline-none"
                />
              </div>
            </label>

            <label className="block">
              <div className="text-xs text-zinc-400 mb-1">Password</div>
              <div className="flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-black/30 px-3 focus-within:border-yellow-500/50 transition">
                <Lock size={16} className="text-zinc-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 bg-transparent py-3 text-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-zinc-400 hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <ShieldCheck size={16} />
              {busy ? "Signing in…" : "Enter Admin Console"}
            </button>
          </form>

          {error && (
            <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="mt-6 text-[11px] text-zinc-500 leading-relaxed">
            Forgot password? Edit <code className="text-yellow-300/80">ADMIN_PASSWORD</code> in the API <code className="text-yellow-300/80">.env</code> and restart the API.
          </div>
        </div>
      </motion.div>
    </div>
  );
}
