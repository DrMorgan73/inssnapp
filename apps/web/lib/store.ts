import type { Showing, ShowingEvent, ShowingState } from "@inssnapp/engine";

/**
 * In-memory data store implementing the engine's persistence boundary.
 *
 * This is the MVP/demo foundation. The production implementation (TASK-002)
 * will provide a PostgreSQL-backed store with identical semantics:
 * organization scoping, optimistic locking, idempotent events, audit trail.
 *
 * State lives on globalThis so it survives Next.js dev-mode hot reloads.
 */

export interface User {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  passwordHash: string;
  role: "management" | "resident" | "prospect" | "broker" | "inssnapp_admin";
  mfaEnabled: boolean;
}

export interface Property {
  id: string;
  organizationId: string;
  name: string;
  address: string;
}

export interface Unit {
  id: string;
  organizationId: string;
  propertyId: string;
  label: string;
  pmsExternalId: string | null;
  eligible: boolean;
  residentAvailable: boolean;
}

export interface Org {
  id: string;
  name: string;
}

// Demo password hash for "pw" — replace with argon2id in TASK-002.
const DEMO_HASH =
  "s1:e33bac68fd8099a0c1c7c3ca8daa83f5:1ce3d930b682994417ea5d7a4a4c509b84d0d7ddd69787a59dd02941a35f8603";

interface StoreData {
  orgs: Org[];
  users: User[];
  properties: Property[];
  units: Unit[];
  showings: Map<string, Showing>;
  events: ShowingEvent[];
  sessions: Map<string, { userId: string; organizationId: string; expiresAt: number }>;
  seq: number;
}

function seed(): StoreData {
  return {
    orgs: [
      { id: "org_1", name: "Skyline Residential Group" },
      { id: "org_2", name: "Harbor Point Management" },
    ],
    users: [
      { id: "u_mgmt", organizationId: "org_1", email: "manager@inssnapp.demo", fullName: "Morgan Reyes", passwordHash: DEMO_HASH, role: "management", mfaEnabled: false },
      { id: "u_admin", organizationId: "org_1", email: "admin@inssnapp.demo", fullName: "Avery Chen", passwordHash: DEMO_HASH, role: "inssnapp_admin", mfaEnabled: true },
      { id: "u_resident", organizationId: "org_1", email: "resident@inssnapp.demo", fullName: "Jordan Lee", passwordHash: DEMO_HASH, role: "resident", mfaEnabled: false },
      { id: "u_prospect", organizationId: "org_1", email: "prospect@inssnapp.demo", fullName: "Taylor Brooks", passwordHash: DEMO_HASH, role: "prospect", mfaEnabled: false },
      { id: "u_broker", organizationId: "org_1", email: "broker@inssnapp.demo", fullName: "Casey Kim", passwordHash: DEMO_HASH, role: "broker", mfaEnabled: false },
      { id: "u_mgmt2", organizationId: "org_2", email: "manager2@inssnapp.demo", fullName: "Riley Park", passwordHash: DEMO_HASH, role: "management", mfaEnabled: false },
    ],
    properties: [
      { id: "prop_1", organizationId: "org_1", name: "The Alder", address: "120 Alder St, Seattle, WA" },
      { id: "prop_2", organizationId: "org_1", name: "Maple Court", address: "88 Maple Ave, Bellevue, WA" },
      { id: "prop_3", organizationId: "org_2", name: "Harbor Lofts", address: "1 Harbor Blvd, Tacoma, WA" },
    ],
    units: [
      { id: "unit_1", organizationId: "org_1", propertyId: "prop_1", label: "4B", pmsExternalId: "YRD-10042", eligible: true, residentAvailable: true },
      { id: "unit_2", organizationId: "org_1", propertyId: "prop_1", label: "2A", pmsExternalId: "YRD-10031", eligible: true, residentAvailable: true },
      { id: "unit_3", organizationId: "org_1", propertyId: "prop_2", label: "1C", pmsExternalId: "ENT-20011", eligible: true, residentAvailable: false },
      { id: "unit_4", organizationId: "org_2", propertyId: "prop_3", label: "PH1", pmsExternalId: "APP-30007", eligible: true, residentAvailable: true },
    ],
    showings: new Map(),
    events: [],
    sessions: new Map(),
    seq: 100,
  };
}

