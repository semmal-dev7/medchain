const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PatientPrivacy", function () {
  let PatientPrivacy;
  let contract;
  let admin;
  let patient;
  let doctor;
  let other;

  beforeEach(async function () {
    PatientPrivacy = await ethers.getContractFactory("PatientPrivacy");
    [admin, patient, doctor, other] = await ethers.getSigners();
    contract = await PatientPrivacy.deploy();
    await contract.deployed();
  });

  it("assigns deployer as admin", async function () {
    expect(await contract.getRole(admin.address)).to.equal(3);
  });

  it("registers patient and doctor roles", async function () {
    await contract.connect(patient).registerPatient();
    await contract.connect(doctor).registerDoctor();

    expect(await contract.getRole(patient.address)).to.equal(1);
    expect(await contract.getRole(doctor.address)).to.equal(2);
  });

  it("prevents duplicate registration", async function () {
    await contract.connect(patient).registerPatient();
    await expect(contract.connect(patient).registerDoctor()).to.be.reverted;
  });

  it("allows only patients to create records", async function () {
    await contract.connect(patient).registerPatient();
    await contract.connect(doctor).registerDoctor();

    await expect(contract.connect(doctor).createRecord("QmHash")).to.be.reverted;
    await expect(contract.connect(patient).createRecord("QmHash")).to.not.be.reverted;
  });

  it("supports request -> approve workflow and doctor read access", async function () {
    await contract.connect(patient).registerPatient();
    await contract.connect(doctor).registerDoctor();
    await contract.connect(patient).createRecord("QmRecordCid");

    await contract.connect(doctor).requestAccess(0);
    const reqBefore = await contract.getAccessRequestStatus(0, doctor.address);
    expect(reqBefore.status).to.equal(1);

    await contract.connect(patient).approveAccess(0, doctor.address);
    expect(await contract.hasAccess(0, doctor.address)).to.equal(true);

    const reqAfter = await contract.getAccessRequestStatus(0, doctor.address);
    expect(reqAfter.status).to.equal(2);

    const record = await contract.connect(doctor).getRecord(0);
    expect(record.ipfsHash).to.equal("QmRecordCid");
  });

  it("supports reject workflow", async function () {
    await contract.connect(patient).registerPatient();
    await contract.connect(doctor).registerDoctor();
    await contract.connect(patient).createRecord("QmRejectCase");

    await contract.connect(doctor).requestAccess(0);
    await contract.connect(patient).rejectAccess(0, doctor.address);

    expect(await contract.hasAccess(0, doctor.address)).to.equal(false);
    const req = await contract.getAccessRequestStatus(0, doctor.address);
    expect(req.status).to.equal(3);
  });

  it("supports revoke workflow after approval", async function () {
    await contract.connect(patient).registerPatient();
    await contract.connect(doctor).registerDoctor();
    await contract.connect(patient).createRecord("QmRevokeCase");

    await contract.connect(doctor).requestAccess(0);
    await contract.connect(patient).grantAccess(0, doctor.address);
    expect(await contract.hasAccess(0, doctor.address)).to.equal(true);

    await contract.connect(patient).revokeAccess(0, doctor.address);
    expect(await contract.hasAccess(0, doctor.address)).to.equal(false);

    const req = await contract.getAccessRequestStatus(0, doctor.address);
    expect(req.status).to.equal(4);
  });

  it("only record owner can approve/reject/revoke", async function () {
    await contract.connect(patient).registerPatient();
    await contract.connect(doctor).registerDoctor();
    await contract.connect(other).registerPatient();
    await contract.connect(patient).createRecord("QmOwnerOnly");
    await contract.connect(doctor).requestAccess(0);

    await expect(contract.connect(other).approveAccess(0, doctor.address)).to.be.reverted;
    await expect(contract.connect(other).rejectAccess(0, doctor.address)).to.be.reverted;
    await expect(contract.connect(other).revokeAccess(0, doctor.address)).to.be.reverted;
  });

  it("rejects invalid record id checks", async function () {
    await contract.connect(doctor).registerDoctor();
    await expect(contract.connect(doctor).requestAccess(999)).to.be.reverted;
    await expect(contract.hasAccess(999, doctor.address)).to.be.reverted;
  });

  it("blocks suspended users from state-changing actions", async function () {
    await contract.connect(patient).registerPatient();
    await contract.connect(doctor).registerDoctor();
    await contract.connect(patient).createRecord("QmSuspension");

    await contract.connect(admin).setUserSuspension(doctor.address, true);
    await expect(contract.connect(doctor).requestAccess(0)).to.be.reverted;

    await contract.connect(admin).setUserSuspension(patient.address, true);
    await expect(contract.connect(patient).createRecord("QmSecondRecord")).to.be.reverted;
  });

  it("returns patient record ids", async function () {
    await contract.connect(patient).registerPatient();
    await contract.connect(patient).createRecord("QmOne");
    await contract.connect(patient).createRecord("QmTwo");

    const ids = await contract.getPatientRecordIds(patient.address);
    expect(ids.map((id) => id.toNumber())).to.deep.equal([0, 1]);
  });
});
