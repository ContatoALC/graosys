import { Navigate } from "react-router-dom";

// Cobrança só tem Recebimento no GraoSys
export function BillingPage() {
  return <Navigate to="/billing/receipt" replace />;
}