const g = globalThis as typeof globalThis & { __inssnappStore?: StoreData };
if (!g.__inssnappStore) {
  g.__inssnappStore = seed();
}
const db = g.__inssnappStore;

function newId(prefix: string): string {
  db.seq += 1;
  return `${prefix}_${db.seq.toString(36)}${Date.now().toString(36)}`;
}

export const store = {
  orgs: {
    list(): Org[] {
      return db.orgs;
    },
    get(id: string): Org | null {
      return db.orgs.find((o) => o.id === id) ?? null;
    },
  },

  users: {
    byEmail(email: string): User | null {
      return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
    },
    byId(id: string): User | null {
      return db.users.find((u) => u.id === id) ?? null;
    },
    byOrg(organizationId: string): User[] {
      return db.users.filter((u) => u.organizationId === organizationId);
    },
  },

  properties: {
    byOrg(organizationId: string): Property[] {
      return db.properties.filter((p) => p.organizationId === organizationId);
    },
  },

  units: {
    byOrg(organizationId: string): Unit[] {
      return db.units.filter((u) => u.organizationId === organizationId);
    },
    byId(id: string): Unit | null {
      return db.units.find((u) => u.id === id) ?? null;
    },
    patch(id: string, patch: Partial<Unit>): Unit | null {
      const idx = db.units.findIndex((u) => u.id === id);
      if (idx === -1) return null;
      db.units[idx] = { ...db.units[idx], ...patch };
      return db.units[idx];
    },
  },

  // ---- Showing engine persistence (used by the engine) ----
  showings: {
    get(id: string): Showing | null {
      return db.showings.get(id) ?? null;
    },
    create(unitId: string, residentUserId: string, organizationId: string, brokerRequired = false): Showing {
      const showing: Showing = {
        id: newId("sh"),
        organizationId,
        unitId,
        residentUserId,
        prospectUserId: null,
        brokerUserId: null,
        brokerRequired,
        state: "AVAILABLE",
        outcome: null,
        version: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.showings.set(showing.id, showing);
      return showing;
    },
    list(organizationId: string): Showing[] {
      return [...db.showings.values()].filter((s) => s.organizationId === organizationId);
    },
    byUnitActive(unitId: string): Showing | null {
      const active = ["REQUESTED", "RESIDENT_ACCEPTED", "BROKER_GATE", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] as ShowingState[];
      return (
        [...db.showings.values()].find(
          (s) => s.unitId === unitId && active.includes(s.state),
        ) ?? null
      );
    },
    set(id: string, updated: Showing): void {
      db.showings.set(id, updated);
    },
  },

  showingEvents: {
    insert(e: Omit<ShowingEvent, "id" | "at">): ShowingEvent {
      const event: ShowingEvent = { ...e, id: newId("evt"), at: new Date().toISOString() };
      db.events.push(event);
      return event;
    },
    list(organizationId: string): ShowingEvent[] {
      return db.events
        .filter((e) => e.organizationId === organizationId)
        .sort((a, b) => (a.at < b.at ? 1 : -1));
    },
    findByIdempotencyKey(key: string): ShowingEvent | null {
      return db.events.find((e) => e.idempotencyKey === key) ?? null;
    },
  },

  sessions: {
    create(userId: string, organizationId: string, ttlMs = 1000 * 60 * 60 * 24): string {
      const token = newId("tok") + newId("tok");
      db.sessions.set(token, { userId, organizationId, expiresAt: Date.now() + ttlMs });
      return token;
    },
    get(token: string): { userId: string; organizationId: string } | null {
      const s = db.sessions.get(token);
      if (!s) return null;
      if (s.expiresAt < Date.now()) {
        db.sessions.delete(token);
        return null;
      }
      return s;
    },
    destroy(token: string): void {
      db.sessions.delete(token);
    },
  },
};
