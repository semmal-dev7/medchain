const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EmergencyZKPortal", function () {
  let portal;
  let verifier;
  let admin;
  let patient;
  let doctor;
  let hospital;

  beforeEach(async function () {
    [admin, patient, doctor, hospital] = await ethers.getSigners();
    const verifierFactory = await ethers.getContractFactory("MockGroth16Verifier");
    verifier = await verifierFactory.deploy();
    await verifier.deployed();

    const portalFactory = await ethers.getContractFactory("EmergencyZKPortal");
    portal = await portalFactory.deploy(verifier.address);
    await portal.deployed();
    await portal.setHospitalDoctor(hospital.address, doctor.address, true);
  });

  it("binds proof verification to patient commitment, predicate, and hospital doctor", async function () {
    const commitment = ethers.utils.hexZeroPad("0x1234", 32);
    await portal.connect(patient).registerCommitment(commitment);

    const publicSignals = [ethers.BigNumber.from(commitment), 70618];
    const proof = [[0, 0], [[0, 0], [0, 0]], [0, 0]];
    await expect(
      portal.connect(doctor).verifyEmergencyProof(
        patient.address,
        hospital.address,
        70618,
        proof[0],
        proof[1],
        proof[2],
        publicSignals,
      ),
    ).to.emit(portal, "EmergencyProofVerified");
  });

  it("rejects an unaffiliated doctor", async function () {
    const commitment = ethers.utils.hexZeroPad("0x1234", 32);
    await portal.connect(patient).registerCommitment(commitment);
    await expect(
      portal.connect(patient).verifyEmergencyProof(
        patient.address,
        hospital.address,
        70618,
        [0, 0],
        [[0, 0], [0, 0]],
        [0, 0],
        [ethers.BigNumber.from(commitment), 70618],
      ),
    ).to.be.reverted;
  });

  it("rejects a verifier failure", async function () {
    const commitment = ethers.utils.hexZeroPad("0x1234", 32);
    await portal.connect(patient).registerCommitment(commitment);
    await verifier.setResult(false);
    await expect(
      portal.connect(doctor).verifyEmergencyProof(
        patient.address,
        hospital.address,
        70618,
        [0, 0],
        [[0, 0], [0, 0]],
        [0, 0],
        [ethers.BigNumber.from(commitment), 70618],
      ),
    ).to.be.reverted;
  });
});