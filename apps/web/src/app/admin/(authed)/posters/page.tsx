"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Save, Trash2, Eye, EyeOff, Upload, X, Loader2 } from "lucide-react";
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
  { label: "Gold",    value: "from-yellow-500/40 via-amber-500/15 to-transparent" },
  { label: "Emerald", value: "from-emerald-500/40 via-green-500/15 to-transparent" },
  { label: "Fuchsia", value: "from-fuchsia-500/40 via-pink-500/15 to-transparent" },
  { label: "Sky",     value: "from-sky-500/40 via-blue-500/15 to-transparent" },
  { label: "Rose",    value: "from-rose-500/40 via-red-500/15 to-transparent" },
];

const empty = (): Partial<Poster> => ({
  title: "", subtitle: "", imageUrl: "",
  gradient: GRADIENTS[0].value, ctaHref: "", ctaLabel: "",
  active: true, sortOrder: 0,
});

// Upload image to imgbb or compress to small base64
async function uploadImage(file: File): Promise<string> {
  // Compress image to max 800x400 and quality 0.7 before any upload
  const compressed = await compressImage(file, 800, 400, 0.75);

  // Try imgbb public API
  try {
    const formData = new FormData();
    // Send the base64 data (without the data:image/...;base64, prefix)
    const base64 = compressed.split(",")[1];
    formData.append("image", base64);
    const res = await fetch("https://api.imgbb.com/1/upload?key=2f9b7a5e7c3d3e1f4a6b8c0d2e4f6a8b", {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.url) return data.data.url;
    }
  } catch {}

  // Fallback: return compressed base64 (stored in DB, ~50-150KB)
  return compressed;
}

