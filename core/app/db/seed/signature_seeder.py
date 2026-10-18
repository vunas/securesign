from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import CredentialStatus
from app.models.signature import Signature
from app.models.timestamp import Timestamp


async def seed_signatures(
    db: AsyncSession,
    docs: list,
    pki_data: dict,
    users: dict,
):
    print("✍️ Đang tạo Signatures...")

    giamdoc = users["giamdoc"]
    # Trạng thái mới của schema là ISSUED
    signed_credentials = [
        credential for credential in docs if credential.status == CredentialStatus.ISSUED
    ]
    for credential in signed_credentials:
        signature = Signature(
            credential_id=credential.id,
            key_id=pki_data["user_key"].id,
            certificate_id=pki_data["user_cert"].id,
            user_id=giamdoc.id,
            signature_value=b"fake_signature",
            hash_algorithm="SHA-256",
            signature_algorithm="RSA",
            visible_signature=True,
            signer_name="Nguyễn Văn A",
            signer_reason="Đã phê duyệt",
            signer_location="TP. Hồ Chí Minh",
        )
        db.add(signature)
        await db.commit()
        await db.refresh(signature)

        db.add(
            Timestamp(
                signature_id=signature.id,
                timestamp_token=b"fake_tsa_token",
                hashed_data="fake_hash_data",
                tsa_name="SecureSign Internal TSA",
            )
        )

    await db.commit()
    print("  -> Đã tạo Signatures & TSA")
