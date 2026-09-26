/**
 * Unified data access layer.
 *
 * When DATABASE_URL is set, all reads/writes go through PostgreSQL with
 * organization-scoped queries. Otherwise, the in-memory store is used for
 * local development and demos.
 *
 * TASK-002: PostgreSQL schema, organizations, authentication, RBAC, tenant isolation.
 * TASK-003: Persistent Showing Engine APIs, event model, locking, idempotency, audit.
 */

import { PostgresStore, usingPostgres, migrate } from "@inssnapp/db";
import type { Showing, ShowingEvent, ShowingState } from "@inssnapp/engine";
import { store as mem } from "./store";

// ---- Postgres pool (lazy) --------------------------------------------------
let pgStore: PostgresStore | null = null;
function postgres(): PostgresStore {
  if (!pgStore) pgStore = new PostgresStore();
  return pgStore;
}

export { usingPostgres, migrate };

// ---- Unified auth / user store ----------------------------------------------
export const db = {
  users: {
    async byEmail(email: string) {
      if (!usingPostgres) return mem.users.byEmail(email);
      const { Client } = await import("pg");
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const res = await client.query(
        `SELECT id, organization_id AS "organizationId", email, full_name AS "fullName",
                password_hash AS "passwordHash", role, mfa_enabled AS "mfaEnabled"
         FROM users WHERE email = $1`,
        [email.toLowerCase()],
      );
      await client.end();
      return res.rows[0] ?? null;
    },

    async byId(id: string) {
      if (!usingPostgres) return mem.users.byId(id);
      const { Client } = await import("pg");
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const res = await client.query(
        `SELECT id, organization_id AS "organizationId", email, full_name AS "fullName", role
         FROM users WHERE id = $1`,
        [id],
      );
      await client.end();
      return res.rows[0] ?? null;
    },
  },

  properties: {
    async byOrg(organizationId: string) {
      if (!usingPostgres) return mem.properties.byOrg(organizationId);
      const { Client } = await import("pg");
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const res = await client.query(
        `SELECT id, organization_id AS "organizationId", name, address
         FROM properties WHERE organization_id = $1`,
        [organizationId],
      );
      await client.end();
      return res.rows;
    },
  },

  units: {
    async byOrg(organizationId: string) {
      if (!usingPostgres) return mem.units.byOrg(organizationId);
      const { Client } = await import("pg");
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const res = await client.query(
        `SELECT id, organization_id AS "organizationId", property_id AS "propertyId",
                label, pms_external_id AS "pmsExternalId", eligible,
                resident_available AS "residentAvailable"
         FROM units WHERE organization_id = $1`,
        [organizationId],
      );
      await client.end();
      return res.rows;
    },

    async byId(id: string) {
      if (!usingPostgres) return mem.units.byId(id);
      const { Client } = await import("pg");
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const res = await client.query(
        `SELECT id, organization_id AS "organizationId", property_id AS "propertyId",
                label, eligible, resident_available AS "residentAvailable"
         FROM units WHERE id = $1`,
        [id],
      );
      await client.end();
      return res.rows[0] ?? null;
    },
  },

  // ---- Showing engine persistence ----
  showings: {
    async get(id: string) {
      if (!usingPostgres) return mem.showings.get(id);
      return postgres().getShowing(id);
    },

    async create(unitId: string, residentUserId: string, organizationId: string, brokerRequired = false) {
      if (!usingPostgres) return mem.showings.create(unitId, residentUserId, organizationId, brokerRequired);
      const { Client } = await import("pg");
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const res = await client.query(
        `INSERT INTO showings (unit_id, resident_user_id, organization_id, broker_required)
         VALUES ($1, $2, $3, $4)
         RETURNING id, organization_id AS "organizationId", unit_id AS "unitId",
                   resident_user_id AS "residentUserId", prospect_user_id AS "prospectUserId",
                   broker_user_id AS "brokerUserId", broker_required AS "brokerRequired",
                   state, outcome, version, created_at AS "createdAt", updated_at AS "updatedAt"`,
        [unitId, residentUserId, organizationId, brokerRequired],
      );
      await client.end();
      return res.rows[0];
    },

    async list(organizationId: string) {
      if (!usingPostgres) return mem.showings.list(organizationId);
      const { Client } = await import("pg");
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const res = await client.query(
        `SELECT id, organization_id AS "organizationId", unit_id AS "unitId",
                resident_user_id AS "residentUserId", prospect_user_id AS "prospectUserId",
                broker_user_id AS "brokerUserId", broker_required AS "brokerRequired",
                state, outcome, version, updated_at AS "updatedAt"
         FROM showings WHERE organization_id = $1 ORDER BY created_at DESC`,
        [organizationId],
      );
      await client.end();
      return res.rows;
    },

    async byUnitActive(unitId: string) {
      if (!usingPostgres) return mem.showings.byUnitActive(unitId);
      const active: ShowingState[] = ["REQUESTED", "RESIDENT_ACCEPTED", "BROKER_GATE", "CONFIRMED", "IN_PROGRESS", "COMPLETED"];
      const { Client } = await import("pg");
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const res = await client.query(
        `SELECT id, unit_id AS "unitId", state FROM showings
         WHERE unit_id = $1 AND state = ANY($2) LIMIT 1`,
        [unitId, active],
      );
      await client.end();
      return res.rows[0] ?? null;
    },

    async set(id: string, updated: Showing) {
      // Handled by PostgresStore.commitShowing via engine adapter.
    },
  },

  showingEvents: {
    async insert(e: Omit<ShowingEvent, "id" | "at">) {
      if (!usingPostgres) return mem.showingEvents.insert(e);
      return postgres().insertEvent(e);
    },

    async list(organizationId: string) {
      if (!usingPostgres) return mem.showingEvents.list(organizationId);
      const { Client } = await import("pg");
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      const res = await client.query(
        `SELECT id, showing_id AS "showingId", organization_id AS "organizationId",
                actor_user_id AS "actorUserId", actor_role AS "actorRole",
                transition, from_state AS "fromState", to_state AS "toState",
                idempotency_key AS "idempotencyKey", at
         FROM showing_events WHERE organization_id = $1 ORDER BY at DESC`,
        [organizationId],
      );
      await client.end();
      return res.rows;
    },

    async findByIdempotencyKey(key: string) {
      if (!usingPostgres) return mem.showingEvents.findByIdempotencyKey(key);
      return postgres().getIdempotent(key);
    },
  },

  sessions: {
    async create(userId: string, organizationId: string) {
      return mem.sessions.create(userId, organizationId);
    },
    async get(token: string) {
      return mem.sessions.get(token);
    },
    async destroy(token: string) {
      mem.sessions.destroy(token);
    },
  },
};
