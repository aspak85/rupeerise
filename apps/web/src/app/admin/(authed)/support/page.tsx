"use client";
import { useCallback, useEffect, useState } from "react";
import { HeadphonesIcon, Loader2, Megaphone, MessageCircle, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

type SupportContact = { kind: string; label: string; handle?: string; url: string; note?: string };
type SupportChannel = { label: string; url: string; icon?: string; note?: string };
type SupportConfig = { contacts: SupportContact[]; channels: SupportChannel[] };

const KIND_OPTIONS = ["telegram", "whatsapp", "email", "phone", "other"];

export default function AdminSupportPage() {
  const [cfg, setCfg] = useState<SupportConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<SupportConfig>("/admin/support/config");
      setCfg(r);
    } catch (e: any) {
      setError(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      await api("/admin/support/config", { method: "PUT", body: JSON.stringify(cfg) });
      setOkMsg("Saved. Users will see updates within ~30s.");
      setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm("Restore default support config?")) return;
    setSaving(true);
    try {
      const r = await api<{ config: SupportConfig }>("/admin/support/reset", { method: "POST" });
      setCfg(r.config);
      setOkMsg("Defaults restored.");
      setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Reset failed");
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) {
    return (
      <div className="max-w-3xl mx-auto p-10 text-center text-zinc-400 text-sm">
        {loading ? "Loading…" : error || "Loading config…"}
      </div>
    );
  }

  /* Contact helpers */
  const updateContact = (i: number, patch: Partial<SupportContact>) => {
    setCfg({ ...cfg, contacts: cfg.contacts.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  };
  const addContact = () => {
    if (cfg.contacts.length >= 10) return;
    setCfg({ ...cfg, contacts: [...cfg.contacts, { kind: "telegram", label: "New Contact", url: "https://t.me/" }] });
  };
  const removeContact = (i: number) => {
    setCfg({ ...cfg, contacts: cfg.contacts.filter((_, idx) => idx !== i) });
  };

  /* Channel helpers */
  const updateChannel = (i: number, patch: Partial<SupportChannel>) => {
    setCfg({ ...cfg, channels: cfg.channels.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  };
  const addChannel = () => {
    if (cfg.channels.length >= 10) return;
    setCfg({ ...cfg, channels: [...cfg.channels, { label: "New Channel", url: "https://t.me/" }] });
  };
  const removeChannel = (i: number) => {
    setCfg({ ...cfg, channels: cfg.channels.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Support & Channels</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Configure user support</h1>
          <p className="mt-1 text-sm text-zinc-400">
            <strong>Contacts</strong> are 1-on-1 chat links (Telegram bot, agent, admin). <strong>Channels</strong> are
            broadcast feeds users follow for announcements & gift code drops.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-lg border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10 inline-flex items-center gap-2">
            <RefreshCw size={14} /> Reload
          </button>
          <button onClick={reset} className="rounded-lg border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10">Reset</button>
          <button onClick={save} disabled={saving} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {okMsg && <div className="glass rounded-xl px-4 py-2 text-emerald-300 text-sm">{okMsg}</div>}
      {error && <div className="glass rounded-xl px-4 py-2 text-red-300 text-sm">{error}</div>}

      {/* Contacts */}
      <section className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white">
            <HeadphonesIcon size={18} className="text-yellow-300" />
            <h2 className="font-semibold text-lg">Support Contacts</h2>
            <span className="text-xs text-zinc-500">({cfg.contacts.length}/10)</span>
          </div>
          <button onClick={addContact} disabled={cfg.contacts.length >= 10} className="text-yellow-300 hover:text-yellow-200 disabled:opacity-30 text-sm inline-flex items-center gap-1">
            <Plus size={14} /> Add contact
          </button>
        </div>

        <div className="space-y-3">
          {cfg.contacts.map((c, i) => (
            <div key={i} className="rounded-xl border border-yellow-500/15 bg-black/20 p-4 grid gap-3 md:grid-cols-12">
              <Field label="Type" className="md:col-span-2">
                <select value={c.kind} onChange={(e) => updateContact(i, { kind: e.target.value })} className="input w-full">
                  {KIND_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </Field>
              <Field label="Label" className="md:col-span-3">
                <input value={c.label} onChange={(e) => updateContact(i, { label: e.target.value })} placeholder="Telegram Support Bot" className="input w-full" />
              </Field>
              <Field label="Handle (optional)" className="md:col-span-2">
                <input value={c.handle || ""} onChange={(e) => updateContact(i, { handle: e.target.value })} placeholder="@rupeerise_bot" className="input w-full" />
              </Field>
              <Field label="URL" className="md:col-span-4">
                <input value={c.url} onChange={(e) => updateContact(i, { url: e.target.value })} placeholder="https://t.me/rupeerise_support" className="input w-full font-mono text-xs" />
              </Field>
              <div className="md:col-span-1 flex items-end justify-end">
                <button onClick={() => removeContact(i)} className="text-zinc-400 hover:text-red-300 p-2"><Trash2 size={16} /></button>
              </div>
              <Field label="Note (optional)" className="md:col-span-12">
                <input value={c.note || ""} onChange={(e) => updateContact(i, { note: e.target.value })} placeholder="Online 9am–11pm IST" className="input w-full" />
              </Field>
            </div>
          ))}
          {cfg.contacts.length === 0 && (
            <div className="text-center text-sm text-zinc-400 py-6">No contacts yet. Add one to let users reach you.</div>
          )}
        </div>
      </section>

      {/* Channels */}
      <section className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white">
            <Megaphone size={18} className="text-yellow-300" />
            <h2 className="font-semibold text-lg">Broadcast Channels</h2>
            <span className="text-xs text-zinc-500">({cfg.channels.length}/10)</span>
          </div>
          <button onClick={addChannel} disabled={cfg.channels.length >= 10} className="text-yellow-300 hover:text-yellow-200 disabled:opacity-30 text-sm inline-flex items-center gap-1">
            <Plus size={14} /> Add channel
          </button>
        </div>

        <div className="space-y-3">
          {cfg.channels.map((c, i) => (
            <div key={i} className="rounded-xl border border-yellow-500/15 bg-black/20 p-4 grid gap-3 md:grid-cols-12">
              <Field label="Label" className="md:col-span-4">
                <input value={c.label} onChange={(e) => updateChannel(i, { label: e.target.value })} placeholder="RupeeRise Official" className="input w-full" />
              </Field>
              <Field label="URL" className="md:col-span-5">
                <input value={c.url} onChange={(e) => updateChannel(i, { url: e.target.value })} placeholder="https://t.me/rupeerise_official" className="input w-full font-mono text-xs" />
              </Field>
              <Field label="Icon (lucide name)" className="md:col-span-2">
                <input value={c.icon || ""} onChange={(e) => updateChannel(i, { icon: e.target.value })} placeholder="send" className="input w-full" />
              </Field>
              <div className="md:col-span-1 flex items-end justify-end">
                <button onClick={() => removeChannel(i)} className="text-zinc-400 hover:text-red-300 p-2"><Trash2 size={16} /></button>
              </div>
              <Field label="Note (optional)" className="md:col-span-12">
                <input value={c.note || ""} onChange={(e) => updateChannel(i, { note: e.target.value })} placeholder="Daily announcements & gift codes" className="input w-full" />
              </Field>
            </div>
          ))}
          {cfg.channels.length === 0 && (
            <div className="text-center text-sm text-zinc-400 py-6">No channels yet. Add Telegram/WhatsApp channels users can follow.</div>
          )}
        </div>
      </section>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 text-white">
          <MessageCircle size={18} className="text-yellow-300" />
          <h3 className="font-semibold">Quick reference</h3>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-zinc-400">
          <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> Telegram: <code className="text-yellow-200">https://t.me/yourname</code></li>
          <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> WhatsApp: <code className="text-yellow-200">https://wa.me/91xxxxxxxxxx</code></li>
          <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> Email: <code className="text-yellow-200">mailto:you@domain.com</code></li>
          <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> Phone: <code className="text-yellow-200">tel:+91xxxxxxxxxx</code></li>
        </ul>
      </div>

      <style jsx>{`
        .input {
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 215, 0, 0.2);
          color: white;
          border-radius: 10px;
          padding: 0.5rem 0.7rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus { border-color: rgba(255, 215, 0, 0.55); }
      `}</style>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className || ""}`}>
      <div className="text-[11px] uppercase tracking-widest text-zinc-400 mb-1">{label}</div>
      {children}
    </label>
  );
}
