import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Mail, Phone, Users, StickyNote, Sparkles, RotateCcw, Building2, Calendar, Ban, CalendarCheck, Kanban } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { buildings } from '@/data/mockData';
import {
  getActivities, addActivity,
  activityTypeLabels, activityTypeIcons,
  type ActivityType, type ActivityEntry,
} from '@/data/activityData';
import { supabase } from '@/integrations/supabase/client';
import { autoCompleteTasks } from '@/lib/autoCompleteTasks';
import { digestEvent } from '@/lib/autoDigest';
import { usePipeline } from '@/hooks/usePipeline';
import { toast } from 'sonner';

const typeOptions: { value: ActivityType; label: string; icon: typeof Mail }[] = [
  { value: 'email_sent', label: 'Email Sent', icon: Mail },
  { value: 'call', label: 'Phone Call', icon: Phone },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'meeting_set', label: 'Meeting Set', icon: CalendarCheck },
  { value: 'do_not_call', label: 'Do Not Call', icon: Ban },
  { value: 'note', label: 'Note', icon: StickyNote },
  { value: 'ai_email', label: 'AI Email', icon: Sparkles },
  { value: 'stage_change', label: 'Stage Change', icon: RotateCcw },
];

const tenantOptions = buildings.flatMap(b =>
  b.tenants.map(t => ({ tenantId: t.id, buildingId: b.id, label: `${t.name} — ${b.name}` }))
);

const ActivityLogger = () => {
  const navigate = useNavigate();
  const { addProspect } = usePipeline();
  const [activities, setActivities] = useState<ActivityEntry[]>(() => getActivities());
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  // Also load activities from Supabase and merge with local
  useEffect(() => {
    supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const dbActivities: ActivityEntry[] = data.map((row: any) => ({
            id: row.id,
            tenantId: row.tenant_id || '',
            buildingId: row.building_id || '',
            type: (row.type || 'note') as ActivityType,
            title: row.title || '',
            description: row.description || '',
            timestamp: row.created_at,
            outreachReasonUsed: row.outreach_reason_used || undefined,
          }));
          setActivities(prev => {
            const existingIds = new Set(prev.map(a => a.id));
            const newOnes = dbActivities.filter(a => !existingIds.has(a.id));
            if (newOnes.length === 0) return prev;
            return [...prev, ...newOnes].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
        }
      });
  }, []);

  // Form state
  const [formType, setFormType] = useState<ActivityType>('note');
  const [formTitle, setFormTitle] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formTenant, setFormTenant] = useState('');

  const filtered = useMemo(() => {
    if (filterType === 'all') return activities;
    return activities.filter(a => a.type === filterType);
  }, [activities, filterType]);

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      toast.error('Please enter an activity title');
      return;
    }
    const selected = tenantOptions.find(t => t.tenantId === formTenant);
    const tenantId = selected?.tenantId || '';
    const entry = addActivity({
      tenantId,
      buildingId: selected?.buildingId || '',
      type: formType,
      title: formTitle.trim(),
      description: formNotes.trim(),
    });
    setActivities([entry, ...activities]);
    setFormTitle('');
    setFormNotes('');
    setFormTenant('');
    setFormType('note');
    setShowForm(false);
    toast.success('Activity logged');

    // Auto-digest: feed this activity to the AI brain
    digestEvent('activity_logged', {
      type: formType,
      title: formTitle.trim(),
      description: formNotes.trim(),
      tenant: selected?.label || '',
      tenantId,
    });

    // Auto-complete matching pending tasks
    if (tenantId) {
      const { completedCount, taskTitles } = await autoCompleteTasks(tenantId, formType);
      if (completedCount > 0) {
        toast.success(`Task auto-completed: "${taskTitles[0]}"`, {
          description: 'Matching task was marked done based on this activity.',
        });
      }
    }
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return format(new Date(ts), 'MMM d, yyyy');
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link to="/" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {activities.length} total activities logged
              </p>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="mr-2 h-4 w-4" /> Log Activity
            </Button>
          </div>
        </motion.div>

        {/* New Activity Form */}
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="mb-6 border-primary/30 bg-card p-4 space-y-4">
              <p className="text-sm font-semibold text-foreground">New Activity</p>

              {/* Activity Type */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Activity Type</p>
                <div className="flex flex-wrap gap-2">
                  {typeOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFormType(opt.value)}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        formType === opt.value
                          ? 'bg-primary/20 text-primary'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <opt.icon className="h-3 w-3" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tenant (optional) */}
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Tenant (optional)</p>
                <select
                  value={formTenant}
                  onChange={e => setFormTenant(e.target.value)}
                  className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground"
                >
                  <option value="">— General activity —</option>
                  {tenantOptions.map(t => (
                    <option key={t.tenantId} value={t.tenantId}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Title</p>
                <Input
                  placeholder="e.g. Called about lease renewal..."
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="border-border bg-secondary/50"
                />
              </div>

              {/* Notes */}
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
                <Textarea
                  placeholder="Add detailed notes about this activity..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="min-h-[100px] border-border bg-secondary/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSubmit}>Save Activity</Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          {['all', ...typeOptions.map(t => t.value)].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterType === t
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {t === 'all' ? 'All' : activityTypeLabels[t as ActivityType]}
            </button>
          ))}
        </div>

        {/* Activity Timeline */}
        <div className="relative space-y-0">
          {filtered.length === 0 ? (
            <Card className="border-border bg-card p-8 text-center">
              <StickyNote className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No activities found</p>
            </Card>
          ) : (
            filtered.map((entry, i) => {
              const building = buildings.find(b => b.id === entry.buildingId);
              const tenant = building?.tenants.find(t => t.id === entry.tenantId);

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="relative flex gap-3 pb-4"
                >
                  {i < filtered.length - 1 && (
                    <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-border" />
                  )}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm">
                    {activityTypeIcons[entry.type]}
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{entry.title}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {activityTypeLabels[entry.type]}
                      </Badge>
                    </div>
                    {entry.description && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{entry.description}</p>
                    )}
                    {tenant && building && (
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground/70">
                        <Building2 className="h-3 w-3" />
                        <Link
                          to={`/building/${building.id}/tenant/${tenant.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {tenant.name} · {building.name}
                        </Link>
                      </div>
                    )}
                    {entry.outreachReasonUsed && (
                      <Badge variant="outline" className="mt-1 bg-primary/10 text-[10px] text-primary">
                        Topic: {entry.outreachReasonUsed}
                      </Badge>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-[11px] text-muted-foreground/50">
                        <Calendar className="mr-1 inline h-3 w-3" />
                        {timeAgo(entry.timestamp)}
                      </p>
                      {entry.type === 'meeting_set' && tenant && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                          onClick={async () => {
                            const success = await addProspect({
                              name: tenant.name,
                              company: tenant.name,
                              email: '',
                              phone: '',
                              sqft: tenant.sqft?.toString() || '',
                            });
                            if (success) {
                              toast.success(`${tenant.name} added to pipeline!`);
                              navigate('/pipeline');
                            } else {
                              toast.error('Failed to add to pipeline');
                            }
                          }}
                        >
                          <Kanban className="h-3 w-3" /> Convert to Opportunity
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogger;
