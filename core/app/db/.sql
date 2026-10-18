-- =============================================================================
-- NHÓM 1: ĐỊNH NGHĨA KIỂU DỮ LIỆU & TIỆN ÍCH DÙNG CHUNG (ENUMS & UTILITIES)
-- =============================================================================

-- Trạng thái vòng đời của tổ chức/trường học (Tenant)
CREATE TYPE tenant_status AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- Phân quyền quản trị nội bộ theo vai trò (RBAC)
CREATE TYPE user_role AS ENUM (
    'PLATFORM_SUPER_ADMIN', -- Quản trị viên tối cao của toàn hệ thống
    'TENANT_ADMIN',         -- Quản trị viên của trường (quản lý nhân sự, khóa, API Key)
    'TENANT_OPERATOR'       -- Cán bộ phòng đào tạo (tạo mẫu, nạp danh sách, ký duyệt)
);

-- Cơ chế lưu trữ khóa bí mật (Chỉ lưu mã hóa trên server qua Master Key AES-256-GCM)
CREATE TYPE key_storage_type AS ENUM ('server');

-- Thuật toán ký số và thuật toán băm chuẩn PAdES
CREATE TYPE signature_algo AS ENUM ('RSA', 'ECDSA');
CREATE TYPE hash_algo      AS ENUM ('SHA-256');

-- Cấp bậc chứng thư số X.509
CREATE TYPE cert_type AS ENUM ('root', 'intermediate', 'end_entity');

-- Trạng thái vòng đời văn bằng số
CREATE TYPE credential_status AS ENUM ('DRAFT', 'ISSUED', 'REVOKED');

-- Nhật ký kiểm toán & giám sát
CREATE TYPE log_level            AS ENUM ('INFO', 'WARNING', 'ERROR');
CREATE TYPE action_status        AS ENUM ('SUCCESS', 'FAILED', 'PENDING');
CREATE TYPE target_resource_type AS ENUM (
    'TENANT',
    'USER',
    'KEY',
    'CERTIFICATE',
    'DOCUMENT',
    'CREDENTIAL',
    'SIGNATURE',
    'SYSTEM'
);

-- Hàm tự động cập nhật trường updated_at
CREATE OR REPLACE FUNCTION update_updated_at() 
RETURNS TRIGGER AS $$ 
BEGIN 
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- NHÓM 2: QUẢN TRỊ ĐA TỔ CHỨC & PHÂN QUYỀN (MULTI-TENANCY & RBAC)
-- =============================================================================

-- 2.1. BẢNG TENANTS (Trường học / Viện đào tạo / Tổ chức đối tác)
CREATE TABLE tenants (
    id              SERIAL PRIMARY KEY,
    tenant_code     VARCHAR(50) UNIQUE NOT NULL,      -- VD: 'HCMUT', 'NEU', 'UEH'
    name            VARCHAR(255) NOT NULL,            -- Tên trường học/tổ chức
    domain          VARCHAR(100) UNIQUE,              -- Tên miền định danh (VD: 'hcmut.edu.vn')
    email           VARCHAR(100) NOT NULL,            -- Email đại diện quản trị
    logo_url        TEXT,                             -- Logo hiển thị trên trang xác thực công khai
    website_url     TEXT,
    status          tenant_status DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_tenants_updated_at 
BEFORE UPDATE ON tenants 
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2.2. BẢNG USERS (Tài khoản cán bộ và quản trị viên)
CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    tenant_id      INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    username       VARCHAR(50) UNIQUE NOT NULL,
    email          VARCHAR(100) UNIQUE,
    full_name      VARCHAR(100),
    password_hash  TEXT NOT NULL,
    role           user_role DEFAULT 'TENANT_OPERATOR',
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- PLATFORM_SUPER_ADMIN không thuộc tenant; các role khác bắt buộc thuộc 1 tenant
    CONSTRAINT chk_user_tenant_role CHECK (
        (role = 'PLATFORM_SUPER_ADMIN' AND tenant_id IS NULL)
        OR (role != 'PLATFORM_SUPER_ADMIN' AND tenant_id IS NOT NULL)
    )
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);

