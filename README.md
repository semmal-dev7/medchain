# MedChain

MedChain is a decentralized patient privacy and access-management system for a shared healthcare network. Patients control normal access to their medical records. Hospitals provide trusted organizational identity, manage doctor affiliation, approve emergency permissions, and review audit activity. Blockchain commitments and zero-knowledge verification are intended to support minimum-disclosure emergency access without exposing a patient's complete record.

## Core Principle

The hospital is not the owner of every patient's medical data. It is the organizational authority for its hospitals, doctors, policies, and oversight. The patient controls consent for normal access, while the blockchain and ZK layer enforce or verify emergency rules.

```text
Patient  -> controls consent and disputes access
Doctor   -> requests and uses approved clinical information
Hospital -> verifies doctors, manages policy, and reviews activity
Blockchain + ZK -> anchors commitments and verifies emergency predicates
```

## Complete Project Idea

### 1. Hospital and user onboarding

1. A hospital administrator registers a hospital with a unique hospital wallet/public address.
2. The hospital becomes a recognized participant in the shared MedChain network.
3. A doctor registers with a wallet and selects a registered hospital using its public wallet address.
4. The doctor submits a hospital-membership request with the requested role and reason.
5. The hospital approves or rejects the request.
6. Only an approved doctor becomes an active network participant. An unapproved doctor remains pending and cannot use the doctor network.
7. A doctor may be affiliated with more than one hospital through separate approved memberships.

Hospital roles include hospital admin, doctor, emergency doctor, and authorized staff. Hospital admins may revoke membership or emergency permission. Revocation disables the doctor's hospital authorization without deleting the historical relationship.

### 2. Patient registration and clinical data

1. A patient registers a wallet-based identity.
2. The patient or an authorized clinician creates structured clinical data.
3. Django normalizes supported data into FHIR R4 resources such as `Patient`, `AllergyIntolerance`, `Condition`, `MedicationStatement`, `Observation`, `DiagnosticReport`, and `Encounter`.
4. The backend stores a FHIR Bundle with the record metadata.
5. Uploaded medical files are encrypted before upload. The current implementation supports Pinata or a local Kubo-compatible IPFS API and stores only the CID in the blockchain record.

### 3. Commitments and protected storage

The complete medical record remains off-chain. A commitment is generated from the structured clinical representation and a secret salt:

```text
FHIR Bundle -> commitment -> Polygon anchor
encrypted file -> off-chain storage/IPFS -> CID
```

The current prototype stores a labeled `sha256-v1` commitment. Poseidon commitments and a production ZK circuit are planned for the next cryptographic phase.

### 4. Normal consultation access

```text
Doctor -> access request -> Patient -> approve -> authorized record access
```

Only the patient can approve, reject, or revoke normal doctor access. Hospitals can facilitate doctor identity and affiliation but cannot bypass patient consent.

### 5. Emergency break-glass access

When a patient is unconscious or unable to provide normal consent:

1. The doctor identifies the patient using the available prototype identifier.
2. The backend verifies that the doctor is registered and actively affiliated with a participating hospital.
   A hospital admin must also explicitly enable emergency access for that doctor in
   the Hospital Dashboard; this authorization is separate from committee membership.
3. The doctor requests a narrowly defined emergency predicate, such as critical drug allergy, anticoagulant use, blood group, critical medication, or emergency contraindication.
4. The hospital policy determines which predicate categories are allowed.
5. The intended ZK prover checks commitment consistency and the selected predicate using private clinical data.
6. A Groth16 proof is submitted to the emergency verifier.
7. The system returns only the minimum result, such as `true` or `false`, rather than the complete FHIR record.
8. The emergency event is recorded for hospital oversight and patient review.

Hospitals must not automatically access psychiatric history, therapy notes, unrelated diagnoses, financial data, or the patient's complete medical history.

### 6. Audit and dispute workflow

The hospital audit records the doctor, hospital, emergency context, requested predicate, request time, and verification status. A patient can report a discrepancy later. The hospital can review the request and mark the dispute as investigating or resolved. Historical audit records are not deleted.

