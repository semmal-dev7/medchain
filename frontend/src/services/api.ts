import { ethers } from "ethers";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://127.0.0.1:8000/api/v1";

const ACCESS_TOKEN_KEY = "healthchain_access_token";
const REFRESH_TOKEN_KEY = "healthchain_refresh_token";
export const AUTH_EXPIRED_EVENT = "healthchain:auth-expired";
const PATIENT_PRIVACY_ADDRESS =
  (import.meta.env.VITE_PATIENT_PRIVACY_CONTRACT as string | undefined) ||
  "0xA67be390586868bCb295681C3A2D1a7e38601658";
const PATIENT_PRIVACY_ABI = [
  "function getRole(address user) view returns (uint8)",
  "function registerPatient()",
  "function registerDoctor()",
  "function createRecord(string ipfsHash) returns (uint256)",
  "function requestAccess(uint256 recordId)",
  "function approveAccess(uint256 recordId, address doctor)",
  "function rejectAccess(uint256 recordId, address doctor)",
  "function revokeAccess(uint256 recordId, address doctor)",
  "function getAccessRequestStatus(uint256 recordId, address doctor) view returns (uint8 status, uint64 requestedAt, uint64 updatedAt)",
  "function hasAccess(uint256 recordId, address doctor) view returns (bool)",
  "event RecordCreated(uint256 indexed recordId, address indexed patient, string ipfsHash, uint256 timestamp)",
];

const ensurePolygonAmoy = async () => {
  if (!window.ethereum) throw new Error("MetaMask is not installed");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x13882" }],
    });
  } catch (error: any) {
    if (error?.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: "0x13882",
        chainName: "Polygon Amoy",
        nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
        rpcUrls: ["https://rpc-amoy.polygon.technology"],
        blockExplorerUrls: ["https://amoy.polygonscan.com"],
      }],
    });
  }
};

const getPatientPrivacyContract = async () => {
  if (!window.ethereum) throw new Error("MetaMask is not installed");
  await ensurePolygonAmoy();
  const provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
  const network = await provider.getNetwork();
  if (network.chainId !== 80002) throw new Error("MetaMask is not connected to Polygon Amoy");
  return new ethers.Contract(PATIENT_PRIVACY_ADDRESS, PATIENT_PRIVACY_ABI, provider.getSigner());
};

const getAmoyGasOverrides = async (contract: ethers.Contract) => {
  const provider = contract.provider;
  const feeData = await provider.getFeeData();
  const minimumPriorityFee = ethers.utils.parseUnits("25", "gwei");
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas?.gte(minimumPriorityFee)
    ? feeData.maxPriorityFeePerGas
    : minimumPriorityFee;
  const baseFee = feeData.lastBaseFeePerGas || feeData.gasPrice || minimumPriorityFee;
  const maxFeePerGas = baseFee.mul(2).add(maxPriorityFeePerGas);
  return { maxPriorityFeePerGas, maxFeePerGas };
};

export const registerOnChain = async (role: "patient" | "doctor"): Promise<string> => {
  const contract = await getPatientPrivacyContract();
  const signer = contract.signer;
  const address = await signer.getAddress();
  const currentRole = Number(await contract.getRole(address));
  const expectedRole = role === "patient" ? 1 : 2;
  if (currentRole === expectedRole) return "";
  if (currentRole !== 0) throw new Error("This wallet is already registered with another blockchain role");
  const method = role === "patient" ? "registerPatient" : "registerDoctor";
  const gasOverrides = await getAmoyGasOverrides(contract);
  const balance = await contract.provider.getBalance(address);
  if (balance.isZero()) {
    throw new Error("This wallet has no POL on Polygon Amoy to pay the registration gas fee. Fund it with Amoy test POL and try again.");
  }

  try {
    const estimatedGas = await contract.estimateGas[method]({
      ...gasOverrides,
      from: address,
    });
    const gasLimit = estimatedGas.mul(120).div(100);
    const maximumGasCost = gasLimit.mul(gasOverrides.maxFeePerGas);
    if (balance.lt(maximumGasCost)) {
      throw new Error(
        `Insufficient POL on Polygon Amoy for this registration. The wallet has ${ethers.utils.formatEther(balance)} POL; add test POL and try again.`,
      );
    }

    const transaction = await contract[method]({
      ...gasOverrides,
      gasLimit,
    });
    const receipt = await transaction.wait();
    return receipt.transactionHash;
  } catch (error: any) {
    if (error?.code === "INSUFFICIENT_FUNDS" || /insufficient funds|funds for gas/i.test(error?.message || "")) {
      throw new Error("Insufficient POL on Polygon Amoy to pay the registration gas fee. Add Amoy test POL to this wallet and try again.");
    }
    if (/internal json-rpc error/i.test(error?.message || "")) {
      throw new Error("Polygon Amoy RPC rejected the registration transaction. Check that this wallet has POL for gas and is connected to Polygon Amoy, then retry.");
    }
    throw error;
  }
};

