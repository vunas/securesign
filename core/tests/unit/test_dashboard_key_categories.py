from types import SimpleNamespace

import pytest

from app.models.enums import CertType
from app.routers.dashboard_router import _key_category


@pytest.mark.parametrize(
    ("certificate", "expected"),
    [
        (None, "UNCERTIFIED"),
        (SimpleNamespace(cert_type=CertType.ROOT, purpose="document_signing"), "ROOT_CA"),
        (
            SimpleNamespace(cert_type=CertType.INTERMEDIATE, purpose="document_signing"),
            "INTERMEDIATE_CA",
        ),
        (
            SimpleNamespace(cert_type=CertType.END_ENTITY, purpose="timestamping"),
            "TSA",
        ),
        (SimpleNamespace(cert_type=CertType.END_ENTITY, purpose="document_signing"), "SIGNING"),
    ],
)
def test_key_category_is_derived_from_linked_certificate(certificate, expected):
    assert _key_category(certificate) == expected
