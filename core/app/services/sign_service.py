import asyncio
import hashlib
import io
import logging
import os
from datetime import datetime

import httpx
from asn1crypto import keys, pem, x509
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign import signers
from pyhanko.sign.fields import SigSeedSubFilter
from pyhanko.sign.timestamps import HTTPTimeStamper
from pyhanko_certvalidator.registry import SimpleCertificateStore
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import TargetResourceType
from app.repositories.certificate_repo import certificate_repo
from app.repositories.credential_repo import credential_repo
from app.repositories.key_repo import key_repo
from app.repositories.signature_repo import signature_repo
from app.schemas.signature_schema import SignatureCreate
from app.services.crypto.aes_service import aes_service
from app.services.log_service import log_service


class SignService:
    async def sign_pdf(
        self,
        db: AsyncSession,
        pdf_bytes: bytes,
        tenant_id: int,
        sign_data: SignatureCreate,
        user_id: int | None = None,
    ) -> tuple[bytes, str]:
        """Thực hiện nhúng chữ ký số PAdES vào tệp PDF trên bộ nhớ tạm (Stateless)."""
        if not pdf_bytes:
            raise ValueError("PDF payload không được rỗng.")
        if tenant_id is None:
            raise ValueError("Tenant ID là bắt buộc.")

        credential, key_record, cert_record = await self._get_and_validate_records(
            db, tenant_id, sign_data
        )

        private_key = self._load_private_key(key_record, sign_data)
        end_entity_cert = self._load_certificate(cert_record)
        cert_registry = await self._build_certificate_registry(db)
        timestamper = await self._setup_timestamper()

        # Xử lý ký số trong RAM qua ThreadPool để tránh nghẽn Event Loop
        signed_pdf_bytes, new_signed_hash = await asyncio.to_thread(
            self._execute_pdf_signing,
            pdf_bytes=pdf_bytes,
            private_key=private_key,
            end_entity_cert=end_entity_cert,
            cert_registry=cert_registry,
            timestamper=timestamper,
            sign_data=sign_data,
        )

        # Cập nhật mã băm đối soát vào sổ cái
        credential.mark_as_signed(new_signed_hash)

        # Tạo bản ghi chữ ký phục vụ kiểm toán
        signature_record = await signature_repo.create(
            db=db,
            credential_id=credential.id,
            key_id=key_record.id,
            certificate_id=cert_record.id,
            user_id=user_id,
            signer_name=sign_data.signer_name,
            signer_reason=sign_data.signer_reason,
            signer_location=sign_data.signer_location,
            visible_signature=True,
        )

        await log_service.log_action(
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            action="SIGN_DOCUMENT",
            target_type=TargetResourceType.SIGNATURE,
            target_id=str(signature_record.id),
            payload={
                "credential_id": credential.id,
                "signer_name": sign_data.signer_name,
            },
        )

        return signed_pdf_bytes, new_signed_hash

    async def _get_and_validate_records(
        self,
        db: AsyncSession,
        tenant_id: int,
        sign_data: SignatureCreate,
    ):
        credential = await credential_repo.get_by_id(db, sign_data.credential_id, tenant_id)
        key_record = await key_repo.get_by_id(db, sign_data.key_id, tenant_id)

        cert_record = None
        if key_record:
            cert_record = await certificate_repo.get_by_key_id(db, key_record.id, tenant_id)

        if not credential or not key_record or not cert_record:
            raise ValueError(
                "Không tìm thấy tài liệu/credential, khóa hoặc chứng thư số tương ứng của tenant."
            )

        if not cert_record.is_valid_now():
            raise ValueError("Chứng chỉ không hợp lệ hoặc đã hết hạn.")

        return credential, key_record, cert_record

    def _load_private_key(self, key_record, sign_data: SignatureCreate):
        # 1. Luôn giải mã AES Master Key trước
        try:
            priv_key_bytes = aes_service.decrypt_key(key_record.private_key_encrypted)
        except Exception as exc:
            raise ValueError("Mật khẩu giải mã khóa không đúng hoặc sai định dạng PEM.") from exc

        # 2. Giải mã bằng Passphrase nếu có đặt mật khẩu phụ
        try:
            password = (
                sign_data.passphrase.encode("utf-8")
                if getattr(sign_data, "passphrase", None)
                else None
            )
            crypto_priv_key = load_pem_private_key(priv_key_bytes, password=password)
        except Exception:
            raise ValueError("Mật khẩu giải mã khóa không đúng hoặc sai định dạng PEM.")

        der_key_bytes = crypto_priv_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        return keys.PrivateKeyInfo.load(der_key_bytes)

    def _load_certificate(self, cert_record):
        cert_bytes = getattr(cert_record, "certificate_data", None) or getattr(
            cert_record, "certificate_pem", None
        )
        if not cert_bytes:
            raise ValueError("Không tìm thấy dữ liệu chứng chỉ trong cơ sở dữ liệu.")

        if isinstance(cert_bytes, str):
            cert_bytes = cert_bytes.encode("utf-8")
        if pem.detect(cert_bytes):
            _, _, der_cert_bytes = pem.unarmor(cert_bytes)
            return x509.Certificate.load(der_cert_bytes)
        return x509.Certificate.load(cert_bytes)

    async def _build_certificate_registry(self, db: AsyncSession):
        cert_registry = SimpleCertificateStore()
        inter_cert_record = await certificate_repo.get_by_name(db, "SecureSign Intermediate CA")

        if inter_cert_record:
            inter_cert_bytes = getattr(inter_cert_record, "certificate_data", None) or getattr(
                inter_cert_record, "certificate_pem", None
            )
            if inter_cert_bytes:
                if isinstance(inter_cert_bytes, str):
                    inter_cert_bytes = inter_cert_bytes.encode("utf-8")
                if pem.detect(inter_cert_bytes):
                    _, _, der_inter_bytes = pem.unarmor(inter_cert_bytes)
                    inter_cert = x509.Certificate.load(der_inter_bytes)
                else:
                    inter_cert = x509.Certificate.load(inter_cert_bytes)
                cert_registry.register(inter_cert)
        return cert_registry

    async def _setup_timestamper(self):
        tsa_url = os.getenv("TSA_URL")
        if not tsa_url:
            return None
        try:
            async with httpx.AsyncClient(timeout=2) as client:
                await client.get(tsa_url)
            return HTTPTimeStamper(tsa_url)
        except (httpx.TimeoutException, httpx.RequestError, ValueError) as e:
            logging.warning(f"External TSA không phản hồi: {e}")
            return None

    def _execute_pdf_signing(
        self,
        pdf_bytes: bytes,
        private_key,
        end_entity_cert,
        cert_registry,
        timestamper,
        sign_data: SignatureCreate,
    ) -> tuple[bytes, str]:
        """Ký số PDF trực tiếp trên RAM buffers theo chuẩn PAdES."""
        input_buffer = io.BytesIO(pdf_bytes)
        output_buffer = io.BytesIO()

        signer = signers.SimpleSigner(
            signing_cert=end_entity_cert, signing_key=private_key, cert_registry=cert_registry
        )
        pdf_writer = IncrementalPdfFileWriter(input_buffer, strict=False)
        metadata = signers.PdfSignatureMetadata(
            field_name=f"Sig_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            location=sign_data.signer_location,
            reason=sign_data.signer_reason,
            name=sign_data.signer_name,
            subfilter=SigSeedSubFilter.PADES,
            embed_validation_info=False,
        )

        try:
            signers.sign_pdf(
                pdf_writer,
                metadata,
                signer=signer,
                timestamper=timestamper,
                existing_fields_only=False,
                in_place=False,
                output=output_buffer,
            )
        except Exception:
            if not timestamper:
                raise
            # Fallback nếu TSA lỗi
            input_buffer.seek(0)
            output_buffer = io.BytesIO()
            signers.sign_pdf(
                IncrementalPdfFileWriter(input_buffer, strict=False),
                metadata,
                signer=signer,
                timestamper=None,
                existing_fields_only=False,
                in_place=False,
                output=output_buffer,
            )

        signed_content = output_buffer.getvalue()
        return signed_content, hashlib.sha256(signed_content).hexdigest()


sign_service = SignService()
