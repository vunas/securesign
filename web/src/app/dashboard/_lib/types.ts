export interface KeyItem {
  id: number;
  name: string;
  algorithm: string;
  storage_type: "server";
  created_at: string;
  public_key: string;
  key_fingerprint: string;
  category:
    | "ROOT_CA"
    | "INTERMEDIATE_CA"
    | "TSA"
    | "SIGNING"
    | "UNCERTIFIED"
    | "OTHER";
  is_revoked: boolean;
}

export interface CredentialItem {
  id: number;
  name: string;
  hash: string;
  size: number;
  tracking_id: string;
  credential_number: string | null;
  recipient_name: string;
  status: "DRAFT" | "ISSUED" | "REVOKED";
  revocation_reason: string | null;
}

export interface SignatureItem {
  id: number;
  credential_name: string;
  key_id: number;
  key_name: string;
  signer: string;
  algorithm: string;
  signed_at: string;
  signature_base64: string;
}

export interface DashboardData {
  stats: {
    total_keys: number;
    total_credentials: number;
    total_sigs: number;
    monthly_signing_limit: number;
    monthly_signing_used: number;
    period_start: string;
    period_end: string;
  };
  permissions: {
    can_manage_api_keys: boolean;
    can_revoke_keys: boolean;
    can_revoke_credentials: boolean;
  };
  keys: KeyItem[];
  credentials: CredentialItem[];
  signatures: SignatureItem[];
}