## Current Implemented Workflow

### Patient

1. Open `/patient/register` or `/register`.
2. Connect a wallet and sign the authentication message.
3. Upload a PDF and optional allergy, condition, and medication fields.
4. The backend creates a FHIR Bundle and clinical commitment.
5. New files are encrypted at rest.
6. Review doctor access requests and approve, reject, or revoke access.

### Doctor

1. Open `/doctor/register`.
2. Connect a doctor wallet.
3. Select an active hospital from the public hospital directory.
4. Select `General Doctor` or `Emergency Doctor` and submit a reason.
5. The doctor profile remains `pending`.
6. After hospital approval, the profile becomes `active` and the doctor can sign in at `/doctor/login`.
7. Approved doctors can request normal patient access and use authorized records.

### Hospital administrator

1. Register at `/hospital/register` with an administrator wallet and a unique hospital wallet.
2. Sign in at `/hospital/login`.
3. Open `/admin/dashboard`.
4. Review and approve or reject pending doctor requests for hospitals administered by that wallet.
5. Review the public hospital audit containing the hospital identity and affiliated doctors.

The hospital dashboard intentionally contains only:

- Doctor request handling
- Public hospital and affiliated-doctor audit

Hospital registration remains a separate flow. Patient records, private policies, and unrestricted medical data are not displayed in the dashboard.

### Public network ledger

1. Open `/transactions` from the public landing page or a signed-in role's
   sidebar. The page is public and does not require wallet authentication.
2. The frontend reads logs directly from the configured MedChain
   `PatientPrivacy` contract on Polygon Amoy (chain ID `80002`). It tries
   `VITE_POLYGON_AMOY_RPC_URL` first when configured, then falls back to public
   Polygon Amoy RPC endpoints.
3. The initial query scans the newest 10,000 blocks. Use **Load older events**
   to continue backward through history. Set
   `VITE_PATIENT_PRIVACY_DEPLOYMENT_BLOCK` to stop scanning at the contract's
   deployment block rather than block zero.
4. While the page remains open, it checks for newly confirmed contract events
   every 30 seconds. The page fetches historical/current records from Polygon;
   it does not store a separate server-side ledger.
5. Filter loaded events by a participant wallet address. Each row links to the
   transaction on PolygonScan.

The ledger displays the supported `PatientPrivacy` events for patient/doctor
registration, user suspension, record creation, access requests, approvals,
rejections, and revocations. It is an event ledger for this contract, not a
complete index of all Polygon transactions: reverted transactions, calls that
emit no supported event, and backend-only actions are not included. The current
`RecordCreated` event publishes an IPFS hash; keep the referenced file
encrypted and treat the hash as sensitive metadata. Never submit patient names
or medical details in transaction inputs.

## Project Structure

- `contracts/PatientPrivacy.sol` - patient roles, records, consent, and access lifecycle.
- `contracts/EmergencyZKPortal.sol` - emergency commitment and verifier boundary.
- `backend/apps/authn` - wallet signature authentication and JWT sessions.
- `backend/apps/hospitals` - hospitals, doctor requests, memberships, and hospital audit identity.
- `backend/apps/records` - encrypted files, FHIR Bundles, and commitments.
- `backend/apps/access` - normal access, emergency requests, appointments, and authorized clinical updates.
- `backend/apps/audit` - emergency audit and dispute workflows.
- `frontend/src/pages` - patient, doctor, hospital, and emergency-approver experiences.

## Local Development

### Smart contracts

```powershell
npm install
npm run compile
npm run test
npm run deploy:amoy
```

### Django backend

```powershell
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

Configure encrypted IPFS uploads before using patient record upload:

```env
IPFS_API_URL=https://api.pinata.cloud/pinning/pinFileToIPFS
IPFS_API_TOKEN=<restricted Pinata JWT>
```

For local Kubo, use `http://127.0.0.1:5001/api/v0/add?pin=true`; omit the token
when authentication is disabled. Pinata JWTs must include `pinFileToIPFS`.
The backend encrypts PDFs before upload and uses the real CID in the Polygon
record transaction. Missing credentials, rejected uploads, or unreachable
providers fail explicitly; the app does not create a fake CID.

