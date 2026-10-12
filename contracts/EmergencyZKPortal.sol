// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[2] calldata publicSignals
    ) external view returns (bool);
}

contract EmergencyZKPortal {
    error NotAdmin();
    error UnauthorizedHospitalDoctor(address hospital, address doctor);
    error InvalidCommitment(address patient);
    error InvalidPublicInputs();
    error InvalidProof();

    address public immutable admin;
    IGroth16Verifier public immutable verifier;

    mapping(address => bytes32) public patientCommitments;
    mapping(address => mapping(address => bool)) public hospitalDoctors;

    event DoctorAffiliated(address indexed hospital, address indexed doctor, bool active);
    event CommitmentRegistered(address indexed patient, bytes32 commitment);
    event EmergencyProofVerified(
        address indexed patient,
        address indexed doctor,
        address indexed hospital,
        uint256 predicateId,
        bool result,
        uint256 timestamp
    );

    constructor(address verifierAddress) {
        admin = msg.sender;
        verifier = IGroth16Verifier(verifierAddress);
    }

    function setHospitalDoctor(address hospital, address doctor, bool active) external {
        if (msg.sender != admin) revert NotAdmin();
        hospitalDoctors[hospital][doctor] = active;
        emit DoctorAffiliated(hospital, doctor, active);
    }

    function registerCommitment(bytes32 commitment) external {
        patientCommitments[msg.sender] = commitment;
        emit CommitmentRegistered(msg.sender, commitment);
    }

    function verifyEmergencyProof(
        address patient,
        address hospital,
        uint256 predicateId,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[2] calldata publicSignals
    ) external returns (bool) {
        if (!hospitalDoctors[hospital][msg.sender]) {
            revert UnauthorizedHospitalDoctor(hospital, msg.sender);
        }
        bytes32 commitment = patientCommitments[patient];
        if (commitment == bytes32(0)) revert InvalidCommitment(patient);
        if (publicSignals[0] != uint256(commitment) || publicSignals[1] != predicateId) {
            revert InvalidPublicInputs();
        }
        if (!verifier.verifyProof(a, b, c, publicSignals)) revert InvalidProof();

        emit EmergencyProofVerified(patient, msg.sender, hospital, predicateId, true, block.timestamp);
        return true;
    }
}