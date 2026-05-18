"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import Logo from "@/components/Logo";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * One-time password setup page shown to legacy OTP-only users right after
 * they sign in via OTP. Posting to /auth/set-password attaches a bcrypt hash
 * to their account so future logins use email + password.
 *
 * If the user already has a password (or isn't authed), we bounce them away
 * to the right place.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const { user, loading, refresh } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    // Already has a password? Skip this page.
    if ((user as any).hasPassword === true) {
      router.replace(user.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [loading, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirm) return setError("Passwords do not match");
    setBusy(true);
    try {
      await api("/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      // Refresh AuthContext so hasPassword=true propagates everywhere.
      await refresh();
      router.replace(user?.role === "admin" ? "/admin" : "/dashboard");
    } catch (e: any) {
      setError(e?.message || "Could not save password right now");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center gap-2 mb-6">
          <Logo size={28} />
          <div className="text-xl font-semibold gold-text">RupeeRise</div>
        </div>

        <div className="glass rounded-3xl p-7">
          <div className="mx-auto w-12 h-12 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
            <ShieldCheck className="text-yellow-300" size={22} />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white text-center">Create your password</h1>
          <p className="mt-1 text-sm text-zinc-300 text-center">
            One-time setup. From now on you'll log in with{" "}
            <span className="gold-text font-medium">{user.email}</span> + this password — no more OTPs.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <PasswordInput
              label="New password"
              value={password}
              onChange={setPassword}
              show={show}
              toggleShow={() => setShow((s) => !s)}
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
            <PasswordInput
              label="Confirm password"
              value={confirm}
              onChange={setConfirm}
              show={show}
              toggleShow={() => setShow((s) => !s)}
              autoComplete="new-password"
              placeholder="Re-type password"
            />

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              {busy ? "Saving…" : "Save & Continue"}
            </button>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-200">{error}</div>
            )}
          </form>

          <div className="mt-5 grid gap-2 text-xs text-zinc-400">
            <Tip>Use a memorable mix of letters & numbers, 8+ characters recommended.</Tip>
            <Tip>You can change it anytime from your Profile page.</Tip>
            <Tip>Forgot it? Use "Forgot password" on the login screen — we'll email an OTP.</Tip>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-yellow-300/80 mt-0.5">•</span>
      <span>{children}</span>
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  show,
  toggleShow,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggleShow: () => void;
  autoComplete: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-black/30 px-3 focus-within:border-yellow-500/50 transition">
        <Lock size={16} className="text-zinc-400" />
        <input
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-3 text-white focus:outline-none"
          required
          minLength={6}
        />
        <button
          type="button"
          onClick={toggleShow}
          className="p-1.5 text-zinc-400 hover:text-yellow-300"
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}