const ensureOnChainRole = async (role: "patient" | "doctor") => {
  const contract = await getPatientPrivacyContract();
  const address = await contract.signer.getAddress();
  const currentRole = Number(await contract.getRole(address));
  const expectedRole = role === "patient" ? 1 : 2;
  if (currentRole === expectedRole) return;
  if (currentRole !== 0) {
    throw new Error(`This wallet is registered on-chain as a different role. Use a ${role} wallet.`);
  }
  const transaction = await contract[role === "patient" ? "registerPatient" : "registerDoctor"](
    await getAmoyGasOverrides(contract),
  );
  await transaction.wait();
};

export interface ApiUser {
  wallet: string;
  role: "patient" | "doctor" | "admin";
  status: "active" | "suspended";
  full_name?: string;
}

export interface MedicalRecord {
  id: string;
  name: string;
  description: string;
  fileName: string;
  uploadDate: string;
  txHash: string;
}

export interface AccessRequest {
  id: string;
  recordId: number;
  doctorName: string;
  doctorWallet: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  requestDate: string;
}

export interface PatientInfo {
  id: string;
  name: string;
  wallet: string;
  recordCount: number;
  status: "approved" | "pending";
}

export interface PatientRecordTarget {
  recordId: number;
  patientWallet: string;
  name: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface PatientRecord {
  id: number;
  recordId: number;
  name: string;
  description: string;
  ipfsHash: string;
  createdAt: string;
  hasFile: boolean;
  fhirBundle: Record<string, unknown>;
  clinicalCommitment: string;
  commitmentAlgorithm: string;
}

export interface EmergencyAccessRequest {
  id: string;
  recordId: number;
  recordName?: string;
  isAllRecords?: boolean;
  patientWallet: string;
  selectedApprovers: string[];
  context: string;
  reason: string;
  requestedResources: string[];
  status: string;
  requestedAt: string;
  expiresAt?: string;
  hospitalId?: string;
  hospitalName?: string;
}

export interface EmergencyRecordGrant {
  grant_token: string;
  expires_at: string;
}

export interface EmergencyApproverCandidate {
  wallet: string;
  fullName: string;
}

export interface EmergencyApproverHospital {
  id: string;
  name: string;
  wallet: string;
  doctors: EmergencyApproverCandidate[];
}

export interface Hospital {
  id: string;
  wallet: string;
  name: string;
  status: "active" | "suspended";
  members: HospitalMember[];
  emergency_policy: string[];
}

export interface HospitalMember {
  wallet: string;
  full_name: string;
  role: "admin" | "doctor" | "emergency_doctor" | "staff";
  active: boolean;
  emergency_access: boolean;
}

export interface HospitalEmergencyAudit {
  request_id: string;
  patient_wallet: string;
  doctor_wallet: string;
  context: string;
  reason: string;
  predicate: string;
  requested_resources: string[];
  status: string;
  requested_at: string;
  dispute_count: number;
  disputes: Array<{ id: number; status: string; reason: string }>;
}

export interface DoctorHospitalRequest {
  id: string;
  doctor_wallet: string;
  doctor_name: string;
  hospital_name: string;
  hospital_wallet: string;
  requested_role: "doctor" | "emergency_doctor";
  status: "pending" | "approved" | "rejected";
  reason: string;
  requested_at: string;
}

export interface Appointment {
  id: string;
  patientWallet: string;
  doctorWallet: string;
  patientName: string;
  doctorName: string;
  scheduledFor: string;
  reason: string;
  status: "requested" | "confirmed" | "rejected" | "cancelled";
}

interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
}

