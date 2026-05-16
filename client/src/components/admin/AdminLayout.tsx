import { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { ThemeToggle } from "../ui/theme-toggle";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <Helmet>
        <meta name="robots" content="noindex,follow" />
      </Helmet>
      <div className="flex h-screen w-full bg-background">
        <AdminSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b bg-card h-16">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-xl font-semibold text-foreground">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