### Frontend

```powershell
cd frontend
npm install
npm start
```

Open `http://localhost:8080`. The frontend uses `http://127.0.0.1:8000/api/v1` by default. Set `VITE_API_BASE_URL` in `frontend/.env` to override it.

## Authentication Routes

- Patient registration: `/patient/register`
- Patient login: `/login`
- Doctor registration and hospital request: `/doctor/register`
- Doctor login after approval: `/doctor/login`
- Hospital registration: `/hospital/register`
- Hospital login: `/hospital/login`
- Hospital dashboard: `/admin/dashboard`

Wallet signatures use a single-use nonce that expires after ten minutes. A doctor with pending hospital approval cannot log in to the doctor network.

## Project Status

> Historical status snapshot. For current completed work, deployment state, and
> remaining tasks, use the authoritative continuation handoff below.

### Completed

- Defined the decentralized patient privacy and medical-record access architecture.
- Implemented patient and doctor registration, role permissions, record ownership, access requests, approvals, rejections, revocations, and guarded reads in `contracts/PatientPrivacy.sol`.
- Implemented the emergency commitment and verifier boundary in `contracts/EmergencyZKPortal.sol`.
- Added Hardhat tests for registration, record creation, normal access lifecycle, suspended users, invalid records, and emergency proof validation.
- Implemented Django REST APIs for SIWE wallet authentication, JWT sessions, profiles, records, access requests, hospitals, appointments, emergency access, and audit workflows.
- Added encrypted-at-rest medical-file support, FHIR Bundle generation, and SHA-256 clinical commitments.
- Implemented the React/Vite frontend for patient, doctor, hospital administrator, and emergency-approver workflows.
- Implemented MetaMask connection, account switching, wallet-change detection, signed authentication, and protected role-based routes.
- Added patient record upload and access-management workflows.
- Added doctor patient access requests and approved-record viewing.
- Doctors can view approved patient PDFs in a read-only viewer. The doctor interface does not provide download or print actions, and the doctor download API returns `403 Forbidden`.
- Updated the landing page to use `Patient Portal` instead of `Login to Dashboard` and removed the duplicate top navigation Login button.
- Verified the Django configuration with `python manage.py check`.
- Verified the frontend with a successful Vite production build.

### Partially completed (historical snapshot)

- The contract and backend workflows exist, but some frontend actions still use backend APIs rather than real wallet-signed blockchain write transactions.
- IPFS integration for encrypted medical files is planned; the current prototype uses backend encrypted storage and some provisional IPFS-style values.
- Some transaction hashes are provisional and must be replaced with confirmed Polygon Amoy transaction hashes.
- Emergency access has contract and backend foundations, but the complete real prover, verifier, and frontend flow needs final integration testing.
- Hospital membership, emergency approver, audit, and dispute workflows need complete end-to-end validation with real roles and wallets.

### Remaining tasks

Complete the remaining work in this order:

#### Phase 1: Environment and deployment configuration

1. Configure the Polygon Amoy network, wallet accounts, RPC URL, and deployment environment.
2. Deploy `PatientPrivacy.sol` and `EmergencyZKPortal.sol` to Polygon Amoy.
3. Store the deployed contract addresses and ABI configuration for the backend and frontend.
4. Configure production-style secrets, including `DJANGO_SECRET_KEY`, `FERNET_KEY`, database settings, and API environment variables.

#### Phase 2: Real storage and blockchain integration

5. Complete encrypted file storage and connect it to a real IPFS provider.
6. Implement secure encryption-key management using a KMS/HSM-compatible approach.
7. Connect frontend record creation to real wallet-signed contract transactions.
8. Connect doctor access requests, patient approvals, rejections, and revocations to real contract transactions.
9. Replace provisional transaction hashes and IPFS-style values with confirmed transaction hashes and real IPFS CIDs.
10. Add transaction confirmation, failure handling, and Polygon Amoy explorer links.

#### Phase 3: Emergency access integration

