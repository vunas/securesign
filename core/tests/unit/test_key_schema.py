import pytest
from pydantic import ValidationError

from app.models.enums import SignatureAlgo
from app.schemas.key_schema import KeyCreate


@pytest.mark.unit
@pytest.mark.parametrize(
    ("algorithm", "expected_size"),
    [(SignatureAlgo.RSA, 2048), (SignatureAlgo.ECDSA, 256)],
)
def test_key_size_defaults_to_algorithm(algorithm, expected_size):
    key = KeyCreate(key_name="  demo key  ", algorithm=algorithm)

    assert key.key_name == "demo key"
    assert key.key_size == expected_size


@pytest.mark.unit
def test_key_name_cannot_be_only_whitespace():
    with pytest.raises(ValidationError):
        KeyCreate(key_name="   ")
