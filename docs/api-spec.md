# Backend API Specification (v1)

Base path: `/api/v1`

## 1. Auth

### `POST /auth/nonce`
- Purpose: issue SIWE nonce.
- Request:
```json
{ "wallet": "0x..." }
```
- Response:
```json
{ "nonce": "random-nonce-string" }
```

### `POST /auth/verify`
- Purpose: verify signed SIWE message, return session/JWT.
- Request:
```json
{
  "wallet": "0x...",
  "message": "SIWE message",
  "signature": "0x..."
}
```
- Response:
```json
{
  "accessToken": "jwt",
  "user": { "wallet": "0x...", "role": "patient", "status": "active" }
}
```

## 2. User/Profile

### `POST /users/register`
- Purpose: register role in backend profile after on-chain registration tx.
- Auth: required.
- Request:
```json
{ "role": "patient", "fullName": "John Doe" }
```

### `GET /users/me`
- Purpose: fetch current user profile and status.
- Auth: required.

### `GET /users/:wallet`
- Purpose: wallet lookup for doctor search.
- Auth: required.

## 3. Patient Flows

### `POST /records/upload-url`
- Purpose: pre-signed upload target (or IPFS staging token).
- Auth: patient.
- Request:
```json
{ "fileName": "xray.pdf", "contentType": "application/pdf" }
```

### `POST /records`
- Purpose: save metadata after encrypted upload and on-chain `createRecord`.
- Auth: patient.
- Request:
```json
{
  "recordId": 7,
  "ipfsHash": "bafy...",
  "encryptedKeyRef": "kms:key-id",
  "name": "X-Ray",
  "description": "Chest scan"
}
```

### `GET /records/mine`
- Purpose: list patient records.
- Auth: patient.

### `GET /access/requests/incoming`
- Purpose: list doctor requests for patient-owned records.
- Auth: patient.

### `POST /access/requests/:id/approve`
- Purpose: mark approved after on-chain approve tx.
- Auth: patient owner.

### `POST /access/requests/:id/reject`
- Purpose: mark rejected.
- Auth: patient owner.

### `POST /access/requests/:id/revoke`
- Purpose: revoke previously approved access after on-chain tx.
- Auth: patient owner.

## 4. Doctor Flows

### `GET /patients/search?wallet=0x...`
- Purpose: fetch patient profile visibility.
- Auth: doctor.

### `POST /access/requests`
- Purpose: create access request.
- Auth: doctor.
- Request:
```json
{ "recordId": 7, "patientWallet": "0x..." }
```

### `GET /access/granted`
- Purpose: list records doctor can access.
- Auth: doctor.

### `GET /records/:recordId/decrypt-material`
- Purpose: retrieve encrypted key material only if access is valid.
- Auth: doctor with active permission.

## 5. Admin Flows

### `GET /admin/users`
- Purpose: list users and statuses.
- Auth: admin.

### `POST /admin/users/:wallet/suspend`
- Purpose: suspend user off-chain and trigger on-chain suspension tx.
- Auth: admin.

### `POST /admin/users/:wallet/unsuspend`
- Purpose: unsuspend user.
- Auth: admin.

### `GET /admin/audit`
- Purpose: query indexed audit events.
- Auth: admin.

## 6. Realtime

### `GET /events/stream` (SSE) or `WS /ws`
- Purpose: push updates for:
- `access.requested`
- `access.approved`
- `access.rejected`
- `access.revoked`
- `record.created`
- Auth: required; server filters by role/wallet.

## 7. Error Model
- `400`: invalid payload
- `401`: unauthenticated
- `403`: forbidden by role/ownership
- `404`: resource not found
- `409`: state conflict (already approved/revoked)
- `422`: chain tx failed or unverifiable
- `500`: server error
