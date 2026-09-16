const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://127.0.0.1:8000/api/v1";

const ACCESS_TOKEN_KEY = "healthchain_access_token";
const REFRESH_TOKEN_KEY = "healthchain_refresh_token";

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
}

export interface EmergencyAccessRequest {
  id: string;
  recordId: number;
  patientWallet: string;
  context: string;
  reason: string;
  requestedResources: string[];
  status: string;
  requestedAt: string;
  expiresAt?: string;
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
    return {};
  }
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

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new Error(`Cannot reach the API at ${API_BASE_URL}. Start the backend server and try again.`);
  }
  const data = await parseJson(res);
  if (!res.ok) {
    const message = data?.detail || "Request failed";
    throw new Error(message);
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

export const uploadRecord = async (name: string, description: string, file: File): Promise<{ txHash: string }> => {
  const txHash = `pending-${Date.now()}`;
  const fileKey = `${file.name.replace(/\s+/g, "-").toLowerCase()}-${file.size}-${file.lastModified}`;
  const fakeIpfs = `ipfs://${fileKey}`;
  const recordId = Date.now() * 1000 + Math.floor(Math.random() * 1000);

  const formData = new FormData();
  formData.append("record_id", String(recordId));
  formData.append("ipfs_hash", fakeIpfs);
  formData.append("encrypted_key_ref", "kms:pending");
  formData.append("name", name);
  formData.append("description", description);
  formData.append("tx_hash", txHash);
  formData.append("file", file);

  await request("/records/", {
    method: "POST",
    body: formData,
  });

  return { txHash };
};

export const downloadRecord = async (recordId: number, fileName: string): Promise<void> => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}/records/${recordId}/download`, {
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
    doctorName: shortWallet(r.doctor_wallet),
    doctorWallet: r.doctor_wallet,
    status: r.status,
    requestDate: r.requested_at,
  }));
};

export const updateAccessStatus = async (id: string, status: "approved" | "rejected"): Promise<void> => {
  const action = status === "approved" ? "approve" : "reject";
  await request(`/access/requests/${id}/${action}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
};

export const revokeAccess = async (id: string): Promise<void> => {
  await request(`/access/requests/${id}/revoke`, {
    method: "POST",
    body: JSON.stringify({}),
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
    current.recordCount += 1;
    if (r.status === "approved") current.status = "approved";
    map.set(wallet, current);
  });

  return Array.from(map.values());
};

export const getAuthorizedRecord = async (recordId: number) => {
  return request(`/access/records/${recordId}`);
};

export const getApprovedRecordAccess = async () => {
  const rows = await request("/access/requests/outgoing");
  return (rows || []).filter((row: any) => row.status === "approved");
};

const mapAppointment = (row: any): Appointment => ({ id: row.id, patientWallet: row.patient_wallet, doctorWallet: row.doctor_wallet, patientName: row.patient_name || row.patient_wallet, doctorName: row.doctor_name || row.doctor_wallet, scheduledFor: row.scheduled_for, reason: row.reason || "", status: row.status });
export const getPatientAppointments = async (): Promise<Appointment[]> => (await request("/access/appointments/patient")).map(mapAppointment);
export const bookAppointment = async (doctorWallet: string, scheduledFor: string, reason: string): Promise<Appointment> => mapAppointment(await request("/access/appointments/patient", { method: "POST", body: JSON.stringify({ doctor_wallet: doctorWallet, scheduled_for: new Date(scheduledFor).toISOString(), reason }) }));
export const getDoctorAppointments = async (): Promise<Appointment[]> => (await request("/access/appointments/doctor")).map(mapAppointment);
export const updateAppointmentStatus = async (id: string, status: "confirmed" | "rejected" | "cancelled"): Promise<Appointment> => mapAppointment(await request(`/access/appointments/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }));

export const downloadAuthorizedRecord = async (recordId: number, fileName: string): Promise<void> => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}/access/records/${recordId}/download`, {
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

export const requestPatientAccess = async (patientAddress: string): Promise<void> => {
  const wallet = patientAddress.toLowerCase();
  const targets = await request(`/access/patient-records?wallet=${encodeURIComponent(wallet)}`);
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error("No active records found for this patient");
  }

  const target = targets[0];
  await request("/access/requests", {
    method: "POST",
    body: JSON.stringify({
      patient_wallet: wallet,
      record_id: target.record_id,
      request_tx_hash: `pending-${Date.now()}`,
    }),
  });
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

export const createEmergencyAccessRequest = async (
  patientAddress: string,
  recordId: number,
  context: string,
  reason: string,
  requestedResources: string[],
): Promise<EmergencyAccessRequest> => {
  const row = await request("/access/emergency/requests", {
    method: "POST",
    body: JSON.stringify({
      patient_wallet: patientAddress.toLowerCase(),
      record_id: recordId,
      context,
      reason,
      requested_resources: requestedResources,
    }),
  });
  return {
    id: row.id,
    recordId: row.record_id,
    patientWallet: row.patient_wallet,
    context: row.context,
    reason: row.reason,
    requestedResources: row.requested_resources,
    status: row.status,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
  };
};

export const getPendingEmergencyRequests = async (): Promise<EmergencyAccessRequest[]> => {
  const rows = await request("/access/emergency/requests/pending");
  return rows.map((row: any) => ({
    id: row.id,
    recordId: row.record_id,
    patientWallet: row.patient_wallet,
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

export const getDoctorAccessHistory = async (): Promise<ActivityItem[]> => {
  const rows = await request("/access/requests/outgoing");
  return (rows || []).map((r: any) => ({
    id: r.id,
    action: `Access ${String(r.status || "").charAt(0).toUpperCase()}${String(r.status || "").slice(1)}`,
    detail: `${shortWallet(r.patient_wallet)} (Record ${r.record_id})`,
    timestamp: r.requested_at || r.approved_at || r.rejected_at || r.revoked_at,
  }));
};