11. Complete the Circom circuit and Poseidon commitment flow.
12. Generate real Groth16 proofs from private clinical data.
13. Deploy and configure the production emergency verifier.
14. Connect the emergency frontend and backend flow to proof generation and verification.
15. Test emergency expiration, revocation, hospital authorization, and minimum-disclosure results.

#### Phase 4: Security and permission hardening

16. Configure HTTPS and restrict CORS to approved frontend origins.
17. Add authentication and sensitive-endpoint rate limiting.
18. Validate SIWE domain, URI, chain ID, nonce, and issued-at fields strictly.
19. Verify every patient, doctor, hospital, and emergency endpoint enforces the correct role and consent rules.
20. Confirm doctor records remain view-only, with download and print actions denied by the backend and hidden in the UI.

#### Phase 5: Testing and end-to-end validation

21. Add automated tests for doctor read-only viewing and doctor download denial.
22. Add frontend tests for wallet connection, role routing, patient consent, and record viewing.
23. Run backend, contract, and frontend test suites together.
24. Run a complete patient-to-doctor workflow on Polygon Amoy:
    - patient registration
    - patient record upload
    - doctor registration
    - hospital approval
    - doctor access request
    - patient approval
    - doctor read-only record viewing
    - patient access revocation
25. Run the emergency-access workflow with a real proof and verify the audit trail.
26. Record and resolve integration, permission, and deployment failures.

#### Phase 6: Documentation and final submission

27. Update deployment and environment-variable documentation.
28. Document contract addresses, API endpoints, user workflows, and security limitations.
29. Capture final screenshots and workflow evidence.
30. Prepare the final report and presentation.
31. Record the final project demonstration.

## Validation

The current repository includes:

- Django backend tests covering authentication, hospitals, doctor approval, records, access, audit, and emergency workflows.
- Hardhat tests covering patient privacy and the emergency portal boundary.
- A Vite production build for the frontend.
- An authenticated backend IPFS upload endpoint that encrypts PDFs before
  uploading them and returns real content identifiers when configured.

Before production use, the prototype still needs a production IPFS provider
with retention monitoring, KMS/HSM key management, Poseidon commitments,
Circom circuits, Groth16 proving keys, a deployed verifier, rate limiting,
secure production secrets, and an end-to-end security review.

This project is intended for demonstration and coursework. It is not a production healthcare system.

## Continuation Handoff (Authoritative)

Use this section as the source of truth when continuing MedChain from a new
chat, account, or machine. Preserve the phase order and do not replace working
integrations with mock values.

### Product idea

MedChain is a coursework/demo decentralized healthcare privacy system:

1. Patients control normal consent for their medical records.
2. Doctors request access; patients approve, reject, or revoke it.
3. Hospitals establish doctor identity, affiliation, emergency permissions,
   policy, and audit oversight.
4. Encrypted files remain off-chain in IPFS; only a CID and record metadata are
   anchored on Polygon.
5. Emergency access is minimum-disclosure and should eventually prove a
   clinical predicate with zero knowledge without revealing the underlying
   clinical value.

### Building workflow

Work in this order:

1. Start the Django backend on `127.0.0.1:8000`.
2. Start the Vite frontend on `localhost:8080`.
3. Connect MetaMask in Chrome and switch to Polygon Amoy, chain ID `80002`.
4. Register/login the correct role wallet.
5. Patient uploads an encrypted PDF; Pinata returns a real CID.
6. The patient wallet creates the blockchain record and the backend stores the
   confirmed transaction hash.
7. Doctor registers, requests hospital affiliation, and waits for approval.
8. Doctor requests a record; patient approves or rejects on-chain.
9. Doctor views approved records through the read-only viewer.
10. Patient can revoke access. Emergency access is a separate break-glass
    workflow and must never bypass its hospital policy or audit trail.

### Completed

- PatientPrivacy Solidity roles, record creation, access requests, approvals,
  rejections, revocations, and guarded reads.
- Django REST authentication, JWT sessions, users, records, FHIR bundles,
  SHA-256 commitments, normal access, hospitals, appointments, emergency
  requests, grants, audit, and disputes.
