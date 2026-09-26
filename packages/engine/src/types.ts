/**
 * INSSNAPP Showing Engine — domain types.
 *
 * The Showing Engine is the SOLE authority permitted to change showing state.
 * Every material transition generates an auditable event with actor,
 * organization, timestamp, and state change.
 */

/** The 8 authoritative showing states. */
export const SHOWING_STATES = [
  "AVAILABLE",
  "REQUESTED",
  "RESIDENT_ACCEPTED",
  "BROKER_GATE",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "OUTCOME",
] as const;

export type ShowingState = (typeof SHOWING_STATES)[number];

/** Post-completion prospect outcomes. */
export const SHOWING_OUTCOMES = ["APPLY", "WATCH", "DECLINE"] as const;

export type ShowingOutcome = (typeof SHOWING_OUTCOMES)[number];

/** Platform roles (RBAC). */
export const ROLES = [
  "management",
  "resident",
  "prospect",
  "broker",
  "inssnapp_admin",
] as const;

export type Role = (typeof ROLES)[number];

/** Material state transitions the engine can perform. */
export const TRANSITIONS = [
  "PROSPECT_REQUEST",
  "RESIDENT_ACCEPT",
  "RESIDENT_DECLINE",
  "BROKER_ASSIGN",
  "BROKER_ACCEPT",
  "BROKER_DECLINE",
  "CONFIRM",
  "CHECK_IN",
  "COMPLETE",
  "RECORD_OUTCOME",
  "EXPIRE",
] as const;

export type Transition = (typeof TRANSITIONS)[number];

/** Who is acting on a transition. */
export interface Actor {
  userId: string;
  role: Role;
  organizationId: string;
}

/** A showing record as persisted. */
export interface Showing {
  id: string;
  organizationId: string;
  unitId: string;
  residentUserId: string;
  prospectUserId: string | null;
  brokerUserId: string | null;
  brokerRequired: boolean;
  state: ShowingState;
  outcome: ShowingOutcome | null;
  /** Optimistic-concurrency version, bumped on every mutation. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Immutable auditable event emitted for every material transition. */
export interface ShowingEvent {
  id: string;
  showingId: string;
  organizationId: string;
  actorUserId: string;
  actorRole: Role;
  transition: Transition;
  fromState: ShowingState;
  toState: ShowingState;
  /** Idempotency key supplied by the caller. */
  idempotencyKey: string;
  at: string;
}
