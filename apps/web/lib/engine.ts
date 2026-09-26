import { ShowingEngine } from "@inssnapp/engine";
import { db } from "./db";

/**
 * Wires the Authoritative Showing Engine to the persistence boundary.
 *
 * Works with both in-memory (dev/demo) and PostgreSQL (TASK-002/003) stores
 * through the unified db layer. The engine itself is unchanged.
 */
export const engine = new ShowingEngine({
  getShowing: (id) => db.showings.get(id),
  insertEvent: (e) => db.showingEvents.insert(e),
  getIdempotent: (key) => db.showingEvents.findByIdempotencyKey(key),
  commitShowing: (id, expectedVersion, patch) => {
    if (process.env.DATABASE_URL) {
      // Postgres path: use the pool directly
      return import("pg").then(({ default: pg }) => {
        const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
        return pool.query(
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
        ).then((res) => res.rows[0] ?? null);
      });
    }
    // In-memory path
    const s = db.showings.get(id);
    if (!s || s.version !== expectedVersion) return Promise.resolve(null);
    const updated = { ...s, ...patch, version: s.version + 1, updatedAt: new Date().toISOString() };
    db.showings.set(id, updated);
    return Promise.resolve(updated);
  },
});
