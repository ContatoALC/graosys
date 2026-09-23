import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/Login";
import { DashboardPage } from "@/pages/Dashboard";
import { ContractsPage } from "@/pages/Contracts";
import { ContractFormPage } from "@/pages/Contracts/ContractForm";
import { ClientsPage } from "@/pages/Clients";
import { ClientFormPage } from "@/pages/Clients/ClientForm";
import { ExecutionPage } from "@/pages/Execution";
import { BillingPage } from "@/pages/Billing";
import { ReceiptPage } from "@/pages/Billing/Receipt";
import { ReportsPage } from "@/pages/Reports";
import { AdminPage } from "@/pages/Admin";
import { AdminUsersPage } from "@/pages/Admin/Users";
import { AdminAccessControlPage } from "@/pages/Admin/AccessControl";
import { AdminProductsPage } from "@/pages/Admin/Products";
import { AdminBrokersPage } from "@/pages/Admin/Brokers";
import { AdminTablesPage } from "@/pages/Admin/Tables";
import { MyAccountPage } from "@/pages/MyAccount";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.role === "admin" ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="contracts/new" element={<ContractFormPage />} />
        <Route path="contracts/:id" element={<ContractFormPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/new" element={<ClientFormPage />} />
        <Route path="clients/:id" element={<ClientFormPage />} />
        <Route path="execution" element={<ExecutionPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="billing/receipt" element={<ReceiptPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="admin/access" element={<AdminRoute><AdminAccessControlPage /></AdminRoute>} />
        <Route path="admin/products" element={<AdminRoute><AdminProductsPage /></AdminRoute>} />
        <Route path="admin/brokers" element={<AdminRoute><AdminBrokersPage /></AdminRoute>} />
        <Route path="admin/tables" element={<AdminRoute><AdminTablesPage /></AdminRoute>} />
        <Route path="my-account" element={<MyAccountPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
