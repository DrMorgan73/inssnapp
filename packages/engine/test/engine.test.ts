import { beforeEach, describe, expect, it } from "vitest";
import { ShowingEngine } from "../src/engine";
import { canTransition, nextState } from "../src/transitions";
import type {
  Actor,
  Showing,
  ShowingEvent,
  ShowingOutcome,
  ShowingState,
  Transition,
} from "../src/types";

/** In-memory store for exercising the engine. */
class MemoryStore {
  showings = new Map<string, Showing>();
  events: ShowingEvent[] = [];

  async getShowing(id: string) {
    return this.showings.get(id) ?? null;
  }
  async insertEvent(e: Omit<ShowingEvent, "id" | "at">) {
    const event: ShowingEvent = {
      ...e,
      id: `evt_${this.events.length + 1}`,
      at: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }
  async commitShowing(id: string, expectedVersion: number, patch: Partial<Showing>) {
    const s = this.showings.get(id);
    if (!s || s.version !== expectedVersion) return null;
    const updated: Showing = { ...s, ...patch, version: s.version + 1, updatedAt: new Date().toISOString() };
    this.showings.set(id, updated);
    return updated;
  }
  async getIdempotent(key: string) {
    return this.events.find((e) => e.idempotencyKey === key) ?? null;
  }
}

function makeShowing(overrides: Partial<Showing> = {}): Showing {
  return {
    id: "sh_1",
    organizationId: "org_1",
    unitId: "unit_1",
    residentUserId: "user_resident",
    prospectUserId: null,
    brokerUserId: null,
    brokerRequired: false,
    state: "AVAILABLE",
    outcome: null,
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const actor = (role: string, organizationId = "org_1", userId = `user_${role}`): Actor => ({
  userId,
  role: role as Actor["role"],
  organizationId,
});

describe("transition table", () => {
  it("allows the full happy path", () => {
    expect(canTransition("AVAILABLE", "PROSPECT_REQUEST")).toBe(true);
    expect(canTransition("REQUESTED", "RESIDENT_ACCEPT")).toBe(true);
    expect(canTransition("RESIDENT_ACCEPTED", "CONFIRM")).toBe(true);
    expect(canTransition("CONFIRMED", "CHECK_IN")).toBe(true);
    expect(canTransition("IN_PROGRESS", "COMPLETE")).toBe(true);
    expect(canTransition("COMPLETED", "RECORD_OUTCOME")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("AVAILABLE", "CHECK_IN")).toBe(false);
    expect(canTransition("OUTCOME", "PROSPECT_REQUEST")).toBe(false);
    expect(canTransition("CONFIRMED", "RECORD_OUTCOME")).toBe(false);
    expect(nextState("AVAILABLE", "COMPLETE" as Transition)).toBeNull();
  });

  it("routes through the broker gate when required", () => {
    expect(canTransition("RESIDENT_ACCEPTED", "BROKER_ASSIGN")).toBe(true);
    expect(canTransition("BROKER_GATE", "BROKER_ACCEPT")).toBe(true);
    expect(canTransition("BROKER_GATE", "BROKER_DECLINE")).toBe(true);
  });
});

describe("ShowingEngine", () => {
  let store: MemoryStore;
  let engine: ShowingEngine;

  beforeEach(() => {
    store = new MemoryStore();
    engine = new ShowingEngine(store);
  });

  it("runs the full lifecycle and emits auditable events", async () => {
    const showing = makeShowing();
    store.showings.set(showing.id, showing);

    const steps: [Transition, Actor, ShowingState, ShowingOutcome?][] = [
      ["PROSPECT_REQUEST", actor("prospect", "org_1", "user_prospect"), "REQUESTED"],
      ["RESIDENT_ACCEPT", actor("resident"), "RESIDENT_ACCEPTED"],
      ["CONFIRM", actor("management"), "CONFIRMED"],
      ["CHECK_IN", actor("resident"), "IN_PROGRESS"],
      ["COMPLETE", actor("resident"), "COMPLETED"],
      ["RECORD_OUTCOME", actor("prospect", "org_1", "user_prospect"), "OUTCOME", "APPLY"],
    ];

    for (const [transition, a, expectedState, outcome] of steps) {
      const res = await engine.transition({
        showingId: showing.id,
        transition,
        actor: a,
        idempotencyKey: `${transition}-1`,
        outcome,
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.showing.state).toBe(expectedState);
    }

    const final = await store.getShowing(showing.id);
    expect(final?.outcome).toBe("APPLY");
    expect(store.events).toHaveLength(6);
    expect(store.events.every((e) => e.organizationId === "org_1")).toBe(true);
  });

  it("supports the optional broker gate", async () => {
    const showing = makeShowing({ brokerRequired: true });
    store.showings.set(showing.id, showing);

    await engine.transition({
      showingId: showing.id, transition: "PROSPECT_REQUEST",
      actor: actor("prospect", "org_1", "user_prospect"), idempotencyKey: "k1",
    });
    await engine.transition({
      showingId: showing.id, transition: "RESIDENT_ACCEPT",
      actor: actor("resident"), idempotencyKey: "k2",
    });
    const gate = await engine.transition({
      showingId: showing.id, transition: "BROKER_ASSIGN", brokerUserId: "user_broker",
      actor: actor("management"), idempotencyKey: "k3",
    });
    expect(gate.ok && gate.showing.state).toBe("BROKER_GATE");

    const accept = await engine.transition({
      showingId: showing.id, transition: "BROKER_ACCEPT",
      actor: actor("broker"), idempotencyKey: "k4",
    });
    expect(accept.ok && accept.showing.state).toBe("CONFIRMED");
  });

  it("rejects cross-tenant access", async () => {
    const showing = makeShowing();
    store.showings.set(showing.id, showing);
    const res = await engine.transition({
      showingId: showing.id, transition: "PROSPECT_REQUEST",
      actor: actor("prospect", "org_OTHER"), idempotencyKey: "x",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("TENANT_ISOLATION");
  });

  it("enforces role policy", async () => {
    const showing = makeShowing({ state: "REQUESTED" });
    store.showings.set(showing.id, showing);
    const res = await engine.transition({
      showingId: showing.id, transition: "RESIDENT_ACCEPT",
      actor: actor("prospect", "org_1", "user_prospect"), idempotencyKey: "x",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("ROLE_FORBIDDEN");
  });

  it("is idempotent for repeated requests", async () => {
    const showing = makeShowing();
    store.showings.set(showing.id, showing);
    const req = {
      showingId: showing.id, transition: "PROSPECT_REQUEST" as Transition,
      actor: actor("prospect", "org_1", "user_prospect"), idempotencyKey: "dup",
    };
    const first = await engine.transition(req);
    const second = await engine.transition(req);
    expect(first.ok && second.ok).toBe(true);
    if (second.ok) expect(second.replayed).toBe(true);
    expect(store.events).toHaveLength(1);
  });

  it("protects against concurrent modification", async () => {
    const showing = makeShowing();
    store.showings.set(showing.id, showing);
    // Simulate a version bump by another writer between read and write.
    const original = store.commitShowing.bind(store);
    store.commitShowing = async (id, version, patch) => {
      if (version === 0) {
        const s = store.showings.get(id)!;
        store.showings.set(id, { ...s, version: s.version + 1 });
      }
      return original(id, version, patch);
    };
    const res = await engine.transition({
      showingId: showing.id, transition: "PROSPECT_REQUEST",
      actor: actor("prospect", "org_1", "user_prospect"), idempotencyKey: "c",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("CONCURRENCY_CONFLICT");
  });
});
