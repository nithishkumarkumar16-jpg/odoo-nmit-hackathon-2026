-- ========== ENUM TYPES ==========
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'employee');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_status') THEN
        CREATE TYPE employment_status AS ENUM ('active', 'on_leave', 'terminated', 'resigned');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status') THEN
        CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM ('leave', 'attendance', 'payroll', 'system');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'computation_type') THEN
        CREATE TYPE computation_type AS ENUM ('fixed_amount', 'percentage_of_wage', 'percentage_of_basic');
    END IF;
END$$;


-- ========== COMPANIES (multi-tenant root) ==========
CREATE TABLE IF NOT EXISTS companies (
    company_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(150) NOT NULL,
    logo_url     TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== DEPARTMENTS ==========
CREATE TABLE IF NOT EXISTS departments (
    department_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    name           VARCHAR(100) NOT NULL,
    UNIQUE (company_id, name)
);

-- ========== LOGIN ID SERIAL COUNTERS (race-safe per company/year) ==========
CREATE TABLE IF NOT EXISTS login_id_counters (
    company_id    UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    joining_year  SMALLINT NOT NULL,
    last_serial   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (company_id, joining_year)
);

-- ========== USERS (auth root, tenant-scoped) ==========
CREATE TABLE IF NOT EXISTS users (
    user_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    login_id             VARCHAR(30) NOT NULL UNIQUE,
    email                VARCHAR(255) NOT NULL UNIQUE,
    phone                VARCHAR(20),
    password_hash        TEXT NOT NULL,
    role                 user_role NOT NULL DEFAULT 'employee',
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    is_email_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_login_id ON users(login_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    verified_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- ========== EMPLOYEE PROFILES ==========
CREATE TABLE IF NOT EXISTS employee_profiles (
    profile_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    company_id          UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    profile_picture_url TEXT,
    department_id       UUID REFERENCES departments(department_id) ON DELETE SET NULL,
    manager_id          UUID REFERENCES users(user_id) ON DELETE SET NULL,
    designation         VARCHAR(100),
    location            VARCHAR(150),
    date_of_joining     DATE NOT NULL DEFAULT CURRENT_DATE,
    joining_year        SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM date_of_joining)::SMALLINT) STORED,
    joining_serial_no   INTEGER NOT NULL,
    employment_status   employment_status NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (company_id, joining_year, joining_serial_no)
);
CREATE INDEX IF NOT EXISTS idx_profiles_department ON employee_profiles(department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_manager ON employee_profiles(manager_id);

-- ========== RESUME TAB ==========
CREATE TABLE IF NOT EXISTS employee_resume (
    resume_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    about          TEXT,
    job_highlights TEXT,
    skills         TEXT[] NOT NULL DEFAULT '{}',
    certifications TEXT[] NOT NULL DEFAULT '{}',
    interests      TEXT[] NOT NULL DEFAULT '{}',
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== PRIVATE INFO TAB (sensitive — encrypt pan/aadhar/bank at app layer) ==========
CREATE TABLE IF NOT EXISTS employee_private_info (
    private_info_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    date_of_birth            DATE,
    residing_address         TEXT,
    nationality              VARCHAR(80),
    personal_email           VARCHAR(255),
    gender                   VARCHAR(20),
    marital_status           VARCHAR(20),
    emergency_contact_name   VARCHAR(150),
    emergency_contact_phone  VARCHAR(20),
    bank_name                VARCHAR(150),
    bank_account_number_enc  TEXT,
    bank_ifsc                VARCHAR(20),
    pan_number_enc           TEXT,
    aadhar_number_enc        TEXT,
    blood_group              VARCHAR(5),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== GENERIC DOCUMENTS ==========
CREATE TABLE IF NOT EXISTS documents (
    document_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    doc_type      VARCHAR(50) NOT NULL,
    file_url      TEXT NOT NULL,
    verified      BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

-- ========== ATTENDANCE ==========
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    check_in_time   TIMESTAMPTZ,
    check_out_time  TIMESTAMPTZ,
    work_hours      NUMERIC(4,2) GENERATED ALWAYS AS (
                        CASE WHEN check_in_time IS NOT NULL AND check_out_time IS NOT NULL
                             THEN EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600.0
                             ELSE NULL END
                    ) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);

-- ========== LEAVE TYPES ==========
CREATE TABLE IF NOT EXISTS leave_types (
    leave_type_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    name                VARCHAR(50) NOT NULL,
    max_days_per_year   INTEGER NOT NULL DEFAULT 0,
    is_paid             BOOLEAN NOT NULL DEFAULT TRUE,
    requires_attachment BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (company_id, name)
);

-- ========== LEAVE BALANCES ==========
CREATE TABLE IF NOT EXISTS leave_balances (
    balance_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    leave_type_id   UUID NOT NULL REFERENCES leave_types(leave_type_id) ON DELETE CASCADE,
    year            INTEGER NOT NULL,
    total_days      NUMERIC(5,1) NOT NULL DEFAULT 0,
    used_days       NUMERIC(5,1) NOT NULL DEFAULT 0,
    remaining_days  NUMERIC(5,1) GENERATED ALWAYS AS (total_days - used_days) STORED,
    UNIQUE (user_id, leave_type_id, year)
);
CREATE INDEX IF NOT EXISTS idx_leave_balances_user ON leave_balances(user_id);

-- ========== LEAVE REQUESTS ==========
CREATE TABLE IF NOT EXISTS leave_requests (
    leave_request_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    leave_type_id     UUID NOT NULL REFERENCES leave_types(leave_type_id),
    start_date        DATE NOT NULL,
    end_date          DATE NOT NULL,
    total_days        NUMERIC(5,1) NOT NULL,
    remarks           TEXT,
    attachment_url    TEXT,
    status            leave_status NOT NULL DEFAULT 'pending',
    reviewed_by       UUID REFERENCES users(user_id),
    reviewer_comments TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- ========== SALARY STRUCTURES ==========
CREATE TABLE IF NOT EXISTS salary_structures (
    salary_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    month_wage              NUMERIC(12,2) NOT NULL,
    yearly_wage             NUMERIC(12,2) GENERATED ALWAYS AS (month_wage * 12) STORED,
    working_days_per_week   SMALLINT NOT NULL DEFAULT 5,
    standard_shift_hours    NUMERIC(4,2) NOT NULL DEFAULT 8.00,
    break_time_hours        NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    pf_employee_rate        NUMERIC(5,2) NOT NULL DEFAULT 12.00,
    pf_employer_rate        NUMERIC(5,2) NOT NULL DEFAULT 12.00,
    professional_tax        NUMERIC(10,2) NOT NULL DEFAULT 200.00,
    effective_from          DATE NOT NULL,
    effective_to            DATE,
    created_by              UUID NOT NULL REFERENCES users(user_id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_salary_user ON salary_structures(user_id);

-- ========== SALARY COMPONENTS ==========
CREATE TABLE IF NOT EXISTS salary_components (
    component_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salary_id        UUID NOT NULL REFERENCES salary_structures(salary_id) ON DELETE CASCADE,
    component_name   VARCHAR(50) NOT NULL,
    computation_type computation_type NOT NULL,
    rate_value       NUMERIC(6,3),
    computed_amount  NUMERIC(12,2) NOT NULL,
    display_order    SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_salary_components_salary ON salary_components(salary_id);

-- ========== PAYSLIPS ==========
CREATE TABLE IF NOT EXISTS payslips (
    payslip_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    salary_id             UUID NOT NULL REFERENCES salary_structures(salary_id),
    month                 SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                  SMALLINT NOT NULL,
    total_days_in_period  SMALLINT NOT NULL,
    payable_days          NUMERIC(5,1) NOT NULL,
    gross_pay             NUMERIC(12,2) NOT NULL,
    pf_employee_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    pf_employer_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    professional_tax      NUMERIC(10,2) NOT NULL DEFAULT 0,
    net_pay               NUMERIC(12,2) NOT NULL,
    generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, month, year)
);
CREATE INDEX IF NOT EXISTS idx_payslips_user ON payslips(user_id);

-- ========== NOTIFICATIONS ==========
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type            notification_type NOT NULL,
    title           VARCHAR(150) NOT NULL,
    message         TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);

-- ========== AUDIT LOG ==========
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action       VARCHAR(100) NOT NULL,
    entity_type  VARCHAR(50) NOT NULL,
    entity_id    UUID,
    metadata     JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ========== HELPER VIEW ==========
CREATE OR REPLACE VIEW employee_current_status AS
SELECT u.user_id,
       CASE
         WHEN lr.leave_request_id IS NOT NULL THEN 'on_leave'
         WHEN a.check_in_time IS NOT NULL THEN 'present'
         ELSE 'absent'
       END AS status
FROM users u
LEFT JOIN attendance a
       ON a.user_id = u.user_id AND a.date = CURRENT_DATE
LEFT JOIN leave_requests lr
       ON lr.user_id = u.user_id AND lr.status = 'approved'
      AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
WHERE u.role = 'employee';