// Compress image using canvas — reduces file size drastically
function compressImage(file: File, maxW: number, maxH: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      // Scale down while maintaining aspect ratio
      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function AdminPostersPage() {
  const [posters, setPosters] = useState<Poster[]>([]);
  const [draft, setDraft] = useState<Partial<Poster>>(empty());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      const r = await api<{ posters: Poster[] }>("/admin/posters");
      setPosters(r.posters);
    } catch (e: any) {
      showToast("err", e?.message || "Failed to load posters");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Handle file selection — upload immediately and put URL in draft
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (file.size > 10 * 1024 * 1024) {
      showToast("err", "File too large. Max 10MB allowed.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      showToast("err", "Sirf images allowed hain (JPG, PNG, WebP)");
      return;
    }

    setUploading(true);
    showToast("ok", "Compressing image…");
    try {
      const url = await uploadImage(file);
      setDraft((d) => ({ ...d, imageUrl: url }));
      showToast("ok", "Image upload ho gaya! ✅");
    } catch {
      showToast("err", "Upload failed. URL paste karo manually.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!draft.title?.trim()) { showToast("err", "Title is required"); return; }
    setBusy(true);
    try {
      if (editingId) {
        await api(`/admin/posters/${editingId}`, { method: "PATCH", body: JSON.stringify(draft) });
      } else {
        await api("/admin/posters", { method: "POST", body: JSON.stringify(draft) });
      }
      setDraft(empty());
      setEditingId(null);
      showToast("ok", editingId ? "Poster updated! 🎉" : "Poster added! Now visible on landing page.");
      await load();
    } catch (e: any) {
      showToast("err", e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const editPoster = (p: Poster) => {
    setEditingId(p.id);
    setDraft({ ...p });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: string) => {
    if (!confirm("Is poster ko delete karo?")) return;
    try {
      await api(`/admin/posters/${id}`, { method: "DELETE" });
      await load();
      showToast("ok", "Poster deleted.");
    } catch (e: any) {
      showToast("err", e?.message || "Delete failed");
    }
  };

  const toggleActive = async (p: Poster) => {
    try {
      await api(`/admin/posters/${p.id}`, { method: "PATCH", body: JSON.stringify({ active: !p.active }) });
      await load();
    } catch (e: any) {
      showToast("err", e?.message || "Update failed");
    }
  };

  const inp = "w-full rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-3 text-white focus:outline-none focus:border-yellow-500/50";

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full">
      <div>
        <div className="text-xs uppercase tracking-widest text-yellow-400/80">Admin · Landing Page</div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Promotional Posters</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Landing page ke top par auto-swipe karta hai. Kisi bhi waqt add, edit, ya hide kar sakte ho.
        </p>
      </div>

      {/* ── Add / Edit form ── */}
      <div className="glass rounded-3xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-white">
          <ImagePlus size={18} className="text-yellow-300" />
          <h3 className="font-semibold">{editingId ? "Poster Edit Karo" : "Naya Poster Add Karo"}</h3>
        </div>

        {/* Title + Subtitle */}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Title <span className="text-red-400">*</span></div>
            <input value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className={inp} placeholder="Diwali Bonus ₹500 Free!" />
          </label>
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Subtitle</div>
            <input value={draft.subtitle || ""} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
              className={inp} placeholder="Sign up aaj aur ₹500 bonus pao." />
          </label>
        </div>

        {/* Image upload section */}
        <div className="space-y-2">
          <div className="text-xs text-zinc-400">Poster Image</div>

          {/* Upload button */}
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm font-semibold text-yellow-200 hover:bg-yellow-500/20 disabled:opacity-50 transition"
            >
              {uploading ? (
                <><Loader2 size={15} className="animate-spin" /> Uploading…</>
              ) : (
                <><Upload size={15} /> Device se Upload karo</>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <span className="text-zinc-500 text-xs">ya</span>
            <input
              value={draft.imageUrl?.startsWith("data:") ? "" : (draft.imageUrl || "")}
              onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
              className="flex-1 min-w-[200px] rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-500/50"
              placeholder="https://... link paste karo"
            />
            {draft.imageUrl && (
              <button onClick={() => setDraft({ ...draft, imageUrl: "" })}
                className="p-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10" title="Remove image">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Size hint */}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-200">
            📐 Best size: <strong>1200×400px</strong> (3:1 ratio) · Max 10MB · JPG/PNG/WebP · Auto-compressed before upload
          </div>

          {/* Live preview */}
          {draft.imageUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-yellow-500/20" style={{ height: 160 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.imageUrl} alt="preview"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent flex flex-col justify-center px-6">
                <div className="text-white font-bold text-lg drop-shadow">{draft.title || "Title here"}</div>
                {draft.subtitle && <div className="text-zinc-200 text-sm mt-1">{draft.subtitle}</div>}
              </div>
            </div>
          ) : (
            <div className={`rounded-2xl bg-gradient-to-br ${draft.gradient || GRADIENTS[0].value} border border-white/10 flex flex-col justify-center px-6`} style={{ height: 120 }}>
              <div className="text-white font-bold text-lg drop-shadow">{draft.title || "Title preview"}</div>
              {draft.subtitle && <div className="text-zinc-200 text-sm mt-1">{draft.subtitle}</div>}
            </div>
          )}
        </div>

        {/* Gradient + Order + CTA */}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Background Color (agar image nahi hai)</div>
            <select value={draft.gradient || GRADIENTS[0].value}
              onChange={(e) => setDraft({ ...draft, gradient: e.target.value })}
              className={inp}>
              {GRADIENTS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Sort Order (0 = pehle)</div>
            <input type="number" value={draft.sortOrder ?? 0}
              onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
              className={inp} />
          </label>
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Button Text (CTA)</div>
            <input value={draft.ctaLabel || ""}
              onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })}
              className={inp} placeholder="Abhi Join Karo" />
          </label>
          <label className="block">
            <div className="text-xs text-zinc-400 mb-1">Button Link</div>
            <input value={draft.ctaHref || ""}
              onChange={(e) => setDraft({ ...draft, ctaHref: e.target.value })}
              className={inp} placeholder="/login?signup=1 ya https://..." />
          </label>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            className="h-4 w-4 accent-yellow-400" />
          <span className="text-sm text-zinc-300">Active — landing page par dikhao</span>
        </label>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={save} disabled={busy || uploading}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 font-semibold text-black hover:brightness-95 disabled:opacity-60">
            {busy ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> {editingId ? "Update Poster" : "Add Poster"}</>}
          </button>
          {editingId && (
            <button onClick={() => { setEditingId(null); setDraft(empty()); }}
              className="rounded-xl border border-yellow-500/20 px-4 py-2.5 text-sm text-zinc-200 hover:bg-yellow-500/10">
              Cancel
            </button>
          )}
        </div>

        {toast && (
          <div className={`rounded-xl px-4 py-3 text-sm border ${toast.kind === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-red-500/10 border-red-500/30 text-red-200"}`}>
            {toast.msg}
          </div>
        )}
      </div>

      {/* ── Existing posters ── */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Existing Posters ({posters.length})</h3>
          <div className="text-xs text-zinc-500">Drag order: Sort Order field se control karo</div>
        </div>
        {posters.length === 0 ? (
          <div className="text-center py-10 text-zinc-500 text-sm">
            Koi poster nahi hai — upar se add karo 👆
          </div>
        ) : (
          <div className="space-y-3">
            {posters.map((p) => (
              <div key={p.id} className={`flex items-center gap-3 rounded-2xl border p-3 transition ${p.active ? "border-yellow-500/15 bg-black/20" : "border-zinc-700/40 bg-black/10 opacity-60"}`}>
                {/* Thumbnail */}
                <div className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 ${!p.imageUrl ? `bg-gradient-to-br ${p.gradient}` : ""}`}>
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="text-white truncate font-medium text-sm">{p.title}</div>
                  <div className="text-xs text-zinc-500 truncate mt-0.5">{p.subtitle || "—"}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-zinc-600">Order: {p.sortOrder}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.active ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700/60 text-zinc-400"}`}>
                      {p.active ? "Active" : "Hidden"}
                    </span>
                    {p.imageUrl && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">📷 Image</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggleActive(p)}
                    className={`p-2 rounded-lg border transition ${p.active ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10" : "border-zinc-600 text-zinc-400 hover:bg-zinc-700/40"}`}
                    title={p.active ? "Hide" : "Show"}>
                    {p.active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button onClick={() => editPoster(p)}
                    className="rounded-lg border border-yellow-500/30 px-3 py-1.5 text-xs text-yellow-200 hover:bg-yellow-500/10">
                    Edit
                  </button>
                  <button onClick={() => remove(p.id)}
                    className="p-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
