import type { ReactNode } from "react";
import { requireServerUser } from "@/lib/server/auth";
import { SessionProvider } from "@/components/SessionProvider";

export default async function ProtectedLayout({
  returnTo,
  children,
}: {
  returnTo: string;
  children: ReactNode;
}) {
  const user = await requireServerUser(returnTo);

  return <SessionProvider user={user}>{children}</SessionProvider>;
}
