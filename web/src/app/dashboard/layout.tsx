import ProtectedLayout from "@/components/ProtectedLayout";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ProtectedLayout returnTo="/dashboard">{children}</ProtectedLayout>;
}
