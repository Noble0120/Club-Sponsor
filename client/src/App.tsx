import { Route, Switch, Redirect } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import Login from "@/pages/Login";
import SponsorReport from "@/pages/SponsorReport";
import Home from "@/pages/Home";
import Planning from "@/pages/Planning";
import Tasks from "@/pages/Tasks";
import CompanyDetail from "@/pages/CompanyDetail";
import CompaniesAdmin from "@/pages/CompaniesAdmin";
import Contracts from "@/pages/Contracts";
import UserManagement from "@/pages/UserManagement";
import Reports from "@/pages/Reports";
import MatchesAdmin from "@/pages/MatchesAdmin";

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
      <Route path="/planning">
        <DashboardLayout>
          <Planning />
        </DashboardLayout>
      </Route>
      <Route path="/tasks">
        <DashboardLayout>
          <Tasks />
        </DashboardLayout>
      </Route>
      <Route path="/company/:id">
        <DashboardLayout>
          <CompanyDetail />
        </DashboardLayout>
      </Route>
      <Route path="/companies-admin">
        <DashboardLayout>
          <AdminRoute>
            <CompaniesAdmin />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/matches-admin">
        <DashboardLayout>
          <AdminRoute>
            <MatchesAdmin />
          </AdminRoute>
        </DashboardLayout>
      </Route>
      <Route path="/contracts">
        <DashboardLayout>
          <AdminRoute>
            <Contracts />
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

      <Route>
        <div className="flex h-screen items-center justify-center text-muted-foreground">
          页面不存在
        </div>
      </Route>
    </Switch>
  );
}
