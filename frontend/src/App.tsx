import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { WalletProvider } from "@/context/WalletContext";
import ProtectedRoute from "@/components/guards/ProtectedRoute";
import DashboardLayout from "@/layouts/DashboardLayout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import PatientRegister from "@/pages/PatientRegister";
import HospitalRegister from "@/pages/hospital/HospitalRegister";
import HospitalLogin from "@/pages/hospital/HospitalLogin";
import PatientDashboard from "@/pages/patient/PatientDashboard";
import UploadRecord from "@/pages/patient/UploadRecord";
import AccessManagement from "@/pages/patient/AccessManagement";
import PatientHistory from "@/pages/patient/PatientHistory";
import PatientAppointments from "@/pages/patient/PatientAppointments";
import PatientPrescriptions from "@/pages/patient/PatientPrescriptions";
import DoctorDashboard from "@/pages/doctor/DoctorDashboard";
import DoctorRegister from "@/pages/doctor/DoctorRegister";
import DoctorLogin from "@/pages/doctor/DoctorLogin";
import DoctorPending from "@/pages/doctor/DoctorPending";
import DoctorPatients from "@/pages/doctor/DoctorPatients";
import DoctorRecords from "@/pages/doctor/DoctorRecords";
import DoctorAppointments from "@/pages/doctor/DoctorAppointments";
import DoctorPrescriptions from "@/pages/doctor/DoctorPrescriptions";
import DoctorEmergencyAccess from "@/pages/doctor/DoctorEmergencyAccess";
import DoctorAccessHistory from "@/pages/doctor/DoctorAccessHistory";
import EmergencyApproverDashboard from "@/pages/emergency/EmergencyApproverDashboard";
import HospitalDashboard from "@/pages/admin/HospitalDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WalletProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<PatientRegister />} />
              <Route path="/patient/register" element={<PatientRegister />} />
              <Route path="/doctor/register" element={<DoctorRegister />} />
              <Route path="/hospital/register" element={<HospitalRegister />} />
              <Route path="/hospital/login" element={<HospitalLogin />} />
              <Route path="/doctor/login" element={<DoctorLogin />} />
              <Route path="/doctor/pending" element={<DoctorPending />} />

              {/* Patient */}
              <Route path="/patient" element={<ProtectedRoute role="patient"><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<PatientDashboard />} />
                <Route path="upload" element={<UploadRecord />} />
                <Route path="records" element={<UploadRecord />} />
                <Route path="access" element={<AccessManagement />} />
                <Route path="history" element={<PatientHistory />} />
                <Route path="appointments" element={<PatientAppointments />} />
                <Route path="prescriptions" element={<PatientPrescriptions />} />
              </Route>

              {/* Doctor */}
              <Route path="/doctor" element={<ProtectedRoute role="doctor"><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DoctorDashboard />} />
                <Route path="patients" element={<DoctorPatients />} />
                <Route path="records" element={<DoctorRecords />} />
                <Route path="appointments" element={<DoctorAppointments />} />
                <Route path="prescriptions" element={<DoctorPrescriptions />} />
                <Route path="emergency" element={<DoctorEmergencyAccess />} />
                <Route path="history" element={<DoctorAccessHistory />} />
              </Route>

              {/* Emergency approver */}
              <Route path="/emergency-approver" element={<ProtectedRoute role="emergency_approver"><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<EmergencyApproverDashboard />} />
              </Route>

              {/* Platform admin */}
              <Route path="/admin" element={<ProtectedRoute role="admin"><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="hospitals" replace />} />
                <Route path="dashboard" element={<HospitalDashboard />} />
                <Route path="hospitals" element={<HospitalDashboard />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </WalletProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
