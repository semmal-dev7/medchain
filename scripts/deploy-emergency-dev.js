async function main() {
  const MockGroth16Verifier = await ethers.getContractFactory("MockGroth16Verifier");
  const verifier = await MockGroth16Verifier.deploy();
  await verifier.deployed();
  console.log("MockGroth16Verifier deployed to:", verifier.address);

  const EmergencyZKPortal = await ethers.getContractFactory("EmergencyZKPortal");
  const portal = await EmergencyZKPortal.deploy(verifier.address);
  await portal.deployed();
  console.log("EmergencyZKPortal deployed to:", portal.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