- React/Vite patient, doctor, hospital, and emergency-approver experiences.
- MetaMask account handling, wallet authentication, Polygon Amoy switching,
  and automatic patient/doctor on-chain role registration.
- Real wallet-signed Polygon transactions for record creation and normal
  access lifecycle operations.
- Dynamic Polygon Amoy EIP-1559 fees with a minimum 25 gwei priority fee. This
  fixes the RPC rejection of the old 1.5 gwei tip.
- Encrypted PDF uploads through Pinata or Kubo-compatible IPFS. Pinata JWTs
  must have `pinFileToIPFS` permission.
- Doctor approved-record viewing is read-only in the UI; the doctor download
  endpoint returns HTTP 403.
- Emergency approvals are hospital-scoped: requesters select three active,
  emergency-authorized doctors from their hospital for each request. Hospital
  emergency authorization is sufficient; a separate `emergency_doctor` role
  is not required. Only
  those doctors can see or decide it; two distinct approvals are required
  within 30 minutes. Grants last 30 minutes and invalidate on membership
  revocation. The separate Emergency Records page displays the full uploaded
  PDF for the approved record to the requesting doctor only while the grant is
  valid; requested resource types remain part of the approval/audit context.
- Hardhat tests, Django tests, Django system checks, and Vite production
  builds have passed during development.

### Current deployment and important state

- Network: Polygon Amoy, chain ID `80002` (`0x13882`).
- PatientPrivacy:
  `0xA67be390586868bCb295681C3A2D1a7e38601658`.
- Public on-chain activity: open `/transactions` in the frontend for an event
  ledger of wallets interacting with the PatientPrivacy contract. It reads
  Polygon Amoy logs in 10,000-block pages; use the optional
  `VITE_PATIENT_PRIVACY_DEPLOYMENT_BLOCK` to set the deployment block and
  `VITE_POLYGON_AMOY_RPC_URL` to select a public RPC provider. The explorer link
  provides the full transaction history. Contract events and transaction inputs
  are public and permanent. The current `RecordCreated` event includes the IPFS
  hash, so referenced files must remain encrypted and the hash should be treated
  as sensitive metadata.
- Development MockGroth16Verifier:
  `0x0Df2430Ef67495971806b672D6E066851bc1b2B8`.
- Development EmergencyZKPortal:
  `0x28847Ca55e921F4Dfae94bE15C217cFC3a86144A`.
- Frontend: `http://localhost:8080`.
- Backend API: `http://127.0.0.1:8000/api/v1`.
- `CHAIN_ENFORCEMENT=false` is intentional until all backend writes and reads
  are synchronized with deployed blockchain state.
- Never commit or paste `.env` files, private keys, JWTs, RPC keys, Django
  secrets, or Fernet keys. Rotate credentials if they were exposed.

### Emergency access and ZKP truth

Implemented emergency policy and foundation:

- Hospital authorization and configurable emergency predicate names.
- Emergency request creation with context, reason, predicate, and requested
  resources.
- A hospital may maintain a pool of active doctors with emergency access
  enabled. This hospital approval is sufficient; a separate
  `emergency_doctor` role is not required. The requester selects exactly three
  from one hospital for each request; only those three can see and decide it.
- Two-of-three distinct approvals, a 30-minute approval deadline, immediate
  closure after a selected approver rejects, expiry, audit data, and 30-minute
  temporary grants. The doctor's separate Emergency Records page streams the
  approved record's full uploaded PDF only to the requesting doctor while the
  grant is valid.
- The requesting doctor cannot approve or reject their own request. Inactive or
  unselected users cannot decide. Decisions lock the request and hospital
  rows to prevent concurrent threshold races.
- `EmergencyZKPortal.sol` commitment registration and Groth16-shaped verifier
  boundary.

Enforced policy:

- Exactly three selected eligible hospital approvers per request.
- Only the selected three receive the request; two different approvals out
  of those three are required.
- Duplicate, self, inactive, unauthorized, late, and post-rejection approvals
  are rejected.