const shortWallet = (wallet: string) => `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

const parseJson = async (res: Response) => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text.trim() };
  }
};

const getResponseError = (data: any, statusCode: number): string => {
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.error === "string") return data.error;

  const messages = Object.entries(data || {}).flatMap(([field, value]) => {
    const values = Array.isArray(value) ? value : [value];
    return values
      .filter((message): message is string => typeof message === "string")
      .map((message) => field === "non_field_errors" ? message : `${field}: ${message}`);
  });
  return messages[0] || `Request failed (HTTP ${statusCode})`;
};

let refreshRequest: Promise<string> | null = null;

const expireSession = () => {
  clearAuthTokens();
  localStorage.removeItem("healthchain_user");
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
};

const refreshAccessToken = async (): Promise<string> => {
  if (refreshRequest) return refreshRequest;

  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    expireSession();
    throw new Error("Your session has expired. Please sign in again.");
  }

  refreshRequest = (async () => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/token/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });
    } catch {
      throw new Error(`Cannot reach the API at ${API_BASE_URL}. Start the backend server and try again.`);
    }

    const data = await parseJson(response);
    if (!response.ok || typeof data?.access !== "string") {
      expireSession();
      throw new Error("Your session has expired. Please sign in again.");
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
    if (typeof data.refresh === "string") {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);
    }
    return data.access as string;
  })();

  try {
    return await refreshRequest;
  } finally {
    refreshRequest = null;
  }
};

const authenticatedFetch = async (path: string, init: RequestInit = {}, auth = true): Promise<Response> => {
  const headers = new Headers(init.headers);
  let token = auth ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  if (auth && !token && localStorage.getItem(REFRESH_TOKEN_KEY)) {
    token = await refreshAccessToken();
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error(`Cannot reach the API at ${API_BASE_URL}. Start the backend server and try again.`);
  }

  if (auth && response.status === 401) {
    if (!token && !localStorage.getItem(REFRESH_TOKEN_KEY)) {
      expireSession();
      throw new Error("Your session could not be validated. Please sign in again.");
    }
    token = await refreshAccessToken();
    headers.set("Authorization", `Bearer ${token}`);
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    } catch {
      throw new Error(`Cannot reach the API at ${API_BASE_URL}. Start the backend server and try again.`);
    }
    if (response.status === 401) {
      expireSession();
      throw new Error("Your session could not be validated. Please sign in again.");
    }
  }
  return response;
};

async function request(path: string, init: RequestInit = {}, auth = true): Promise<any> {
  const headers: Record<string, string> = {
    ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (auth) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await authenticatedFetch(path, { ...init, headers }, auth);
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(getResponseError(data, res.status));
  }
  return data;
}

const buildSiweMessage = (wallet: string, nonce: string) =>
  [
    "medchain.local wants you to sign in with your Ethereum account:",
    wallet,
    "",
    "Sign in to MedChain",
    "",
    "URI: http://localhost:8080",
    "Version: 1",
    "Chain ID: 80002",
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");

export const clearAuthTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const authenticateWallet = async (
  wallet: string,
  signMessage: (message: string) => Promise<string>,
  role?: "patient" | "doctor" | "admin",
  fullName?: string,
): Promise<ApiUser> => {
  const normalizedWallet = wallet.toLowerCase();
  const nonceResponse = await request("/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ wallet: normalizedWallet }),
  }, false);
  const nonce = nonceResponse?.nonce;
  if (!nonce) throw new Error("Failed to get nonce");

  const message = buildSiweMessage(normalizedWallet, nonce);
  const signature = await signMessage(message);

  const payload: Record<string, string> = {
    wallet: normalizedWallet,
    message,
    signature,
  };
  if (role) payload.role = role;
  if (fullName) payload.full_name = fullName;

  const verified = (await request("/auth/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  }, false)) as VerifyResponse;

  localStorage.setItem(ACCESS_TOKEN_KEY, verified.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, verified.refreshToken);
  return verified.user;
};

export const fetchMe = async (): Promise<ApiUser> => {
  return request("/users/me");
};

// ---- Patient APIs ----

export const getPatientStats = async () => {
  const [records, requests] = await Promise.all([
    request("/records/mine"),
    request("/access/requests/incoming"),
  ]);

  const approvedDoctors = new Set<string>();
  let pendingRequests = 0;
  (requests || []).forEach((r: any) => {
    if (r.status === "approved") approvedDoctors.add((r.doctor_wallet || "").toLowerCase());
    if (r.status === "pending") pendingRequests += 1;
  });

  return {
    totalRecords: (records || []).length,
    activeDoctors: approvedDoctors.size,
    pendingRequests,
  };
};

export const getMyRecords = async (): Promise<PatientRecord[]> => {
  const rows = await request("/records/mine");
  return (rows || []).map((row: any) => ({
    id: row.id,
    recordId: row.record_id,
    name: row.name,
    description: row.description,
    ipfsHash: row.ipfs_hash,
    createdAt: row.created_at,
    hasFile: Boolean(row.has_file),
    fhirBundle: row.fhir_bundle || {},
    clinicalCommitment: row.clinical_commitment || "",
    commitmentAlgorithm: row.commitment_algorithm || "",
  }));
};

export const getRecentActivity = async (): Promise<ActivityItem[]> => {
  const [records, requests] = await Promise.all([
    request("/records/mine"),
    request("/access/requests/incoming"),
  ]);

  const recordEvents = (records || []).map((r: any) => ({
    id: `record-${r.id}`,
    action: "Record Uploaded",
    detail: r.name || shortWallet(r.patient_wallet || ""),
    timestamp: r.created_at,
  }));

  const requestEvents = (requests || []).map((r: any) => ({
    id: `access-${r.id}`,
    action: `Access ${String(r.status || "").charAt(0).toUpperCase()}${String(r.status || "").slice(1)}`,
    detail: shortWallet(r.doctor_wallet || ""),
    timestamp: r.requested_at || r.approved_at || r.rejected_at || r.revoked_at,
  }));

  return [...recordEvents, ...requestEvents]
    .filter((e) => !!e.timestamp)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 10);
};

export const uploadRecord = async (
  name: string,
  description: string,
  file: File,
  fhirResources: Array<Record<string, unknown>> = [],
): Promise<{ txHash: string }> => {
  await ensureOnChainRole("patient");
  const ipfsForm = new FormData();
  ipfsForm.append("file", file);
  const ipfs = await request("/records/ipfs/upload", { method: "POST", body: ipfsForm });
  const ipfsHash = String(ipfs.ipfs_hash || "");
  if (!ipfsHash.startsWith("ipfs://")) throw new Error("IPFS did not return a valid content identifier");
  const contract = await getPatientPrivacyContract();
  const transaction = await contract.createRecord(ipfsHash, await getAmoyGasOverrides(contract));
  const receipt = await transaction.wait();
  const event = receipt.events?.find((item: ethers.Event) => item.event === "RecordCreated");
  const recordId = event?.args?.recordId?.toNumber();
  if (recordId === undefined) throw new Error("Blockchain record creation did not return a record ID");

  const formData = new FormData();
  formData.append("record_id", String(recordId));
  formData.append("ipfs_hash", ipfsHash);
  formData.append("encrypted_key_ref", String(ipfs.encrypted_key_ref || "ipfs-managed"));
  formData.append("name", name);
  formData.append("description", description);
  formData.append("tx_hash", receipt.transactionHash);
  formData.append("fhir_resources", JSON.stringify(fhirResources));
  formData.append("file", file);

  await request("/records/", {
    method: "POST",
    body: formData,
  });

  return { txHash: receipt.transactionHash };
};

export const getHospitals = async (): Promise<Hospital[]> => request("/hospitals/", {}, false);

export const getMyHospitals = async (): Promise<Hospital[]> => request("/hospitals/mine");

export const createHospital = async (name: string, wallet: string): Promise<Hospital> =>
  request("/hospitals/", { method: "POST", body: JSON.stringify({ name, wallet }) });

export const registerHospitalDoctor = async (hospitalId: string, doctorWallet: string, role = "doctor", emergencyAccess = false) =>
  request(`/hospitals/${hospitalId}/doctors`, {
    method: "POST",
    body: JSON.stringify({ doctor_wallet: doctorWallet, role, emergency_access: emergencyAccess }),
  });

export const updateHospitalDoctor = async (hospitalId: string, doctorWallet: string, changes: { role?: string; active?: boolean; emergency_access?: boolean }) =>
  request(`/hospitals/${hospitalId}/doctors/${encodeURIComponent(doctorWallet)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

export const removeHospitalDoctor = async (hospitalId: string, doctorWallet: string) =>
  request(`/hospitals/${hospitalId}/doctors/${encodeURIComponent(doctorWallet)}`, { method: "DELETE" });

export const revokeHospitalDoctorPermission = async (hospitalId: string, doctorWallet: string) =>
  updateHospitalDoctor(hospitalId, doctorWallet, { active: false, emergency_access: false });

export const updateHospitalPolicy = async (hospitalId: string, allowedPredicates: string[]) =>
  request(`/hospitals/${hospitalId}/policy`, {
    method: "PUT",
    body: JSON.stringify({ allowed_predicates: allowedPredicates }),
  });

export const registerHospitalPatient = async (hospitalId: string, patientWallet: string, hospitalPatientId: string, administrativeNotes: string) =>
  request(`/hospitals/${hospitalId}/patients`, {
    method: "POST",
    body: JSON.stringify({ patient_wallet: patientWallet, hospital_patient_id: hospitalPatientId, administrative_notes: administrativeNotes }),
  });

export const getHospitalEmergencyAudit = async (hospitalId: string): Promise<HospitalEmergencyAudit[]> =>
  request(`/audit/hospitals/${hospitalId}/emergency`);

export const getHospitalPublicAudit = async (hospitalId: string) =>
  request(`/hospitals/${hospitalId}/public-audit`, {}, false);

export const getHospitalMembers = async (hospitalId: string): Promise<HospitalMember[]> =>
  request(`/hospitals/${hospitalId}/doctors`);

export const createDoctorHospitalRequest = async (hospitalWallet: string, requestedRole: "doctor" | "emergency_doctor", reason: string) =>
  request("/hospitals/doctor-requests", { method: "POST", body: JSON.stringify({ hospital_wallet: hospitalWallet, requested_role: requestedRole, reason }) });

export const getDoctorHospitalRequests = async (): Promise<DoctorHospitalRequest[]> => request("/hospitals/doctor-requests/mine");

export const getHospitalDoctorRequests = async (hospitalId: string): Promise<DoctorHospitalRequest[]> => request(`/hospitals/${hospitalId}/doctor-requests`);

export const reviewHospitalDoctorRequest = async (hospitalId: string, requestId: string, decision: "approve" | "reject") =>
  request(`/hospitals/${hospitalId}/doctor-requests/${requestId}/${decision}`, { method: "POST", body: JSON.stringify({}) });

export const updateHospitalDispute = async (hospitalId: string, disputeId: number, status: "investigating" | "resolved", resolution: string) =>
  request(`/audit/hospitals/${hospitalId}/disputes/${disputeId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, resolution }),
  });

export const downloadRecord = async (recordId: number, fileName: string): Promise<void> => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await authenticatedFetch(`/records/${recordId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const data = await parseJson(response);
    throw new Error(data?.detail || "Failed to download record");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "medical-record";
  link.click();
  URL.revokeObjectURL(url);
};

export const deleteRecord = async (recordId: number): Promise<void> => {
  await request(`/records/${recordId}`, { method: "DELETE" });
};

export const getAccessRequests = async (): Promise<AccessRequest[]> => {
  const rows = await request("/access/requests/incoming");
  return (rows || []).map((r: any) => ({
    id: r.id,
    recordId: r.record_id,
    doctorName: shortWallet(r.doctor_wallet),
    doctorWallet: r.doctor_wallet,
    status: r.status,
    requestDate: r.requested_at,
  }));
};

export const updateAccessStatus = async (id: string, status: "approved" | "rejected"): Promise<void> => {
  const rows = await request("/access/requests/incoming");
  const accessRequest = (rows || []).find((row: any) => row.id === id);
  if (!accessRequest) throw new Error("Access request not found");
  const contract = await getPatientPrivacyContract();

  let onChainStatus = 0;
  try {
    const statusData = await contract.getAccessRequestStatus(
      accessRequest.record_id,
      accessRequest.doctor_wallet
    );
    onChainStatus = Number(statusData.status ?? statusData[0] ?? 0);
  } catch (err) {
    console.warn("Could not query on-chain access request status:", err);
  }

  let txHash = "";

  if (status === "approved") {
    if (onChainStatus === 2) {
      console.log("Access request is already approved on-chain. Syncing database.");
    } else {
      try {
        const transaction = await contract.approveAccess(
          accessRequest.record_id,
          accessRequest.doctor_wallet,
          await getAmoyGasOverrides(contract),
        );
        const receipt = await transaction.wait();
        txHash = receipt.transactionHash;
      } catch (contractErr: any) {
        const errStr = JSON.stringify(contractErr) || contractErr?.message || "";
        if (errStr.includes("0xdb619333") || errStr.includes("AccessRequestNotPending")) {
          console.log("Contract indicates request is already transitioned on-chain. Syncing database.");
        } else {
          throw contractErr;
        }
      }
    }
  } else {
    // status === "rejected"
    if (onChainStatus === 3 || onChainStatus === 4) {
      console.log("Access request is already rejected/revoked on-chain. Syncing database.");
    } else if (onChainStatus === 2) {
      try {
        const transaction = await contract.revokeAccess(
          accessRequest.record_id,
          accessRequest.doctor_wallet,
          await getAmoyGasOverrides(contract),
        );
        const receipt = await transaction.wait();
        txHash = receipt.transactionHash;
      } catch (contractErr: any) {
        const errStr = JSON.stringify(contractErr) || contractErr?.message || "";
        if (errStr.includes("0xdb619333") || errStr.includes("AccessNotGranted") || errStr.includes("0x3ba59ed6")) {
          console.log("Contract indicates access is already revoked on-chain. Syncing database.");
        } else {
          throw contractErr;
        }
      }
    } else {
      try {
        const transaction = await contract.rejectAccess(
          accessRequest.record_id,
          accessRequest.doctor_wallet,
          await getAmoyGasOverrides(contract),
        );
        const receipt = await transaction.wait();
        txHash = receipt.transactionHash;
      } catch (contractErr: any) {
        const errStr = JSON.stringify(contractErr) || contractErr?.message || "";
        if (errStr.includes("0xdb619333") || errStr.includes("AccessRequestNotPending")) {
          console.log("Contract indicates request is already transitioned on-chain. Syncing database.");
        } else {
          throw contractErr;
        }
      }
    }
  }

  const action = status === "approved" ? "approve" : "reject";
  await request(`/access/requests/${id}/${action}`, {
    method: "POST",
    body: JSON.stringify({ decision_tx_hash: txHash }),
  });
};

export const revokeAccess = async (id: string): Promise<void> => {
  const rows = await request("/access/requests/incoming");
  const accessRequest = (rows || []).find((row: any) => row.id === id);
  if (!accessRequest) throw new Error("Access request not found");
  const contract = await getPatientPrivacyContract();

  let onChainStatus = 0;
  try {
    const statusData = await contract.getAccessRequestStatus(
      accessRequest.record_id,
      accessRequest.doctor_wallet
    );
    onChainStatus = Number(statusData.status ?? statusData[0] ?? 0);
  } catch (err) {
    console.warn("Could not query on-chain access request status:", err);
  }

  let txHash = "";
  if (onChainStatus === 2) {
    try {
      const transaction = await contract.revokeAccess(
        accessRequest.record_id,
        accessRequest.doctor_wallet,
        await getAmoyGasOverrides(contract),
      );
      const receipt = await transaction.wait();
      txHash = receipt.transactionHash;
    } catch (contractErr: any) {
      const errStr = JSON.stringify(contractErr) || contractErr?.message || "";
      if (errStr.includes("AccessNotGranted") || errStr.includes("0x3ba59ed6")) {
        console.log("Access is already revoked on-chain. Syncing database.");
      } else {
        throw contractErr;
      }
    }
  }

  await request(`/access/requests/${id}/revoke`, {
    method: "POST",
    body: JSON.stringify({ decision_tx_hash: txHash }),
  });
};

// ---- Doctor APIs ----

export const getApprovedPatients = async (): Promise<PatientInfo[]> => {
  const rows = await request("/access/requests/outgoing");
  const map = new Map<string, PatientInfo>();

  (rows || []).forEach((r: any) => {
    const wallet = String(r.patient_wallet || "").toLowerCase();
    if (!wallet) return;
    const current = map.get(wallet) || {
      id: wallet,
      name: shortWallet(wallet),
      wallet,
      recordCount: 0,
      status: "pending" as const,
    };
    if (r.status === "approved") current.status = "approved";
    map.set(wallet, current);
  });

  // Calculate actual record count for each patient
  await Promise.all(
    Array.from(map.values()).map(async (patient) => {
      try {
        const records = await request(`/access/patient-records?wallet=${encodeURIComponent(patient.wallet)}`);
        patient.recordCount = Array.isArray(records) && records.length > 0 ? records.length : 1;
      } catch {
        patient.recordCount = 1;
      }
    })
  );

  return Array.from(map.values());
};

export const getAuthorizedRecord = async (recordId: number) => {
  return request(`/access/records/${recordId}`);
};

export const getApprovedRecordAccess = async (): Promise<any[]> => {
  const rows = await request("/access/requests/outgoing");
  const approvedRequests = (rows || []).filter((row: any) => row.status === "approved");

  // Get unique patient wallets from approved requests
  const patientWallets = Array.from(
    new Set(approvedRequests.map((r: any) => String(r.patient_wallet || "").toLowerCase()).filter(Boolean))
  );

  if (patientWallets.length === 0) return [];

  // For each approved patient, fetch all of their active medical records
  const recordLists = await Promise.all(
    patientWallets.map(async (wallet) => {
      try {
        const targets = await request(`/access/patient-records?wallet=${encodeURIComponent(wallet)}`);
        return Array.isArray(targets) ? targets : [];
      } catch (err) {
        console.warn(`Could not load records for patient ${wallet}:`, err);
        return [];
      }
    })
  );

  const allRecordsMap = new Map<number, any>();
  for (const list of recordLists) {
    for (const rec of list) {
      if (rec?.record_id !== undefined && !allRecordsMap.has(rec.record_id)) {
        allRecordsMap.set(rec.record_id, rec);
      }
    }
  }

  // Also include original records from approvedRequests
  for (const req of approvedRequests) {
    if (req?.record_id !== undefined && !allRecordsMap.has(req.record_id)) {
      allRecordsMap.set(req.record_id, req);
    }
  }

  return Array.from(allRecordsMap.values());
};

const mapAppointment = (row: any): Appointment => ({ id: row.id, patientWallet: row.patient_wallet, doctorWallet: row.doctor_wallet, patientName: row.patient_name || row.patient_wallet, doctorName: row.doctor_name || row.doctor_wallet, scheduledFor: row.scheduled_for, reason: row.reason || "", status: row.status });
export const getPatientAppointments = async (): Promise<Appointment[]> => (await request("/access/appointments/patient")).map(mapAppointment);
export const bookAppointment = async (doctorWallet: string, scheduledFor: string, reason: string): Promise<Appointment> => mapAppointment(await request("/access/appointments/patient", { method: "POST", body: JSON.stringify({ doctor_wallet: doctorWallet, scheduled_for: new Date(scheduledFor).toISOString(), reason }) }));
export const getDoctorAppointments = async (): Promise<Appointment[]> => (await request("/access/appointments/doctor")).map(mapAppointment);
export const updateAppointmentStatus = async (id: string, status: "confirmed" | "rejected" | "cancelled"): Promise<Appointment> => mapAppointment(await request(`/access/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }));

export const downloadAuthorizedRecord = async (recordId: number, fileName: string): Promise<void> => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await authenticatedFetch(`/access/records/${recordId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const data = await parseJson(response);
    throw new Error(data?.detail || "Failed to download approved record");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || `medical-record-${recordId}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
};

export const viewAuthorizedRecord = async (recordId: number): Promise<string> => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await authenticatedFetch(`/access/records/${recordId}/view`, {
    headers: token ? { Authorization: "Bearer " + token } : {},
  });
  if (!response.ok) {
    const data = await parseJson(response);
    throw new Error(data?.detail || "Failed to view approved record");
  }
  return URL.createObjectURL(await response.blob());
};

export const requestPatientAccess = async (patientAddress: string): Promise<void> => {
  await ensureOnChainRole("doctor");
  const wallet = patientAddress.toLowerCase();
  const targets = await request(`/access/patient-records?wallet=${encodeURIComponent(wallet)}`);
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error("No active records found for this patient");
  }

  const target = targets[0];
  const existingRequests = await request("/access/requests/outgoing");
  const existingRequest = (existingRequests || []).find(
    (item: any) =>
      String(item.patient_wallet || "").toLowerCase() === wallet &&
      Number(item.record_id) === Number(target.record_id),
  );
  if (existingRequest?.status === "pending") {
    throw new Error("An access request for this record is already pending.");
  }
  if (existingRequest?.status === "approved") {
    throw new Error("You already have access to this patient's record.");
  }

  const contract = await getPatientPrivacyContract();
  let transaction: ethers.ContractTransaction;
  try {
    transaction = await contract.requestAccess(target.record_id, await getAmoyGasOverrides(contract));
    await transaction.wait();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not submit the access request to Polygon Amoy: ${message}`);
  }

  try {
    await request("/access/requests", {
      method: "POST",
      body: JSON.stringify({
        patient_wallet: wallet,
        record_id: target.record_id,
        request_tx_hash: transaction.hash,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `The blockchain request was confirmed (${transaction.hash}), but the backend could not save it: ${message}. Contact support before retrying.`,
    );
  }
};

export const getPatientRecordTargets = async (patientAddress: string): Promise<PatientRecordTarget[]> => {
  const rows = await request(`/access/patient-records?wallet=${encodeURIComponent(patientAddress.toLowerCase())}`);
  return (rows || []).map((row: any) => ({
    recordId: row.record_id,
    patientWallet: row.patient_wallet,
    name: row.name,
    createdAt: row.created_at,
  }));
};

export const getEligibleEmergencyApprovers = async (): Promise<EmergencyApproverHospital[]> => {
  const rows = await request("/access/emergency/eligible-approvers");
  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    wallet: row.wallet,
    doctors: row.doctors.map((doctor: any) => ({
      wallet: doctor.wallet,
      fullName: doctor.full_name,
    })),
  }));
};

export const createEmergencyAccessRequest = async (
  patientAddress: string,
  recordId: number,
  hospitalId: string,
  approverWallets: string[],
  context: string,
  reason: string,
  requestedResources: string[],
  predicate = "",
): Promise<EmergencyAccessRequest> => {
  const row = await request("/access/emergency/requests", {
    method: "POST",
    body: JSON.stringify({
      patient_wallet: patientAddress.toLowerCase(),
      record_id: recordId,
      hospital_id: hospitalId,
      approver_wallets: approverWallets.map((wallet) => wallet.toLowerCase()),
      context,
      reason,
      requested_resources: requestedResources,
      predicate,
    }),
  });
  return {
    id: row.id,
    recordId: row.record_id,
    recordName: row.record_name,
    isAllRecords: row.is_all_records,
    patientWallet: row.patient_wallet,
    selectedApprovers: row.selected_approvers,
    context: row.context,
    reason: row.reason,
    requestedResources: row.requested_resources,
    status: row.status,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    hospitalId: row.hospital_id,
    hospitalName: row.hospital_name,
  };
};

export const getPendingEmergencyRequests = async (): Promise<EmergencyAccessRequest[]> => {
  const rows = await request("/access/emergency/requests/pending");
  return rows.map((row: any) => ({
    id: row.id,
    recordId: row.record_id,
    recordName: row.record_name,
    isAllRecords: row.is_all_records,
    patientWallet: row.patient_wallet,
    selectedApprovers: row.selected_approvers,
    context: row.context,
    reason: row.reason,
    requestedResources: row.requested_resources,
    status: row.status,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
  }));
};

export const decideEmergencyRequest = async (id: string, decision: "approve" | "reject") => {
  return request(`/access/emergency/requests/${id}/${decision}`, { method: "POST", body: JSON.stringify({}) });
};

export const getDoctorEmergencyRequests = async (): Promise<EmergencyAccessRequest[]> => {
  const rows = await request("/access/emergency/requests/outgoing");
  return rows.map((row: any) => ({
    id: row.id,
    recordId: row.record_id,
    recordName: row.record_name,
    isAllRecords: row.is_all_records,
    patientWallet: row.patient_wallet,
    selectedApprovers: row.selected_approvers,
    context: row.context,
    reason: row.reason,
    requestedResources: row.requested_resources,
    status: row.status,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    hospitalId: row.hospital_id,
    hospitalName: row.hospital_name,
  }));
};

export const issueEmergencyGrant = async (requestId: string): Promise<EmergencyRecordGrant> =>
  request(`/access/emergency/requests/${requestId}/grant`, {
    method: "POST",
    body: JSON.stringify({}),
  });

export const viewEmergencyRecordFile = async (grantToken: string, recordId?: number): Promise<string> => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await authenticatedFetch("/access/emergency/grants/record", {
    method: "POST",
    headers,
    body: JSON.stringify({ grant_token: grantToken, record_id: recordId }),
  });
  if (!response.ok) {
    const data = await parseJson(response);
    throw new Error(data?.detail || "Failed to view emergency medical record");
  }
  return URL.createObjectURL(await response.blob());
};

export const getDoctorAccessHistory = async (): Promise<ActivityItem[]> => {
  const rows = await request("/access/requests/outgoing");
  return (rows || []).map((r: any) => ({
    id: r.id,
    action: `Access ${String(r.status || "").charAt(0).toUpperCase()}${String(r.status || "").slice(1)}`,
    detail: `${shortWallet(r.patient_wallet)} (Record ${r.record_id})`,
    timestamp: r.requested_at || r.approved_at || r.rejected_at || r.revoked_at,
  }));
};
