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
import PatientDashboard from "@/pages/patient/PatientDashboard";
import UploadRecord from "@/pages/patient/UploadRecord";
import AccessManagement from "@/pages/patient/AccessManagement";
import PatientHistory from "@/pages/patient/PatientHistory";
import PatientAppointments from "@/pages/patient/PatientAppointments";
import PatientPrescriptions from "@/pages/patient/PatientPrescriptions";
import DoctorDashboard from "@/pages/doctor/DoctorDashboard";
import DoctorPatients from "@/pages/doctor/DoctorPatients";
import DoctorRecords from "@/pages/doctor/DoctorRecords";
import DoctorAppointments from "@/pages/doctor/DoctorAppointments";
import DoctorPrescriptions from "@/pages/doctor/DoctorPrescriptions";
import DoctorEmergencyAccess from "@/pages/doctor/DoctorEmergencyAccess";
import DoctorAccessHistory from "@/pages/doctor/DoctorAccessHistory";
import EmergencyApproverDashboard from "@/pages/emergency/EmergencyApproverDashboard";
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
              <Route path="/register" element={<Register />} />

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

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </WalletProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
