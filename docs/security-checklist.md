# Security Checklist

## 1. Identity and Auth
- Use SIWE (wallet signature) with short-lived nonce.
- Invalidate nonce after successful verification.
- Issue short-lived access tokens and rotate refresh tokens.
- Enforce role checks on every sensitive endpoint.

## 2. Authorization
- Backend must verify ownership before approve/reject/revoke.
- Backend must verify doctor role before creating access requests.
- Never trust client-provided role; derive from server/session.
- Re-check on-chain permission (`hasAccess`) before serving decrypt material.

## 3. Data Protection
- Encrypt medical files client-side before upload.
- Store only encrypted blobs in IPFS/object storage.
- Keep encryption keys in KMS/HSM; never hardcode keys.
- Do not log plaintext health data.

## 4. Smart Contract Safety
- Apply `onlyPatient`, `onlyDoctor`, `onlyAdmin`, `onlyRecordOwner`.
- Use custom errors for precise failure semantics.
- Emit events on every permission transition.
- Add tests for role bypass, suspension checks, invalid IDs, and revoke edge cases.

## 5. Backend/API Hardening
- Validate all inputs (wallet format, ids, payload size).
- Add rate limits for auth, upload initiation, and request creation.
- Enforce CORS allowlist and secure headers.
- Use idempotency keys for tx-submitting endpoints.

## 6. Realtime/Event Pipeline
- Persist chain cursor (`last_processed_block`) for crash recovery.
- De-duplicate events by (`tx_hash`,`log_index`).
- Handle chain reorgs safely in indexer logic.
- Push only authorized event updates to each user channel.

## 7. Storage and Secrets
- Store secrets in environment manager/secret vault.
- Separate dev/staging/prod keys and contracts.
- Enable encrypted backups for DB and storage metadata.
- Rotate secrets regularly.

## 8. Monitoring and Audit
- Track failed logins/signature verifications.
- Alert on abnormal access request spikes.
- Maintain immutable audit table for security events.
- Capture tx failures and confirmation delays.

## 9. Compliance and Privacy
- Minimize personal data collection.
- Define retention policy for metadata/logs.
- Provide user data export and account deactivation process.
- Publish breach response and incident response runbooks.

## 10. Release Gate (Must Pass)
- Contract tests green.
- API auth/authorization tests green.
- E2E flow validated: register -> upload -> request -> approve -> view -> revoke.
- Security review checklist signed before production deployment.
