import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Newspaper,
  Map,
  CheckSquare,
  Zap,
  UserPlus,
  BarChart2,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

interface PageCommand {
  label: string;
  path: string;
  icon: React.ReactNode;
  shortcut?: string;
}

interface ActionCommand {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

const PAGE_COMMANDS: PageCommand[] = [
  { label: "Dashboard", path: "/", icon: <LayoutDashboard className="mr-2 h-4 w-4" /> },
  { label: "Pipeline", path: "/pipeline", icon: <KanbanSquare className="mr-2 h-4 w-4" /> },
  { label: "Prospects", path: "/prospects", icon: <Users className="mr-2 h-4 w-4" /> },
  { label: "News", path: "/news", icon: <Newspaper className="mr-2 h-4 w-4" /> },
  { label: "Map", path: "/map", icon: <Map className="mr-2 h-4 w-4" /> },
  { label: "Tasks", path: "/tasks", icon: <CheckSquare className="mr-2 h-4 w-4" /> },
  { label: "Scoop", path: "/scoop", icon: <Zap className="mr-2 h-4 w-4" /> },
];

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const runCommand = React.useCallback((fn: () => void) => {
    setOpen(false);
    fn();
  }, []);

  const ACTION_COMMANDS: ActionCommand[] = [
    {
      label: "Add Prospect",
      icon: <UserPlus className="mr-2 h-4 w-4" />,
      onSelect: () => navigate("/prospects?action=add"),
    },
    {
      label: "View Pipeline Stats",
      icon: <BarChart2 className="mr-2 h-4 w-4" />,
      onSelect: () => navigate("/pipeline"),
    },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a page or action..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          {PAGE_COMMANDS.map((cmd) => (
            <CommandItem
              key={cmd.path}
              value={cmd.label}
              onSelect={() => runCommand(() => navigate(cmd.path))}
            >
              {cmd.icon}
              {cmd.label}
              {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          {ACTION_COMMANDS.map((cmd) => (
            <CommandItem
              key={cmd.label}
              value={cmd.label}
              onSelect={() => runCommand(cmd.onSelect)}
            >
              {cmd.icon}
              {cmd.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
