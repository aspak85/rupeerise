"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Gift, Loader2, Plus, RefreshCw, Trash2, ToggleLeft, ToggleRight, Users } from "lucide-react";
import { api, formatINR } from "@/lib/api";

type GiftCode = {
  id: string;
  code: string;
  amount: number;
  maxClaims: number;
  claimsCount: number;
  remaining: number;
  expiresAt: string | null;
  status: "active" | "disabled" | "exhausted";
  notes: string | null;
  createdAt: string;
};

type Claim = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  amount: number;
  claimedAt: string;
};

export default function AdminGiftCodesPage() {
  const [codes, setCodes] = useState<GiftCode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyId, setCopyId] = useState<string | null>(null);
  const [openClaims, setOpenClaims] = useState<{ id: string; code: string; claims: Claim[] | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ codes: GiftCode[] }>("/admin/gift-codes");
      setCodes(r.codes);
    } catch (e: any) {
      setError(e?.message || "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    if (!codes) return { active: 0, total: 0, totalIssued: 0, totalClaimed: 0 };
    return {
      active: codes.filter((c) => c.status === "active").length,
      total: codes.length,
      totalIssued: codes.reduce((s, c) => s + c.amount * c.maxClaims, 0),
      totalClaimed: codes.reduce((s, c) => s + c.amount * c.claimsCount, 0),
    };
  }, [codes]);

  const copy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyId(id);
      setTimeout(() => setCopyId(null), 1500);
    } catch {}
  };

  const toggleStatus = async (g: GiftCode) => {
    const next = g.status === "active" ? "disabled" : "active";
    try {
      await api(`/admin/gift-codes/${g.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      load();
    } catch (e: any) {
      alert(e?.message || "Update failed");
    }
  };

  const remove = async (g: GiftCode) => {
    if (!confirm(`Delete code ${g.code}? This cannot be undone.`)) return;
    try {
      await api(`/admin/gift-codes/${g.id}`, { method: "DELETE" });
      load();
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  };

  const openClaimsList = async (g: GiftCode) => {
    setOpenClaims({ id: g.id, code: g.code, claims: null });
    try {
      const r = await api<{ claims: Claim[] }>(`/admin/gift-codes/${g.id}/claims`);
      setOpenClaims({ id: g.id, code: g.code, claims: r.claims });
    } catch {
      setOpenClaims({ id: g.id, code: g.code, claims: [] });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Promo / Gift Codes</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Issue gift codes any user can redeem</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Each code credits the recipient's <span className="gold-text font-semibold">Bonus Wallet</span>.
            Single-use by default; bump <em>Max Claims</em> for mass campaigns.
          </p>
        </div>
        <button onClick={load} className="rounded-lg border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10 inline-flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active codes" value={String(stats.active)} hint={`of ${stats.total} total`} />
        <StatCard label="Codes issued (₹)" value={formatINR(stats.totalIssued)} hint="if all claimed" />
        <StatCard label="Claimed so far (₹)" value={formatINR(stats.totalClaimed)} />
        <StatCard label="Currency" value="INR (Bonus Wallet)" />
      </div>

      <CreateForm onCreated={load} />

      {/* List */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-yellow-500/10 flex items-center justify-between">
          <div className="text-sm text-zinc-300 flex items-center gap-2">
            <Gift size={16} className="text-yellow-300" />
            <span>All codes</span>
          </div>
          {loading && <Loader2 size={14} className="text-yellow-300 animate-spin" />}
        </div>
        {error && <div className="px-5 py-4 text-red-300 text-sm">{error}</div>}
        {!error && codes && codes.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-zinc-400">No codes yet. Create your first one above.</div>
        )}
        {codes && codes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-widest text-yellow-300/80 bg-black/30">
                <tr>
                  <th className="text-left px-4 py-2.5">Code</th>
                  <th className="text-right px-4 py-2.5">Amount</th>
                  <th className="text-center px-4 py-2.5">Claims</th>
                  <th className="text-center px-4 py-2.5">Expiry</th>
                  <th className="text-center px-4 py-2.5">Status</th>
                  <th className="text-left px-4 py-2.5">Notes</th>
                  <th className="text-right px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((g) => (
                  <tr key={g.id} className="border-t border-white/5">
                    <td className="px-4 py-2.5">
                      <button onClick={() => copy(g.id, g.code)} className="font-mono text-yellow-200 inline-flex items-center gap-1.5 hover:text-yellow-100">
                        {g.code}
                        {copyId === g.id ? <span className="text-emerald-300 text-[10px]">✓ copied</span> : <Copy size={12} className="opacity-60" />}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right text-white">{formatINR(g.amount)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => openClaimsList(g)} className="inline-flex items-center gap-1 text-zinc-200 hover:text-yellow-200" title="View claims">
                        <span>{g.claimsCount}/{g.maxClaims}</span>
                        <Users size={12} className="opacity-60" />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-center text-zinc-400 text-xs">
                      {g.expiresAt ? new Date(g.expiresAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <StatusBadge status={g.status} />
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 text-xs max-w-[200px] truncate" title={g.notes || ""}>{g.notes || "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => toggleStatus(g)}
                          className="text-zinc-400 hover:text-yellow-200"
                          title={g.status === "active" ? "Disable" : "Enable"}
                          disabled={g.status === "exhausted"}
                        >
                          {g.status === "active" ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        <button onClick={() => remove(g)} className="text-zinc-400 hover:text-red-300" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Claims modal */}
      {openClaims && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4" onClick={() => setOpenClaims(null)}>
          <div className="glass rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-yellow-500/10 flex items-center justify-between">
              <div className="font-mono text-yellow-200">{openClaims.code} · claims</div>
              <button onClick={() => setOpenClaims(null)} className="text-zinc-400 hover:text-white">×</button>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
              {!openClaims.claims && <div className="p-6 text-center text-sm text-zinc-400">Loading…</div>}
              {openClaims.claims?.length === 0 && <div className="p-6 text-center text-sm text-zinc-400">No claims yet.</div>}
              {openClaims.claims && openClaims.claims.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-widest text-yellow-300/80 bg-black/30">
                    <tr>
                      <th className="text-left px-4 py-2.5">User</th>
                      <th className="text-right px-4 py-2.5">Amount</th>
                      <th className="text-right px-4 py-2.5">Claimed at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openClaims.claims.map((c) => (
                      <tr key={c.id} className="border-t border-white/5">
                        <td className="px-4 py-2.5">
                          <div className="text-white">{c.userName || c.userEmail || c.userId}</div>
                          {c.userName && c.userEmail && <div className="text-xs text-zinc-500">{c.userEmail}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-white">{formatINR(c.amount)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-zinc-400">{new Date(c.claimedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-yellow-400/80">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-400">{hint}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: GiftCode["status"] }) {
  const cls =
    status === "active" ? "bg-emerald-500/15 text-emerald-300" :
    status === "disabled" ? "bg-zinc-700/40 text-zinc-300" :
    "bg-amber-500/15 text-amber-300";
  return (
    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full ${cls}`}>{status}</span>
  );
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(true);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("100");
  const [maxClaims, setMaxClaims] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const body: any = {
        amount: Number(amount),
        maxClaims: Number(maxClaims),
      };
      if (code.trim()) body.code = code.trim().toUpperCase();
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      if (notes.trim()) body.notes = notes.trim();
      const r = await api<{ ok: true; code: { code: string } }>("/admin/gift-codes", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setLast(r.code.code);
      setCode("");
      setNotes("");
      onCreated();
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-2xl">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-3 flex items-center justify-between text-left">
        <div className="flex items-center gap-2 text-white">
          <Plus size={16} className="text-yellow-300" />
          <span className="font-semibold">Create new gift code</span>
        </div>
        <span className="text-zinc-400 text-sm">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <form onSubmit={submit} className="px-5 pb-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Amount (₹)" required>
            <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required className="input" />
          </Field>
          <Field label="Max claims">
            <input type="number" min={1} value={maxClaims} onChange={(e) => setMaxClaims(e.target.value)} className="input" />
          </Field>
          <Field label="Custom code (optional)" hint="A-Z 0-9 dashes; auto-generated if blank">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="DIWALI100" className="input font-mono" />
          </Field>
          <Field label="Expiry (optional)">
            <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="input" />
          </Field>
          <Field label="Notes (internal only)" hint="Visible only to admins">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Diwali campaign 2025" className="input" />
          </Field>
          <div className="md:col-span-2 lg:col-span-3 flex items-end gap-3">
            <button type="submit" disabled={busy} className="rounded-xl bg-[var(--primary)] px-5 py-2.5 font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center gap-2">
              {busy && <Loader2 size={14} className="animate-spin" />}
              {busy ? "Creating…" : "Create code"}
            </button>
            {last && (
              <div className="text-xs text-emerald-300">
                Created <span className="font-mono text-emerald-200">{last}</span> ✓
              </div>
            )}
            {err && <div className="text-xs text-red-300">{err}</div>}
          </div>
        </form>
      )}
      <style jsx>{`
        .input {
          width: 100%;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 215, 0, 0.2);
          color: white;
          border-radius: 10px;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: rgba(255, 215, 0, 0.55);
        }
      `}</style>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest text-zinc-400 mb-1">
        {label} {required && <span className="text-yellow-400">*</span>}
      </div>
      {children}
      {hint && <div className="text-[11px] text-zinc-500 mt-1">{hint}</div>}
    </label>
  );
}
