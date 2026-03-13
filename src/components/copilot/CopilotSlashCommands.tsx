import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Search, ListTodo, MoveRight, BarChart3, Star, GitCompare, MapPin, Calculator, FileBox, FileSearch } from 'lucide-react';

const COMMANDS = [
  { command: '/move', description: 'Move a deal to a new stage', icon: MoveRight, template: 'Move [prospect] to [stage]' },
  { command: '/task', description: 'Create a new task', icon: ListTodo, template: 'Create a task: ' },
  { command: '/draft', description: 'Draft an outreach email', icon: Mail, template: 'Draft an outreach email for ' },
  { command: '/search', description: 'Search live market data', icon: Search, template: 'Search for ' },
  { command: '/tour', description: 'Plan an optimized tour route', icon: MapPin, template: 'Plan a tour for these addresses: ' },
  { command: '/comp', description: 'Compare lease offers side-by-side', icon: BarChart3, template: 'Compare these lease offers: ' },
  { command: '/commission', description: 'Calculate broker commission from a lease', icon: Calculator, template: 'Calculate the commission on the attached lease' },
  { command: '/template', description: 'Save or use an output template', icon: FileBox, template: 'Save the attached file as a template called ' },
  { command: '/abstract', description: 'Run a full lease abstract from an attached lease', icon: FileSearch, template: 'Run a full lease abstract on the attached document' },
];

interface Props {
  input: string;
  visible: boolean;
  onSelect: (template: string) => void;
}

export default function CopilotSlashCommands({ input, visible, onSelect }: Props) {
  if (!visible) return null;

  const filter = input.slice(1).toLowerCase();
  const filtered = COMMANDS.filter(c => c.command.slice(1).startsWith(filter) || !filter);

  if (filtered.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
        className="absolute bottom-full left-0 right-0 mb-1 mx-3 rounded-xl border border-border bg-card shadow-xl overflow-hidden z-20"
      >
        <div className="p-1.5 max-h-[240px] overflow-y-auto">
          <p className="px-2.5 py-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Quick Commands</p>
          {filtered.map(cmd => (
            <button
              key={cmd.command}
              onClick={() => onSelect(cmd.template)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-secondary/50 transition-colors text-left group"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <cmd.icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{cmd.command}</p>
                <p className="text-[10px] text-muted-foreground">{cmd.description}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
