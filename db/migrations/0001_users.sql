CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'active',
  plant TEXT NOT NULL DEFAULT 'TYANA OTOMOTİV',
  department TEXT NOT NULL DEFAULT 'Kalite',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (role IN ('admin', 'quality_manager', 'quality_engineer', 'process_engineer', 'approver', 'operator', 'viewer')),
  CHECK (status IN ('active', 'inactive', 'invited')),
  CHECK (length(email) BETWEEN 3 AND 254),
  CHECK (length(display_name) BETWEEN 2 AND 100),
  CHECK (length(plant) BETWEEN 1 AND 120),
  CHECK (length(department) BETWEEN 1 AND 120),
  CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
