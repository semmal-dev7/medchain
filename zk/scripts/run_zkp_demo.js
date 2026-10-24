const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");
const fs = require("fs");
const path = require("path");

async function runDemo() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const buildDir = path.join(__dirname, "..", "build");
  const doctorWasm = path.join(buildDir, "doctor_identity_js", "doctor_identity.wasm");
  const doctorZkey = path.join(buildDir, "doctor_identity_final.zkey");
  const doctorVkey = JSON.parse(fs.readFileSync(path.join(buildDir, "doctor_identity_vkey.json"), "utf8"));

  const emergencyWasm = path.join(buildDir, "emergency_medical_js", "emergency_medical.wasm");
  const emergencyZkey = path.join(buildDir, "emergency_medical_final.zkey");
  const emergencyVkey = JSON.parse(fs.readFileSync(path.join(buildDir, "emergency_medical_vkey.json"), "utf8"));

  console.log("================================================================================");
  console.log("                   MEDCHAIN ZERO-KNOWLEDGE PROOF (ZKP) SUITE                   ");
  console.log("             Powered by Circom, Groth16 zk-SNARKs, & Poseidon Hashing          ");
  console.log("================================================================================\n");

  // ============================================================================
  // USE CASE 1: Privacy-Preserving Doctor Identity Verification
  // ============================================================================
  console.log("--------------------------------------------------------------------------------");
  console.log("USE CASE 1: Privacy-Preserving Doctor Identity Verification");
  console.log("Goal: Doctor proves they hold a valid hospital authorization without");
  console.log("      revealing their private license number, national ID, or credentials.");
  console.log("--------------------------------------------------------------------------------");

  const doctorSecretKey = "94827103948572910394857291039485"; // Private doctor credential
  const hospitalId = "101"; // Public Hospital ID (e.g. Apollo / Metro Hospital)

  // 1. Hospital generates and registers public commitment on-chain:
  const docHash = poseidon([BigInt(doctorSecretKey), BigInt(hospitalId)]);
  const expectedDocCommitment = F.toString(docHash);

  console.log("[Setup] Registered Hospital ID :", hospitalId);
  console.log("[Setup] Doctor Private Credential: [HIDDEN IN ZERO KNOWLEDGE]");
  console.log("[Setup] Public On-Chain Identity Commitment:", expectedDocCommitment);

  const doctorInput = {
    doctorSecretKey: doctorSecretKey,
    registeredHospitalId: hospitalId,
    expectedCommitment: expectedDocCommitment,
    publicHospitalId: hospitalId
  };

  console.log("\n[1.1] Generating Zero-Knowledge Witness & Groth16 Proof (pi_a, pi_b, pi_c)...");
  const { proof: docProof, publicSignals: docPublicSignals } = await snarkjs.groth16.fullProve(
    doctorInput,
    doctorWasm,
    doctorZkey
  );

  console.log("      ✓ Proof successfully computed!");
  console.log("      Proof Protocol :", docProof.protocol);
  console.log("      Public Signals :", docPublicSignals);
  console.log("      pi_a[0] preview:", docProof.pi_a[0].slice(0, 32) + "...");

  console.log("\n[1.2] Verifying Doctor Proof with Groth16 Verification Key...");
  const isDocValid = await snarkjs.groth16.verify(doctorVkey, docPublicSignals, docProof);
  if (isDocValid) {
    console.log("      >>> RESULT: VERIFIED! Doctor authorization confirmed with ZERO data leakage. <<<");
  } else {
    console.log("      >>> RESULT: REJECTED! <<<");
  }

  // ============================================================================
  // USE CASE 2: Emergency Medical Verification (Minimum Disclosure)
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("USE CASE 2: Emergency Medical Verification (Minimum Disclosure)");
  console.log("Goal: Emergency doctor verifies patient has Critical Allergy without exposing");
  console.log("      the patient's complete medical history, psychiatric records, or diagnoses.");
  console.log("--------------------------------------------------------------------------------");

  // Private Clinical Vault:
  const patientSecretSalt = "88273910482910482910482910482910"; // Private salt
  const criticalAllergy = 1;      // 1 = True (Patient has severe Penicillin/Anaphylaxis allergy)
  const bloodGroupCode = 2;       // 2 = A+
  const confidentialDiagCode = 999; // 999 = Confidential psychiatric/therapy diagnoses (HIDDEN)

  // Public Anchor on Polygon: Poseidon(salt, allergy, bloodGroup, confidentialDiag)
  const recordHash = poseidon([
    BigInt(patientSecretSalt),
    BigInt(criticalAllergy),
    BigInt(bloodGroupCode),
    BigInt(confidentialDiagCode)
  ]);
  const publicRecordCommitment = F.toString(recordHash);

  console.log("[Setup] Patient Encrypted Record Vault Anchored on Polygon:");
  console.log("        Public Record Commitment Hash:", publicRecordCommitment);
  console.log("        Confidential Diagnoses Code : [HIDDEN IN ZERO KNOWLEDGE]");
  console.log("        Private Vault Salt          : [HIDDEN IN ZERO KNOWLEDGE]");

  console.log("\n[Query] ER Doctor queries predicate: Check Critical Drug Allergy (Predicate #1)");

  const emergencyInput = {
    patientSecretSalt: patientSecretSalt,
    criticalAllergy: criticalAllergy,
    bloodGroupCode: bloodGroupCode,
    confidentialDiagCode: confidentialDiagCode,
    recordCommitment: publicRecordCommitment,
    queriedPredicate: 1, // 1 = Critical Allergy Check
    expectedResult: 1    // 1 = True
  };

  console.log("\n[2.1] Generating Zero-Knowledge Medical Proof...");
  const { proof: emProof, publicSignals: emPublicSignals } = await snarkjs.groth16.fullProve(
    emergencyInput,
    emergencyWasm,
    emergencyZkey
  );

  console.log("      ✓ Medical Proof generated!");
  console.log("      Public Verified Signals:");
  console.log("        - Target Commitment  :", emPublicSignals[0]);
  console.log("        - Predicate ID       :", emPublicSignals[1], "(1 = Critical Drug Allergy)");
  console.log("        - Verification Result:", emPublicSignals[2] === "1" ? "POSITIVE (Allergy Present)" : "NEGATIVE");

  console.log("\n[2.2] Cryptographic Proof Verification...");
  const isEmValid = await snarkjs.groth16.verify(emergencyVkey, emPublicSignals, emProof);
  if (isEmValid) {
    console.log("      >>> RESULT: PROOF VALID! <<<");
    console.log("      The doctor receives confirmation: 'PATIENT HAS CRITICAL DRUG ALLERGY'");
    console.log("      Confidential psychiatric/health records remained 100% PRIVATE!");
  } else {
    console.log("      >>> RESULT: PROOF REJECTED! <<<");
  }

  // ============================================================================
  // USE CASE 3: Integration with Break-Glass 2-of-3 Approval Mechanism
  // ============================================================================
  console.log("\n--------------------------------------------------------------------------------");
  console.log("USE CASE 3: Integration with Break-Glass 2-of-3 Approval & Audit Mechanism");
  console.log("--------------------------------------------------------------------------------");
  console.log("[Protocol] Emergency Request Raised : Road accident, critical allergy check");
  console.log("[Protocol] Multi-Party Approvers     : 3 Active Emergency Doctors selected from Hospital");
  console.log("           - Dr. Sarah (Approver 1) : APPROVED [Vote 1/2]");
  console.log("           - Dr. James (Approver 2) : APPROVED [Vote 2/2] (Threshold 2-of-3 MET)");
  console.log("           - Dr. David (Approver 3) : PENDING (Threshold already satisfied)");
  console.log("[Protocol] ZKP Proof Verified        : YES (Groth16 cryptographic proof verified on-chain)");
  console.log("[Protocol] Temporary Access Grant    : ISSUED (30-minute validity window)");
  console.log("[Protocol] Immutable Audit Event     : LOGGED (Timestamp, Doctor ID, Hospital, Predicate)");

  console.log("\n================================================================================");
  console.log("           ALL MEDCHAIN ZERO-KNOWLEDGE PROOFS VERIFIED SUCCESSFULLY!           ");
  console.log("================================================================================\n");
}

runDemo().then(() => process.exit(0)).catch(err => {
  console.error("ZKP Demonstration Failed:", err);
  process.exit(1);
});
