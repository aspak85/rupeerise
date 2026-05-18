"use client";
import { useEffect, useState } from "react";
import {
  Bell,
  ExternalLink,
  HeadphonesIcon,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  UserCircle2,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";

type SupportContact = { kind: string; label: string; handle?: string; url: string; note?: string };
type SupportChannel = { label: string; url: string; icon?: string; note?: string };
type SupportConfig = { contacts: SupportContact[]; channels: SupportChannel[] };

const CONTACT_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  telegram: Send,
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
  other: HeadphonesIcon,
};

const CHANNEL_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  send: Send,
  bell: Bell,
  megaphone: Megaphone,
  users: Users,
  message: MessageCircle,
  shield: ShieldCheck,
  user: UserCircle2,
};

export default function SupportPage() {
  const [cfg, setCfg] = useState<SupportConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SupportConfig>("/support/config")
      .then(setCfg)
      .catch((e) => setError(e?.message || "Could not load support info"));
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full">
      <div>
        <div className="text-xs uppercase tracking-widest text-yellow-400/80">Help & Community</div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">We're here to help</h1>
        <p className="mt-1 text-sm text-zinc-300 max-w-2xl">
          Talk to a real human on Telegram or WhatsApp, or follow our official channels for daily
          updates, gift codes, and announcements.
        </p>
      </div>

      {error && <div className="glass rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>}
      {!cfg && !error && (
        <div className="text-center py-12 text-zinc-400 text-sm">
          <Loader2 className="inline-block animate-spin text-yellow-300" size={18} /> &nbsp;Loading…
        </div>
      )}

      {cfg && (
        <>
          {/* Contacts */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white">
              <HeadphonesIcon size={18} className="text-yellow-300" />
              <h2 className="font-semibold text-lg">Direct Support</h2>
            </div>
            {cfg.contacts.length === 0 ? (
              <EmptyBlock text="No support contacts available right now. Check back soon." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cfg.contacts.map((c, i) => {
                  const Icon = CONTACT_ICON[c.kind] || HeadphonesIcon;
                  return (
                    <a
                      key={i}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group glass rounded-2xl p-5 hover:border-yellow-500/40 transition border border-yellow-500/15 block"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-yellow-500/15 border border-yellow-500/30 p-3 shrink-0 group-hover:bg-yellow-500/20 transition">
                          <Icon className="text-yellow-300" size={22} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-white font-semibold flex items-center gap-1.5">
                            {c.label}
                            <ExternalLink size={13} className="text-zinc-500 group-hover:text-yellow-300 transition" />
                          </div>
                          {c.handle && <div className="text-xs text-yellow-300/90 font-mono truncate">{c.handle}</div>}
                          {c.note && <div className="mt-1 text-xs text-zinc-400">{c.note}</div>}
                        </div>
                      </div>
                      <div className="mt-3 inline-flex items-center gap-2 text-xs text-yellow-300/90 group-hover:text-yellow-200">
                        Open chat →
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>

          {/* Channels */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white">
              <Megaphone size={18} className="text-yellow-300" />
              <h2 className="font-semibold text-lg">Follow our Channels</h2>
              <span className="text-xs text-zinc-500">— for daily gift codes & news</span>
            </div>
            {cfg.channels.length === 0 ? (
              <EmptyBlock text="No channels published yet." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {cfg.channels.map((c, i) => {
                  const Icon = (c.icon && CHANNEL_ICON[c.icon.toLowerCase()]) || Megaphone;
                  return (
                    <a
                      key={i}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group glass rounded-2xl p-5 hover:border-yellow-500/40 transition border border-yellow-500/15 block"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-gradient-to-br from-yellow-500/30 to-amber-500/20 border border-yellow-500/40 p-3 shrink-0">
                          <Icon className="text-yellow-200" size={24} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-white font-semibold flex items-center gap-1.5">
                            {c.label}
                            <ExternalLink size={13} className="text-zinc-500 group-hover:text-yellow-300 transition" />
                          </div>
                          {c.note && <div className="mt-0.5 text-xs text-zinc-400">{c.note}</div>}
                          <div className="mt-2 text-xs text-yellow-300/90 truncate font-mono">{c.url}</div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>

          <section className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 text-white">
              <ShieldCheck size={18} className="text-yellow-300" />
              <h3 className="font-semibold">Stay safe</h3>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> RupeeRise will <strong>never</strong> ask for your password or OTP outside the app.</li>
              <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> Only trust the contacts and channels listed on this page — beware of impersonators.</li>
              <li className="flex items-start gap-2"><span className="text-yellow-300">•</span> Report suspicious behavior to the Admin contact above.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="glass rounded-2xl p-6 text-center text-sm text-zinc-400">{text}</div>;
}
