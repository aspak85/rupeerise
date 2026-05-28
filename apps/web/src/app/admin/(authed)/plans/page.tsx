"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Save, ToggleLeft, ToggleRight, Trash2, RefreshCw, TrendingUp, CheckCircle2 } from "lucide-react";
import { api, formatINR } from "@/lib/api";

type Plan = {
  id: string;
  name: string;
  price: number;
  dailyIncome: number;
  durationDays: number;
  active: boolean;
};

const EMPTY_DRAFT = { name: "", price: 0, dailyIncome: 0, durationDays: 30 };

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api<{ plans: Plan[] }>("/admin/plans");
      setPlans(data.plans);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showSync = (msg: string) => {
    setSyncMsg(msg);
    setTimeout(() => setSyncMsg(null), 3000);
  };

  const create = async () => {
    if (!draft.name.trim() || draft.price <= 0 || draft.dailyIncome <= 0 || draft.durationDays <= 0) {
      setErr("Sab fields fill karo — valid values chahiye");
      return;
    }
    setBusy(true); setErr(null);
    try {
      await api("/admin/plans", { method: "POST", body: JSON.stringify({ ...draft, active: true }) });
      setDraft(EMPTY_DRAFT);
      await load();
      showSync("✅ Plan created & live on platform!");
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const updatePlan = async (id: string, patch: Partial<Plan>) => {
    setBusy(true);
    try {
      await api(`/admin/plans/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await load();
      showSync("✅ Plan updated & synced to all users!");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Is plan ko deactivate karo?")) return;
    await api(`/admin/plans/${id}`, { method: "DELETE" });
    await load();
    showSync("Plan deactivated.");
  };

  const totalReturn = draft.dailyIncome * draft.durationDays;
  const roi = draft.price > 0 ? ((totalReturn / draft.price) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Plans</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Plan Management</h1>
          <p className="text-sm text-zinc-400 mt-1">Plans ka koi bhi change instantly platform pe reflect hota hai.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Sync notification */}
      {syncMsg && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-200 flex items-center gap-2">
          <CheckCircle2 size={16} /> {syncMsg}
        </div>
      )}

      {/* Create new plan */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-5">
          <Plus size={16} className="text-yellow-300" /> Naya Plan Banao
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Plan Name</div>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Diamond VIP" className="w-full rounded-xl border border-yellow-500/20 bg-black/40 px-3 py-2.5 text-white focus:outline-none focus:border-yellow-500/50" />
          </label>
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Plan Price (₹)</div>
            <input type="number" min={0} value={draft.price || ""} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
              placeholder="5000" className="w-full rounded-xl border border-yellow-500/20 bg-black/40 px-3 py-2.5 text-white focus:outline-none focus:border-yellow-500/50" />
          </label>
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Daily Income (₹)</div>
            <input type="number" min={0} value={draft.dailyIncome || ""} onChange={(e) => setDraft({ ...draft, dailyIncome: Number(e.target.value) })}
              placeholder="320" className="w-full rounded-xl border border-yellow-500/20 bg-black/40 px-3 py-2.5 text-white focus:outline-none focus:border-yellow-500/50" />
          </label>
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Duration (Days)</div>
            <input type="number" min={1} value={draft.durationDays || ""} onChange={(e) => setDraft({ ...draft, durationDays: Number(e.target.value) })}
              placeholder="60" className="w-full rounded-xl border border-yellow-500/20 bg-black/40 px-3 py-2.5 text-white focus:outline-none focus:border-yellow-500/50" />
          </label>
        </div>

        {/* Live ROI preview */}
        {draft.price > 0 && draft.dailyIncome > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-black/30 border border-yellow-500/10 p-3 text-center">
              <div className="text-xs text-zinc-400">Total Return</div>
              <div className="text-white font-bold mt-1">{formatINR(totalReturn)}</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-yellow-500/10 p-3 text-center">
              <div className="text-xs text-zinc-400">ROI</div>
              <div className="gold-text font-bold mt-1">{roi}%</div>
            </div>
            <div className="rounded-xl bg-black/30 border border-yellow-500/10 p-3 text-center">
              <div className="text-xs text-zinc-400">Daily %</div>
              <div className="text-emerald-300 font-bold mt-1">
                {draft.price > 0 ? ((draft.dailyIncome / draft.price) * 100).toFixed(2) : 0}%
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button disabled={busy} onClick={create}
            className="rounded-xl bg-[var(--primary)] px-5 py-2.5 font-semibold text-black hover:brightness-95 disabled:opacity-60 inline-flex items-center gap-2">
            <Plus size={16} /> {busy ? "Creating…" : "Create Plan & Go Live"}
          </button>
          {err && <div className="text-xs text-red-300">{err}</div>}
        </div>
      </div>

      {/* Plans table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-yellow-500/10 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <TrendingUp size={16} className="text-yellow-300" /> All Plans ({plans.length})
          </h3>
          <div className="text-xs text-zinc-400">Changes auto-sync to users</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/40 text-zinc-400 text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">Daily</th>
                <th className="text-left px-4 py-3">Days</th>
                <th className="text-left px-4 py-3">Total Return</th>
                <th className="text-left px-4 py-3">ROI</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-500/10 text-zinc-200">
              {loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">Loading…</td></tr>
              )}
              {!loading && plans.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500">Koi plan nahi — upar se banao</td></tr>
              )}
              {plans.map((p) => (
                <PlanRow key={p.id} plan={p} onPatch={updatePlan} onDelete={remove} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PlanRow({ plan, onPatch, onDelete }: { plan: Plan; onPatch: (id: string, patch: any) => void; onDelete: (id: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(plan.price);
  const [daily, setDaily] = useState(plan.dailyIncome);
  const [days, setDays] = useState(plan.durationDays);

  const totalReturn = (edit ? daily : plan.dailyIncome) * (edit ? days : plan.durationDays);
  const roi = plan.price > 0 ? ((totalReturn / (edit ? price : plan.price)) * 100).toFixed(1) : "0";

  const save = () => {
    onPatch(plan.id, { name, price, dailyIncome: daily, durationDays: days });
    setEdit(false);
  };

  return (
    <tr className={edit ? "bg-yellow-500/5" : ""}>
      <td className="px-4 py-3 text-white font-medium">
        {edit
          ? <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-yellow-500/30 bg-black/40 px-2 py-1.5 text-white w-32 focus:outline-none" />
          : plan.name}
      </td>
      <td className="px-4 py-3 gold-text font-semibold">
        {edit
          ? <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-24 rounded-lg border border-yellow-500/30 bg-black/40 px-2 py-1.5 text-white focus:outline-none" />
          : formatINR(plan.price)}
      </td>
      <td className="px-4 py-3">
        {edit
          ? <input type="number" value={daily} onChange={(e) => setDaily(Number(e.target.value))} className="w-24 rounded-lg border border-yellow-500/30 bg-black/40 px-2 py-1.5 text-white focus:outline-none" />
          : formatINR(plan.dailyIncome)}
      </td>
      <td className="px-4 py-3">
        {edit
          ? <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-20 rounded-lg border border-yellow-500/30 bg-black/40 px-2 py-1.5 text-white focus:outline-none" />
          : `${plan.durationDays}d`}
      </td>
      <td className="px-4 py-3 text-zinc-300">{formatINR(totalReturn)}</td>
      <td className="px-4 py-3">
        <span className="text-emerald-300 font-semibold">{roi}%</span>
      </td>
      <td className="px-4 py-3">
        <button onClick={() => onPatch(plan.id, { active: !plan.active })}
          className="flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border transition"
          style={{ borderColor: plan.active ? "rgba(52,211,153,0.3)" : "rgba(113,113,122,0.4)", color: plan.active ? "#6ee7b7" : "#a1a1aa" }}>
          {plan.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {plan.active ? "Active" : "Inactive"}
        </button>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {edit ? (
            <>
              <button onClick={save} className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-black">
                <Save size={12} /> Save
              </button>
              <button onClick={() => { setEdit(false); setName(plan.name); setPrice(plan.price); setDaily(plan.dailyIncome); setDays(plan.durationDays); }}
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setEdit(true)} className="rounded-lg border border-yellow-500/30 px-3 py-1.5 text-xs text-yellow-200 hover:bg-yellow-500/10">
              Edit
            </button>
          )}
          <button onClick={() => onDelete(plan.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10">
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}
