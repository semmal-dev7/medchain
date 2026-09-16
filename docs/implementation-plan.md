# Implementation Plan (Repo-Aligned)

## Phase 1 - Contract Upgrade
1. Extend [PatientPrivacy.sol](d:/Blockchain%20Project/course-project-submission-consensus_crew/contracts/PatientPrivacy.sol) with role registry and suspension logic.
2. Add access-request state machine (`pending`, `approved`, `rejected`, `revoked`).
3. Emit all required events from `docs/requirements.md`.
4. Update tests in `test/patientPrivacy.test.js` for new role and permission invariants.

## Phase 2 - Backend Setup
1. Create new `backend/` service (Express/NestJS).
2. Add SIWE auth (`/auth/nonce`, `/auth/verify`).
3. Implement API endpoints from `docs/api-spec.md`.
4. Add event indexer worker to consume contract events and write `audit_events`.

## Phase 3 - Database and Storage
1. Create PostgreSQL migrations from `docs/db-schema.md`.
2. Add Redis (optional but recommended) for queues/realtime fanout.
3. Add IPFS upload integration and KMS key-reference handling.

## Phase 4 - Frontend Integration
1. Replace placeholder methods in [api.ts](d:/Blockchain%20Project/course-project-submission-consensus_crew/frontend/src/services/api.ts) with real backend calls.
2. Keep wallet as primary identity and use backend token for session.
3. Connect patient/doctor dashboards to real data.
4. Add SSE/WS listener for live request/approval/revoke updates.

## Phase 5 - Hardening and Launch
1. Run security checklist in `docs/security-checklist.md`.
2. Add end-to-end tests for complete user journeys.
3. Deploy contracts + backend + frontend to staging.
4. Run load and failure tests before production.
