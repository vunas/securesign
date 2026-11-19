import ProtectedLayout from "@/components/ProtectedLayout";

export default function SignLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ProtectedLayout returnTo="/sign">{children}</ProtectedLayout>;
}
