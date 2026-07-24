import { Route, Switch, Redirect } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import Login from "@/pages/Login";
import SponsorReport from "@/pages/SponsorReport";
import Home from "@/pages/Home";
import ByRound from "@/pages/ByRound";
import BySponsor from "@/pages/BySponsor";
import SponsorDetail from "@/pages/SponsorDetail";
import AcceptanceForm from "@/pages/AcceptanceForm";
import MyTasks from "@/pages/MyTasks";
import SponsorsAdmin from "@/pages/SponsorsAdmin";
import UserManagement from "@/pages/UserManagement";
import Reports from "@/pages/Reports";
import WorkflowTemplates from "@/pages/WorkflowTemplates";
import WorkflowOverview from "@/pages/WorkflowOverview";

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== "admin") {
    return <Redirect to="/" />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/report/:token" component={SponsorReport} />

      <Route path="/">
        <DashboardLayout>
          <Home />
        </DashboardLayout>
      </Route>
      <Route path="/by-round">
        <DashboardLayout>
          <ByRound />
        </DashboardLayout>
      </Route>
      <Route path="/by-sponsor">
        <DashboardLayout>
          <BySponsor />
        </DashboardLayout>
      </Route>
      <Route path="/sponsor/:id">
        <DashboardLayout>
          <SponsorDetail />
        </DashboardLayout>
      </Route>
      <Route path="/acceptance/:matchId/:sponsorId">
        <DashboardLayout>
          <AcceptanceForm />
        </DashboardLayout>
      </Route>
      <Route path="/my-tasks">
        <DashboardLayout>
          <MyTasks />
        </DashboardLayout>
      </Route>
      <Route path="/sponsors-admin">
        <DashboardLayout>
          <AdminRoute>
            <SponsorsAdmin />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/user-management">
        <DashboardLayout>
          <AdminRoute>
            <UserManagement />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/reports">
        <DashboardLayout>
          <AdminRoute>
            <Reports />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/workflow/templates">
        <DashboardLayout>
          <AdminRoute>
            <WorkflowTemplates />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/workflow">
        <DashboardLayout>
          <AdminRoute>
            <WorkflowOverview />
          </AdminRoute>
        </DashboardLayout>
      </Route>

      <Route>
        <div className="flex h-screen items-center justify-center text-muted-foreground">
          页面不存在
        </div>
      </Route>
    </Switch>
  );
}
