import enum


class TenantStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"


class UserRole(str, enum.Enum):
    PLATFORM_SUPER_ADMIN = "PLATFORM_SUPER_ADMIN"
    TENANT_ADMIN = "TENANT_ADMIN"
    TENANT_OPERATOR = "TENANT_OPERATOR"


class LogLevel(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class ActionStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PENDING = "PENDING"


class TargetResourceType(str, enum.Enum):
    TENANT = "TENANT"
    USER = "USER"
    KEY = "KEY"
    CERTIFICATE = "CERTIFICATE"
    CREDENTIAL = "CREDENTIAL"
    SIGNATURE = "SIGNATURE"
    SYSTEM = "SYSTEM"


class KeyStorageType(str, enum.Enum):
    SERVER = "server"


class SignatureAlgo(str, enum.Enum):
    RSA = "RSA"
    ECDSA = "ECDSA"


class HashAlgo(str, enum.Enum):
    SHA_256 = "SHA-256"


class CertType(str, enum.Enum):
    ROOT = "root"
    INTERMEDIATE = "intermediate"
    END_ENTITY = "end_entity"


class CredentialStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    REVOKED = "REVOKED"


def enum_values(enum_type: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_type]
