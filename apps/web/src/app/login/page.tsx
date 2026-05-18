"use client";
import Logo from "@/components/Logo";
import { motion, AnimatePresence } from "framer-motion";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Phone,
  Gift,
  ShieldCheck,
  KeyRound,
  Sparkles,
  HelpCircle,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { api, ApiError, AuthUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Mode = "login" | "signup" | "forgot";
type SignupStep = "form" | "otp";
type ForgotStep = "email" | "reset";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user, signIn } = useAuth();

  // Routing the initial mode: ?ref=XYZ or ?signup=1 → signup; ?forgot=1 → forgot
  const initialMode: Mode = sp.get("ref") || sp.get("signup")
    ? "signup"
    : sp.get("forgot") ? "forgot" : "login";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Signup-only
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");

  // OTP step (signup + forgot)
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Auto-redirect once authenticated
  useEffect(() => {
    if (user) {
      // Legacy users with no password get pushed to /set-password first
      if ((user as any).hasPassword === false) {
        router.replace("/set-password");
      } else {
        router.replace(user.role === "admin" ? "/admin" : "/dashboard");
      }
    }
  }, [user, router]);

  // Pre-fill referral code from ?ref= and switch to signup
  useEffect(() => {
    const r = sp.get("ref");
    if (r) {
      setReferralCode(r.toUpperCase());
      setMode("signup");
    }
  }, [sp]);

  // Reset transient state on mode change
  useEffect(() => {
    setError(null);
    setInfo(null);
    setCode("");
    setDevOtp(null);
    setSignupStep("form");
    setForgotStep("email");
    setPassword("");
  }, [mode]);

  /* ─────────── Login (password) ─────────── */
  const submitLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!EMAIL_RE.test(email)) return setError("Enter a valid email address");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setError(null);
    setBusy(true);
    try {
      const data = await api<{ token: string; user: AuthUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      signIn(data.token, data.user);
      router.replace(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (e: any) {
      // Special case: legacy account without password → push them to OTP signup-style flow.
      if (e instanceof ApiError && e.data?.code === "OTP_LOGIN_REQUIRED") {
        setError(null);
        setInfo("This account hasn't set a password yet. Sending you an OTP — sign in once and we'll prompt you to create a password.");
        await sendOtpForLegacyMigration();
        return;
      }
      setError(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  /**
   * For legacy OTP-only accounts, transition to a one-step OTP flow that
   * verifies them, signs them in, and our useEffect-on-user push to
   * /set-password takes care of the rest.
   */
  const sendOtpForLegacyMigration = async () => {
    setBusy(true);
    try {
      const r = await api<{ delivered: boolean; devOtp?: string }>("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMode("signup");
      setSignupStep("otp");
      if (r.devOtp) setDevOtp(r.devOtp);
      setInfo(`OTP sent to ${email}. Enter it below and we'll get you set up with a password.`);
    } catch (e: any) {
      setError(e?.message || "Failed to send OTP");
    } finally {
      setBusy(false);
    }
  };

  /* ─────────── Signup (OTP first, then register w/ password) ─────────── */
  const requestSignupOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!EMAIL_RE.test(email)) return setError("Enter a valid email address");
    if (!firstName.trim() || !lastName.trim()) return setError("Please enter your first and last name");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ delivered: boolean; devOtp?: string }>("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSignupStep("otp");
      setDevOtp(r.devOtp || null);
      setInfo(r.devOtp ? "Dev mode: your OTP is shown below." : `OTP sent to ${email}. Check your inbox.`);
    } catch (e: any) {
      setError(e?.message || "Failed to send OTP");
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit OTP");
    setError(null);
    setBusy(true);
    try {
      // If we have firstName/password (real signup) → /auth/register.
      // Otherwise this is the legacy migration path → /auth/verify-otp.
      const isRealSignup = !!firstName && !!lastName && password.length >= 6;
      if (isRealSignup) {
        const data = await api<{ token: string; user: AuthUser }>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            code,
            password,
            phone: phone || undefined,
            firstName,
            lastName,
            referralCode: referralCode || undefined,
          }),
        });
        signIn(data.token, data.user);
        router.replace(data.user.role === "admin" ? "/admin" : "/dashboard");
      } else {
        const data = await api<{
          token: string;
          user: AuthUser;
          requiresPasswordSetup?: boolean;
        }>("/auth/verify-otp", {
          method: "POST",
          body: JSON.stringify({ email, code }),
        });
        signIn(data.token, data.user);
        if (data.requiresPasswordSetup) router.replace("/set-password");
        else router.replace(data.user.role === "admin" ? "/admin" : "/dashboard");
      }
    } catch (e: any) {
      setError(e?.message || "Could not complete sign-in");
    } finally {
      setBusy(false);
    }
  };

  /* ─────────── Forgot Password ─────────── */
  const requestForgotOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!EMAIL_RE.test(email)) return setError("Enter a valid email address");
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ delivered?: boolean; devOtp?: string; message: string }>(
        "/auth/forgot-password",
        { method: "POST", body: JSON.stringify({ email }) }
      );
      setForgotStep("reset");
      setDevOtp(r.devOtp || null);
      setInfo(r.message || "If an account exists, an OTP has been sent.");
    } catch (e: any) {
      setError(e?.message || "Could not send reset OTP");
    } finally {
      setBusy(false);
    }
  };

  const submitForgotReset = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit OTP");
    if (password.length < 6) return setError("New password must be at least 6 characters");
    setError(null);
    setBusy(true);
    try {
      const data = await api<{ token: string; user: AuthUser }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, code, password }),
      });
      signIn(data.token, data.user);
      router.replace(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (e: any) {
      setError(e?.message || "Could not reset password");
    } finally {
      setBusy(false);
    }
  };

  const heading = useMemo(() => {
    if (mode === "login") return { title: "Welcome back", sub: "Sign in to continue earning daily rewards." };
    if (mode === "signup") return { title: "Create your account", sub: "Join thousands earning daily on RupeeRise." };
    return { title: "Reset your password", sub: "We'll email you a code to set a new password." };
  }, [mode]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Link href="/" className="flex items-center justify-center gap-2 mb-6">
          <Logo size={28} />
          <div className="text-xl font-semibold gold-text">RupeeRise</div>
        </Link>

        <div className="glass rounded-3xl p-7">
          {/* Tab switcher (login vs signup) — hidden in forgot mode */}
          {mode !== "forgot" && (signupStep === "form") && (
            <div className="relative grid grid-cols-2 rounded-xl bg-black/40 border border-yellow-500/15 p-1 mb-5 text-sm">
              <motion.div
                layout
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-[var(--primary)]"
                style={{ left: mode === "login" ? 4 : "calc(50% + 0px)" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
              <button
                onClick={() => setMode("login")}
                className={`relative z-10 py-2 font-semibold transition ${mode === "login" ? "text-black" : "text-zinc-300 hover:text-white"}`}
              >
                Login
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`relative z-10 py-2 font-semibold transition ${mode === "signup" ? "text-black" : "text-zinc-300 hover:text-white"}`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Back arrow when deep in a multi-step flow */}
          {((mode === "signup" && signupStep === "otp") ||
            (mode === "forgot" && forgotStep === "reset") ||
            mode === "forgot") && (
            <button
              onClick={() => {
                if (mode === "forgot" && forgotStep === "reset") setForgotStep("email");
                else if (mode === "forgot") setMode("login");
                else if (mode === "signup" && signupStep === "otp") setSignupStep("form");
              }}
              className="text-xs text-zinc-400 hover:text-yellow-300 inline-flex items-center gap-1 mb-3"
            >
              <ArrowLeft size={12} /> Back
            </button>
          )}

          <h1 className="text-2xl font-semibold text-white">{heading.title}</h1>
          <p className="mt-1 text-sm text-zinc-300">{heading.sub}</p>

          <AnimatePresence mode="wait">
            {/* ━━━ LOGIN MODE ━━━ */}
            {mode === "login" && (
              <motion.form
                key="login-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={submitLogin}
                className="mt-5 space-y-4"
              >
                <EmailField email={email} setEmail={setEmail} />
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  show={showPwd}
                  toggleShow={() => setShowPwd((s) => !s)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  <KeyRound size={16} />
                  {busy ? "Signing in…" : "Sign in"}
                </button>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-zinc-400 hover:text-yellow-300 inline-flex items-center gap-1.5"
                  >
                    <HelpCircle size={12} /> Forgot password?
                  </button>
                  <button type="button" onClick={() => setMode("signup")} className="text-yellow-300/90 hover:underline">
                    Don't have an account? Sign Up →
                  </button>
                </div>
              </motion.form>
            )}

            {/* ━━━ SIGNUP MODE ━━━ */}
            {mode === "signup" && signupStep === "form" && (
              <motion.form
                key="signup-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={requestSignupOtp}
                className="mt-5 space-y-4"
              >
                <EmailField email={email} setEmail={setEmail} />

                <div className="grid grid-cols-2 gap-3">
                  <NamedField icon={<User size={14} />} label="First name">
                    <input
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, 40))}
                      placeholder="Aarav"
                      className="flex-1 bg-transparent py-3 text-white focus:outline-none capitalize"
                    />
                  </NamedField>
                  <NamedField icon={<User size={14} />} label="Last name">
                    <input
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, 40))}
                      placeholder="Sharma"
                      className="flex-1 bg-transparent py-3 text-white focus:outline-none capitalize"
                    />
                  </NamedField>
                </div>

                <NamedField icon={<Phone size={14} />} label="Mobile number" prefix="+91">
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit mobile"
                    className="flex-1 bg-transparent px-3 py-3 text-white focus:outline-none"
                  />
                </NamedField>

                <PasswordField
                  value={password}
                  onChange={setPassword}
                  show={showPwd}
                  toggleShow={() => setShowPwd((s) => !s)}
                  placeholder="Create a password (6+ chars)"
                  autoComplete="new-password"
                  hint="Make it memorable. You'll use this to log in next time."
                />

                <NamedField icon={<Gift size={16} />} label={<>Referral code <span className="text-zinc-500">(optional)</span></>}>
                  <input
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase().slice(0, 12))}
                    placeholder="RR123ABC"
                    className="flex-1 bg-transparent py-3 text-white focus:outline-none uppercase tracking-widest text-sm"
                  />
                </NamedField>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  <Mail size={16} />
                  {busy ? "Sending OTP…" : "Send Verification OTP"}
                </button>
                <div className="text-xs text-center">
                  <button type="button" onClick={() => setMode("login")} className="text-yellow-300/90 hover:underline">
                    ← Already have an account? Log in
                  </button>
                </div>
              </motion.form>
            )}

            {/* ━━━ SIGNUP / LEGACY OTP STEP ━━━ */}
            {mode === "signup" && signupStep === "otp" && (
              <motion.form
                key="signup-otp"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={submitSignup}
                className="mt-5 space-y-4"
              >
                <div className="text-sm text-zinc-300">
                  We sent a 6-digit code to <span className="gold-text font-medium">{email}</span>
                </div>

                {devOtp && <DevOtpCard code={devOtp} onTap={() => setCode(devOtp)} />}

                <OtpInput value={code} onChange={setCode} />

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={16} />
                  {busy ? "Verifying…" : firstName ? "Create Account" : "Verify & Continue"}
                </button>

                <button
                  type="button"
                  onClick={requestSignupOtp}
                  disabled={busy}
                  className="w-full text-xs text-yellow-400/80 hover:underline"
                >
                  Resend OTP
                </button>
              </motion.form>
            )}

            {/* ━━━ FORGOT — STEP 1: EMAIL ━━━ */}
            {mode === "forgot" && forgotStep === "email" && (
              <motion.form
                key="forgot-email"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={requestForgotOtp}
                className="mt-5 space-y-4"
              >
                <EmailField email={email} setEmail={setEmail} />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  <Mail size={16} />
                  {busy ? "Sending…" : "Send Reset Code"}
                </button>
                <div className="text-xs text-center text-zinc-400">
                  Remember your password?{" "}
                  <button type="button" onClick={() => setMode("login")} className="text-yellow-300/90 hover:underline">
                    Back to login
                  </button>
                </div>
              </motion.form>
            )}

            {/* ━━━ FORGOT — STEP 2: OTP + NEW PASSWORD ━━━ */}
            {mode === "forgot" && forgotStep === "reset" && (
              <motion.form
                key="forgot-reset"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onSubmit={submitForgotReset}
                className="mt-5 space-y-4"
              >
                <div className="text-sm text-zinc-300">
                  Code sent to <span className="gold-text font-medium">{email}</span>
                </div>

                {devOtp && <DevOtpCard code={devOtp} onTap={() => setCode(devOtp)} />}
                <OtpInput value={code} onChange={setCode} />

                <PasswordField
                  value={password}
                  onChange={setPassword}
                  show={showPwd}
                  toggleShow={() => setShowPwd((s) => !s)}
                  placeholder="Choose a new password"
                  autoComplete="new-password"
                />

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  {busy ? "Resetting…" : "Reset Password & Sign In"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {info && (
            <div className="mt-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-200">
              {info}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-zinc-400">
          By continuing, you agree to our{" "}
          <Link href="/" className="text-yellow-400/80 hover:underline">Terms</Link> &{" "}
          <Link href="/" className="text-yellow-400/80 hover:underline">Privacy Policy</Link>.
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Reusable bits ─── */

function EmailField({ email, setEmail }: { email: string; setEmail: (v: string) => void }) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-400 mb-1">Email address</div>
      <div className="flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-black/30 px-3 focus-within:border-yellow-500/50 transition">
        <Mail size={16} className="text-zinc-400" />
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
          placeholder="you@gmail.com"
          className="flex-1 bg-transparent py-3 text-white focus:outline-none"
          required
        />
      </div>
    </label>
  );
}

function PasswordField({
  value,
  onChange,
  show,
  toggleShow,
  placeholder,
  autoComplete,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  toggleShow: () => void;
  placeholder: string;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-400 mb-1">Password</div>
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
      {hint && <div className="mt-1 text-[11px] text-zinc-500">{hint}</div>}
    </label>
  );
}

function NamedField({
  icon,
  label,
  prefix,
  children,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  prefix?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-black/30 px-3 focus-within:border-yellow-500/50 transition overflow-hidden">
        <span className="text-zinc-400 inline-flex items-center gap-1.5">{icon}</span>
        {prefix && (
          <span className="px-2 py-3 text-zinc-400 border-r border-yellow-500/10 text-sm">{prefix}</span>
        )}
        {children}
      </div>
    </label>
  );
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-400 mb-1">6-digit OTP</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="••••••"
        className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-center tracking-[0.5em] text-white text-lg focus:outline-none focus:border-yellow-500/50"
        required
      />
    </label>
  );
}

function DevOtpCard({ code, onTap }: { code: string; onTap: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 to-yellow-500/0 p-4"
    >
      <div className="flex items-center gap-2 text-yellow-300 text-[10px] uppercase tracking-widest">
        <Sparkles size={12} /> Dev Mode — Your OTP
      </div>
      <button
        type="button"
        onClick={() => {
          onTap();
          navigator.clipboard?.writeText(code).catch(() => {});
        }}
        className="mt-1 w-full text-center font-mono text-3xl font-bold gold-text tracking-[0.5em] hover:scale-[1.02] transition"
        title="Tap to autofill"
      >
        {code}
      </button>
      <div className="mt-1 text-[10px] text-zinc-400 text-center">Tap the code to autofill below.</div>
    </motion.div>
  );
}
