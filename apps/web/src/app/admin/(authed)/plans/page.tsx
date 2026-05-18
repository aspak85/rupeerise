"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Save, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { api, formatINR } from "@/lib/api";

type Plan = {
  id: string;
  name: string;
  price: number;
  dailyIncome: number;
  durationDays: number;
  active: boolean;
};

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [draft, setDraft] = useState<{ name: string; price: number; dailyIncome: number; durationDays: number }>({
    name: "",
    price: 0,
    dailyIncome: 0,
    durationDays: 30,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<{ plans: Plan[] }>("/admin/plans");
    setPlans(data.plans);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!draft.name || draft.price <= 0 || draft.dailyIncome <= 0) {
      setErr("Fill all fields with valid values");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api("/admin/plans", { method: "POST", body: JSON.stringify({ ...draft, active: true }) });
      setDraft({ name: "", price: 0, dailyIncome: 0, durationDays: 30 });
      await load();
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
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Deactivate this plan?")) return;
    await api(`/admin/plans/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div>
        <div className="text-xs uppercase tracking-widest text-yellow-400/80">Plans</div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Plan management</h1>
      </div>

      {/* Create */}
      <div className="glass rounded-2xl p-5">
        <h3 className="text-white font-semibold flex items-center gap-2"><Plus size={16} /> New Plan</h3>
        <div className="mt-4 grid sm:grid-cols-4 gap-3">
          <Field label="Name">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Diamond" className="w-full rounded-lg border border-yellow-500/20 bg-black/40 px-3 py-2 text-white" />
          </Field>
          <Field label="Price (₹)">
            <input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} className="w-full rounded-lg border border-yellow-500/20 bg-black/40 px-3 py-2 text-white" />
          </Field>
          <Field label="Daily Income (₹)">
            <input type="number" value={draft.dailyIncome} onChange={(e) => setDraft({ ...draft, dailyIncome: Number(e.target.value) })} className="w-full rounded-lg border border-yellow-500/20 bg-black/40 px-3 py-2 text-white" />
          </Field>
          <Field label="Duration (days)">
            <input type="number" value={draft.durationDays} onChange={(e) => setDraft({ ...draft, durationDays: Number(e.target.value) })} className="w-full rounded-lg border border-yellow-500/20 bg-black/40 px-3 py-2 text-white" />
          </Field>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            Total return: <span className="gold-text font-semibold">{formatINR(draft.dailyIncome * draft.durationDays)}</span>
          </div>
          <button disabled={busy} onClick={create} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-black">
            {busy ? "Saving…" : "Create Plan"}
          </button>
        </div>
        {err && <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-200">{err}</div>}
      </div>

      {/* Existing plans */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/40 text-zinc-400 text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">Daily</th>
                <th className="text-left px-4 py-3">Duration</th>
                <th className="text-left px-4 py-3">Total Return</th>
                <th className="text-left px-4 py-3">Active</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-500/10 text-zinc-200">
              {plans.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">No plans yet</td></tr>}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      {children}
    </label>
  );
}

function PlanRow({ plan, onPatch, onDelete }: { plan: Plan; onPatch: (id: string, patch: any) => void; onDelete: (id: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(plan.price);
  const [daily, setDaily] = useState(plan.dailyIncome);
  const [days, setDays] = useState(plan.durationDays);

  const save = () => {
    onPatch(plan.id, { name, price, dailyIncome: daily, durationDays: days });
    setEdit(false);
  };

  return (
    <tr>
      <td className="px-4 py-3 text-white">
        {edit ? <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-yellow-500/20 bg-black/40 px-2 py-1 text-white" /> : plan.name}
      </td>
      <td className="px-4 py-3 gold-text font-semibold">
        {edit ? <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-24 rounded border border-yellow-500/20 bg-black/40 px-2 py-1 text-white" /> : formatINR(plan.price)}
      </td>
      <td className="px-4 py-3">
        {edit ? <input type="number" value={daily} onChange={(e) => setDaily(Number(e.target.value))} className="w-24 rounded border border-yellow-500/20 bg-black/40 px-2 py-1 text-white" /> : formatINR(plan.dailyIncome)}
      </td>
      <td className="px-4 py-3">
        {edit ? <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-24 rounded border border-yellow-500/20 bg-black/40 px-2 py-1 text-white" /> : `${plan.durationDays}d`}
      </td>
      <td className="px-4 py-3">{formatINR((edit ? daily : plan.dailyIncome) * (edit ? days : plan.durationDays))}</td>
      <td className="px-4 py-3">
        <button onClick={() => onPatch(plan.id, { active: !plan.active })} className="text-xs flex items-center gap-1 text-zinc-300">
          {plan.active ? <ToggleRight size={18} className="text-emerald-400" /> : <ToggleLeft size={18} className="text-zinc-500" />}
          {plan.active ? "Active" : "Inactive"}
        </button>
      </td>
      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
        {edit ? (
          <button onClick={save} className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-2 py-1 text-xs font-semibold text-black">
            <Save size={12} /> Save
          </button>
        ) : (
          <button onClick={() => setEdit(true)} className="rounded-lg border border-yellow-500/20 px-2 py-1 text-xs hover:bg-yellow-500/10">Edit</button>
        )}
        <button onClick={() => onDelete(plan.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1 text-xs text-red-200 hover:bg-red-500/10">
          <Trash2 size={12} /> Deactivate
        </button>
      </td>
    </tr>
  );
}
