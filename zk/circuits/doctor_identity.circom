pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
 * DoctorIdentityVerifier
 * Purpose 1: Privacy-preserving doctor identity verification.
 * Verifies that a doctor has a valid, authorized hospital credential
 * without revealing their private license number, national ID, or personal credentials.
 */
template DoctorIdentityVerifier() {
    // --- PRIVATE INPUTS (Known only to the doctor) ---
    signal input doctorSecretKey;      // Secret physician credential key
    signal input registeredHospitalId;  // Hospital ID where doctor is affiliated

    // --- PUBLIC INPUTS (Visible on blockchain / audit registry) ---
    signal input expectedCommitment;   // Public doctor identity hash anchored on-chain
    signal input publicHospitalId;     // Hospital ID the doctor claims affiliation with

    // Verify hospital ID matches public query
    registeredHospitalId === publicHospitalId;

    // Compute Poseidon commitment: Hash(doctorSecretKey, registeredHospitalId)
    component hasher = Poseidon(2);
    hasher.inputs[0] <== doctorSecretKey;
    hasher.inputs[1] <== registeredHospitalId;

    // Assert computed commitment matches the public commitment
    hasher.out === expectedCommitment;
}

component main {public [expectedCommitment, publicHospitalId]} = DoctorIdentityVerifier();
