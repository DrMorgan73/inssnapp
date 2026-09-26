-- INSSNAPP PostgreSQL schema (TASK-002)
-- Organization/tenant isolation on every table. Idempotent.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS citext;

-- ---- Enums ---------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('management', 'resident', 'prospect', 'broker', 'inssnapp_admin');
CREATE TYPE showing_state AS ENUM (
  'AVAILABLE', 'REQUESTED', 'RESIDENT_ACCEPTED', 'BROKER_GATE',
  'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'OUTCOME'
);
CREATE TYPE showing_outcome AS ENUM ('APPLY', 'WATCH', 'DECLINE');
CREATE TYPE transition_name AS ENUM (
  'PROSPECT_REQUEST', 'RESIDENT_ACCEPT', 'RESIDENT_DECLINE', 'BROKER_ASSIGN',
  'BROKER_ACCEPT', 'BROKER_DECLINE', 'CONFIRM', 'CHECK_IN', 'COMPLETE',
  'RECORD_OUTCOME', 'EXPIRE'
);

-- ---- Tenancy -------------------------------------------------------------
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Users & auth ----------------------------------------------------------
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           CITEXT UNIQUE NOT NULL,
  full_name       TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  role            user_role NOT NULL,
  mfa_enabled     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX users_org_idx ON users (organization_id);

CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  token_hash      TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_token_idx ON sessions (token_hash);

-- ---- Portfolio --------------------------------------------------------------
CREATE TABLE properties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX properties_org_idx ON properties (organization_id);

CREATE TABLE units (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,               -- e.g. "4B"
  pms_external_id TEXT,
  eligible        BOOLEAN NOT NULL DEFAULT false,  -- management-authorized for participation
  resident_available BOOLEAN NOT NULL DEFAULT false, -- resident "Available NOW"
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX units_org_idx ON units (organization_id);
CREATE INDEX units_property_idx ON units (property_id);

-- ---- Residents --------------------------------------------------------------
CREATE TABLE residents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id         UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  verified        BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, unit_id)
);

-- ---- Showing Engine (authoritative) -----------------------------------------
CREATE TABLE showings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_id           UUID NOT NULL REFERENCES units(id),
  resident_user_id  UUID NOT NULL REFERENCES users(id),
  prospect_user_id  UUID REFERENCES users(id),
  broker_user_id    UUID REFERENCES users(id),
  broker_required   BOOLEAN NOT NULL DEFAULT false,
  state             showing_state NOT NULL DEFAULT 'AVAILABLE',
  outcome           showing_outcome,
  version           INTEGER NOT NULL DEFAULT 0,   -- optimistic concurrency
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX showings_org_idx ON showings (organization_id);
CREATE INDEX showings_state_idx ON showings (state);
CREATE INDEX showings_unit_idx ON showings (unit_id);

-- ---- Audit / events (immutable) ----------------------------------------------
CREATE TABLE showing_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  showing_id        UUID NOT NULL REFERENCES showings(id) ON DELETE CASCADE,
  actor_user_id     UUID REFERENCES users(id),
  actor_role        user_role NOT NULL,
  transition        transition_name NOT NULL,
  from_state        showing_state NOT NULL,
  to_state          showing_state NOT NULL,
  idempotency_key   TEXT NOT NULL,
  at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);
CREATE INDEX showing_events_org_idx ON showing_events (organization_id);
CREATE INDEX showing_events_showing_idx ON showing_events (showing_id);

-- ---- PMS integration boundary ------------------------------------------------
CREATE TABLE pms_adapters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,   -- 'yardi' | 'entrata' | 'realpage' | 'mri' | 'appfolio' | 'buildium'
  status          TEXT NOT NULL DEFAULT 'sandbox',  -- 'sandbox' | 'connected' | 'error'
  last_sync_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pms_adapters_org_idx ON pms_adapters (organization_id);
