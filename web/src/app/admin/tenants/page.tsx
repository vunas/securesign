"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchAPI, getCurrentUsername } from "@/lib/api";
import { showToast } from "@/lib/swal";

interface Tenant {
  id: number;
  tenant_code: string;
  name: string;
  email: string;
  domain: string | null;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";
  created_at: string;
  monthly_limit: number | null;
  used_count: number | null;
}

interface TenantReviewResult extends Tenant {
  api_key_secret?: string | null;
}

const STATUS_LABELS: Record<Tenant["status"], string> = {
  PENDING: "Chờ duyệt",
  ACTIVE: "Đang hoạt động",
  REJECTED: "Đã từ chối",
  SUSPENDED: "Đã tạm ngưng",
};

export default function TenantApprovalPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [initialApiKey, setInitialApiKey] = useState("");
  const [loading, setLoading] = useState(true);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = filter ? `?status=${encodeURIComponent(filter)}` : "";
      setTenants(await fetchAPI<Tenant[]>(`/api/admin/tenants${query}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải tổ chức.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (!getCurrentUsername()) {
      router.replace("/login");
      return;
    }
    if (localStorage.getItem("role") !== "PLATFORM_SUPER_ADMIN") {
      router.replace("/dashboard");
      return;
    }
    void Promise.resolve().then(loadTenants);
  }, [loadTenants, router]);

  const review = async (tenant: Tenant, approve: boolean) => {
    const reason = approve ? null : window.prompt("Lý do từ chối đăng ký:");
    if (!approve && !reason?.trim()) return;
    try {
      const result = await fetchAPI<TenantReviewResult>(
        `/api/admin/tenants/${tenant.id}/review`,
        "POST",
        { status: approve ? "ACTIVE" : "REJECTED", reason },
      );
      if (result.api_key_secret) setInitialApiKey(result.api_key_secret);
      showToast(approve ? "Đã duyệt và khởi tạo PKI/API key" : "Đã từ chối đăng ký", "success");
      await loadTenants();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật tổ chức.");
    }
  };

  const changeStatus = async (tenant: Tenant) => {
    const status = tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await fetchAPI(`/api/admin/tenants/${tenant.id}/status`, "PATCH", { status });
      showToast(status === "ACTIVE" ? "Đã kích hoạt tổ chức" : "Đã tạm ngưng tổ chức", "success");
      await loadTenants();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật trạng thái.");
    }
  };

  const updateQuota = async (tenant: Tenant) => {
    const value = window.prompt(
      `Hạn ngạch mới cho ${tenant.name}:`,
      String(tenant.monthly_limit ?? 1000),
    );
    if (value === null) return;
    const monthly_limit = Number(value);
    if (!Number.isInteger(monthly_limit) || monthly_limit < 0) {
      setError("Hạn ngạch phải là số nguyên không âm.");
      return;
    }
    try {
      await fetchAPI(`/api/admin/tenants/${tenant.id}/quota`, "PUT", { monthly_limit });
      showToast("Đã cập nhật hạn ngạch tháng", "success");
      await loadTenants();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật hạn ngạch.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl grow px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Quản lý tổ chức</h1>
            <p className="mt-2 text-slate-600">
              Xét duyệt, tạm ngưng và điều chỉnh hạn ngạch của các tenant.
            </p>
          </div>
          <select
            aria-label="Lọc trạng thái tổ chức"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
        {initialApiKey && (
          <section className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <h2 className="font-bold text-amber-950">API key được tạo lúc duyệt</h2>
            <p className="mt-1 text-sm text-amber-900">
              Hãy chuyển secret an toàn cho tổ chức. Secret này chỉ hiển thị lần này.
            </p>
            <code className="mt-2 block break-all rounded bg-white p-3">{initialApiKey}</code>
            <button
              onClick={() => setInitialApiKey("")}
              className="mt-3 rounded bg-amber-800 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Đã lưu, đóng
            </button>
          </section>
        )}

        <div className="mt-6 space-y-4">
          {tenants.map((tenant) => (
            <article key={tenant.id} className="rounded-xl bg-white p-5 shadow">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <h2 className="font-bold text-slate-900">{tenant.name}</h2>
                  <p className="text-sm text-slate-600">
                    {tenant.tenant_code} · {tenant.email}{tenant.domain ? ` · ${tenant.domain}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {STATUS_LABELS[tenant.status]} · quota tháng:{" "}
                    {tenant.monthly_limit == null
                      ? "chưa cấp"
                      : `${tenant.used_count ?? 0}/${tenant.monthly_limit}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tenant.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => void review(tenant, false)}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
                      >
                        Từ chối
                      </button>
                      <button
                        onClick={() => void review(tenant, true)}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Duyệt và khởi tạo
                      </button>
                    </>
                  )}
                  {tenant.status === "ACTIVE" && (
                    <>
                      <button
                        onClick={() => void updateQuota(tenant)}
                        className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700"
                      >
                        Hạn ngạch
                      </button>
                      <button
                        onClick={() => void changeStatus(tenant)}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
                      >
                        Tạm ngưng
                      </button>
                    </>
                  )}
                  {tenant.status === "SUSPENDED" && (
                    <button
                      onClick={() => void changeStatus(tenant)}
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Kích hoạt lại
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {!loading && !tenants.length && !error && (
            <p className="rounded-lg bg-white p-6 text-slate-600">Không có tổ chức phù hợp.</p>
          )}
          {loading && <p className="rounded-lg bg-white p-6 text-slate-600">Đang tải...</p>}
        </div>
      </main>
      <Footer />
    </div>
  );
}
