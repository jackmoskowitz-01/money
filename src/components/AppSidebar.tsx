import { Link, useLocation } from 'react-router-dom';
import {
  Building2,
  Map,
  Newspaper,
  MessageSquare,
  Kanban,
  CalendarCheck,
  Users,
  Settings,
  LogOut,
  Shield,
  Mail,
  Activity,
  BarChart3,
  FileText,
  LayoutDashboard,
  Bell,
  Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

const navGroups = [
  {
    label: 'Detect — Find signals',
    items: [
      { path: '/news', label: 'News Intel', icon: Newspaper },
      { path: '/scoop', label: 'Scoop Board', icon: MessageSquare },
      { path: '/loopnet', label: 'LoopNet Search', icon: Search },
      { path: '/map', label: 'Map View', icon: Map },
    ],
  },
  {
    label: 'Engage — Reach out',
    items: [
      { path: '/prospect-table', label: 'Prospects CRM', icon: Users },
      { path: '/email-analytics', label: 'Email Outreach', icon: Mail },
      { path: '/activities', label: 'Activity Log', icon: Activity },
    ],
  },
  {
    label: 'Close — Win deals',
    items: [
      { path: '/pipeline', label: 'Pipeline', icon: Kanban },
      { path: '/tasks', label: 'Tasks', icon: CalendarCheck },
      { path: '/comp-tracker', label: 'Comp Tracker', icon: BarChart3 },
      { path: '/lease-abstracts', label: 'Lease Abstracts', icon: FileText },
    ],
  },
  {
    label: 'Utility',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/alerts', label: 'Alerts', icon: Bell },
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function BrandHeader() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <SidebarHeader>
      <button
        onClick={toggleSidebar}
        className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-sidebar-accent transition-colors w-full text-left"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-3.5 w-3.5" />
        </div>
        {!isCollapsed && (
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground truncate">
            DealFlow
          </span>
        )}
      </button>
    </SidebarHeader>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const { signOut, isSuperAdmin } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <BrandHeader />

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ path, label, icon: Icon }) => {
                  const isActive =
                    path === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(path);

                  return (
                    <SidebarMenuItem key={path}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={label}
                      >
                        <Link to={path}>
                          <Icon />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparatorLine />
        <SidebarMenu>
          {isSuperAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location.pathname.startsWith('/admin')}
                tooltip="Admin"
              >
                <Link to="/admin">
                  <Shield />
                  <span>Admin</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              tooltip="Sign Out"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

function SidebarSeparatorLine() {
  return <Separator className="bg-sidebar-border" />;
}

export { SidebarTrigger };
