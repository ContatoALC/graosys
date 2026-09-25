import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Breadcrumbs } from "./Breadcrumbs";

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Breadcrumbs />
        <div className="min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
