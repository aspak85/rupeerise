"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, CreditCard, Check, X, AlertTriangle, Copy, Send, Settings as SettingsIcon, ExternalLink, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type SettingsStatus = {
  smtp: {
    configured: boolean;
    host: string | null;
    port: number;
    user: string | null;
    mailFrom: string;
    vendor: "gmail" | "brevo" | "sendgrid" | "mailtrap" | "other" | null;
  };
  razorpay: {
    configured: boolean;
    keyId: string | null;
    mode: "live" | "test" | null;
  };
  admins: string[];
};

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api<SettingsStatus>("/admin/settings/status");
    setStatus(r);
    if (!testTo && user?.email) setTestTo(user.email);
  }, [testTo, user?.email]);

  useEffect(() => { load(); }, [load]);

  const testMail = async () => {
    if (!testTo) return;
    setBusy(true); setResult(null);
    try {
      const r = await api<{ ok: boolean; delivered: boolean; message: string }>("/admin/settings/test-mail", {
        method: "POST",
        body: JSON.stringify({ to: testTo }),
      });
      setResult({ ok: r.delivered, msg: r.message });
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message || "Send failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-400/80">
          <SettingsIcon size={12} /> Platform Settings
        </div>
        <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-white">Integrations & configuration</h1>
        <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
          These are <span className="text-yellow-200 font-medium">platform-wide</span> settings configured <span className="text-yellow-200 font-medium">once</span>.
          End users <span className="text-emerald-300 font-medium">never need to do this</span> — they just sign up with their Gmail and receive OTP through the mail server you configure here.
        </p>
      </div>

      {/* SMTP / Email OTP */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-white">
            <Mail size={18} className="text-yellow-300" />
            <h3 className="font-semibold">Email OTP delivery (SMTP)</h3>
          </div>
          <StatusPill ok={!!status?.smtp.configured} okLabel="Configured" failLabel="Not configured" />
        </div>

        {status?.smtp.configured ? (
          <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm text-zinc-300">
            <KV k="Host"      v={`${status.smtp.host}:${status.smtp.port}`} />
            <KV k="From"      v={status.smtp.mailFrom} />
            <KV k="User"      v={status.smtp.user ?? "—"} />
            <KV k="Vendor"    v={status.smtp.vendor ?? "other"} />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-zinc-200">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-yellow-300 mt-0.5 shrink-0" />
              <div>
                Without SMTP, OTPs are <span className="text-yellow-200">printed in the API terminal only</span> (dev mode).
                Configure ANY ONE of the providers below to actually deliver OTPs to user inboxes.
                <span className="block mt-1 text-zinc-400">You do this <span className="text-emerald-300 font-medium">once</span>, then every new signup automatically receives an OTP email.</span>
              </div>
            </div>
          </div>
        )}

        {/* Test mail */}
        <div className="mt-5">
          <div className="text-xs text-zinc-400 mb-1">Send a test mail</div>
          <div className="flex flex-wrap gap-2">
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value.trim().toLowerCase())}
              placeholder="you@gmail.com"
              className="flex-1 min-w-[180px] rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-500/50"
            />
            <button
              onClick={testMail}
              disabled={busy || !testTo}
              className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center gap-2"
            >
              <Send size={14} /> {busy ? "Sending…" : "Send test"}
            </button>
          </div>
          {result && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-xs border ${
              result.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                : "bg-yellow-500/10 border-yellow-500/30 text-yellow-200"
            }`}>{result.msg}</div>
          )}
        </div>

        {/* Setup guides — collapsible */}
        <div className="mt-6 space-y-3">
          <SetupGuide
            title="Option 1 — Gmail (free, 500/day)"
            recommended
            steps={[
              "Sign in to your Google account and enable 2-Step Verification (myaccount.google.com → Security).",
              "Open https://myaccount.google.com/apppasswords, create a 16-character App Password named 'RupeeRise'.",
              "Edit apps/api/.env with these 5 lines:",
            ]}
            envSnippet={[
              `SMTP_HOST="smtp.gmail.com"`,
              `SMTP_PORT="587"`,
              `SMTP_USER="your.real@gmail.com"`,
              `SMTP_PASS="<16-char app password>"`,
              `MAIL_FROM="RupeeRise <your.real@gmail.com>"`,
            ]}
            link="https://myaccount.google.com/apppasswords"
            linkLabel="Open Gmail App Passwords"
          />
          <SetupGuide
            title="Option 2 — Brevo (free, 300/day, easier than Gmail)"
            steps={[
              "Sign up free at brevo.com (formerly Sendinblue) and verify your sender email.",
              "Go to SMTP & API → SMTP, copy your SMTP login + password (master key).",
              "Edit apps/api/.env:",
            ]}
            envSnippet={[
              `SMTP_HOST="smtp-relay.brevo.com"`,
              `SMTP_PORT="587"`,
              `SMTP_USER="your-brevo-login@example.com"`,
              `SMTP_PASS="<brevo SMTP master key>"`,
              `MAIL_FROM="RupeeRise <your-verified-sender@example.com>"`,
            ]}
            link="https://app.brevo.com/settings/keys/smtp"
            linkLabel="Open Brevo SMTP keys"
          />
          <div className="text-xs text-zinc-500">
            After saving <code className="text-yellow-300/80">.env</code>, the API restarts automatically (tsx watch). Reload this page and click <span className="text-yellow-200">Send test</span> to confirm.
          </div>
        </div>
      </motion.div>

      {/* Razorpay */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-white">
            <CreditCard size={18} className="text-yellow-300" />
            <h3 className="font-semibold">Razorpay (instant card / UPI deposits)</h3>
          </div>
          <StatusPill
            ok={!!status?.razorpay.configured}
            okLabel={status?.razorpay.mode === "live" ? "LIVE mode" : "TEST mode"}
            failLabel="Not configured"
          />
        </div>

        {status?.razorpay.configured ? (
          <div className="mt-4 text-sm text-zinc-300">
            Key ID: <code className="text-yellow-200">{status.razorpay.keyId}</code>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-zinc-200">
            Without keys, users see <span className="text-yellow-200">manual UTR + UPI QR</span> only.
            Configure Razorpay to enable instant card/UPI deposits with auto-credit.
          </div>
        )}

        <div className="mt-5">
          <SetupGuide
            title="Razorpay setup (5 min)"
            recommended
            steps={[
              "Sign up free at dashboard.razorpay.com (no docs needed for test mode).",
              "Settings → API Keys → Generate Test Key. Copy both Key Id and Key Secret.",
              "Edit apps/api/.env with the test keys:",
            ]}
            envSnippet={[
              `RAZORPAY_KEY_ID="rzp_test_XXXXXXXXXXXX"`,
              `RAZORPAY_KEY_SECRET="<key secret>"`,
            ]}
            link="https://dashboard.razorpay.com/app/keys"
            linkLabel="Open Razorpay API Keys"
          />
          <div className="mt-3 text-xs text-zinc-500">
            For real money, replace with live keys (<code className="text-yellow-300/80">rzp_live_*</code>) after KYC approval from Razorpay.
          </div>
        </div>
      </motion.div>

      {/* Admins */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-3xl p-6">
        <div className="flex items-center gap-2 text-white">
          <ShieldCheck size={18} className="text-yellow-300" />
          <h3 className="font-semibold">Admin accounts</h3>
        </div>
        <p className="mt-1 text-sm text-zinc-300">
          Any email listed in <code className="text-yellow-300/80">ADMIN_EMAILS</code> is auto-promoted to admin on login (comma-separated).
        </p>
        <ul className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
          {(status?.admins ?? []).map((e) => (
            <li key={e} className="rounded-lg border border-yellow-500/15 bg-black/30 px-3 py-2 text-yellow-200 break-all">{e}</li>
          ))}
          {(!status || status.admins.length === 0) && (
            <li className="text-zinc-500">None configured. Edit ADMIN_EMAILS in apps/api/.env to add admins.</li>
          )}
        </ul>
      </motion.div>
    </div>
  );
}

function StatusPill({ ok, okLabel, failLabel }: { ok: boolean; okLabel: string; failLabel: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${
      ok ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
    }`}>
      {ok ? <Check size={10} /> : <X size={10} />} {ok ? okLabel : failLabel}
    </span>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-yellow-500/10 bg-black/30 p-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-400">{k}</div>
      <div className="mt-0.5 font-medium text-white break-all text-sm">{v}</div>
    </div>
  );
}

