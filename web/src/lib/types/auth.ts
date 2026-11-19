export interface SessionUser {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  role: string;
  tenant_id: number | null;
  tenant_name: string | null;
}
