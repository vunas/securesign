import SignClient, { type KeyOption } from "./SignClient";
import { fetchServerApi, requireServerUser } from "@/lib/server/auth";

export default async function SignPage() {
  const user = await requireServerUser("/sign");
  const keys = await fetchServerApi<KeyOption[]>("/api/keys/", "/sign");

  return (
    <SignClient
      initialKeys={keys.filter((key) => !key.is_revoked)}
      user={user}
      defaultIssueDate={new Date().toISOString().slice(0, 10)}
    />
  );
}
