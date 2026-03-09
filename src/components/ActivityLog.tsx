import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Mail, Phone, Users, StickyNote, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  getActivities, addActivity, getUsedOutreachReasons,
  activityTypeLabels, activityTypeIcons,
  type ActivityType, type ActivityEntry,
} from '@/data/activityData';

const typeOptions: { value: ActivityType; label: string; icon: typeof Mail }[] = [
  { value: 'email_sent', label: 'Email', icon: Mail },
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'note', label: 'Note', icon: StickyNote },
];

interface Props {
  tenantId: string;
  buildingId: string;
  outreachReasonTitles: string[];
}

const ActivityLog = ({ tenantId, buildingId, outreachReasonTitles }: Props) => {
  const [activities, setActivities] = useState<ActivityEntry[]>(() => getActivities(tenantId));
  const [showForm, setShowForm] = useState(false);
  const [newType, setNewType] = useState<ActivityType>('note');
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const usedReasons = getUsedOutreachReasons(tenantId);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    const entry = addActivity({
      tenantId,
      buildingId,
      type: newType,
      title: newTitle,
      description: newDesc,
    });
    setActivities([entry, ...activities]);
    setNewTitle('');
    setNewDesc('');
    setShowForm(false);
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Activity Log</h2>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowForm(!showForm)}>
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
      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
          <Card className="mb-4 border-primary/30 bg-card p-3">
            <div className="mb-3 flex gap-2">
              {typeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setNewType(opt.value)}
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
              className="mb-2 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
            />
            <Textarea
              placeholder="Details / notes..."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="mb-3 min-h-[60px] border-border bg-secondary/50 text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd}>Save</Button>
            </div>
          </Card>
        </motion.div>
      )}

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
              {/* Timeline line */}
              {i < activities.length - 1 && (
                <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-border" />
              )}
              {/* Icon */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm">
                {activityTypeIcons[entry.type]}
              </div>
              {/* Content */}
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
