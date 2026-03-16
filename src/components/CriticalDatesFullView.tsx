import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar, AlertTriangle, Clock, CheckCircle2, Plus, Trash2, BellOff,
  Search, Building2, User,
} from 'lucide-react';
import { useCriticalDates, getDateTypeLabel, getDaysUntil, getUrgency, type CriticalDate } from '@/hooks/useCriticalDates';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const urgencyConfig = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', badge: 'bg-red-500/20 text-red-400', ring: 'ring-red-500/20', label: 'Critical', icon: AlertTriangle },
  warning: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', badge: 'bg-amber-500/20 text-amber-400', ring: 'ring-amber-500/20', label: 'Approaching', icon: Clock },
  upcoming: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', badge: 'bg-blue-500/20 text-blue-400', ring: 'ring-blue-500/20', label: 'Upcoming', icon: Calendar },
  safe: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-400', ring: 'ring-emerald-500/20', label: 'On Track', icon: CheckCircle2 },
  past: { color: 'text-muted-foreground', bg: 'bg-muted/30 border-muted', badge: 'bg-muted text-muted-foreground', ring: 'ring-muted', label: 'Past Due', icon: Clock },
};

export default function CriticalDatesFullView() {
  const { dates, loading, acknowledge, deleteDate, addDates } = useCriticalDates();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'upcoming' | 'safe'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [newDate, setNewDate] = useState({
    prospect_name: '', building_name: '', date_type: 'lease_expiration',
    date_value: '', description: '', remind_days_before: 30,
  });

  const processedDates = useMemo(() => {
    return dates
      .map(d => ({
        ...d,
        daysUntil: getDaysUntil(d.date_value),
        urgency: getUrgency(getDaysUntil(d.date_value), d.remind_days_before),
      }))
      .filter(d => d.daysUntil >= -30) // Show up to 30 days past
      .filter(d => {
        if (filter !== 'all' && d.urgency !== filter) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            d.prospect_name.toLowerCase().includes(s) ||
            d.building_name.toLowerCase().includes(s) ||
            d.description.toLowerCase().includes(s) ||
            getDateTypeLabel(d.date_type).toLowerCase().includes(s)
          );
        }
        return true;
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [dates, filter, search]);

  // Group by prospect
  const groupedByProspect = useMemo(() => {
    const groups = new Map<string, typeof processedDates>();
    processedDates.forEach(d => {
      const key = d.prospect_name || 'Unassigned';
      const list = groups.get(key) || [];
      list.push(d);
      groups.set(key, list);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      const aMin = Math.min(...a[1].map(d => d.daysUntil));
      const bMin = Math.min(...b[1].map(d => d.daysUntil));
      return aMin - bMin;
    });
  }, [processedDates]);

  // Summary stats
  const stats = useMemo(() => ({
    total: dates.filter(d => getDaysUntil(d.date_value) >= 0).length,
    critical: dates.filter(d => getUrgency(getDaysUntil(d.date_value), d.remind_days_before) === 'critical' && !d.acknowledged).length,
    warning: dates.filter(d => getUrgency(getDaysUntil(d.date_value), d.remind_days_before) === 'warning' && !d.acknowledged).length,
    pastDue: dates.filter(d => getDaysUntil(d.date_value) < 0 && getDaysUntil(d.date_value) >= -30 && !d.acknowledged).length,
    prospects: new Set(dates.map(d => d.prospect_name)).size,
  }), [dates]);

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

  const formatDaysLabel = (days: number) => {
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 30) return `${days}d`;
    if (days <= 365) return `${Math.floor(days / 30)}mo`;
    return `${(days / 365).toFixed(1)}yr`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Dates', value: stats.total, icon: Calendar, color: 'text-primary' },
          { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Approaching', value: stats.warning, icon: Clock, color: 'text-amber-400' },
          { label: 'Past Due', value: stats.pastDue, icon: Clock, color: 'text-muted-foreground' },
          { label: 'Clients Tracked', value: stats.prospects, icon: User, color: 'text-blue-400' },
        ].map(stat => (
          <Card key={stat.label} className="border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by client, building, or date type..."
            className="h-8 text-xs pl-8"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="h-8 text-xs w-[130px] border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Urgencies</SelectItem>
            <SelectItem value="critical">Critical Only</SelectItem>
            <SelectItem value="warning">Approaching</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="safe">On Track</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-3 w-3" /> Add Date
        </Button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <Card className="border-border bg-card p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input placeholder="Client / Prospect name" className="h-8 text-xs" value={newDate.prospect_name} onChange={e => setNewDate(p => ({ ...p, prospect_name: e.target.value }))} />
                <Input placeholder="Building name" className="h-8 text-xs" value={newDate.building_name} onChange={e => setNewDate(p => ({ ...p, building_name: e.target.value }))} />
                <Select value={newDate.date_type} onValueChange={v => setNewDate(p => ({ ...p, date_type: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lease_expiration">Lease Expiration</SelectItem>
                    <SelectItem value="renewal_option">Renewal Option</SelectItem>
                    <SelectItem value="early_termination">Early Termination</SelectItem>
                    <SelectItem value="rent_escalation">Rent Escalation</SelectItem>
                    <SelectItem value="notice_period">Notice Period</SelectItem>
                    <SelectItem value="option_exercise">Option Exercise</SelectItem>
                    <SelectItem value="ti_deadline">TI Deadline</SelectItem>
                    <SelectItem value="free_rent_expiry">Free Rent Expiry</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" className="h-8 text-xs" value={newDate.date_value} onChange={e => setNewDate(p => ({ ...p, date_value: e.target.value }))} />
                <Input placeholder="Description (e.g., 'Must notify landlord of renewal')" className="h-8 text-xs md:col-span-2" value={newDate.description} onChange={e => setNewDate(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleAddDate}>Add Critical Date</Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dates grouped by prospect */}
      {processedDates.length === 0 ? (
        <Card className="border-border bg-card">
          <div className="text-center py-12">
            <Calendar className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No critical dates tracked yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Upload a lease with /abstract in the Copilot to auto-extract dates</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedByProspect.map(([prospectName, prospectDates]) => {
            const mostUrgent = prospectDates.reduce((a, b) => a.daysUntil < b.daysUntil ? a : b);
            const mostUrgentConfig = urgencyConfig[mostUrgent.urgency];

            return (
              <Card key={prospectName} className={`border-border bg-card overflow-hidden`}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${mostUrgentConfig.bg.split(' ')[0]}`}>
                        <User className={`h-4 w-4 ${mostUrgentConfig.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{prospectName}</CardTitle>
                        {prospectDates[0]?.building_name && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-2.5 w-2.5" /> {prospectDates[0].building_name}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 border-0 ${mostUrgentConfig.badge}`}>
                      {prospectDates.length} date{prospectDates.length > 1 ? 's' : ''} · Next: {formatDaysLabel(mostUrgent.daysUntil)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-1">
                  <div className="space-y-1.5">
                    {prospectDates.map((d, i) => {
                      const config = urgencyConfig[d.urgency];
                      const Icon = config.icon;
                      return (
                        <motion.div
                          key={d.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className={`flex items-center gap-3 p-2.5 rounded-lg border ${config.bg} ${d.acknowledged ? 'opacity-40' : ''}`}
                        >
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />

                          {/* Days counter */}
                          <div className={`flex h-10 w-14 shrink-0 items-center justify-center rounded-md ${config.bg.split(' ')[0]} border ${config.bg.split(' ')[1] || 'border-transparent'}`}>
                            <div className="text-center">
                              <p className={`text-sm font-bold leading-none ${config.color}`}>
                                {d.daysUntil < 0 ? Math.abs(d.daysUntil) : d.daysUntil}
                              </p>
                              <p className={`text-[8px] uppercase ${config.color} opacity-70`}>
                                {d.daysUntil < 0 ? 'over' : d.daysUntil === 0 ? 'today' : 'days'}
                              </p>
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-foreground">{getDateTypeLabel(d.date_type)}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(d.date_value + 'T00:00:00'), 'MMM d, yyyy')}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{d.description}</p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {!d.acknowledged && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => acknowledge(d.id)} title="Acknowledge">
                                <BellOff className="h-3 w-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => deleteDate(d.id)} title="Delete">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
