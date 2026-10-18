import asyncio
import hashlib
import io

from asn1crypto import x509
from fastapi import UploadFile
from pyhanko.pdf_utils.reader import PdfFileReader
from pyhanko.sign import validation
from pyhanko_certvalidator import ValidationContext
from pyhanko_certvalidator.errors import PathBuildingError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.certificate import Certificate
from app.models.credential import Credential
from app.models.enums import ActionStatus, CertType, CredentialStatus, TargetResourceType
from app.services.log_service import log_service
from app.services.verify_log_service import verify_log_service


class VerifyService:
    MAX_FILE_SIZE = 20 * 1024 * 1024

    async def verify_pdf_signature(
        self,
        db: AsyncSession,
        file: UploadFile | bytes,
        user_id: int | None = None,
        tenant_id: int | None = None,
    ):
        """Xác thực chữ ký số PAdES hoàn toàn trên bộ nhớ RAM (Stateless)."""
        if isinstance(file, UploadFile):
            pdf_bytes = await file.read(self.MAX_FILE_SIZE + 1)
            filename = file.filename
        elif isinstance(file, (bytes, bytearray)):
            pdf_bytes = bytes(file)
            filename = "uploaded_document.pdf"
        else:
            raise ValueError("Cần cung cấp dữ liệu PDF hợp lệ để xác thực.")

        if len(pdf_bytes) > self.MAX_FILE_SIZE:
            raise ValueError("Tệp PDF vượt quá giới hạn 20 MB.")

        if not pdf_bytes:
            msg = "File PDF tải lên bị rỗng (0 bytes)."
            await log_service.log_action(
                db=db,
                tenant_id=tenant_id,
                user_id=user_id,
                action="VERIFY_DOCUMENT",
                target_type=TargetResourceType.CREDENTIAL,
                target_id=filename,
                status=ActionStatus.FAILED,
                payload={"reason": "File rỗng"},
            )
            await verify_log_service.create_verify_log(
                db=db,
                tenant_id=tenant_id,
                tracking_id=None,
                credential_id=None,
                signature_id=None,
                verified_by_user_id=user_id,
                is_valid=False,
                message=msg,
            )
            return {
                "is_valid": False,
                "is_integrity_valid": False,
                "is_cert_valid": False,
                "message": msg,
                "signer_info": None,
            }

        try:
            content_hash = hashlib.sha256(pdf_bytes).hexdigest()
            credential_result = await db.execute(
                select(Credential).where(
                    (Credential.signed_hash == content_hash)
                    | (Credential.original_hash == content_hash)
                )
            )
            credential = credential_result.scalar_one_or_none()
            tracking_id = credential.tracking_id if credential else None
            credential_id = credential.id if credential else None
            if credential and credential.status == CredentialStatus.REVOKED:
                msg = "Văn bằng đã bị thu hồi."
                await verify_log_service.create_verify_log(
                    db=db,
                    tenant_id=tenant_id,
                    tracking_id=tracking_id,
                    credential_id=credential_id,
                    signature_id=None,
                    verified_by_user_id=user_id,
                    is_valid=False,
                    is_integrity_valid=False,
                    is_cert_valid=False,
                    message=msg,
                )
                return {
                    "is_valid": False,
                    "is_integrity_valid": False,
                    "is_cert_valid": False,
                    "is_not_revoked": False,
                    "message": msg,
                    "signer_info": None,
                }
            root_result = await db.execute(
                select(Certificate).filter(Certificate.cert_type == CertType.ROOT)
            )
            inter_result = await db.execute(
                select(Certificate).filter(Certificate.cert_type == CertType.INTERMEDIATE)
            )

            trust_roots = [
                x509.Certificate.load(r.certificate_data)
                for r in root_result.scalars().all()
                if r.certificate_data
            ]
            other_certs = [
                x509.Certificate.load(i.certificate_data)
                for i in inter_result.scalars().all()
                if i.certificate_data
            ]

            if not trust_roots:
                msg = "Hệ thống chưa có Root CA để đối chiếu. Vui lòng nạp Seed Data."
                return {
                    "is_valid": False,
                    "is_integrity_valid": False,
                    "is_cert_valid": False,
                    "message": msg,
                    "signer_info": None,
                }

            vc = ValidationContext(trust_roots=trust_roots, other_certs=other_certs)
            result = await asyncio.to_thread(self._sync_verify_pdf_bytes, pdf_bytes, vc)

            if credential and credential.tenant_id:
                signer_cert_data = result.pop("_signer_cert_data", None)
                if signer_cert_data:
                    signer_cert_result = await db.execute(
                        select(Certificate).where(Certificate.certificate_data == signer_cert_data)
                    )
                    signer_certificate = signer_cert_result.scalar_one_or_none()
                    if signer_certificate and signer_certificate.tenant_id != credential.tenant_id:
                        result.update(
                            {
                                "is_valid": False,
                                "is_cert_valid": False,
                                "message": (
                                    "Chứng thư số không thuộc quyền sở hữu của tổ chức "
                                    "phát hành văn bằng này."
                                ),
                            }
                        )

            await log_service.log_action(
                db=db,
                tenant_id=tenant_id,
                user_id=user_id,
                action="VERIFY_DOCUMENT",
                target_type=TargetResourceType.CREDENTIAL,
                target_id=filename,
                status=ActionStatus.SUCCESS if result.get("is_valid") else ActionStatus.FAILED,
                payload={"message": result.get("message")},
            )

            await verify_log_service.create_verify_log(
                db=db,
                tenant_id=tenant_id,
                tracking_id=tracking_id,
                credential_id=credential_id,
                signature_id=None,
                verified_by_user_id=user_id,
                is_valid=result.get("is_valid", False),
                is_integrity_valid=result.get("is_integrity_valid"),
                is_cert_valid=result.get("is_cert_valid"),
                message=result.get("message"),
                signer_snapshot=result.get("signer_info"),
            )

            return result

        except PathBuildingError:
            msg = "Chữ ký KHÔNG HỢP LỆ: Không thể xác minh chuỗi tin cậy chứng chỉ."
            return {
                "is_valid": False,
                "is_integrity_valid": False,
                "is_cert_valid": False,
                "message": msg,
                "signer_info": None,
            }
        except Exception as e:
            # Ngăn ngừa sập API khi gặp PDF sai cấu trúc
            msg = f"Không thể xử lý hoặc phân tích tệp PDF: {str(e)}"
            return {
                "is_valid": False,
                "is_integrity_valid": False,
                "is_cert_valid": False,
                "message": msg,
                "signer_info": None,
            }

    def _sync_verify_pdf_bytes(self, pdf_bytes: bytes, vc: ValidationContext) -> dict:
        """Kiểm tra chữ ký số PAdES sử dụng BytesIO trong RAM."""
        with io.BytesIO(pdf_bytes) as pdf_stream:
            reader = PdfFileReader(pdf_stream, strict=False)
            embedded_signatures = reader.embedded_signatures
            if not embedded_signatures:
                return {
                    "is_valid": False,
                    "is_integrity_valid": False,
                    "is_cert_valid": False,
                    "message": "Văn bản chưa được ký điện tử (Không tìm thấy trường chữ ký).",
                    "signer_info": None,
                }

            sig_field = embedded_signatures[-1]
            signer_cert = getattr(sig_field, "signer_cert", None)
            status = validation.validate_pdf_signature(sig_field, signer_validation_context=vc)

            subject_info = (
                signer_cert.subject.human_friendly
                if signer_cert and hasattr(signer_cert.subject, "human_friendly")
                else "Không xác định"
            )
            issuer_info = (
                signer_cert.issuer.human_friendly
                if signer_cert and hasattr(signer_cert.issuer, "human_friendly")
                else "Không xác định"
            )

            sig_dict = sig_field.sig_object
            reason = sig_dict.get("/Reason", "")
            reason_str = reason.decode("utf-8") if hasattr(reason, "decode") else str(reason)

            signer_info_dict = {
                "subject": subject_info,
                "issuer": issuer_info,
                "reason": reason_str or "Không xác định",
                "has_tsa": bool(status.timestamp_validity),
                "is_entire_file": status.coverage.name == "ENTIRE_FILE",
                "coverage_name": status.coverage.name,
            }

            is_ok = bool(status.valid and status.intact)
            return {
                "is_valid": is_ok,
                "is_integrity_valid": status.intact,
                "is_cert_valid": status.valid,
                "message": "Kiểm tra chữ ký thành công." if is_ok else "Chữ ký không hợp lệ.",
                "signer_info": signer_info_dict,
                "_signer_cert_data": signer_cert.dump() if signer_cert else None,
            }


verify_service = VerifyService()
