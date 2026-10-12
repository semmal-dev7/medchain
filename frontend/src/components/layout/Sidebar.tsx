import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Upload,
  FileHeart,
  CalendarDays,
  Pill,
  Siren,
  ShieldCheck,
  Users,
  History,
  LogOut,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const patientNav = [
  { title: "Dashboard", url: "/patient/dashboard", icon: LayoutDashboard },
  { title: "Medical Records", url: "/patient/records", icon: FileHeart },
  { title: "Consent Governance", url: "/patient/access", icon: ShieldCheck },
  { title: "Access History", url: "/patient/history", icon: History },
  { title: "Appointments", url: "/patient/appointments", icon: CalendarDays },
  { title: "Prescriptions", url: "/patient/prescriptions", icon: Pill },
];

const doctorNav = [
  { title: "Clinical Dashboard", url: "/doctor/dashboard", icon: LayoutDashboard },
  { title: "My Patients", url: "/doctor/patients", icon: Users },
  { title: "Medical Records", url: "/doctor/records", icon: FileHeart },
  { title: "Appointments", url: "/doctor/appointments", icon: CalendarDays },
  { title: "Prescriptions", url: "/doctor/prescriptions", icon: Pill },
  { title: "Emergency Access", url: "/doctor/emergency", icon: Siren },
  { title: "Access History", url: "/doctor/history", icon: History },
];

const adminNav = [
  { title: "Hospital Dashboard", url: "/admin/dashboard", icon: LayoutDashboard },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  const navItems = user?.role === "doctor" ? doctorNav : user?.role === "admin" ? adminNav : patientNav;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <SidebarRoot collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <div className="flex items-center gap-2">
              {!collapsed && <span className="font-bold text-base tracking-tight">MedChain</span>}
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/60"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Logout"}
        </Button>
      </SidebarFooter>
    </SidebarRoot>
  );
}
