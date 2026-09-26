# INSSNAPP — Agent Guide

## Repository Layout

```
inssnapp/
├── apps/web/                  # Next.js Management Portal + Control Center
│   ├── app/
│   │   ├── admin/             # Management dashboard
│   │   ├── control/           # Control Center
│   │   ├── login/             # Authentication
│   │   └── api/               # REST API (auth, showings, units, events)
│   ├── components/            # Shared UI components
│   └── lib/                   # Store, engine adapter, auth helpers
├── packages/
│   ├── engine/                # Authoritative Showing Engine (core domain)
│   ├── db/                    # PostgreSQL schema (TASK-002)
│   └── auth/                  # Session + RBAC
└── docs/                      # Specifications
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js dev server |
| `npm test` | Run Showing Engine tests |
| `npm run build` | Production build |

## Showing Engine Authority

The Showing Engine (`packages/engine`) is the **sole authority** for showing-state
transitions. No UI, adapter, or integration may independently define workflow rules.

### States
`AVAILABLE → REQUESTED → RESIDENT_ACCEPTED → BROKER_GATE → CONFIRMED → IN_PROGRESS → COMPLETED → OUTCOME`

### Transitions
`PROSPECT_REQUEST`, `RESIDENT_ACCEPT`, `RESIDENT_DECLINE`, `BROKER_ASSIGN`,
`BROKER_ACCEPT`, `BROKER_DECLINE`, `CONFIRM`, `CHECK_IN`, `COMPLETE`,
`RECORD_OUTCOME`, `EXPIRE`

### Enforcement Order
1. Idempotency — repeated requests are safe
2. Existence — showing must exist
3. Tenant isolation — actor belongs to the showing's org
4. Role policy — actor's role may perform the transition
5. State legality — transition is valid from current state
6. Concurrency — optimistic locking prevents double-booking
7. Audit — immutable event emitted for every material transition

## Roles

| Role | Capabilities |
|------|-------------|
| `management` | Full portfolio oversight, confirm/assign, reporting |
| `resident` | Availability, accept/decline requests, check-in, complete |
| `prospect` | Request showing, record outcome (Apply/Watch/Decline) |
| `broker` | Accept assignment, check-in, complete, rate |
| `inssnapp_admin` | Cross-org oversight, audit, integration health, feature flags |

## Demo Accounts (password: `pw`)

| Role | Email |
|------|-------|
| Management | manager@inssnapp.demo |
| Control Center | admin@inssnapp.demo |
| Resident | resident@inssnapp.demo |
| Prospect | prospect@inssnapp.demo |
| Broker | broker@inssnapp.demo |
