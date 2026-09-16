# Project Proposal

## Team Info
- Team Name: `Consensus Crew`
- Team Members:
- `SONIKA` - `23BKT0123`
- `VINITHA J` - `23BKT0132`
- `SEMMAL A` - `23BKT0133`

## Selected Blockchain Platform
- `Polygon Amoy`
- Chosen because it is EVM-compatible, low-cost, and suitable for developing and testing a smart-contract-based healthcare privacy system.

## Use Case / Problem Statement
- We are building a decentralized patient privacy and access management system.
- The target audience includes patients, doctors, and healthcare institutions.
- The problem we are addressing is that traditional healthcare systems often do not give patients direct control over who can access their medical records.
- Our system allows patients to manage doctor access permissions using blockchain-based smart contracts, while keeping medical files off-chain and secure.

## High-Level Architecture
- A Solidity smart contract on Polygon manages registration, record ownership, access requests, approvals, rejections, and revocations.
- A React frontend provides interfaces for patients and doctors to connect wallets and interact with the system.
- A Django backend handles wallet-based authentication, user profiles, record metadata, and access-request APIs.
- Medical files are intended to be encrypted and stored off-chain, while only metadata and access permissions are maintained on-chain.
- Backend services can validate contract state before allowing sensitive actions.
- The system supports auditability through contract events and backend records.

## Timeline + Phases

### Phase 1: Requirement Analysis and Planning
- Milestones:
- finalize use case and features
- prepare system design and architecture
- divide responsibilities among team members
- Task Assignments:
- `SONIKA`: requirements analysis and documentation
- `VINITHA J`: architecture planning and backend flow design
- `SEMMAL A`: frontend and blockchain workflow planning

### Phase 2: Smart Contract Development
- Milestones:
- develop smart contract for patient and doctor roles
- implement record creation and access control logic
- test smart contract functions using Hardhat
- Task Assignments:
- `SEMMAL A`: Solidity contract development
- `SONIKA`: contract testing support and validation
- `VINITHA J`: logic review and documentation support

### Phase 3: Backend Development
- Milestones:
- create backend with Django
- implement wallet authentication and profile management
- build APIs for records and access requests
- Task Assignments:
- `VINITHA J`: backend implementation
- `SONIKA`: backend testing and API validation
- `SEMMAL A`: backend integration support with frontend and blockchain flow

### Phase 4: Frontend Development
- Milestones:
- build landing page, login/register pages, and dashboards
- integrate wallet connection
- connect frontend to backend APIs
- Task Assignments:
- `SEMMAL A`: frontend development and wallet integration
- `VINITHA J`: API support for frontend integration
- `SONIKA`: UI testing and usability review

### Phase 5: Integration and Testing
- Milestones:
- test full patient and doctor workflow
- verify frontend-backend integration
- test contract behavior and access flow
- fix bugs and finalize project context
- Task Assignments:
- `SONIKA`: integration testing and result documentation
- `VINITHA J`: backend issue fixing
- `SEMMAL A`: frontend and blockchain integration fixes

### Phase 6: Deployment and Final Submission
- Milestones:
- deploy contract to Polygon Amoy
- prepare final report and screenshots
- create project demo and presentation
- Task Assignments:
- `SEMMAL A`: deployment and technical demo
- `VINITHA J`: backend deployment notes and support
- `SONIKA`: final report and presentation preparation
