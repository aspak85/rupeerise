"use client";
import { useCallback, useEffect, useState } from "react";
import { Shield, AlertTriangle, RefreshCw, Eye, Users, MapPin, Clock, Search } from "lucide-react";
import { api } from "@/lib/api";

type User = {
  id: string;
  email: string;
  phone?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  lastLoginAt?: string | null;
  lastIp?: string | null;
  createdAt: string;
  status: string;
};

type IpGroup = {
  ip: string;
  users: User[];
  count: number;
};

export default function SecurityPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchIp, setSearchIp] = useState("");
  const [activeTab, setActiveTab] = useState<"ip" | "duplicate">("ip");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load all users — we analyse client-side since the admin API returns full user list
      const data = await api<{ users: User[] }>("/admin/users?limit=500");
      setUsers(data.users);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group users by IP address
  const ipGroups = useCallback((): IpGroup[] => {
    const map: Record<string, User[]> = {};
    for (const u of users) {
      if (!u.lastIp) continue;
      if (!map[u.lastIp]) map[u.lastIp] = [];
      map[u.lastIp].push(u);
    }
    return Object.entries(map)
      .filter(([, list]) => list.length > 1)
      .map(([ip, list]) => ({ ip, users: list, count: list.length }))
      .sort((a, b) => b.count - a.count);
  }, [users]);

  // Find users with same email domain (potential spam/shared accounts)
  const duplicateDomains = useCallback((): { domain: string; users: User[] }[] => {
    const map: Record<string, User[]> = {};
    for (const u of users) {
      const domain = u.email.split("@")[1] || "";
      if (!domain || domain === "gmail.com" || domain === "yahoo.com" || domain === "hotmail.com") continue;
      if (!map[domain]) map[domain] = [];
      map[domain].push(u);
    }
    return Object.entries(map)
      .filter(([, list]) => list.length > 1)
      .map(([domain, list]) => ({ domain, users: list }))
      .sort((a, b) => b.users.length - a.users.length);
  }, [users]);

  const filteredIpGroups = ipGroups().filter(g => searchIp ? g.ip.includes(searchIp) : true);
  const noIpUsers = users.filter(u => !u.lastIp).length;
  const multiIpCount = ipGroups().reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-yellow-400/80">Security</div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1">Security Monitor</h1>
          <p className="text-sm text-zinc-400 mt-1">IP abuse detection, duplicate account tracking aur login activity.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-yellow-500/20 px-3 py-2 text-sm text-zinc-300 hover:bg-yellow-500/10">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: users.length, icon: Users, color: "text-white" },
          { label: "Shared IPs", value: ipGroups().length, icon: MapPin, color: "text-orange-300" },
          { label: "Multi-Account IPs", value: multiIpCount, icon: AlertTriangle, color: "text-red-300" },
          { label: "No IP Tracked", value: noIpUsers, icon: Eye, color: "text-zinc-400" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
              <s.icon size={13} /> {s.label}
            </div>
            <div className={`text-2xl font-bold ${s.color}`}>{loading ? "…" : s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex border-b border-yellow-500/10">
          {(["ip", "duplicate"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-semibold transition ${activeTab === tab ? "bg-yellow-500/10 text-yellow-200 border-b-2 border-yellow-400" : "text-zinc-400 hover:text-white"}`}>
              {tab === "ip" ? "🌐 IP Login Tracking" : "👥 Duplicate Accounts"}
            </button>
          ))}
        </div>

        {/* IP Tracking Tab */}
        {activeTab === "ip" && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Shield size={16} className="text-yellow-300" />
              Yeh sections dikhate hain kaun se IP addresses se multiple users ne login kiya
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-black/30 px-3 py-2">
              <Search size={14} className="text-zinc-400" />
              <input value={searchIp} onChange={(e) => setSearchIp(e.target.value)}
                placeholder="IP address se filter karo…"
                className="flex-1 bg-transparent text-white text-sm focus:outline-none" />
            </div>

            {loading ? (
              <div className="text-center py-8 text-zinc-500">Loading…</div>
            ) : filteredIpGroups.length === 0 ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
                <div className="text-emerald-300 font-semibold">✅ Koi suspicious IP activity nahi mili</div>
                <div className="text-xs text-zinc-400 mt-1">Sab users alag IPs se login kar rahe hain</div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredIpGroups.map((group) => (
                  <div key={group.ip} className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className="text-orange-400" />
                        <code className="text-orange-300 font-mono text-sm">{group.ip}</code>
                        <span className="text-xs text-zinc-400">— {group.count} accounts</span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        group.count >= 5 ? "bg-red-500/20 text-red-300" :
                        group.count >= 3 ? "bg-orange-500/20 text-orange-300" :
                        "bg-yellow-500/20 text-yellow-300"
                      }`}>
                        {group.count >= 5 ? "🔴 High Risk" : group.count >= 3 ? "🟠 Medium Risk" : "🟡 Low Risk"}
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {group.users.map((u) => (
                        <div key={u.id} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 text-xs">
                          <div>
                            <span className="text-white">{u.email}</span>
                            {u.firstName && <span className="text-zinc-500 ml-2">({u.firstName} {u.lastName || ""})</span>}
                          </div>
                          <div className="flex items-center gap-3 text-zinc-400">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${u.status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                              {u.status}
                            </span>
                            {u.lastLoginAt && (
                              <span className="flex items-center gap-1">
                                <Clock size={10} /> {new Date(u.lastLoginAt).toLocaleDateString("en-IN")}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Duplicate Accounts Tab */}
        {activeTab === "duplicate" && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Shield size={16} className="text-yellow-300" />
              Same email domain wale multiple users — non-standard domains pe flag karta hai
            </div>

            {/* Same email multiple times */}
            <div className="rounded-xl border border-yellow-500/20 bg-black/20 p-4">
              <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-yellow-300" /> Same Domain Users
              </h4>
              {loading ? (
                <div className="text-zinc-500 text-sm">Loading…</div>
              ) : duplicateDomains().length === 0 ? (
                <div className="text-emerald-300 text-sm">✅ Koi suspicious domain pattern nahi mila</div>
              ) : (
                <div className="space-y-3">
                  {duplicateDomains().map((d) => (
                    <div key={d.domain} className="rounded-lg bg-black/30 border border-yellow-500/10 p-3">
                      <div className="text-yellow-300 text-xs font-mono mb-2">@{d.domain} — {d.users.length} accounts</div>
                      {d.users.map((u) => (
                        <div key={u.id} className="text-xs text-zinc-300 py-1 border-t border-yellow-500/5 first:border-0">
                          {u.email} · Joined {new Date(u.createdAt).toLocaleDateString("en-IN")}
                          <span className={`ml-2 text-[10px] ${u.status === "active" ? "text-emerald-400" : "text-red-400"}`}>
                            {u.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recently active users */}
            <div className="rounded-xl border border-yellow-500/20 bg-black/20 p-4">
              <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <Clock size={14} className="text-yellow-300" /> Aaj Login Karne Wale Users
              </h4>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {users
                  .filter(u => u.lastLoginAt && new Date(u.lastLoginAt).toDateString() === new Date().toDateString())
                  .sort((a, b) => new Date(b.lastLoginAt!).getTime() - new Date(a.lastLoginAt!).getTime())
                  .slice(0, 20)
                  .map((u) => (
                    <div key={u.id} className="flex items-center justify-between text-xs rounded-lg bg-black/30 px-3 py-2">
                      <span className="text-white">{u.email}</span>
                      <div className="flex items-center gap-3 text-zinc-400">
                        {u.lastIp && <code className="text-[10px] text-zinc-500">{u.lastIp}</code>}
                        <span>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleTimeString("en-IN") : ""}</span>
                      </div>
                    </div>
                  ))}
                {users.filter(u => u.lastLoginAt && new Date(u.lastLoginAt).toDateString() === new Date().toDateString()).length === 0 && (
                  <div className="text-zinc-500 text-sm py-2">Aaj koi login nahi kiya</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
