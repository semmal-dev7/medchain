# Project Context

## Goal
Build a decentralized patient privacy and access management system on Polygon, with:
- Solidity smart contract for patient/doctor/admin permissions
- Django backend for SIWE auth, profiles, records, and access-request orchestration
- React frontend for patient and doctor workflows

## Current Repository State
- Main working folder: `course-project-submission-consensus_crew`
- Active branch used locally: `semmal`
- Local branch and `origin/semmal` were verified to point to the same commit during the latest review

## Frontend Status
- The frontend codebase has been replaced with the newer `secure-canvas-health` style UI
- Actual frontend stack is:
  - Vite
  - React
  - TypeScript
  - Tailwind
  - shadcn/ui
- Main frontend app entry:
  - `frontend/src/App.tsx`
- Local frontend was successfully served with Vite at:
  - `http://127.0.0.1:8080`
- Wallet connect and wallet-based sign-in flow are working once the backend is running
- Important mismatch:
  - `frontend/package.json` still contains old `react-scripts` commands
  - the actual frontend is Vite-based
  - because of this, `npm run build` and `npm start` from the current `package.json` are not reliable

## Backend Status
- Backend stack:
  - Django
  - Django REST Framework
  - SimpleJWT
- Main API routes are wired in:
  - `backend/config/urls.py`
- Implemented backend areas:
  - SIWE nonce + signature verification
  - user profile retrieval
  - patient record metadata creation/listing
  - doctor access-request creation
  - patient approve/reject/revoke actions
  - optional contract-read enforcement through `apps/chain/services.py`
- Local backend was blocked initially because Python dependencies were not installed
- Backend dependencies were installed successfully from `backend/requirements.txt`
- Django backend was verified with:
  - `python manage.py check`
- Local backend auth endpoint was verified working at:
  - `http://127.0.0.1:8000/api/v1/auth/nonce`

## Smart Contract Status
- Main contract:
  - `contracts/PatientPrivacy.sol`
- Implemented contract features:
  - patient registration
  - doctor registration
  - admin suspension
  - record creation
  - doctor access requests
  - patient approve/reject/revoke access
  - access checks
  - guarded record reads
  - patient record listing
- Contract includes custom errors and event coverage for access lifecycle transitions

## Testing Status
- Hardhat contract tests were run successfully
- Current test result:
  - **11 passing**
- Test file:
  - `test/patientPrivacy.test.js`
- Frontend and backend local flow were also tested manually after starting both servers

## Current Known Gaps
- Frontend scripts in `frontend/package.json` do not match the actual Vite frontend
- Frontend API layer still uses provisional values in some places:
  - fake `pending-...` transaction hashes
  - fake/generated IPFS-style values during record upload
- Full on-chain write flow is not yet wired from frontend to contract
- Full encrypted file upload and key management flow is not yet implemented
- Main `README.md` is outdated and still describes the older setup
- Earlier notes saying `7 passing` are outdated; current contract test count is `11 passing`

## Current User Preference
- Keep the current frontend design as-is
- Work inside the current folder without redesigning the UI

## Recommended Next Steps
1. Fix `frontend/package.json` so scripts match the Vite frontend
2. Run backend + frontend together and validate patient/doctor flows end-to-end
3. Replace provisional transaction/IPFS placeholders with real contract + storage integration
4. Configure chain enforcement for real contract reads
5. Update `README.md` and related docs so they reflect the actual repo state
