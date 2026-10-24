# Zero-Knowledge Proofs (ZKP) in MedChain

MedChain implements zero-knowledge cryptographic verification using **Circom** arithmetic circuits and the **Groth16 zk-SNARK** proving system over the **BN128** elliptic curve with **Poseidon** hashing.

---

## 1. Core Use Cases

### A. Privacy-Preserving Doctor Identity Verification
- **Problem**: When a doctor requests records or approves emergency access, MedChain must verify that the doctor holds an authorized hospital credential without revealing personal details (such as doctor license numbers, national identity numbers, or internal credentials).
- **ZKP Circuit**: [`circuits/doctor_identity.circom`](circuits/doctor_identity.circom)
- **Private Inputs**: `doctorSecretKey` (physician secret credential).
- **Public Inputs**: `expectedCommitment` (on-chain doctor hash), `publicHospitalId`.
- **Result**: Proves affiliation to the hospital with zero leakage of doctor credentials.

### B. Emergency Medical Verification (Minimum Disclosure)
- **Problem**: An unconscious patient arrives in an ER following an accident. The clinician needs to know if the patient has a critical drug allergy (e.g. penicillin). Under GDPR/HIPAA minimum disclosure principles, the doctor must not be handed the patient's full medical record (such as psychiatric notes, confidential diagnoses, or unrelated conditions).
- **ZKP Circuit**: [`circuits/emergency_medical.circom`](circuits/emergency_medical.circom)
- **Private Inputs**: `patientSecretSalt`, `criticalAllergy`, `bloodGroupCode`, `confidentialDiagCode`.
- **Public Inputs**: `recordCommitment` (anchored on Polygon blockchain), `queriedPredicate` (1 = Critical Allergy), `expectedResult` (1 = Present).
- **Result**: Proves the patient's record satisfies the medical condition without revealing the patient's secret salt, other diagnoses, or private health data.

### C. Integration with Break-Glass 2-of-3 Approval & Audit Trail
- Emergency requests require **2-of-3 multi-party approvals** from hospital emergency doctors within a 30-minute window.
- The ZKP verifies the clinical claim with minimum disclosure.
- The system issues a 30-minute temporary grant and records an immutable audit log.

---

## 2. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Circuit Language** | Circom 2.2.3 | Domain-Specific Language for arithmetic constraint systems |
| **Proving System** | Groth16 zk-SNARK | Constant-size proofs (128 bytes) and ultra-fast verification |
| **Curve** | BN128 (Alt-bn128) | Ethereum/Polygon precompiled pairing curve |
| **Hash Function** | Poseidon | ZK-friendly cryptographic hash algorithm |
| **Toolchain** | snarkjs & circomlib | Powers of Tau trusted setup, witness generation, proof verification |
| **Smart Contracts** | Solidity (`contracts/`) | Auto-generated EVM on-chain verifier contracts |

---

## 3. How to Run the Demonstration

From the project root directory, run:

```bash
npm run zk:demo
```

Or from inside the `zk/` folder:

```bash
cd zk
node scripts/run_zkp_demo.js
```

### Output:
1. Generates real elliptic curve points ($\pi_A, \pi_B, \pi_C$) for Doctor Identity.
2. Mathematically verifies doctor credential.
3. Computes zero-knowledge medical predicate proof.
4. Confirms patient critical allergy with zero disclosure of confidential diagnoses.
5. Verifies 2-of-3 multi-party emergency break-glass workflow.
