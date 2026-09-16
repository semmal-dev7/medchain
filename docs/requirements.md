# Patient Privacy DApp - Product to Build Spec

## 1. Goal
Build a decentralized Patient Privacy and Access Management system where patients retain full control over medical-record sharing.

## 2. Roles
- `patient`: owns records, approves/rejects/revokes doctor access.
- `doctor`: requests access, views only explicitly approved records.
- `admin`: governance only (user verification/suspension/audit monitoring), no record access.

## 3. Identity and Registration
- Wallet address is the canonical identity.
- Users must register on-chain before role-specific actions.
- A wallet can have only one active role (`patient` or `doctor`).
- Admin role must be assigned at deployment or through a controlled admin-management function.

## 4. Record Storage Model
- Medical files are encrypted off-chain, uploaded to IPFS.
- On-chain record stores:
- `recordId`
- `owner` (patient wallet)
- `ipfsHash` (or CID)
- `createdAt`
- `active` flag
- Optional metadata pointer (non-sensitive fields only).

## 5. Access Control Rules
- Only registered patients can create records.
- Only the record owner can grant/reject/revoke access for that record.
- Only registered doctors can request access.
- Doctors can view record references only when access is active.
- Revoked access must block future reads immediately.
- Admin cannot grant/revoke patient permissions.

## 6. Required Contract Functions (V2 Target)
- `registerPatient()`
- `registerDoctor()`
- `setUserSuspension(address user, bool suspended)` (`onlyAdmin`)
- `createRecord(string ipfsHash) returns (uint256 recordId)` (`onlyPatient`)
- `requestAccess(uint256 recordId)` (`onlyDoctor`)
- `approveAccess(uint256 recordId, address doctor)` (`onlyRecordOwner`)
- `rejectAccess(uint256 recordId, address doctor)` (`onlyRecordOwner`)
- `revokeAccess(uint256 recordId, address doctor)` (`onlyRecordOwner`)
- `hasAccess(uint256 recordId, address user) view returns (bool)`
- `getRecord(uint256 recordId) view returns (Record memory)` (owner or approved doctor)
- `getPatientRecordIds(address patient) view returns (uint256[] memory)`
- `getAccessRequestStatus(uint256 recordId, address doctor) view returns (...)`

## 7. Required Events
- `PatientRegistered(address indexed patient)`
- `DoctorRegistered(address indexed doctor)`
- `UserSuspended(address indexed user, bool suspended, address indexed admin)`
- `RecordCreated(uint256 indexed recordId, address indexed owner, string ipfsHash, uint256 createdAt)`
- `AccessRequested(uint256 indexed recordId, address indexed doctor, address indexed patient, uint256 timestamp)`
- `AccessApproved(uint256 indexed recordId, address indexed patient, address indexed doctor, uint256 timestamp)`
- `AccessRejected(uint256 indexed recordId, address indexed patient, address indexed doctor, uint256 timestamp)`
- `AccessRevoked(uint256 indexed recordId, address indexed patient, address indexed doctor, uint256 timestamp)`

## 8. Core Invariants
- No one except record owner can change permissions.
- Admin can never read medical records through privileged paths.
- Every permission state transition emits an event.
- Historical events are immutable; no delete/update semantics.
- Suspended users cannot perform state-changing actions.

## 9. Non-Functional Requirements
- Permission update to UI visibility target: < 5 seconds (via event listener + websocket).
- Audit event ingestion success target: >= 99.9%.
- All off-chain file payloads encrypted before upload.

## 10. Out of Scope
- On-chain storage of full medical files.
- Admin override of patient consent.
- Deletion of historical blockchain audit events.
