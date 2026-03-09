import { Link, useLocation } from 'react-router-dom';
import { Building2, Map, Newspaper, MessageSquare, Kanban, CalendarCheck, ClipboardList } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: Newspaper },
  { path: '/map', label: 'Map', icon: Map },
  { path: '/pipeline', label: 'Pipeline', icon: Kanban },
  { path: '/tasks', label: 'Tasks', icon: CalendarCheck },
  { path: '/activities', label: 'Activities', icon: ClipboardList },
  { path: '/scoop', label: 'Scoop', icon: MessageSquare },
];

const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            DealFlow
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`relative flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
