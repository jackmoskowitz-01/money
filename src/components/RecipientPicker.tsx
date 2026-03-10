import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ChevronDown, Check, User } from 'lucide-react';

export type EmailRecipient = {
  id: string;
  name: string;
  email: string;
  title: string;
  isPrimary?: boolean;
};

interface Props {
  recipients: EmailRecipient[];
  onSend: (selectedEmails: string[]) => void;
  buttonClass?: string;
  size?: 'sm' | 'default';
}

const RecipientPicker = ({ recipients, onSend, buttonClass, size = 'sm' }: Props) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => {
    // Pre-select primary contact
    const primary = recipients.find(r => r.isPrimary);
    return primary ? new Set([primary.id]) : new Set();
  });

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const emails = recipients
      .filter(r => selected.has(r.id))
      .map(r => r.email)
      .filter(Boolean);
    if (emails.length === 0) return;
    onSend(emails);
    setOpen(false);
  };

  // Always show the picker dropdown
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={buttonClass || "flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-primary-foreground bg-primary hover:bg-primary/90"}
      >
        <Send className="h-3 w-3" /> Send
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-lg border border-border bg-card shadow-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-border">
              <p className="text-[10px] font-semibold text-foreground">Select Recipients</p>
              <p className="text-[9px] text-muted-foreground">{selected.size} of {recipients.length} selected</p>
            </div>

            <div className="max-h-[200px] overflow-y-auto p-1.5 space-y-0.5">
              {recipients.map(r => (
                <button
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
                    selected.has(r.id) ? 'bg-primary/10' : 'hover:bg-secondary'
                  }`}
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    selected.has(r.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                  }`}>
                    {selected.has(r.id) && <Check className="h-2.5 w-2.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-medium text-foreground truncate">{r.name}</p>
                      {r.isPrimary && (
                        <span className="text-[8px] font-medium text-primary bg-primary/10 px-1 py-0.5 rounded">Primary</span>
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground truncate">{r.title} · {r.email}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t border-border px-3 py-2">
              <button
                onClick={() => setSelected(new Set(recipients.map(r => r.id)))}
                className="text-[9px] text-primary hover:underline"
              >
                Select all
              </button>
              <span className="text-[9px] text-muted-foreground">·</span>
              <button
                onClick={() => setSelected(new Set())}
                className="text-[9px] text-muted-foreground hover:underline"
              >
                Clear
              </button>
              <div className="flex-1" />
              <button
                onClick={handleConfirm}
                disabled={selected.size === 0}
                className="rounded-md bg-primary px-3 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Send to {selected.size}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecipientPicker;
