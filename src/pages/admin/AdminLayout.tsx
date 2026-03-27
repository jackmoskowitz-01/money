import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Users, Settings, LayoutDashboard, ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const adminNav = [
  { path: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { path: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { path: '/admin/users', label: 'Users', icon: Users },
];

export default function AdminLayout() {
  const { isSuperAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Admin Sidebar */}
      <aside className="w-60 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive text-destructive-foreground">
              <Shield className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">Admin Panel</span>
          </div>
          <Button variant="ghost" size="sm" asChild className="w-full justify-start text-xs text-muted-foreground">
            <Link to="/">
              <ArrowLeft className="h-3 w-3 mr-1" />
              Back to DealFlow
            </Link>
          </Button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {adminNav.map(({ path, label, icon: Icon, exact }) => {
            const isActive = exact
              ? location.pathname === path
              : location.pathname.startsWith(path);

            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
