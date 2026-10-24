pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/*
 * EmergencyMedicalPredicateVerifier
 * Purpose: Emergency medical verification (Minimum Disclosure).
 * Allows doctors to verify specific medical conditions, such as critical drug allergies,
 * without exposing the patient's complete medical records or private health data.
 */
template EmergencyMedicalPredicateVerifier() {
    // --- PRIVATE INPUTS (Known only to the patient's encrypted record) ---
    signal input patientSecretSalt;    // Secret salt guarding the patient's clinical vault
    signal input criticalAllergy;      // 1 = Critical Drug Allergy present, 0 = Absent
    signal input bloodGroupCode;       // Blood group code (e.g., 1=O+, 2=A+, 3=B+, 4=AB+)
    signal input confidentialDiagCode; // Other private diagnoses (kept 100% secret)

    // --- PUBLIC INPUTS (Shared with Hospital & Polygon Blockchain) ---
    signal input recordCommitment;     // Public clinical commitment hash anchored on Polygon
    signal input queriedPredicate;     // Predicate being tested: 1 for Critical Allergy
    signal input expectedResult;       // Expected predicate outcome (1 = True)

    // 1. Enforce boolean constraints on binary signals
    criticalAllergy * (1 - criticalAllergy) === 0;
    expectedResult * (1 - expectedResult) === 0;

    // 2. Commitment Integrity Check: Poseidon(salt, allergy, bloodGroup, confidentialDiag)
    component hasher = Poseidon(4);
    hasher.inputs[0] <== patientSecretSalt;
    hasher.inputs[1] <== criticalAllergy;
    hasher.inputs[2] <== bloodGroupCode;
    hasher.inputs[3] <== confidentialDiagCode;

    hasher.out === recordCommitment;

    // 3. Predicate Evaluation
    // When queriedPredicate == 1 (Check Critical Allergy), enforce criticalAllergy == expectedResult
    component isAllergyQuery = IsEqual();
    isAllergyQuery.in[0] <== queriedPredicate;
    isAllergyQuery.in[1] <== 1;

    // Assert that if querying allergy (isAllergyQuery == 1), criticalAllergy must equal expectedResult
    isAllergyQuery.out * (criticalAllergy - expectedResult) === 0;
}

component main {public [recordCommitment, queriedPredicate, expectedResult]} = EmergencyMedicalPredicateVerifier();
