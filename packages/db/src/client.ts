/**
 * PostgreSQL client for TASK-002/003.
 *
 * Uses `pg` as a peer dependency. The engine's ShowingStore interface is
 * implemented here with organization scoping, optimistic locking, and
 * idempotent audit events — matching the in-memory semantics exactly.
 *
 * `pg` is loaded lazily so the in-memory path works without it installed.
 */

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { Showing, ShowingEvent } from "@inssnapp/engine";

const connectionString = process.env.DATABASE_URL;

export const usingPostgres = Boolean(connectionString);

/** Runs all migrations in a transaction. Idempotent. */
export async function migrate(): Promise<void> {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("BEGIN");
    const schemaPath = join(dirname(__filename), "schema.sql");
    const sql = await readFile(schemaPath, "utf8");
    await client.query(sql);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

/** Postgres-backed store implementing the engine's persistence contract. */
export class PostgresStore {
  private pool: unknown = null;

  private async pool_(): Promise<any> {
    if (!this.pool) {
      const { default: pg } = await import("pg");
      this.pool = new pg.Pool({ connectionString });
    }
    return this.pool;
  }

  async getShowing(id: string): Promise<Showing | null> {
    const pool = await this.pool_();
    const res = await pool.query(
      `SELECT id, organization_id AS "organizationId", unit_id AS "unitId",
              resident_user_id AS "residentUserId", prospect_user_id AS "prospectUserId",
              broker_user_id AS "brokerUserId", broker_required AS "brokerRequired",
              state, outcome, version,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM showings WHERE id = $1`,
      [id],
    );
    return res.rows[0] ?? null;
  }

  async insertEvent(e: Omit<ShowingEvent, "id" | "at">): Promise<ShowingEvent> {
    const pool = await this.pool_();
    const res = await pool.query(
      `INSERT INTO showing_events
         (organization_id, showing_id, actor_user_id, actor_role, transition, from_state, to_state, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, at`,
      [e.organizationId, e.showingId, e.actorUserId, e.actorRole, e.transition, e.fromState, e.toState, e.idempotencyKey],
    );
    return { ...e, id: res.rows[0].id, at: res.rows[0].at };
  }

  async commitShowing(
    id: string,
    expectedVersion: number,
    patch: Partial<Pick<Showing, "state" | "outcome" | "prospectUserId" | "brokerUserId">>,
  ): Promise<Showing | null> {
    const pool = await this.pool_();
    const res = await pool.query(
      `UPDATE showings
       SET state = COALESCE($3, state),
           outcome = COALESCE($4, outcome),
           prospect_user_id = COALESCE($5, prospect_user_id),
           broker_user_id = COALESCE($6, broker_user_id),
           version = version + 1,
           updated_at = now()
       WHERE id = $1 AND version = $2
       RETURNING id, organization_id AS "organizationId", unit_id AS "unitId",
                 resident_user_id AS "residentUserId", prospect_user_id AS "prospectUserId",
                 broker_user_id AS "brokerUserId", broker_required AS "brokerRequired",
                 state, outcome, version, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, expectedVersion, patch.state ?? null, patch.outcome ?? null, patch.prospectUserId ?? null, patch.brokerUserId ?? null],
    );
    return res.rows[0] ?? null;
  }

  async getIdempotent(key: string): Promise<ShowingEvent | null> {
    const pool = await this.pool_();
    const res = await pool.query(
      `SELECT id, showing_id AS "showingId", organization_id AS "organizationId",
              actor_user_id AS "actorUserId", actor_role AS "actorRole",
              transition, from_state AS "fromState", to_state AS "toState",
              idempotency_key AS "idempotencyKey", at
       FROM showing_events WHERE idempotency_key = $1 LIMIT 1`,
      [key],
    );
    return res.rows[0] ?? null;
  }
}
