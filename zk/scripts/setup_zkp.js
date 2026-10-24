const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=== MedChain Zero-Knowledge Proof (Groth16) Trusted Setup ===");
  const buildDir = path.join(__dirname, "..", "build");
  const contractsDir = path.join(__dirname, "..", "contracts");
  if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir, { recursive: true });

  const ptauPath = path.join(buildDir, "pot12_final.ptau");

  // Step 1: Create Powers of Tau (power 12 covers up to 4096 constraints)
  if (!fs.existsSync(ptauPath)) {
    console.log("[1/4] Generating Powers of Tau ceremony (BN128 curve, 2^12)...");
    const ptau0 = path.join(buildDir, "pot12_0000.ptau");
    const ptau1 = path.join(buildDir, "pot12_0001.ptau");

    await snarkjs.powersOfTau.newAccumulator({ curve: "bn128", power: 12 }, ptau0);
    await snarkjs.powersOfTau.contribute(ptau0, ptau1, "MedChain Contributor 1", "entropy-entropy-12345");
    await snarkjs.powersOfTau.preparePhase2(ptau1, ptauPath);

    if (fs.existsSync(ptau0)) fs.unlinkSync(ptau0);
    if (fs.existsSync(ptau1)) fs.unlinkSync(ptau1);
    console.log("      Powers of Tau ready:", ptauPath);
  } else {
    console.log("[1/4] Using existing Powers of Tau file:", ptauPath);
  }

  // Circuits to prepare
  const circuits = [
    { name: "doctor_identity", title: "1. Privacy-Preserving Doctor Identity Verification" },
    { name: "emergency_medical", title: "2. Emergency Medical Predicate Verification (Minimum Disclosure)" }
  ];

  for (const c of circuits) {
    console.log(`\n--- Preparing ${c.title} ---`);
    const r1csPath = path.join(buildDir, `${c.name}.r1cs`);
    const zkey0 = path.join(buildDir, `${c.name}_0000.zkey`);
    const finalZkey = path.join(buildDir, `${c.name}_final.zkey`);
    const vkeyPath = path.join(buildDir, `${c.name}_vkey.json`);
    const solPath = path.join(contractsDir, `${c.name === "doctor_identity" ? "DoctorIdentityVerifier" : "EmergencyMedicalVerifier"}.sol`);

    console.log(`[2/4] Setting up Groth16 zkey for ${c.name}...`);
    await snarkjs.zKey.newZKey(r1csPath, ptauPath, zkey0);
    await snarkjs.zKey.contribute(zkey0, finalZkey, "MedChain Setup", "salt-entropy-98765");
    if (fs.existsSync(zkey0)) fs.unlinkSync(zkey0);

    console.log(`[3/4] Exporting verification key...`);
    const vKey = await snarkjs.zKey.exportVerificationKey(finalZkey);
    fs.writeFileSync(vkeyPath, JSON.stringify(vKey, null, 2));

    console.log(`[4/4] Exporting Solidity Verifier contract...`);
    const templatePath = path.join(__dirname, "..", "node_modules", "snarkjs", "templates", "verifier_groth16.sol.ejs");
    let template = "";
    if (fs.existsSync(templatePath)) {
      template = fs.readFileSync(templatePath, "utf-8");
    }
    const verifierSol = await snarkjs.zKey.exportSolidityVerifier(finalZkey, { groth16: template });
    // Rename contract class so both verifiers can co-exist
    const contractName = c.name === "doctor_identity" ? "DoctorIdentityVerifier" : "EmergencyMedicalVerifier";
    const customSol = verifierSol.replace("contract Groth16Verifier", `contract ${contractName}`);
    fs.writeFileSync(solPath, customSol);
    console.log(`      Exported ${contractName} to: ${solPath}`);
  }

  console.log("\n=======================================================");
  console.log("SUCCESS! ZKP Groth16 setup is complete for MedChain.");
  console.log("=======================================================\n");
}

main().then(() => process.exit(0)).catch(err => { console.error("Error:", err); process.exit(1); });
