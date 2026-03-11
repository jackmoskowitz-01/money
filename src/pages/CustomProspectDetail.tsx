import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Globe, MapPin, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCustomProspect } from '@/data/customProspects';
import EmailComposer from '@/components/EmailComposer';
import CompanyNewsCard from '@/components/CompanyNewsCard';
import ProspectEnrichmentCard from '@/components/ProspectEnrichmentCard';
import { getActivities, addActivity, activityTypeLabels, activityTypeIcons, type ActivityType, type ActivityEntry } from '@/data/activityData';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Mail, Phone, Users, StickyNote } from 'lucide-react';
import { format } from 'date-fns';

const typeOptions: { value: ActivityType; label: string; icon: typeof Mail; defaultTitle: string }[] = [
  { value: 'email_sent', label: 'Email', icon: Mail, defaultTitle: 'Sent email' },
  { value: 'call', label: 'Call', icon: Phone, defaultTitle: 'Phone call' },
  { value: 'meeting', label: 'Meeting', icon: Users, defaultTitle: 'Meeting held' },
  { value: 'note', label: 'Note', icon: StickyNote, defaultTitle: 'Note added' },
];

const CustomProspectDetail = () => {
  const { prospectId } = useParams();
  const prospect = prospectId ? getCustomProspect(prospectId) : undefined;

  const [activities, setActivities] = useState<ActivityEntry[]>(() =>
    prospectId ? getActivities().filter(a => a.tenantId === prospectId) : []
  );
  const [showForm, setShowForm] = useState(false);
  const [newType, setNewType] = useState<ActivityType>('note');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  if (!prospect) {
    return (
      <div className="min-h-screen pt-14">
        <div className="mx-auto max-w-3xl px-4 py-8 text-center">
          <p className="text-muted-foreground">Prospect not found.</p>
          <Link to="/" className="text-primary hover:underline text-sm mt-2 inline-block">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    const entry = addActivity({
      tenantId: prospectId!,
      buildingId: '',
      type: newType,
      title: newTitle,
      description: newDesc,
    });
    setActivities([entry, ...activities]);
    setNewTitle('');
    setNewDesc('');
    setShowForm(false);
    setNewType('note');
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
    <div className="min-h-screen pt-20 pb-12">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{prospect.name}</h1>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-accent text-accent-foreground">
                Custom Prospect
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {prospect.address}
              </span>
              {prospect.website && (
                <a
                  href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" /> Website
                </a>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground/60 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Created {format(new Date(prospect.createdAt), 'MMM d, yyyy')}
            </p>
          </div>

          {/* AI Company Enrichment */}
          <div className="mb-6">
            <ProspectEnrichmentCard
              prospectId={prospectId!}
              companyName={prospect.name}
              website={prospect.website}
              address={prospect.address}
              cachedEnrichment={prospect.enrichment}
            />
          </div>

          {/* Email Composer */}
          <div className="mb-6">
            <EmailComposer
              tenantId={prospectId!}
              buildingId=""
              tenantName={prospect.name}
              contactName={prospect.name}
              buildingName={prospect.address}
            />
          </div>

          {/* Real-Time Company News */}
          <div className="mb-6">
            <CompanyNewsCard
              companyId={prospectId!}
              companyName={prospect.name}
            />
          </div>

          {/* Activity Log */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Activity Log</h2>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowForm(!showForm)}>
                <Plus className="mr-1 h-3 w-3" /> Log Activity
              </Button>
            </div>

            {showForm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <Card className="mb-4 border-primary/30 bg-card p-3">
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
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim()}>Save</Button>
                  </div>
                </Card>
              </motion.div>
            )}

            <div className="relative space-y-0">
              {activities.length === 0 ? (
                <Card className="border-border bg-card p-8 text-center">
                  <StickyNote className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No activity logged yet</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">Click "Log Activity" to start tracking interactions</p>
                </Card>
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
                      <p className="mt-1 text-[11px] text-muted-foreground/60">{timeAgo(entry.timestamp)}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CustomProspectDetail;
