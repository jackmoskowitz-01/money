import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, Map, Newspaper, MessageSquare, Kanban, CalendarCheck, Menu, X, Settings, LogOut, Search, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ProspectSearch from './ProspectSearch';
import dealflowLogo from '@/assets/dealflow-logo.jpg';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = [
  { path: '/', label: 'Dashboard', icon: Newspaper },
  { path: '/news', label: 'News', icon: Building2 },
  { path: '/map', label: 'Map', icon: Map },
  { path: '/pipeline', label: 'Pipeline', icon: Kanban },
  { path: '/tasks', label: 'Tasks', icon: CalendarCheck },
  { path: '/scoop', label: 'Scoop', icon: MessageSquare },
  { path: '/email-analytics', label: 'Emails', icon: BarChart3 },
];

const Navbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 outline-none group">
            <div className="relative">
              <img src={dealflowLogo} alt="DealFlow" className="h-8 rounded-md transition-transform group-hover:scale-105" />
              <div className="absolute -inset-1 rounded-lg bg-primary/0 group-hover:bg-primary/5 transition-colors" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 glass-card">
            <DropdownMenuItem asChild>
              <Link to="/" className="flex items-center gap-2 cursor-pointer" onClick={() => setMobileOpen(false)}>
                <Newspaper className="h-4 w-4" />
                Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2 cursor-pointer" onClick={() => setMobileOpen(false)}>
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 cursor-pointer text-destructive">
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`nav-indicator ${isActive ? 'active' : ''} relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <Icon className={`h-4 w-4 transition-colors ${isActive ? 'text-primary' : ''}`} />
                <span>{label}</span>
                {isActive && (
                  <span className="absolute inset-0 rounded-lg bg-primary/8 pointer-events-none" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ProspectSearch />
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden rounded-lg p-2 text-muted-foreground hover:bg-secondary/50 transition-colors"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/50 glass">
          <div className="px-4 py-2 space-y-0.5">
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </div>
          <div className="px-4 py-3 border-t border-border/50 sm:hidden">
            <ProspectSearch />
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
