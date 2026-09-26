import type { ShowingState, Transition } from "./types";

/**
 * The authoritative state-transition table.
 *
 * A transition is only valid when explicitly listed for the current state.
 * This is the single source of truth for workflow legality — no UI, adapter,
 * or integration may define its own rules.
 */
export const TRANSITION_TABLE: Readonly<
  Record<ShowingState, Partial<Record<Transition, ShowingState>>>
> = {
  AVAILABLE: {
    PROSPECT_REQUEST: "REQUESTED",
  },
  REQUESTED: {
    RESIDENT_ACCEPT: "RESIDENT_ACCEPTED",
    RESIDENT_DECLINE: "AVAILABLE",
    EXPIRE: "AVAILABLE",
  },
  RESIDENT_ACCEPTED: {
    BROKER_ASSIGN: "BROKER_GATE",
    CONFIRM: "CONFIRMED",
  },
  BROKER_GATE: {
    BROKER_ACCEPT: "CONFIRMED",
    BROKER_DECLINE: "RESIDENT_ACCEPTED",
  },
  CONFIRMED: {
    CHECK_IN: "IN_PROGRESS",
  },
  IN_PROGRESS: {
    COMPLETE: "COMPLETED",
  },
  COMPLETED: {
    RECORD_OUTCOME: "OUTCOME",
  },
  OUTCOME: {},
};

/** Returns true when `transition` is legal from `from`. */
export function canTransition(from: ShowingState, transition: Transition): boolean {
  return TRANSITION_TABLE[from][transition] !== undefined;
}

/** Returns the resulting state, or null when the transition is illegal. */
export function nextState(
  from: ShowingState,
  transition: Transition,
): ShowingState | null {
  return TRANSITION_TABLE[from][transition] ?? null;
}

/**
 * Which roles are permitted to initiate each transition.
 * The engine enforces this in addition to state legality.
 */
export const TRANSITION_ROLE_POLICY: Readonly<Record<Transition, readonly string[]>> = {
  PROSPECT_REQUEST: ["prospect"],
  RESIDENT_ACCEPT: ["resident"],
  RESIDENT_DECLINE: ["resident"],
  BROKER_ASSIGN: ["management", "inssnapp_admin"],
  BROKER_ACCEPT: ["broker"],
  BROKER_DECLINE: ["broker"],
  CONFIRM: ["management", "inssnapp_admin"],
  CHECK_IN: ["broker", "resident"],
  COMPLETE: ["broker", "resident"],
  RECORD_OUTCOME: ["prospect"],
  EXPIRE: ["system", "inssnapp_admin"],
};
