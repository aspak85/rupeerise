"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Star, StarOff, Save, X, QrCode, Edit2, Power } from "lucide-react";
import { api } from "@/lib/api";

type Channel = {
  id: string;
  kind: "upi" | "bank" | "crypto" | "other";
  label: string;
  value: string;
  payeeName: string;
  note: string | null;
  metaJson: string | null;
  active: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt?: string;
};

const EMPTY: Omit<Channel, "id"> = {
  kind: "upi",
  label: "",
  value: "",
  payeeName: "RupeeRise",
  note: null,
  metaJson: null,
  active: true,
  isDefault: false,
  sortOrder: 0,
};

export default function AdminPaymentChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [editing, setEditing] = useState<Channel | (Omit<Channel, "id"> & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ channels: Channel[] }>("/admin/payment-channels");
      setChannels(r.channels);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing({ ...EMPTY }); setErr(null); };
  const startEdit = (c: Channel) => { setEditing({ ...c }); setErr(null); };
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!editing) return;
    if (!editing.label.trim() || !editing.value.trim()) {
      setErr("Label and Value are required");
      return;
    }
    setBusy(true); setErr(null);
    try {
      if ("id" in editing && editing.id) {
        await api(`/admin/payment-channels/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(editing),
        });
        setToast("Channel updated");
      } else {
        await api("/admin/payment-channels", {
          method: "POST",
          body: JSON.stringify(editing),
        });
        setToast("Channel added");
      }
      setEditing(null);
      await load();
      setTimeout(() => setToast(null), 2000);
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (c: Channel) => {
    setBusy(true);
    try {
      await api(`/admin/payment-channels/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isDefault: true }),
      });
      await load();
    } finally { setBusy(false); }
  };

  const toggleActive = async (c: Channel) => {
    setBusy(true);
    try {
      await api(`/admin/payment-channels/${c.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !c.active }),
      });
      await load();
    } finally { setBusy(false); }
  };

  const remove = async (c: Channel) => {
    if (!window.confirm(`Delete channel "${c.label}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api(`/admin/payment-channels/${c.id}`, { method: "DELETE" });
      await load();
      setToast("Channel deleted");
      setTimeout(() => setToast(null), 2000);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-400/80">
            <QrCode size={12} /> Payment Channels
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold text-white">UPI / Bank / Crypto deposit channels</h1>
          <p className="mt-1 text-sm text-zinc-400 max-w-2xl">
            Add as many UPI IDs / bank accounts / crypto addresses as you want. The
            <span className="text-yellow-200 font-medium"> default</span> channel becomes the primary QR on the user wallet page; users can switch to any active channel.
          </p>
        </div>
        <button onClick={startNew} className="rounded-xl bg-[var(--primary)] px-4 py-2.5 font-semibold text-black hover:brightness-95 inline-flex items-center gap-2">
          <Plus size={16} /> Add channel
        </button>
      </div>

      {toast && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-200">{toast}</div>
      )}
      {err && !editing && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-200">{err}</div>
      )}

      {/* Editor sheet */}
      {editing && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-white">{(editing as Channel).id ? "Edit channel" : "New channel"}</div>
            <button onClick={cancel} className="text-zinc-400 hover:text-white" aria-label="Close"><X size={16} /></button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Kind">
              <select
                value={editing.kind}
                onChange={(e) => setEditing({ ...editing, kind: e.target.value as Channel["kind"] })}
                className="w-full rounded-lg border border-yellow-500/20 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50"
              >
                <option value="upi">UPI</option>
                <option value="bank">Bank account</option>
                <option value="crypto">Crypto</option>
                <option value="other">Other</option>
              </select>
            </Field>

            <Field label="Label (shown to users)">
              <input
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder='e.g. "Primary UPI (PhonePe)"'
                className="w-full rounded-lg border border-yellow-500/20 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50"
              />
            </Field>

            <Field label={editing.kind === "upi" ? "UPI VPA" : editing.kind === "bank" ? "Account number" : "Address / value"}>
              <input
                value={editing.value}
                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                placeholder={editing.kind === "upi" ? "yourname@hdfc" : "—"}
                className="w-full rounded-lg border border-yellow-500/20 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50"
              />
            </Field>

            <Field label="Payee name (in UPI deep link)">
              <input
                value={editing.payeeName}
                onChange={(e) => setEditing({ ...editing, payeeName: e.target.value })}
                className="w-full rounded-lg border border-yellow-500/20 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50"
              />
            </Field>

            <Field label="Sort order (lower = first)">
              <input
                type="number"
                value={editing.sortOrder}
                onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value || 0) })}
                className="w-full rounded-lg border border-yellow-500/20 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50"
              />
            </Field>

            <Field label="Note (optional)">
              <input
                value={editing.note ?? ""}
                onChange={(e) => setEditing({ ...editing, note: e.target.value || null })}
                placeholder="e.g. Use this for amounts above ₹10,000"
                className="w-full rounded-lg border border-yellow-500/20 bg-black/30 px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500/50"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2 text-zinc-200">
              <input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="accent-yellow-500" />
              Active (visible to users)
            </label>
            <label className="inline-flex items-center gap-2 text-zinc-200">
              <input type="checkbox" checked={editing.isDefault} onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })} className="accent-yellow-500" />
              Set as default
            </label>
          </div>

          {err && <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-200">{err}</div>}

          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="rounded-xl bg-[var(--primary)] px-4 py-2.5 font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center gap-2">
              <Save size={14} /> {busy ? "Saving…" : "Save"}
            </button>
            <button onClick={cancel} className="rounded-xl border border-yellow-500/30 px-4 py-2.5 text-sm text-zinc-200 hover:bg-yellow-500/10">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Channels list */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/40 text-zinc-400 text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-3">Kind</th>
                <th className="text-left px-4 py-3">Label</th>
                <th className="text-left px-4 py-3">Value</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-500/10 text-zinc-200">
              {channels.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No channels yet — add your first UPI ID above.</td></tr>
              )}
              {channels.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 capitalize">{c.kind}</td>
                  <td className="px-4 py-3">
                    <div className="text-white">{c.label}</div>
                    {c.note && <div className="text-[11px] text-zinc-500 mt-0.5">{c.note}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-yellow-200 text-xs break-all">{c.value}</td>
                  <td className="px-4 py-3 space-x-1.5">
                    {c.isDefault && <Pill tone="gold">Default</Pill>}
                    <Pill tone={c.active ? "emerald" : "zinc"}>{c.active ? "Active" : "Inactive"}</Pill>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                    {!c.isDefault && c.active && (
                      <IconBtn onClick={() => setDefault(c)} title="Set default" tone="gold"><Star size={12} /></IconBtn>
                    )}
                    {c.isDefault && <IconBtn disabled title="Already default"><StarOff size={12} /></IconBtn>}
                    <IconBtn onClick={() => toggleActive(c)} title={c.active ? "Deactivate" : "Activate"} tone={c.active ? "zinc" : "emerald"}><Power size={12} /></IconBtn>
                    <IconBtn onClick={() => startEdit(c)} title="Edit" tone="zinc"><Edit2 size={12} /></IconBtn>
                    <IconBtn onClick={() => remove(c)} title="Delete" tone="red"><Trash2 size={12} /></IconBtn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest text-zinc-400 mb-1">{label}</div>
      {children}
    </label>
  );
}

function Pill({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "gold" | "emerald" | "zinc" | "red" }) {
  const map = {
    gold: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    zinc: "bg-zinc-700/40 text-zinc-300 border-zinc-600",
    red: "bg-red-500/15 text-red-300 border-red-500/30",
  };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest border ${map[tone]}`}>{children}</span>;
}

function IconBtn({ children, onClick, title, tone = "zinc", disabled }: { children: React.ReactNode; onClick?: () => void; title: string; tone?: "gold" | "emerald" | "zinc" | "red"; disabled?: boolean }) {
  const map = {
    gold: "bg-yellow-500/15 border-yellow-500/30 text-yellow-200 hover:bg-yellow-500/25",
    emerald: "bg-emerald-500/15 border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/25",
    zinc: "bg-zinc-700/40 border-zinc-600 text-zinc-200 hover:bg-zinc-700/60",
    red: "bg-red-500/15 border-red-500/30 text-red-200 hover:bg-red-500/25",
  };
  return (
    <button title={title} onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs disabled:opacity-50 ${map[tone]}`}>
      {children}
    </button>
  );
}
