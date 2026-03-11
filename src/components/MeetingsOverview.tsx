import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPipeline, stageLabels, type PipelineItem } from '@/data/pipelineData';
import { getAssignments, getTasks } from '@/data/activityData';
import { useBrokers } from '@/hooks/useBrokers';
import { buildings } from '@/data/mockData';

const MeetingsOverview = () => {
  const pipeline = getPipeline();
  const assignments = getAssignments();
  const tasks = getTasks();

  // Get all prospects with meetings set or held
  const meetingProspects = useMemo(() => {
    return pipeline
      .filter(p => p.stage === 'meeting_set' || p.stage === 'meeting_held')
      .map(item => {
        const building = buildings.find(b => b.id === item.buildingId);
        const tenant = item.isManual
          ? null
          : building?.tenants.find(t => t.id === item.tenantId);
        const assignment = assignments.find(
          a => a.tenantId === item.tenantId && a.buildingId === item.buildingId
        );
        const broker = assignment ? brokers.find(b => b.id === assignment.brokerId) : null;

        return {
          ...item,
          building,
          tenant,
          broker,
          displayName: item.isManual
            ? (item.prospectCompany || item.prospectName || 'Manual Prospect')
            : (tenant?.name || 'Unknown'),
        };
      })
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  }, [pipeline, assignments]);

  // Get upcoming meeting tasks
  const upcomingMeetings = useMemo(() => {
    return tasks
      .filter(t => t.type === 'meeting' && !t.completed)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5)
      .map(task => {
        const building = buildings.find(b => b.id === task.buildingId);
        const tenant = building?.tenants.find(t => t.id === task.tenantId);
        const assignment = task.tenantId
          ? assignments.find(a => a.tenantId === task.tenantId)
          : null;
        const broker = assignment ? brokers.find(b => b.id === assignment.brokerId) : null;
        return { ...task, building, tenant, broker };
      });
  }, [tasks, assignments]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      {/* Upcoming Meetings */}
      <Card className="border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold">Upcoming Meetings</h3>
          </div>
          <Link to="/tasks">
            <span className="text-[11px] text-primary hover:underline">View Calendar →</span>
          </Link>
        </div>

        {upcomingMeetings.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No upcoming meetings scheduled</p>
        ) : (
          <div className="space-y-2">
            {upcomingMeetings.map((meeting, i) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 rounded-md border border-border bg-secondary/20 p-3 hover:bg-secondary/40 transition-colors"
              >
                {/* Date block */}
                <div className="flex flex-col items-center justify-center rounded-md bg-primary/10 px-2.5 py-1.5 shrink-0">
                  <span className="text-[10px] font-medium text-primary uppercase">
                    {new Date(meeting.dueDate).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-lg font-bold text-primary leading-none">
                    {new Date(meeting.dueDate).getDate()}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{meeting.title}</p>
                  {meeting.tenant && meeting.building && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      <MapPin className="inline h-2.5 w-2.5 mr-0.5" />
                      {meeting.tenant.name} · {meeting.building.name}
                    </p>
                  )}
                  {meeting.description && (
                    <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">
                      {meeting.description}
                    </p>
                  )}
                </div>

                {/* Broker */}
                {meeting.broker && (
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${meeting.broker.color}`}>
                    {meeting.broker.initials}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </Card>

    </div>
  );
};

export default MeetingsOverview;