CREATE TRIGGER trg_users_updated_at 
BEFORE UPDATE ON users 
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2.3. BẢNG TENANT_QUOTAS (Quản lý hạn ngạch ký số theo tháng)
CREATE TABLE tenant_quotas (
    id            SERIAL PRIMARY KEY,
    tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    monthly_limit INTEGER NOT NULL DEFAULT 1000,
    used_count    INTEGER NOT NULL DEFAULT 0,
    period_start  DATE NOT NULL,
    period_end    DATE NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_tenant_period UNIQUE (tenant_id, period_start, period_end),
    -- Khóa cứng ở tầng DB chống Race Condition khi gọi API ký đồng thời vượt hạn ngạch
    CONSTRAINT chk_quota_limits CHECK (used_count >= 0 AND used_count <= monthly_limit)
);

CREATE INDEX idx_quotas_tenant ON tenant_quotas(tenant_id);

-- 2.4. BẢNG API_KEYS (Tích hợp tự động hóa qua phần mềm ngoài LMS / SIS / ERP)
CREATE TABLE api_keys (
    id                 SERIAL PRIMARY KEY,
    tenant_id          INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name               VARCHAR(100) NOT NULL,           -- VD: 'LMS Production Key'
    key_prefix         VARCHAR(16) NOT NULL,            -- VD: 'vck_live_9a1f'
    key_hash           VARCHAR(255) NOT NULL UNIQUE,    -- Băm SHA-256 của API Secret, không lưu plain text
    rate_limit_per_min INTEGER DEFAULT 60,
    is_active          BOOLEAN DEFAULT TRUE,
    last_used_at       TIMESTAMPTZ,
    expires_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);


-- =============================================================================
-- NHÓM 3: HẠ TẦNG KHÓA MẬT MÃ & CHỨNG THƯ SỐ (PRIVATE PKI)
-- =============================================================================

