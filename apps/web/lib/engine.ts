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
      return import("../../packages/db/src/index").then(({ PostgresStore }) => {
        const store = new PostgresStore();
        return store.commitShowing(id, expectedVersion, patch);
      });
    }
    const s = db.showings.get(id);
    if (!s || s.version !== expectedVersion) return Promise.resolve(null);
    const updated = { ...s, ...patch, version: s.version + 1, updatedAt: new Date().toISOString() };
    db.showings.set(id, updated);
    return Promise.resolve(updated);
  },
});
