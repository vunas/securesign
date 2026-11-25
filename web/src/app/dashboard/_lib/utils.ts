import { getSwal } from "@/lib/swal";
import type { KeyItem, SignatureItem } from "./types";

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function extractDayLabel(signedAt: string): string {
  const isoMatch = signedAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}`;
  const vnMatch = signedAt.match(/^(\d{2})\/(\d{2})\/\d{4}/);
  if (vnMatch) return `${vnMatch[1]}/${vnMatch[2]}`;
  return signedAt.slice(0, 10);
}

export function openPublicKeyModal(key: KeyItem) {
  const Swal = getSwal();
  if (!Swal) {
    alert(key.public_key);
    return;
  }

  void Swal.fire({
    title:
      '<span class="text-lg font-bold text-slate-900"><i class="fa-solid fa-key text-indigo-600 mr-2"></i>Khóa Công Khai (Public Key)</span>',
    html: `<div class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <textarea readonly class="h-56 w-full resize-none border-0 bg-transparent p-2 font-mono text-xs leading-relaxed text-slate-700 outline-none">${escapeHtml(key.public_key)}</textarea>
           </div>
           <p class="mt-3 text-left text-xs text-slate-500"><i class="fa-solid fa-circle-info text-indigo-600 mr-1"></i> Public Key này được nhúng công khai vào PDF để đối tác xác thực chữ ký của tổ chức.</p>`,
    width: 650,
    confirmButtonText: "Đóng",
    confirmButtonColor: "#4f46e5",
  });
}

export function openSignatureDetailsModal(sig: SignatureItem) {
  const Swal = getSwal();
  if (!Swal) return;

  void Swal.fire({
    title:
      '<span class="text-lg font-bold text-slate-900"><i class="fa-solid fa-file-shield text-indigo-600 mr-2"></i>Chi Tiết Chữ Ký Số</span>',
    html: `<div class="mt-3 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-xs">
          <div><span class="text-slate-500">Tài liệu:</span> <b class="text-slate-900">${escapeHtml(sig.credential_name)}</b></div>
          <div><span class="text-slate-500">Người đại diện ký:</span> <b class="text-slate-900">${escapeHtml(sig.signer)}</b></div>
          <div><span class="text-slate-500">Khóa sử dụng:</span> <b class="text-slate-900">${escapeHtml(sig.key_name)}</b></div>
          <div><span class="text-slate-500">Thuật toán:</span> <b class="font-mono text-indigo-700">${escapeHtml(sig.algorithm)}</b></div>
          <div><span class="text-slate-500">Thời gian (TSA):</span> <b class="text-slate-900">${escapeHtml(sig.signed_at)}</b></div>
          <div class="border-t border-slate-200 pt-2.5 font-mono text-[10px] break-all text-slate-600">
            <b class="text-slate-800">Giá trị chữ ký (Base64):</b><br/>${escapeHtml(sig.signature_base64.substring(0, 96))}...
          </div>
         </div>
         <p class="mt-3 text-left text-xs text-slate-500"><i class="fa-solid fa-shield-check text-emerald-600 mr-1"></i> Tệp PDF đã ký được trả trực tiếp về thiết bị của người phát hành theo kiến trúc Stateless.</p>`,
    width: 600,
    confirmButtonText: "Đóng",
    confirmButtonColor: "#4f46e5",
  });
}