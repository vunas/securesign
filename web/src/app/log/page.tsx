"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchAPI, getCurrentUsername } from "@/lib/api";
import { showToast } from "@/lib/swal";

function subscribeAuth(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("securesign:auth-changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("securesign:auth-changed", callback);
  };
}

function getRoleSnapshot() {
  return typeof window === "undefined" ? null : localStorage.getItem("role");
}

interface AuditLog {
  id: number;
  user_id?: number;
  tenant_id?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  status: string;
  ip_address?: string;
  user_agent?: string;
  log_hash?: string;
  created_at: string;
}

interface VerifyLog {
  id: number;
  user_id?: number;
  tenant_id?: string;
  credential_id?: number;
  document_id?: number;
  is_valid: boolean;
  message: string;
  created_at: string;
}

interface AuditIntegrityResult {
  valid: boolean;
  checked_entries: number;
  legacy_entries: number;
  invalid_entry_id: number | null;
}

export default function LogPage() {
  const router = useRouter();
  const role = useSyncExternalStore(subscribeAuth, getRoleSnapshot, () => null);
  const [activeTab, setActiveTab] = useState<"audit" | "verify">("audit");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [verifyLogs, setVerifyLogs] = useState<VerifyLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [integrityResult, setIntegrityResult] = useState<AuditIntegrityResult | null>(null);

  const checkAuditChain = async () => {
    try {
      const result = await fetchAPI<AuditIntegrityResult>("/api/logs/audit/verify-chain");
      setIntegrityResult(result);
      showToast(
        result.valid
          ? `Chuỗi khớp (${result.checked_entries} bản ghi, ${result.legacy_entries} bản ghi đời cũ).`
          : `Phát hiện sai lệch tại bản ghi #${result.invalid_entry_id}.`,
        result.valid && result.legacy_entries === 0 ? "success" : "warning",
      );
    } catch (error) {
      console.error("Không thể kiểm tra tính toàn vẹn audit:", error);
    }
  };

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (actionFilter.trim()) params.set("action", actionFilter.trim());
      if (statusFilter) params.set("status", statusFilter);
      const data = await fetchAPI<AuditLog[]>(`/api/logs/audit?${params}`);
      setAuditLogs(data || []);
    } catch (e) {
      console.error("Lỗi tải Audit logs:", e);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, statusFilter]);

  const loadVerifyLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAPI<VerifyLog[]>("/api/logs/verify?limit=50");
      setVerifyLogs(data || []);
    } catch (e) {
      console.error("Lỗi tải Verify logs:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const user = getCurrentUsername();
    if (!user) {
      router.push("/login");
      return;
    }
    fetchAPI<AuditLog[]>("/api/logs/audit?limit=50")
      .then((data) => {
        if (isMounted) {
          setAuditLogs(data || []);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (isMounted) {
          console.error("Lỗi tải Audit logs:", e);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleTabChange = (tab: "audit" | "verify") => {
    setActiveTab(tab);
    if (tab === "audit") {
      loadAuditLogs();
    } else {
      loadVerifyLogs();
    }
  };

  const formatAction = (action: string) => {
    const actionMap: Record<string, { text: string; color: string }> = {
      REGISTER_USER: {
        text: "Đăng ký",
        color: "text-blue-600 bg-blue-50 border border-blue-100",
      },
      USER_LOGIN: {
        text: "Đăng nhập",
        color: "text-emerald-600 bg-emerald-50 border border-emerald-100",
      },
      UPLOAD_DOCUMENT: {
        text: "Tải tài liệu",
        color: "text-indigo-600 bg-indigo-50 border border-indigo-100",
      },
      SIGN_DOCUMENT: {
        text: "Ký văn bản",
        color: "text-amber-600 bg-amber-50 border border-amber-100",
      },
      GENERATE_KEY: {
        text: "Tạo khóa",
        color: "text-purple-600 bg-purple-50 border border-purple-100",
      },
      ISSUE_AND_SIGN_CREDENTIAL: {
        text: "Phát hành văn bằng",
        color: "text-emerald-700 bg-emerald-50 border border-emerald-100",
      },
      REVOKE_CREDENTIAL: {
        text: "Thu hồi văn bằng",
        color: "text-rose-700 bg-rose-50 border border-rose-100",
      },
      REGISTER_TENANT: {
        text: "Đăng ký tổ chức",
        color: "text-blue-700 bg-blue-50 border border-blue-100",
      },
      REVIEW_TENANT: {
        text: "Xét duyệt tổ chức",
        color: "text-indigo-700 bg-indigo-50 border border-indigo-100",
      },
      CREATE_API_KEY: {
        text: "Tạo API key",
        color: "text-purple-700 bg-purple-50 border border-purple-100",
      },
      REVOKE_API_KEY: {
        text: "Thu hồi API key",
        color: "text-rose-700 bg-rose-50 border border-rose-100",
      },
      REVOKE_KEY: {
        text: "Thu hồi khóa",
        color: "text-rose-700 bg-rose-50 border border-rose-100",
      },
      CREATE_ROOT_CA: {
        text: "Tạo Root CA",
        color: "text-rose-600 bg-rose-50 border border-rose-100",
      },
      VERIFY_DOCUMENT: {
        text: "Xác thực",
        color: "text-cyan-600 bg-cyan-50 border border-cyan-100",
      },
    };
    const style = actionMap[action] || {
      text: action,
      color: "text-slate-600 bg-slate-100 border border-slate-200",
    };
    return (
      <span
        className={`px-2.5 py-1 rounded-md text-xs font-bold ${style.color}`}
      >
        {style.text}
      </span>
    );
  };

  const formatStatus = (status: string) => {
    if (status === "SUCCESS") {
      return (
        <span className="text-emerald-500 font-bold">
          <i className="fa-solid fa-check mr-1"></i>Thành công
        </span>
      );
    }
    if (status === "FAILED") {
      return (
        <span className="text-rose-500 font-bold">
          <i className="fa-solid fa-xmark mr-1"></i>Thất bại
        </span>
      );
    }
    return (
      <span className="text-amber-500 font-bold">
        <i className="fa-solid fa-clock mr-1"></i>Đang xử lý
      </span>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Header Page */}
          <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                <i className="fa-solid fa-clock-rotate-left text-indigo-600 mr-3"></i>
                Nhật Ký Hệ Thống
              </h2>
              <p className="text-slate-500 mt-2 text-lg">
                Quản lý tập trung lịch sử hoạt động bảo mật và kết quả xác thực
                tài liệu.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(role === "PLATFORM_SUPER_ADMIN" || role === "TENANT_ADMIN") && (
                <button
                  onClick={() => void checkAuditChain()}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 font-semibold text-amber-900"
                >
                  Kiểm tra chuỗi Audit
                </button>
              )}
              <button
                onClick={() =>
                  activeTab === "audit" ? loadAuditLogs() : loadVerifyLogs()
                }
                className="bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 font-semibold py-2 px-5 rounded-xl shadow-sm transition-all duration-200 flex items-center h-fit cursor-pointer"
              >
                <i
                  className={`fa-solid fa-rotate-right mr-2 ${loading ? "fa-spin" : ""}`}
                ></i>{" "}
                Làm mới dữ liệu
              </button>
            </div>
          </div>
          {integrityResult && (
            <p className={`mb-5 rounded-lg p-4 text-sm ${
              integrityResult.valid && integrityResult.legacy_entries === 0
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-900"
            }`}>
              {integrityResult.valid
                ? `Chuỗi HMAC khớp ${integrityResult.checked_entries} bản ghi. Bản ghi chưa ký HMAC: ${integrityResult.legacy_entries}.`
                : `Chuỗi có thể đã bị thay đổi tại bản ghi #${integrityResult.invalid_entry_id}.`}
              {" "}Việc xóa phần đuôi lịch sử vẫn cần checkpoint lưu ngoài cơ sở dữ liệu để phát hiện.
            </p>
          )}

          {/* TABS CHUYỂN ĐỔI CHẾ ĐỘ */}
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-6 w-full md:w-fit">
            <button
              type="button"
              onClick={() => handleTabChange("audit")}
              className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 flex items-center justify-center cursor-pointer ${
                activeTab === "audit"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <i className="fa-solid fa-shield-halved mr-2"></i>Hoạt Động
              (Audit)
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("verify")}
              className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 flex items-center justify-center cursor-pointer ${
                activeTab === "verify"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <i className="fa-solid fa-file-shield mr-2"></i>Xác Thực (Verify)
            </button>
          </div>

          {activeTab === "audit" && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void loadAuditLogs();
              }}
              className="mb-6 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm sm:flex-row"
            >
              <label className="sr-only" htmlFor="audit-action-filter">Lọc theo hành động</label>
              <input
                id="audit-action-filter"
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                placeholder="Tên hành động (ví dụ ISSUE_AND_SIGN_CREDENTIAL)"
                className="min-w-0 grow rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="sr-only" htmlFor="audit-status-filter">Lọc theo trạng thái</label>
              <select
                id="audit-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Mọi trạng thái</option>
                <option value="SUCCESS">Thành công</option>
                <option value="FAILED">Thất bại</option>
                <option value="PENDING">Đang xử lý</option>
              </select>
              <button type="submit" className="rounded-lg bg-indigo-700 px-5 py-2 text-sm font-semibold text-white">
                Lọc
              </button>
              {typeof window !== "undefined" &&
                localStorage.getItem("role") === "TENANT_ADMIN" && (
                  <a
                    href={`/api/logs/audit/export?${new URLSearchParams({
                      ...(actionFilter.trim() ? { action: actionFilter.trim() } : {}),
                      ...(statusFilter ? { status: statusFilter } : {}),
                    })}`}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700"
                  >
                    Xuất CSV
                  </a>
                )}
            </form>
          )}

          {/* PANEL 1: AUDIT LOGS */}
          {activeTab === "audit" && (
            <div className="block bg-white shadow-xl shadow-slate-200/40 rounded-2xl border border-slate-100 overflow-hidden flex-col transition-opacity duration-300">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold">Thời gian</th>
                      <th className="p-4 font-bold">Hành động</th>
                      <th className="p-4 font-bold">Đối tượng</th>
                      <th className="p-4 font-bold">Trạng thái</th>
                      <th className="p-4 font-bold">IP & Thiết bị</th>
                      <th className="p-4 font-bold text-right">
                        Mã Hash (Bảo mật)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-50">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-slate-400"
                        >
                          <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-indigo-400"></i>
                          <p>Đang tải dữ liệu Audit...</p>
                        </td>
                      </tr>
                    ) : auditLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-slate-500"
                        >
                          Không có nhật ký hoạt động nào.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => {
                        const date = new Date(log.created_at).toLocaleString(
                          "vi-VN",
                        );
                        const hashAbbr = log.log_hash
                          ? `${log.log_hash.substring(0, 12)}...`
                          : "N/A";

                        return (
                          <tr
                            key={log.id}
                            className="hover:bg-slate-50/50 transition-colors group"
                          >
                            <td className="p-4 whitespace-nowrap text-slate-600 font-medium">
                              {date}
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              {formatAction(log.action)}
                            </td>
                            <td className="p-4">
                              {log.target_type && (
                                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider block">
                                  {log.target_type}
                                </span>
                              )}
                              <span className="text-slate-700 font-medium">
                                {log.target_id ? `#${log.target_id}` : "-"}
                              </span>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              {formatStatus(log.status)}
                            </td>
                            <td className="p-4 text-xs text-slate-500">
                              <div
                                className="truncate w-32"
                                title={log.user_agent || "N/A"}
                              >
                                <i className="fa-solid fa-globe mr-1 text-slate-400"></i>{" "}
                                {log.ip_address || "Local"}
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <span
                                className="font-mono text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded cursor-pointer hover:bg-slate-200 hover:text-slate-700 transition-colors"
                                title={log.log_hash}
                              >
                                {hashAbbr}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between text-sm text-slate-500">
                <span>Hiển thị 50 bản ghi gần nhất</span>
                <div className="flex items-center space-x-1">
                  <i className="fa-solid fa-lock text-emerald-500 mr-1"></i> Dữ
                  liệu được bảo vệ bằng Hashing
                </div>
              </div>
            </div>
          )}

          {/* PANEL 2: VERIFY LOGS */}
          {activeTab === "verify" && (
            <div className="bg-white shadow-xl shadow-slate-200/40 rounded-2xl border border-slate-100 p-6 transition-opacity duration-300">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-700">
                  Lịch sử Xác thực Tài liệu
                </h3>
                <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                  Tối đa 50 lượt kiểm tra gần nhất
                </span>
              </div>
              <div className="space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <div className="text-center">
                      <i className="fa-solid fa-circle-notch fa-spin text-3xl mb-3 text-emerald-400"></i>
                      <p className="font-medium">
                        Đang tải dữ liệu Xác thực...
                      </p>
                    </div>
                  </div>
                ) : verifyLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <i className="fa-solid fa-folder-open text-4xl mb-3 text-slate-300"></i>
                    <p>Bạn chưa thực hiện xác thực tài liệu nào.</p>
                  </div>
                ) : (
                  verifyLogs.map((log) => {
                    const date = new Date(log.created_at).toLocaleString(
                      "vi-VN",
                    );
                    const credId = log.credential_id || log.document_id;

                    return (
                      <div
                        key={log.id}
                        className={`flex flex-col md:flex-row gap-4 p-5 rounded-2xl border ${
                          log.is_valid
                            ? "border-emerald-100 hover:border-emerald-300"
                            : "border-rose-100 hover:border-rose-300"
                        } bg-white transition-colors shadow-sm`}
                      >
                        {/* Cột trái */}
                        <div className="md:w-1/3 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-5">
                          <div className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-1">
                            Thời gian kiểm tra
                          </div>
                          <div className="font-medium text-slate-700 mb-4 text-sm">
                            <i className="fa-regular fa-clock mr-1.5 text-slate-400"></i>{" "}
                            {date}
                          </div>

                          <div className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-1">
                            Tài liệu tham chiếu
                          </div>
                          <div className="font-semibold text-indigo-600 text-sm">
                            <i className="fa-solid fa-file-pdf mr-1.5"></i>{" "}
                            {credId
                              ? `Credential #${credId}`
                              : "File tải lên trực tiếp"}
                          </div>
                        </div>

                        {/* Cột phải */}
                        <div className="md:w-2/3 flex flex-col justify-center">
                          {log.is_valid ? (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-start">
                              <div className="bg-emerald-100 text-emerald-600 rounded-full w-8 h-8 flex items-center justify-center shrink-0 mr-3 mt-0.5">
                                <i className="fa-solid fa-check"></i>
                              </div>
                              <div>
                                <h4 className="font-bold text-emerald-800 text-sm mb-1">
                                  HỢP LỆ
                                </h4>
                                <p
                                  className="text-xs text-emerald-700/80 leading-relaxed"
                                  title={log.message}
                                >
                                  {log.message}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-start">
                              <div className="bg-rose-100 text-rose-600 rounded-full w-8 h-8 flex items-center justify-center shrink-0 mr-3 mt-0.5">
                                <i className="fa-solid fa-xmark"></i>
                              </div>
                              <div>
                                <h4 className="font-bold text-rose-800 text-sm mb-1">
                                  KHÔNG HỢP LỆ / CẢNH BÁO
                                </h4>
                                <p
                                  className="text-xs text-rose-700/80 leading-relaxed"
                                  title={log.message}
                                >
                                  {log.message}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
