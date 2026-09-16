async function main() {
  const PatientPrivacy = await ethers.getContractFactory("PatientPrivacy");
  const contract = await PatientPrivacy.deploy();
  await contract.deployed();
  console.log("PatientPrivacy deployed to:", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });