import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, AlertTriangle, Clock, CheckCircle2, Plus, Trash2, Bell, BellOff, ChevronDown, ChevronUp } from 'lucide-react';
import { useCriticalDates, getDateTypeLabel, getDaysUntil, getUrgency, type CriticalDate } from '@/hooks/useCriticalDates';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const urgencyConfig = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', badge: 'bg-red-500/20 text-red-400', icon: AlertTriangle, label: 'Critical' },
  warning: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', badge: 'bg-amber-500/20 text-amber-400', icon: Clock, label: 'Approaching' },
  upcoming: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', badge: 'bg-blue-500/20 text-blue-400', icon: Calendar, label: 'Upcoming' },
  safe: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle2, label: 'On Track' },
  past: { color: 'text-muted-foreground', bg: 'bg-muted/30 border-muted', badge: 'bg-muted text-muted-foreground', icon: Clock, label: 'Past Due' },
};

function DateCard({ date, onAcknowledge, onDelete }: { date: CriticalDate; onAcknowledge: (id: string) => void; onDelete: (id: string) => void }) {
  const daysUntil = getDaysUntil(date.date_value);
  const urgency = getUrgency(daysUntil, date.remind_days_before);
  const config = urgencyConfig[urgency];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`p-3 rounded-lg border ${config.bg} ${date.acknowledged ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-foreground">{getDateTypeLabel(date.date_type)}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.badge} border-0`}>
              {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Today!' : `${daysUntil}d away`}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{date.description}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-muted-foreground">
              📅 {format(new Date(date.date_value + 'T00:00:00'), 'MMM d, yyyy')}
            </span>
            {date.prospect_name && (
              <span className="text-[10px] text-muted-foreground">• {date.prospect_name}</span>
            )}
            {date.building_name && (
              <span className="text-[10px] text-muted-foreground">@ {date.building_name}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!date.acknowledged && (
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onAcknowledge(date.id)} title="Acknowledge">
              <BellOff className="h-3 w-3" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(date.id)} title="Delete">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function CriticalDatesTracker() {
  const { dates, loading, acknowledge, deleteDate, addDates } = useCriticalDates();
  const { user } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'upcoming'>('all');
  const [newDate, setNewDate] = useState({
    prospect_name: '', building_name: '', date_type: 'lease_expiration',
    date_value: '', description: '', remind_days_before: 30,
  });

  const handleAddDate = async () => {
    if (!newDate.date_value || !newDate.description) {
      toast.error('Date and description are required');
      return;
    }
    const success = await addDates([{
      ...newDate,
      prospect_id: null,
      source: 'manual',
      lease_abstract_id: null,
    }]);
    if (success) {
      toast.success('Critical date added');
      setNewDate({ prospect_name: '', building_name: '', date_type: 'lease_expiration', date_value: '', description: '', remind_days_before: 30 });
      setShowAdd(false);
    }
  };

  const filteredDates = dates.filter(d => {
    if (filter === 'all') return true;
    const days = getDaysUntil(d.date_value);
    const urgency = getUrgency(days, d.remind_days_before);
    return urgency === filter;
  });

  const activeDates = filteredDates.filter(d => getDaysUntil(d.date_value) >= -7);
  const displayDates = showAll ? activeDates : activeDates.slice(0, 5);

  // Summary stats
  const criticalCount = dates.filter(d => !d.acknowledged && getUrgency(getDaysUntil(d.date_value), d.remind_days_before) === 'critical').length;
  const warningCount = dates.filter(d => !d.acknowledged && getUrgency(getDaysUntil(d.date_value), d.remind_days_before) === 'warning').length;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Critical Dates</CardTitle>
            {criticalCount > 0 && (
              <Badge variant="outline" className="bg-red-500/20 text-red-400 border-0 text-[10px] px-1.5 py-0 animate-pulse">
                {criticalCount} critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-0 text-[10px] px-1.5 py-0">
                {warningCount} approaching
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="h-6 text-[10px] w-[90px] border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Approaching</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-3"
            >
              <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Prospect name" className="h-7 text-xs" value={newDate.prospect_name} onChange={e => setNewDate(p => ({ ...p, prospect_name: e.target.value }))} />
                  <Input placeholder="Building name" className="h-7 text-xs" value={newDate.building_name} onChange={e => setNewDate(p => ({ ...p, building_name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newDate.date_type} onValueChange={v => setNewDate(p => ({ ...p, date_type: v }))}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lease_expiration">Lease Expiration</SelectItem>
                      <SelectItem value="renewal_option">Renewal Option</SelectItem>
                      <SelectItem value="early_termination">Early Termination</SelectItem>
                      <SelectItem value="rent_escalation">Rent Escalation</SelectItem>
                      <SelectItem value="notice_period">Notice Period</SelectItem>
                      <SelectItem value="option_exercise">Option Exercise</SelectItem>
                      <SelectItem value="ti_deadline">TI Deadline</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="date" className="h-7 text-xs" value={newDate.date_value} onChange={e => setNewDate(p => ({ ...p, date_value: e.target.value }))} />
                </div>
                <Input placeholder="Description (e.g., 'Must notify landlord of renewal intent')" className="h-7 text-xs" value={newDate.description} onChange={e => setNewDate(p => ({ ...p, description: e.target.value }))} />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button size="sm" className="h-6 text-xs" onClick={handleAddDate}>Add Date</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : activeDates.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No critical dates tracked</p>
            <p className="text-[10px] text-muted-foreground mt-1">Upload a lease with /abstract to auto-extract dates</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {displayDates.map(d => (
                <DateCard key={d.id} date={d} onAcknowledge={acknowledge} onDelete={deleteDate} />
              ))}
            </AnimatePresence>
            {activeDates.length > 5 && (
              <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground gap-1" onClick={() => setShowAll(!showAll)}>
                {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showAll ? 'Show less' : `Show ${activeDates.length - 5} more`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
