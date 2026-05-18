import AdminShell from "@/components/AdminShell";

export default function AdminAuthedLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