Not yet complete:

- Production Poseidon commitments.
- Circom circuits and witness generation.
- Groth16 proving and verification keys.
- Real proof generation and a real deployed verifier.
- Full frontend proof submission and on-chain emergency verification.

The deployed mock verifier returns a configurable boolean and does not perform
cryptographic verification. It is development-only and must never support a
production security claim.

### Remaining tasks in dependency order

#### Phase 1: Validate the current integration

1. Refresh Chrome and verify the latest frontend bundle.
2. Test patient registration, automatic role registration, encrypted Pinata
   upload, real CID, generated record ID, and confirmed transaction hash.
3. Test doctor registration, hospital affiliation approval, doctor role
   registration, access request, patient approval/rejection/revocation, and
   doctor read-only viewing.
4. Confirm doctor download remains HTTP 403.
5. Confirm MetaMask network switching and the 25 gwei Amoy fee path.

#### Phase 2: Emergency approval policy - complete

6. Hospital-approved emergency doctors form the eligible pool. The requester
   selects exactly three active emergency-authorized colleagues from one
   hospital for the request.
7. Two of those three selected doctors must approve within 30 minutes. The
   requester cannot approve or reject their own request; one selected-doctor
   rejection closes it.
8. Inactive, unauthorized, duplicate, late, expired, and post-rejection
   decisions are blocked. Requests are visible only to their three selected
   approvers while those doctors remain eligible at that hospital.
9. Grant issuance rechecks selected-approver votes and the requesting doctor's
   current hospital authorization. Revoking that authorization invalidates the
   grant. Hospital admins can enable or revoke emergency access from the
   Hospital Dashboard; this authorization is sufficient for approver
   eligibility without a separate emergency-doctor role.
10. The doctor interface includes an Emergency Approvals page. Backend
    threshold, membership, deadline, rejection, grant, and revocation behavior
    has targeted tests. A live workflow with real accounts is still required.

#### Phase 3: Implement real ZKP

11. Define circuits for allergy, medication, anticoagulant, blood-group, and
    contraindication predicates.
12. Implement versioned Poseidon commitments with a private salt.
13. Build Circom circuits and private witness generation.
14. Generate Groth16 keys and test valid and invalid proofs.
15. Deploy a real verifier and configure the emergency portal.
16. Bind proof public inputs to the patient commitment, predicate, hospital,
    and request context.
17. Remove the mock verifier from production configuration.

#### Phase 4: Security hardening

18. Replace development Django secrets and design KMS/HSM-compatible key
    management.
19. Configure HTTPS, strict CORS, secure token handling, and rate limits.
20. Strictly validate SIWE domain, URI, chain ID, nonce, and issued-at fields.
21. Audit patient, doctor, hospital, emergency, disclosure, and dispute
    permissions.
22. Add retention, key rotation, IPFS pin monitoring, and incident procedures.
23. Enable `CHAIN_ENFORCEMENT=true` only after synchronization is complete.

#### Phase 5: Tests and end-to-end proof

24. Add tests for fee overrides, role registration, confirmed transaction data,
    Pinata success/failure, and real CID handling.
25. Add backend tests for doctor download denial, view authorization, 2-of-3
    committee enforcement, expiry, and minimum disclosure.
26. Add frontend tests for wallet/network errors, consent, role routing, and
    emergency workflows.
27. Run the complete patient-to-doctor workflow on Polygon Amoy.
28. Run emergency access with a real proof and verify the audit trail.
29. Record and resolve integration, permission, and deployment failures.

#### Phase 6: Final submission

30. Document final addresses, environment variables, API routes, screenshots,
    tests, limitations, and security assumptions.
31. Prepare the final report, presentation, and demonstration.

### Minimal validation commands

```powershell
# From D:\Blockchain Project\medchain
npm run compile
npm run test

cd backend
python manage.py check
python manage.py test

cd ..\frontend
npm run build
```

This project is intended for demonstration and coursework. It is not a
production healthcare system until real ZKP verification, secure key
management, committee enforcement, security hardening, and end-to-end
validation are complete.
