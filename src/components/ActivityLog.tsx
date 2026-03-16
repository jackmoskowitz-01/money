import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useContacts } from '@/hooks/useContacts';
import { Plus, Mail, Phone, Users, StickyNote, AlertTriangle, ChevronRight, User, PhoneOff, CalendarCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { buildings } from '@/data/mockData';
import {
  getActivities, addActivity, getUsedOutreachReasons,
  activityTypeLabels, activityTypeIcons,
  type ActivityType, type ActivityEntry,
} from '@/data/activityData';
import { autoCompleteTasks } from '@/lib/autoCompleteTasks';
import { toast } from 'sonner';

const typeOptions: { value: ActivityType; label: string; icon: typeof Mail; defaultTitle: string }[] = [
  { value: 'email_sent', label: 'Email', icon: Mail, defaultTitle: 'Sent email' },
  { value: 'call', label: 'Call', icon: Phone, defaultTitle: 'Phone call' },
  { value: 'meeting', label: 'Meeting', icon: Users, defaultTitle: 'Meeting held' },
  { value: 'note', label: 'Note', icon: StickyNote, defaultTitle: 'Note added' },
  { value: 'do_not_call', label: 'DNC', icon: PhoneOff, defaultTitle: 'Do Not Call' },
  { value: 'meeting_set', label: 'Meeting Set', icon: CalendarCheck, defaultTitle: 'Meeting scheduled' },
];

// Types that require contact selection
const contactRequiredTypes: ActivityType[] = ['email_sent', 'call', 'meeting'];

interface Props {
  tenantId: string;
  buildingId: string;
  outreachReasonTitles: string[];
  contactsVersion?: number;
}

type Contact = {
  id: string;
  name: string;
  title: string;
  email: string;
  tenantName: string;
  isPrimary: boolean;
};

const ActivityLog = ({ tenantId, buildingId, outreachReasonTitles }: Props) => {
  const [activities, setActivities] = useState<ActivityEntry[]>(() => getActivities(tenantId));
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState<'details' | 'contacts'>('details');
  const [newType, setNewType] = useState<ActivityType>('note');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  const usedReasons = getUsedOutreachReasons(tenantId);

  const { contacts: additionalContacts } = useContacts(tenantId);

  // Build contacts list: primary + additional from DB
  const contacts = useMemo<Contact[]>(() => {
    const building = buildings.find(b => b.id === buildingId);
    const tenant = building?.tenants.find(t => t.id === tenantId);
    if (!tenant) return [];

    const list: Contact[] = [];

    // Primary contact from mock data
    list.push({
      id: tenant.id,
      name: tenant.contactName,
      title: tenant.contactTitle,
      email: tenant.contactEmail,
      tenantName: tenant.name,
      isPrimary: true,
    });

    // Additional contacts from DB (realtime)
    additionalContacts.forEach(cc => {
      list.push({
        id: cc.id,
        name: cc.name,
        title: cc.title,
        email: cc.email,
        tenantName: tenant.name,
        isPrimary: false,
      });
    });

    return list;
  }, [buildingId, tenantId, additionalContacts]);

  const needsContacts = contactRequiredTypes.includes(newType);

  const handleNext = () => {
    if (!newTitle.trim()) return;
    if (needsContacts) {
      // Pre-select the primary contact
      const primary = contacts.find(c => c.isPrimary);
      if (primary) setSelectedContacts(new Set([primary.id]));
      setFormStep('contacts');
    } else {
      handleSave([]);
    }
  };

  const handleSave = async (contactIds: string[]) => {
    if (contactIds.length === 0) {
      // No contacts selected — log single activity
      const entry = addActivity({
        tenantId,
        buildingId,
        type: newType,
        title: newTitle,
        description: newDesc,
      });
      setActivities(prev => [entry, ...prev]);
    } else {
      // Log one activity per selected contact
      const newEntries: ActivityEntry[] = [];
      contactIds.forEach(contactId => {
        const contact = contacts.find(c => c.id === contactId);
        if (!contact) return;
        const suffix = contactIds.length > 1 ? ` → ${contact.name}` : ` → ${contact.name}`;
        const entry = addActivity({
          tenantId,
          buildingId,
          type: newType,
          title: `${newTitle}${suffix}`,
          description: `${newDesc}${newDesc ? '\n' : ''}Contact: ${contact.name} (${contact.title}) — ${contact.email}`,
        });
        newEntries.push(entry);
      });
      setActivities(prev => [...newEntries, ...prev]);
    }

    // Auto-complete matching pending tasks
    const { completedCount, taskTitles } = await autoCompleteTasks(tenantId, newType);
    if (completedCount > 0) {
      toast.success(`Task auto-completed: "${taskTitles[0]}"`, {
        description: 'Matching task was marked done based on this activity.',
      });
    }

    resetForm();
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDesc('');
    setShowForm(false);
    setFormStep('details');
    setSelectedContacts(new Set());
    setNewType('note');
  };

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const typeLabel = typeOptions.find(t => t.value === newType)?.label || 'Activity';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Activity Log</h2>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => { setShowForm(!showForm); setFormStep('details'); }}>
          <Plus className="mr-1 h-3 w-3" /> Log Activity
        </Button>
      </div>

      {/* Duplicate Outreach Warning */}
      {usedReasons.length > 0 && (
        <Card className="mb-3 border-warning/30 bg-warning/5 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
            <div>
              <p className="text-xs font-medium text-warning">Already Used Outreach Topics</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {usedReasons.map(r => (
                  <Badge key={r} variant="outline" className="bg-warning/10 text-[10px] text-warning">
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Add Form */}
      <AnimatePresence mode="wait">
        {showForm && (
          <motion.div
            key={formStep}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="mb-4 border-primary/30 bg-card p-3">
              {formStep === 'details' ? (
                <>
                  {/* Step 1: Activity details */}
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Step 1 — Activity Details
                  </p>
                  <div className="mb-3 flex gap-2">
                    {typeOptions.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setNewType(opt.value); setNewTitle(opt.defaultTitle); }}
                        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          newType === opt.value
                            ? 'bg-primary/20 text-primary'
                            : 'bg-secondary text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <opt.icon className="h-3 w-3" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <input
                    placeholder="Activity title..."
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="mb-2 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <Textarea
                    placeholder="Details / notes..."
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    className="mb-3 min-h-[60px] border-border bg-secondary/50 text-sm"
                  />
                  <div className="flex items-center justify-between">
                    {needsContacts && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" /> Next: select who you contacted
                      </p>
                    )}
                    <div className="flex gap-2 ml-auto">
                      <Button variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
                      <Button size="sm" onClick={handleNext} disabled={!newTitle.trim()}>
                        {needsContacts ? (
                          <>Select Contacts <ChevronRight className="ml-1 h-3 w-3" /></>
                        ) : (
                          'Save'
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Step 2: Contact selection */}
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Step 2 — Who did you {typeLabel.toLowerCase()}?
                    </p>
                    <button
                      onClick={() => setFormStep('details')}
                      className="text-[10px] text-primary hover:underline"
                    >
                      ← Back
                    </button>
                  </div>
                  <p className="mb-3 text-[10px] text-muted-foreground">
                    Select one or more contacts. Each selection creates a separate activity entry.
                  </p>
                  <div className="space-y-1.5 mb-3 max-h-[200px] overflow-y-auto">
                    {contacts.map(contact => (
                      <label
                        key={contact.id}
                        className={`flex items-center gap-3 rounded-md p-2.5 cursor-pointer transition-colors ${
                          selectedContacts.has(contact.id)
                            ? 'bg-primary/10 border border-primary/30'
                            : 'bg-secondary/30 border border-transparent hover:bg-secondary/50'
                        }`}
                      >
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={() => toggleContact(contact.id)}
                          className="h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-foreground">{contact.name}</p>
                            {contact.isPrimary && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 bg-primary/10 text-primary border-primary/30">
                                Primary
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {contact.title} · {contact.tenantName}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60">{contact.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedContacts.size > 1 && (
                    <p className="mb-2 text-[10px] text-primary font-medium">
                      ✓ {selectedContacts.size} contacts selected — will create {selectedContacts.size} separate activity entries
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
                    <Button
                      size="sm"
                      onClick={() => handleSave(Array.from(selectedContacts))}
                      disabled={selectedContacts.size === 0}
                    >
                      Log {selectedContacts.size > 1 ? `${selectedContacts.size} Activities` : 'Activity'}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      <div className="relative space-y-0">
        {activities.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No activity logged yet.</p>
        ) : (
          activities.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="relative flex gap-3 pb-4"
            >
              {i < activities.length - 1 && (
                <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-border" />
              )}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm">
                {activityTypeIcons[entry.type]}
              </div>
              <div className="flex-1 pt-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{entry.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {activityTypeLabels[entry.type]}
                  </Badge>
                </div>
                {entry.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{entry.description}</p>
                )}
                {entry.outreachReasonUsed && (
                  <Badge variant="outline" className="mt-1 bg-primary/10 text-[10px] text-primary">
                    Topic: {entry.outreachReasonUsed}
                  </Badge>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground/60">{timeAgo(entry.timestamp)}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
