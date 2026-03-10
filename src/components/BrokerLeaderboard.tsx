import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Calendar, Phone, Mail, Users, FileText, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getActivities, getAssignments, brokers, type ActivityType } from '@/data/activityData';
import { getPipeline } from '@/data/pipelineData';

const BrokerLeaderboard = () => {
  const activities = getActivities();
  const assignments = getAssignments();
  const pipeline = getPipeline();

  const leaderboard = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 3600000;

    return brokers.map(broker => {
      const brokerAssignments = assignments.filter(a => a.brokerId === broker.id);
      const tenantIds = new Set(brokerAssignments.map(a => a.tenantId));

      // All activities for this broker's prospects
      const brokerActivities = activities.filter(a => tenantIds.has(a.tenantId));

      // This week's activities
      const weekActivities = brokerActivities.filter(
        a => now - new Date(a.timestamp).getTime() < weekMs
      );

      // Activity breakdown
      const breakdown: Partial<Record<ActivityType, number>> = {};
      weekActivities.forEach(a => {
        breakdown[a.type] = (breakdown[a.type] || 0) + 1;
      });

      // Meetings set this week (prospects moved to meeting_set stage)
      const meetingsSet = pipeline.filter(p => {
        if (p.stage !== 'meeting_set' && p.stage !== 'meeting_held') return false;
        const isAssigned = brokerAssignments.some(
          a => a.tenantId === p.tenantId && a.buildingId === p.buildingId
        );
        if (!isAssigned) return false;
        return now - new Date(p.lastActivity).getTime() < weekMs;
      }).length;

      return {
        ...broker,
        totalActivities: weekActivities.length,
        allTimeActivities: brokerActivities.length,
        meetingsSet,
        breakdown,
        prospects: brokerAssignments.length,
      };
    }).sort((a, b) => b.totalActivities - a.totalActivities);
  }, [activities, assignments, pipeline]);

  const topBroker = leaderboard[0];

  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-bold">Broker Leaderboard</h3>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto">This Week</Badge>
      </div>

      <div className="space-y-3">
        {leaderboard.map((broker, i) => {
          const isTop = i === 0 && broker.totalActivities > 0;
          return (
            <motion.div
              key={broker.id}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`rounded-lg border p-3 transition-colors ${
                isTop
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-secondary/20'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Rank */}
                <span className={`text-sm font-bold w-5 text-center ${isTop ? 'text-primary' : 'text-muted-foreground'}`}>
                  {i + 1}
                </span>

                {/* Avatar */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${broker.color}`}>
                  {broker.initials}
                </div>

                {/* Name + prospects */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{broker.name}</p>
                    {isTop && <Trophy className="h-3 w-3 text-primary" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {broker.prospects} prospects assigned
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center">
                    <p className="text-lg font-bold text-foreground leading-none">{broker.totalActivities}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Activities</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold leading-none ${broker.meetingsSet > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                      {broker.meetingsSet}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Meetings</p>
                  </div>
                </div>
              </div>

              {/* Activity breakdown row */}
              {broker.totalActivities > 0 && (
                <div className="flex items-center gap-2 mt-2 ml-8 pl-5">
                  {(broker.breakdown.email_sent || 0) > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Mail className="h-2.5 w-2.5 text-info" /> {broker.breakdown.email_sent}
                    </span>
                  )}
                  {(broker.breakdown.call || 0) > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Phone className="h-2.5 w-2.5 text-warning" /> {broker.breakdown.call}
                    </span>
                  )}
                  {(broker.breakdown.meeting || 0) > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Users className="h-2.5 w-2.5 text-success" /> {broker.breakdown.meeting}
                    </span>
                  )}
                  {(broker.breakdown.note || 0) > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <FileText className="h-2.5 w-2.5" /> {broker.breakdown.note}
                    </span>
                  )}
                  {(broker.breakdown.ai_email || 0) > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Sparkles className="h-2.5 w-2.5 text-accent" /> {broker.breakdown.ai_email}
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
};

export default BrokerLeaderboard;
