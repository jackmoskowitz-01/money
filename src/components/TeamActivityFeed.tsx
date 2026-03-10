import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Phone, Users, FileText, ArrowRightLeft, Sparkles, ClipboardList } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getActivities, getAssignments, brokers, type ActivityType } from '@/data/activityData';
import { buildings } from '@/data/mockData';

const activityIcons: Record<ActivityType, React.ReactNode> = {
  email_sent: <Mail className="h-3.5 w-3.5" />,
  call: <Phone className="h-3.5 w-3.5" />,
  meeting: <Users className="h-3.5 w-3.5" />,
  note: <FileText className="h-3.5 w-3.5" />,
  stage_change: <ArrowRightLeft className="h-3.5 w-3.5" />,
  ai_email: <Sparkles className="h-3.5 w-3.5" />,
  task_created: <ClipboardList className="h-3.5 w-3.5" />,
};

const activityColors: Record<ActivityType, string> = {
  email_sent: 'bg-info/15 text-info',
  call: 'bg-warning/15 text-warning',
  meeting: 'bg-success/15 text-success',
  note: 'bg-muted text-muted-foreground',
  stage_change: 'bg-primary/15 text-primary',
  ai_email: 'bg-accent/15 text-accent',
  task_created: 'bg-secondary text-secondary-foreground',
};

const TeamActivityFeed = () => {
  const activities = getActivities();
  const assignments = getAssignments();

  const enrichedActivities = useMemo(() => {
    return activities.slice(0, 15).map(activity => {
      const assignment = assignments.find(
        a => a.tenantId === activity.tenantId && a.buildingId === activity.buildingId
      );
      const broker = assignment
        ? brokers.find(b => b.id === assignment.brokerId)
        : brokers[Math.floor(Math.random() * brokers.length)]; // fallback
      const building = buildings.find(b => b.id === activity.buildingId);
      const tenant = building?.tenants.find(t => t.id === activity.tenantId);

      return { ...activity, broker, building, tenant };
    });
  }, [activities, assignments]);

  const timeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-bold">Team Activity Feed</h3>
        <Link to="/activities">
          <span className="text-[11px] text-primary hover:underline">View All →</span>
        </Link>
      </div>

      <div className="space-y-1">
        {enrichedActivities.map((activity, i) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-secondary/30 transition-colors group"
          >
            {/* Broker Avatar */}
            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${activity.broker?.color || 'bg-muted text-muted-foreground'}`}>
              {activity.broker?.initials || '??'}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground">
                <span className="font-semibold">{activity.broker?.name || 'Unknown'}</span>
                {' '}
                <span className="text-muted-foreground">
                  {activity.type === 'email_sent' && 'sent an email to'}
                  {activity.type === 'call' && 'called'}
                  {activity.type === 'meeting' && 'had a meeting with'}
                  {activity.type === 'note' && 'added a note on'}
                  {activity.type === 'stage_change' && 'updated stage for'}
                  {activity.type === 'ai_email' && 'generated AI email for'}
                  {activity.type === 'task_created' && 'created a task for'}
                </span>
                {' '}
                {activity.tenant ? (
                  <Link
                    to={`/building/${activity.buildingId}/tenant/${activity.tenantId}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {activity.tenant.name}
                  </Link>
                ) : (
                  <span className="font-medium">{activity.title}</span>
                )}
              </p>
              {activity.building && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {activity.building.name} — {activity.description.slice(0, 80)}{activity.description.length > 80 ? '…' : ''}
                </p>
              )}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-2 shrink-0">
              <div className={`flex h-6 w-6 items-center justify-center rounded-md ${activityColors[activity.type]}`}>
                {activityIcons[activity.type]}
              </div>
              <span className="text-[10px] text-muted-foreground/70 w-10 text-right">
                {timeAgo(activity.timestamp)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

export default TeamActivityFeed;