function SetupGuide({
  title, recommended, steps, envSnippet, link, linkLabel,
}: {
  title: string;
  recommended?: boolean;
  steps: string[];
  envSnippet: string[];
  link: string;
  linkLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const snippetText = envSnippet.join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippetText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <details className="group rounded-2xl border border-yellow-500/15 bg-black/30 overflow-hidden">
      <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-white">
          <span className="font-semibold">{title}</span>
          {recommended && <span className="text-[10px] uppercase tracking-widest rounded-full bg-yellow-500/15 text-yellow-300 px-2 py-0.5 border border-yellow-500/30">recommended</span>}
        </div>
        <span className="text-xs text-yellow-300/80 group-open:rotate-180 transition">▾</span>
      </summary>
      <div className="px-4 pb-4 space-y-3 border-t border-yellow-500/10">
        <ol className="mt-3 space-y-1 text-sm text-zinc-300 list-decimal list-inside">
          {steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <div className="relative rounded-xl border border-yellow-500/15 bg-black/60 p-3 font-mono text-xs text-zinc-200 whitespace-pre overflow-x-auto">
          {snippetText}
          <button
            onClick={copy}
            className={`absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition ${
              copied ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-200 hover:bg-yellow-500/20"
            }`}
          >
            {copied ? <><Check size={10}/> Copied</> : <><Copy size={10}/> Copy</>}
          </button>
        </div>
        <a href={link} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-xs text-yellow-300 hover:underline">
          <ExternalLink size={12} /> {linkLabel}
        </a>
      </div>
    </details>
  );
}
