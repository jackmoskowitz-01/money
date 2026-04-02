import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, UserPlus, RefreshCw, CheckCircle2, Circle, AlertOctagon, Play, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

type ActivityEntry = {
  id: string;
  taskId: string;
  userId: string | null;
  userName: string;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

type DbRow = {
  id: string;
  task_id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
};

const actionConfig: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  created: { icon: Circle, label: 'created this task', color: 'text-primary' },
  assigned: { icon: UserPlus, label: 'assigned', color: 'text-info' },
  reassigned: { icon: RefreshCw, label: 'reassigned', color: 'text-warning' },
  status_changed: { icon: Play, label: 'changed status', color: 'text-accent' },
  completed: { icon: CheckCircle2, label: 'completed this task', color: 'text-success' },
  reopened: { icon: Circle, label: 'reopened this task', color: 'text-warning' },
  commented: { icon: MessageSquare, label: 'commented', color: 'text-muted-foreground' },
  blocked: { icon: AlertOctagon, label: 'marked as blocked', color: 'text-destructive' },
};

function describeAction(entry: ActivityEntry): string {
  const cfg = actionConfig[entry.action];
  if (!cfg) return entry.action;

  if (entry.action === 'assigned' || entry.action === 'reassigned') {
    const name = (entry.detail.assigned_to_name as string) || 'someone';
    return `${cfg.label} to ${name}`;
  }
  if (entry.action === 'status_changed') {
    const from = (entry.detail.from as string || 'unknown').replace(/_/g, ' ');
    const to = (entry.detail.to as string || 'unknown').replace(/_/g, ' ');
    return `${cfg.label} from ${from} to ${to}`;
  }
  return cfg.label;
}

interface Props {
  taskId: string;
}

const TaskActivityFeed = ({ taskId }: Props) => {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [expanded, setExpanded] = useState(false);

  const fetchActivity = useCallback(async () => {
    const { data } = await supabase
      .from('task_activity')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setEntries((data as unknown as DbRow[]).map(r => ({
        id: r.id,
        taskId: r.task_id,
        userId: r.user_id,
        userName: r.user_name,
        action: r.action,
        detail: r.detail || {},
        createdAt: r.created_at,
      })));
    }
  }, [taskId]);

  useEffect(() => {
    if (!expanded) return;
    fetchActivity();

    const channel = supabase
      .channel(`task-activity-${taskId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_activity', filter: `task_id=eq.${taskId}` }, () => {
        fetchActivity();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [expanded, fetchActivity, taskId]);

  return (
    <div className="mt-1" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
      >
        <Activity className="h-2.5 w-2.5" />
        {expanded ? 'Hide activity' : 'Activity'}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-secondary/20 p-2.5 max-h-48 overflow-y-auto">
              {entries.length === 0 && (
                <p className="text-[10px] text-muted-foreground/60 text-center py-2">No activity yet</p>
              )}

              {entries.map((entry, i) => {
                const cfg = actionConfig[entry.action] || actionConfig.created;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-start gap-2"
                  >
                    <Icon className={`h-3 w-3 mt-0.5 shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-foreground/80">
                        <span className="font-medium">{entry.userName || 'System'}</span>{' '}
                        {describeAction(entry)}
                      </p>
                      <p className="text-[9px] text-muted-foreground/50">
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaskActivityFeed;
