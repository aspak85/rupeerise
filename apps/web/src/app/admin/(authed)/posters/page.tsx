"use client";
import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Save, Trash2, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";

type Poster = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  gradient: string;
  ctaHref: string | null;
  ctaLabel: string | null;
  active: boolean;
  sortOrder: number;
};

const GRADIENTS = [
  { label: "Gold", value: "from-yellow-500/40 via-amber-500/15 to-transparent" },
  { label: "Emerald", value: "from-emerald-500/40 via-green-500/15 to-transparent" },
  { label: "Fuchsia", value: "from-fuchsia-500/40 via-pink-500/15 to-transparent" },
  { label: "Sky", value: "from-sky-500/40 via-blue-500/15 to-transparent" },
  { label: "Rose", value: "from-rose-500/40 via-red-500/15 to-transparent" },
];

const empty = (): Partial<Poster> => ({
  title: "",
  subtitle: "",
  imageUrl: "",
  gradient: GRADIENTS[0].value,
  ctaHref: "",
  ctaLabel: "",
  active: true,
  sortOrder: 0,
});

export default function AdminPostersPage() {
  const [posters, setPosters] = useState<Poster[]>([]);
  const [draft, setDraft] = useState<Partial<Poster>>(empty());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ posters: Poster[] }>("/admin/posters");
      setPosters(r.posters);
    } catch (e: any) {
      setToast({ kind: "err", msg: e?.message || "Failed to load posters" });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!draft.title?.trim()) {
      setToast({ kind: "err", msg: "Title is required" });
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await api(`/admin/posters/${editingId}`, { method: "PATCH", body: JSON.stringify(draft) });
      } else {
        await api("/admin/posters", { method: "POST", body: JSON.stringify(draft) });
      }
      setDraft(empty());
      setEditingId(null);
      setToast({ kind: "ok", msg: editingId ? "Poster updated" : "Poster created" });
      await load();
    } catch (e: any) {
      setToast({ kind: "err", msg: e?.message || "Save failed" });
    } finally {
      setBusy(false);
    }
  };

  const editPoster = (p: Poster) => {
    setEditingId(p.id);
    setDraft({ ...p });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this poster?")) return;
    try {
      await api(`/admin/posters/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setToast({ kind: "err", msg: e?.message || "Delete failed" });
    }
  };

  const toggleActive = async (p: Poster) => {
    try {
      await api(`/admin/posters/${p.id}`, { method: "PATCH", body: JSON.stringify({ active: !p.active }) });
      await load();
    } catch (e: any) {
      setToast({ kind: "err", msg: e?.message || "Update failed" });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div>
        <div className="text-xs uppercase tracking-widest text-yellow-400/80">Admin · Landing Page</div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Promotional Posters</h1>
        <p className="mt-1 text-sm text-zinc-300">Auto-swiping carousel at the top of the public homepage. Add, edit, reorder, or hide slides any time.</p>
      </div>

      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-2 text-white">
          <ImagePlus size={18} className="text-yellow-300" />
          <h3 className="font-semibold">{editingId ? "Edit poster" : "Add new poster"}</h3>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Title</div>
            <input
              value={draft.title || ""}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white"
              placeholder="Welcome bonus ₹100 free"
            />
          </label>
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Subtitle</div>
            <input
              value={draft.subtitle || ""}
              onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
              className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white"
              placeholder="Sign up with Gmail and get ₹100 bonus instantly."
            />
          </label>
          <label className="block sm:col-span-2">
            <div className="text-xs text-zinc-400 mb-1">Image URL</div>
            <input
              value={draft.imageUrl || ""}
              onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
              className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white"
              placeholder="https://i.imgur.com/yourposter.jpg"
            />
            <div className="mt-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-200">
              📐 <strong>Recommended poster size:</strong> 1200×400 px (3:1 ratio) · Max 2MB · JPG/PNG/WebP<br/>
              💡 Free upload: <a href="https://imgur.com/upload" target="_blank" rel="noopener" className="underline">imgur.com</a> ya <a href="https://imgbb.com" target="_blank" rel="noopener" className="underline">imgbb.com</a> par upload karo aur link paste karo
            </div>
            {/* Live preview */}
            {draft.imageUrl && (
              <div className="mt-2">
                <div className="text-xs text-zinc-400 mb-1">Preview:</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft.imageUrl} alt="preview" className="w-full max-h-32 object-cover rounded-xl border border-yellow-500/20" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </label>
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Gradient (when no image)</div>
            <select
              value={draft.gradient || GRADIENTS[0].value}
              onChange={(e) => setDraft({ ...draft, gradient: e.target.value })}
              className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white"
            >
              {GRADIENTS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Sort Order</div>
            <input
              type="number"
              value={draft.sortOrder ?? 0}
              onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
              className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white"
            />
          </label>
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">CTA Label</div>
            <input
              value={draft.ctaLabel || ""}
              onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })}
              className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white"
              placeholder="Claim ₹100"
            />
          </label>
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">CTA Link</div>
            <input
              value={draft.ctaHref || ""}
              onChange={(e) => setDraft({ ...draft, ctaHref: e.target.value })}
              className="w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white"
              placeholder="/login?signup=1 or #plans or https://…"
            />
          </label>
          <label className="block sm:col-span-2 inline-flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              checked={!!draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm text-zinc-300">Active (visible on landing page)</span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 font-semibold text-black hover:brightness-95 disabled:opacity-60"
          >
            <Save size={14} /> {busy ? "Saving…" : editingId ? "Update poster" : "Add poster"}
          </button>
          {editingId && (
            <button
              onClick={() => { setEditingId(null); setDraft(empty()); }}
              className="rounded-xl border border-yellow-500/20 px-4 py-2.5 text-sm text-zinc-200 hover:bg-yellow-500/10"
            >
              Cancel edit
            </button>
          )}
        </div>
        {toast && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs border ${toast.kind === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-red-500/10 border-red-500/30 text-red-200"}`}>
            {toast.msg}
          </div>
        )}
      </div>

      <div className="glass rounded-3xl p-6">
        <h3 className="text-white font-semibold">Existing posters</h3>
        <div className="mt-4 grid gap-3">
          {posters.length === 0 && <div className="text-sm text-zinc-500">No posters yet.</div>}
          {posters.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-yellow-500/15 bg-black/30 p-3">
              <div className={`relative h-16 w-28 overflow-hidden rounded-lg border border-white/10 ${p.imageUrl ? "" : `bg-gradient-to-br ${p.gradient}`}`}>
                {p.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-white truncate font-medium">{p.title}</div>
                <div className="text-xs text-zinc-500 truncate">{p.subtitle || "—"}</div>
                <div className="mt-1 text-[11px] text-zinc-600">order {p.sortOrder} · {p.active ? "active" : "hidden"}</div>
              </div>
              <button
                onClick={() => toggleActive(p)}
                className={`p-2 rounded-lg border ${p.active ? "border-emerald-500/30 text-emerald-300" : "border-zinc-600 text-zinc-400"} hover:bg-yellow-500/10`}
                title={p.active ? "Hide" : "Show"}
              >
                {p.active ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button
                onClick={() => editPoster(p)}
                className="rounded-lg border border-yellow-500/30 px-3 py-1.5 text-xs text-yellow-200 hover:bg-yellow-500/10"
              >
                Edit
              </button>
              <button
                onClick={() => remove(p.id)}
                className="p-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