-- 3.1. BẢNG KEYS (Cặp khóa mật mã đại diện pháp nhân của Tenant)
CREATE TABLE keys (
    id                    SERIAL PRIMARY KEY,
    tenant_id             INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, -- Khóa thuộc sở hữu trường
    user_id               INTEGER REFERENCES users(id) ON DELETE SET NULL,           -- Cán bộ khởi tạo khóa
    key_name              VARCHAR(100),
    public_key            BYTEA NOT NULL,
    private_key_encrypted BYTEA NOT NULL,             -- Khóa bí mật đã mã hóa bằng Master Key (AES-256-GCM)
    key_size              INTEGER DEFAULT 2048,
    algorithm             signature_algo DEFAULT 'RSA',
    storage_type          key_storage_type DEFAULT 'server',
    storage_provider      VARCHAR(50),
    key_fingerprint       TEXT,
    is_revoked            BOOLEAN DEFAULT FALSE,
    created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_keys_tenant_id ON keys(tenant_id);
CREATE INDEX idx_keys_user_id ON keys(user_id);

-- 3.2. BẢNG CERTIFICATES (Chứng thư số X.509 chứng thực cho cặp khóa của Tenant)
CREATE TABLE certificates (
    id               SERIAL PRIMARY KEY,
    tenant_id        INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    key_id           INTEGER NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
    cert_name        VARCHAR(100),
    serial_number    VARCHAR(100) UNIQUE,
    issuer           VARCHAR(255),
    subject          VARCHAR(255),
    cert_type        cert_type DEFAULT 'end_entity',
    purpose          VARCHAR(50) DEFAULT 'document_signing',
    certificate_data BYTEA NOT NULL,                  -- Định dạng nhị phân DER
    certificate_pem  TEXT,                            -- Định dạng PEM Base64
    valid_from       TIMESTAMPTZ,
    valid_to         TIMESTAMPTZ,
    is_revoked       BOOLEAN DEFAULT FALSE,
    revoked_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cert_tenant_id ON certificates(tenant_id);
CREATE INDEX idx_cert_user_id ON certificates(user_id);
CREATE INDEX idx_cert_key_id ON certificates(key_id);

-- 3.3. BẢNG CERTIFICATE_CHAINS (Lưu vết chuỗi chứng chỉ Intermediate & Root CA)
CREATE TABLE certificate_chains (
    id                  SERIAL PRIMARY KEY,
    certificate_id      INTEGER REFERENCES certificates(id) ON DELETE CASCADE,
    ca_certificate_data BYTEA NOT NULL,
    level               INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cert_chains_cert_id ON certificate_chains(certificate_id);


-- =============================================================================
-- NHÓM 4: QUẢN LÝ VĂN BẰNG & CHỨNG CHỈ SỐ (VERIFIABLE CREDENTIALS)
-- =============================================================================

-- BẢNG CREDENTIALS (Lưu metadata văn bằng, mã băm đối soát Stateless & hỗ trợ quét QR)
CREATE TABLE credentials (
    id                 SERIAL PRIMARY KEY,
    tenant_id          INTEGER NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Định danh tra cứu công khai qua QR / Web Portal
    tracking_id        VARCHAR(64) UNIQUE NOT NULL,      -- UUIDv4 / NanoID nhúng mã QR
    credential_number  VARCHAR(100),                     -- Số hiệu văn bằng / Số quyết định / Số vào sổ
    
    -- Thông tin người thụ hưởng (Dùng chung cho sinh viên, nhân viên, học viên, cá nhân)
    recipient_name     VARCHAR(150) NOT NULL,            -- Họ tên người nhận
    recipient_id       VARCHAR(50),                      -- Mã SV, Mã nhân sự, CCCD hoặc Mã định danh
    issue_date         DATE NOT NULL,                    -- Ngày ban hành / Ngày cấp
    
    -- Dữ liệu linh hoạt theo từng tổ chức (Trường học: major, gpa; Công ty: department, position; Y tế: test_result...)
    metadata           JSONB,
    
    -- Bằng chứng mật mã (Stateless: chỉ lưu băm đối soát, không lưu file PDF nhạy cảm)
    file_name          VARCHAR(255),
    original_hash      TEXT NOT NULL,                    -- H0: Mã băm SHA-256 trước khi ký
    signed_hash        TEXT,                             -- Mã băm SHA-256 sau khi ký PAdES (NULL khi còn DRAFT)
    file_download_url  TEXT,
    
    -- Trạng thái vòng đời & Thu hồi văn bằng (Revocation)
    status             credential_status DEFAULT 'ISSUED',
    revocation_reason  TEXT,
    revoked_at         TIMESTAMPTZ,
    revoked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_credentials_updated_at 
BEFORE UPDATE ON credentials 
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Chỉ mục phục vụ tra cứu
CREATE INDEX idx_credentials_tracking_id ON credentials(tracking_id);
CREATE INDEX idx_credentials_recipient_id ON credentials(recipient_id);
CREATE INDEX idx_credentials_tenant_id ON credentials(tenant_id);
CREATE INDEX idx_credentials_status ON credentials(status);

-- Chỉ mục mã băm phục vụ Cổng thẩm tra kéo thả file
CREATE INDEX idx_credentials_signed_hash ON credentials(signed_hash);
CREATE INDEX idx_credentials_original_hash ON credentials(original_hash);

-- =============================================================================
-- NHÓM 5: CHỮ KÝ SỐ PAdES & MỘC THỜI GIAN (SIGNING ENGINE & TSA RFC 3161)
-- =============================================================================

-- 5.1. BẢNG SIGNATURES (Bản ghi chữ ký số nhị phân nhúng vào văn bằng)
CREATE TABLE signatures (
    id                  SERIAL PRIMARY KEY,
    credential_id       INTEGER NOT NULL REFERENCES credentials(id) ON DELETE RESTRICT,
    key_id              INTEGER NOT NULL REFERENCES keys(id) ON DELETE RESTRICT,
    certificate_id      INTEGER REFERENCES certificates(id) ON DELETE RESTRICT,
    user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Cán bộ thực hiện lệnh ký
    signature_value     BYTEA,                                           -- Khối nhị phân PAdES (PKCS#7 / CMS)
    hash_algorithm      hash_algo DEFAULT 'SHA-256',
    signature_algorithm signature_algo DEFAULT 'RSA',
    visible_signature   BOOLEAN DEFAULT TRUE,                            -- Có hiển thị mộc trực quan không
    signer_name         VARCHAR(100),
    signer_reason       TEXT,
    signer_location     VARCHAR(100),
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sign_credential_id ON signatures(credential_id);
CREATE INDEX idx_sign_user_id ON signatures(user_id);

-- 5.2. BẢNG TIMESTAMPS (Mộc thời gian độc lập RFC 3161)
CREATE TABLE timestamps (
    id              SERIAL PRIMARY KEY,
    signature_id    INTEGER NOT NULL REFERENCES signatures(id) ON DELETE CASCADE,
    timestamp_token BYTEA,       -- Token nhị phân do cơ quan TSA cấp phát
    hashed_data     TEXT,        -- Chuỗi băm gửi lên TSA
    tsa_name        VARCHAR(100),-- Đơn vị cấp mộc thời gian
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_timestamps_signature_id ON timestamps(signature_id);


-- =============================================================================
-- NHÓM 6: THẨM ĐỊNH & NHẬT KÝ KIỂM TOÁN (VERIFICATION & AUDIT TRAIL)
-- =============================================================================

-- 6.1. BẢNG VERIFY_LOGS (Nhật ký các lượt thẩm tra từ công chúng và nhà tuyển dụng)
CREATE TABLE verify_logs (
    id                  SERIAL PRIMARY KEY,
    tenant_id           INTEGER REFERENCES tenants(id) ON DELETE SET NULL,   -- Thống kê lượt quét của từng trường
    credential_id       INTEGER REFERENCES credentials(id) ON DELETE SET NULL, -- Liên kết văn bằng cụ thể nếu tìm thấy
    tracking_id         VARCHAR(64),                                         -- Mã tracking của văn bằng được thẩm tra
    signature_id        INTEGER REFERENCES signatures(id) ON DELETE SET NULL,
    verified_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,     -- NULL nếu là khách vãng lai
    is_valid            BOOLEAN NOT NULL,                                    -- Kết luận tổng quan tính hợp lệ
    is_integrity_valid  BOOLEAN,                                             -- Tính toàn vẹn: Hash file có khớp không
    is_cert_valid       BOOLEAN,                                             -- Chứng thư: Còn hạn và hợp lệ không
    is_not_revoked      BOOLEAN,                                             -- Hiệu lực: Văn bằng có bị thu hồi không
    message             TEXT,
    signer_snapshot     JSONB,
    ip_address          VARCHAR(50),
    user_agent          TEXT,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verify_logs_tenant_id ON verify_logs(tenant_id);
CREATE INDEX idx_verify_logs_credential_id ON verify_logs(credential_id);
CREATE INDEX idx_verify_logs_tracking_id ON verify_logs(tracking_id);
CREATE INDEX idx_verify_logs_created_at ON verify_logs(created_at);

-- 6.2. BẢNG AUDIT_LOGS (Sổ cái kiểm toán bất biến chống chối bỏ)
CREATE TABLE audit_logs (
    id          SERIAL PRIMARY KEY,
    tenant_id   INTEGER REFERENCES tenants(id) ON DELETE SET NULL, -- Cô lập log theo từng trường học
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,   -- Cán bộ thực hiện hành động
    action      VARCHAR(50) NOT NULL,                              -- VD: 'ISSUE_CREDENTIAL', 'REVOKE_CREDENTIAL'
    target_type target_resource_type,
    target_id   VARCHAR(255),
    level       log_level DEFAULT 'INFO',
    status      action_status DEFAULT 'SUCCESS',
    ip_address  VARCHAR(50),
    user_agent  TEXT,
    payload     JSONB,
    log_hash    VARCHAR(255),                                      -- Băm liên kết chuỗi chống sửa đổi log
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);