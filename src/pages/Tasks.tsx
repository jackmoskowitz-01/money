import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Phone, Mail, Users, Search, StickyNote, MoreHorizontal, List, AlertTriangle, ArrowRight, ArrowDown, X, Loader2, Inbox, CornerDownRight, Clock, CheckCircle2, UserPlus, Building2, User } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addDays } from 'date-fns';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buildings } from '@/data/mockData';
import { useBuildings } from '@/hooks/useBuildings';
import { useTasks, type TaskPriority, type TaskType, type Task } from '@/hooks/useTasks';
import { getCustomProspects } from '@/data/customProspects';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import ProspectLists from '@/components/ProspectLists';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useAuth } from '@/contexts/AuthContext';
import TaskComments from '@/components/TaskComments';
import { useToast } from '@/hooks/use-toast';

const taskTypeIcons: Record<string, typeof Phone> = {
  follow_up: MoreHorizontal, call: Phone, meeting: Users, email: Mail, research: Search, other: StickyNote,
};

const taskTypeColors: Record<string, string> = {
  follow_up: 'bg-primary/20 text-primary', call: 'bg-info/20 text-info', meeting: 'bg-success/20 text-success',
  email: 'bg-warning/20 text-warning', research: 'bg-accent/20 text-accent', other: 'bg-muted text-muted-foreground',
};

const priorityConfig: Record<TaskPriority, { icon: typeof AlertTriangle; label: string; class: string; sortOrder: number }> = {
  high: { icon: AlertTriangle, label: 'High', class: 'text-destructive bg-destructive/10 border-destructive/30', sortOrder: 0 },
  medium: { icon: ArrowRight, label: 'Med', class: 'text-warning bg-warning/10 border-warning/30', sortOrder: 1 },
  low: { icon: ArrowDown, label: 'Low', class: 'text-muted-foreground bg-muted border-border', sortOrder: 2 },
};

const nextTypeMap: Record<string, TaskType> = { email: 'call', call: 'meeting', meeting: 'follow_up', follow_up: 'call', research: 'email', other: 'follow_up' };
const followUpDaysMap: Record<string, number> = { call: 3, email: 2, meeting: 7, follow_up: 3, research: 1, other: 3 };

const Tasks = () => {
  const { buildings: allBuildings } = useBuildings();
  const navigate = useNavigate();
  const { tasks, loading, addTask, updateTask, deleteTask } = useTasks();
  const { members: teamMembers } = useTeamMembers();
  const { user } = useAuth();
  const { toast } = useToast();
  

  // Listen for task assignment notifications
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      toast({
        title: '📋 New task assigned to you',
        description: detail.title,
      });
    };
    window.addEventListener('task-assigned', handler);
    return () => window.removeEventListener('task-assigned', handler);
  }, [toast]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', type: 'follow_up' as TaskType, priority: 'medium' as TaskPriority, dueDate: format(new Date(), 'yyyy-MM-dd'), tenantId: '', buildingId: '', assignedTo: '', assignedToName: '' });
  const [prospectSearch, setProspectSearch] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'assigned_to_me'>('all');
  
  const [followUpTaskId, setFollowUpTaskId] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<{ title: string; description: string; type: TaskType; priority: TaskPriority; dueDate: string }>({
    title: '', description: '', type: 'call', priority: 'medium', dueDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'),
  });

  const pendingCount = useMemo(() => tasks.filter(t => !t.completed).length, [tasks]);
  const completedCount = useMemo(() => tasks.filter(t => t.completed).length, [tasks]);
  const overdueCount = useMemo(() => tasks.filter(t => !t.completed && t.dueDate < format(new Date(), 'yyyy-MM-dd')).length, [tasks]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { taskCounts, overdueCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    const overdue: Record<string, number> = {};
    tasks.filter(t => !t.completed).forEach(t => {
      const date = t.dueDate.split('T')[0];
      counts[date] = (counts[date] || 0) + 1;
      if (date < todayStr) {
        overdue[date] = (overdue[date] || 0) + 1;
      }
    });
    return { taskCounts: counts, overdueCounts: overdue };
  }, [tasks, todayStr]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const filteredTasks = useMemo(() => {
    let t = [...tasks];
    if (filter === 'pending') t = t.filter(x => !x.completed);
    if (filter === 'completed') t = t.filter(x => x.completed);
    if (filter === 'assigned_to_me') t = t.filter(x => x.assignedTo === user?.id);
    if (selectedDate) t = t.filter(x => x.dueDate.startsWith(format(selectedDate, 'yyyy-MM-dd')));
    return t.sort((a, b) => {
      const pa = priorityConfig[a.priority || 'medium'].sortOrder;
      const pb = priorityConfig[b.priority || 'medium'].sortOrder;
      if (pa !== pb) return pa - pb;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [tasks, filter, selectedDate, user?.id]);

  const handleAdd = async () => {
    if (!newTask.title.trim() || !newTask.tenantId) return;
    await addTask({ ...newTask, tenantId: newTask.tenantId || undefined, buildingId: newTask.buildingId || undefined, completed: false } as any);
    setNewTask({ title: '', description: '', type: 'follow_up', priority: 'medium', dueDate: format(new Date(), 'yyyy-MM-dd'), tenantId: '', buildingId: '', assignedTo: '', assignedToName: '' });
    setProspectSearch('');
    setShowForm(false);
  };

  const handleToggle = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const wasCompleted = task.completed;
    await updateTask(id, { completed: !wasCompleted });
    if (!wasCompleted) {
      const suggestedType = nextTypeMap[task.type] || 'follow_up';
      const suggestedDays = followUpDaysMap[suggestedType] || 3;
      const subjectMatch = task.title.match(/(?:with|for|to)\s+(.+)/i);
      const subject = subjectMatch ? subjectMatch[1] : '';
      const typeLabel = suggestedType.replace('_', ' ');
      setFollowUp({
        title: subject ? `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} with ${subject}` : '',
        description: `Follow-up from: ${task.title}`, type: suggestedType, priority: task.priority || 'medium',
        dueDate: format(addDays(new Date(), suggestedDays), 'yyyy-MM-dd'),
      });
      setFollowUpTaskId(id);
    }
  };

  const handleFollowUpCreate = async (sourceTask: Task) => {
    if (!followUp.title.trim()) return;
    await addTask({ ...followUp, tenantId: sourceTask.tenantId, buildingId: sourceTask.buildingId });
    setFollowUpTaskId(null);
  };

  const handleDelete = async (id: string) => { await deleteTask(id); };

  const getTenantInfo = (task: { tenantId?: string; buildingId?: string }) => {
    if (!task.tenantId || !task.buildingId) return null;
    const building = allBuildings.find(b => b.id === task.buildingId);
    const tenant = building?.tenants.find(t => t.id === task.tenantId);
    return tenant ? { tenant, building } : null;
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-14">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Skeleton className="h-10 w-64 mb-6" />
          <div className="grid grid-cols-3 gap-3 mb-6">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  // ── Task creation form (shared) ──
  const renderTaskForm = () => (
    <AnimatePresence>
      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
          <Card className="border-primary/30 bg-card p-4">
            {/* Prospect */}
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-foreground">Prospect <span className="text-destructive">*</span></label>
              {newTask.tenantId ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm flex-1">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    <span className="text-foreground">
                      {(() => {
                        const b = allBuildings.find(b => b.id === newTask.buildingId);
                        const t = b?.tenants.find(t => t.id === newTask.tenantId);
                        if (t) return `${t.name} — ${b?.name}`;
                        const cp = getCustomProspects().find(p => p.id === newTask.tenantId);
                        return cp ? cp.name : 'Unknown';
                      })()}
                    </span>
                  </div>
                  <button onClick={() => { setNewTask({ ...newTask, tenantId: '', buildingId: '' }); setProspectSearch(''); }} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input placeholder="Search prospect by name or building..." value={prospectSearch} onChange={e => setProspectSearch(e.target.value)} className={`border-border bg-secondary/50 ${!newTask.tenantId && prospectSearch === '' ? 'border-destructive/30 focus:ring-destructive/30' : ''}`} autoFocus />
                  {prospectSearch.length >= 2 && (() => {
                    const query = prospectSearch.toLowerCase();
                    const tenantResults = allBuildings.flatMap(b => b.tenants.filter(t => t.name.toLowerCase().includes(query) || b.name.toLowerCase().includes(query)).map(t => ({ key: `${b.id}-${t.id}`, id: t.id, buildingId: b.id, name: t.name, subtitle: `${b.name} · ${t.industry}`, isCustom: false })));
                    const customProspects = getCustomProspects().filter(p => p.name.toLowerCase().includes(query)).map(p => ({ key: `cp-${p.id}`, id: p.id, buildingId: '', name: p.name, subtitle: p.address || p.website || 'Custom prospect', isCustom: true }));
                    const allResults = [...tenantResults, ...customProspects].slice(0, 10);
                    return allResults.length > 0 ? (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                        {allResults.map(r => (
                          <button key={r.key} onClick={() => { setNewTask({ ...newTask, tenantId: r.id, buildingId: r.buildingId }); setProspectSearch(''); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0"><p className="font-medium text-foreground truncate">{r.name}</p><p className="text-[11px] text-muted-foreground truncate">{r.subtitle}</p></div>
                            {r.isCustom && <Badge variant="outline" className="ml-auto shrink-0 text-[9px]">Custom</Badge>}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-card shadow-lg">
                        <p className="px-3 py-2 text-xs text-muted-foreground">No matching prospects</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <Input placeholder="Task title..." value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} className="mb-3 border-border bg-secondary/50" />
            <Textarea placeholder="Description..." value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} className="mb-3 min-h-[60px] border-border bg-secondary/50" />

            <div className="mb-3 flex flex-wrap gap-2">
              {Object.entries(taskTypeIcons).map(([type, Icon]) => (
                <button key={type} onClick={() => setNewTask({ ...newTask, type: type as TaskType })} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${newTask.type === type ? taskTypeColors[type] : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                  <Icon className="h-3 w-3" />{type.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs text-muted-foreground">Priority</label>
              <div className="flex gap-2">
                {(Object.entries(priorityConfig) as [TaskPriority, typeof priorityConfig.high][]).map(([key, cfg]) => {
                  const PIcon = cfg.icon;
                  return (
                    <button key={key} onClick={() => setNewTask({ ...newTask, priority: key })} className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${newTask.priority === key ? cfg.class : 'border-border bg-secondary text-muted-foreground hover:text-foreground'}`}>
                      <PIcon className="h-3 w-3" />{cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-xs text-muted-foreground">Due Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-56 justify-start text-left font-normal", !newTask.dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newTask.dueDate ? format(new Date(newTask.dueDate + 'T12:00:00'), 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newTask.dueDate ? new Date(newTask.dueDate + 'T12:00:00') : undefined} onSelect={(date) => { if (date) setNewTask({ ...newTask, dueDate: format(date, 'yyyy-MM-dd') }); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>

            {/* Assign to team member */}
            <div className="mb-3">
              <label className="mb-1 block text-xs text-muted-foreground">Assign to (optional)</label>
              {newTask.assignedTo ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm flex-1">
                    <UserPlus className="h-3.5 w-3.5 text-primary" />
                    <span className="text-foreground">{newTask.assignedToName}</span>
                  </div>
                  <button onClick={() => setNewTask({ ...newTask, assignedTo: '', assignedToName: '' })} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input placeholder="Search team member..." value={assignSearch} onChange={e => setAssignSearch(e.target.value)} className="border-border bg-secondary/50" />
                  {assignSearch.length >= 1 && (() => {
                    const query = assignSearch.toLowerCase();
                    const matches = teamMembers
                      .filter(m => m.id !== user?.id)
                      .filter(m => m.fullName.toLowerCase().includes(query) || m.email.toLowerCase().includes(query))
                      .slice(0, 8);
                    return matches.length > 0 ? (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                        {matches.map(m => (
                          <button key={m.id} onClick={() => { setNewTask({ ...newTask, assignedTo: m.id, assignedToName: m.fullName }); setAssignSearch(''); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{m.avatarInitials}</div>
                            <div className="min-w-0"><p className="font-medium text-foreground truncate">{m.fullName}</p><p className="text-[10px] text-muted-foreground truncate">{m.email}</p></div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-card shadow-lg">
                        <p className="px-3 py-2 text-xs text-muted-foreground">No matching team members</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={!newTask.tenantId || !newTask.title.trim()}>Create Task</Button>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── Task card (shared) ──
  const renderTaskCard = (task: Task, i: number) => {
    const Icon = taskTypeIcons[task.type] || StickyNote;
    const info = getTenantInfo(task);
    const isOverdue = !task.completed && task.dueDate < format(new Date(), 'yyyy-MM-dd');
    const showFollowUp = followUpTaskId === task.id;

    return (
      <motion.div key={task.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
        <Card className={`border-border bg-card p-3 transition-colors cursor-pointer hover:border-primary/30 ${task.completed ? 'opacity-60' : ''} ${isOverdue ? 'border-destructive/30' : ''}`} onClick={() => { if (info) navigate(`/building/${task.buildingId}/tenant/${task.tenantId}`); }}>
          <div className="flex items-start gap-3">
            <button onClick={(e) => { e.stopPropagation(); handleToggle(task.id); }} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${task.completed ? 'border-success bg-success/20 text-success' : 'border-border hover:border-primary'}`}>
              {task.completed && <Check className="h-3 w-3" />}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</p>
                <Badge variant="outline" className={`text-[10px] ${taskTypeColors[task.type]}`}><Icon className="mr-1 h-2.5 w-2.5" />{task.type.replace('_', ' ')}</Badge>
                {(() => { const p = priorityConfig[task.priority || 'medium']; const PIcon = p.icon; return <Badge variant="outline" className={`text-[10px] ${p.class}`}><PIcon className="mr-1 h-2.5 w-2.5" />{p.label}</Badge>; })()}
                {task.assignedToName && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger onClick={(e) => e.stopPropagation()}>
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                            {task.assignedToName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{task.assignedTo === user?.id ? 'Assigned to you' : `Assigned to ${task.assignedToName}`}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {task.description && <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p>}
              <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                <span className={isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                  {isOverdue ? '⚠ Overdue: ' : ''}{format(new Date(task.dueDate + 'T12:00:00'), 'EEE, MMM d')}
                </span>
                {info && <span className="text-muted-foreground/60">{info.tenant.name} · {info.building!.name}</span>}
              </div>
              <TaskComments taskId={task.id} />
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </Card>

        {/* Follow-up */}
        <AnimatePresence>
          {showFollowUp && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <Card className="ml-8 mt-1 border-primary/30 bg-primary/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary"><CornerDownRight className="h-3.5 w-3.5" /> Schedule follow-up</div>
                <Input placeholder="Follow-up title..." value={followUp.title} onChange={e => setFollowUp({ ...followUp, title: e.target.value })} className="mb-2 h-8 border-border bg-card text-sm" onClick={e => e.stopPropagation()} autoFocus />
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {Object.entries(taskTypeIcons).map(([type, TIcon]) => (
                    <button key={type} onClick={(e) => { e.stopPropagation(); setFollowUp({ ...followUp, type: type as TaskType, dueDate: format(addDays(new Date(), followUpDaysMap[type] || 3), 'yyyy-MM-dd') }); }} className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${followUp.type === type ? taskTypeColors[type] : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                      <TIcon className="h-2.5 w-2.5" />{type.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <Input type="date" value={followUp.dueDate} onChange={e => setFollowUp({ ...followUp, dueDate: e.target.value })} className="h-8 w-40 border-border bg-card text-xs" onClick={e => e.stopPropagation()} />
                  <div className="flex gap-1">
                    {[1, 2, 3, 5, 7].map(d => (
                      <button key={d} onClick={(e) => { e.stopPropagation(); setFollowUp({ ...followUp, dueDate: format(addDays(new Date(), d), 'yyyy-MM-dd') }); }} className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${followUp.dueDate === format(addDays(new Date(), d), 'yyyy-MM-dd') ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>{d}d</button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setFollowUpTaskId(null); }}>Skip</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleFollowUpCreate(task); }} disabled={!followUp.title.trim()}><Plus className="mr-1 h-3 w-3" /> Create Follow-up</Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tasks & Calendar</h1>
              <p className="mt-1 text-sm text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
            </div>
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Task
            </Button>
          </div>

          {/* Stat Cards */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            <Card className="border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
                  <Clock className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground tabular-nums">{pendingCount}</p>
                  <p className="text-[11px] text-muted-foreground">Pending</p>
                </div>
              </div>
            </Card>
            <Card className={`border-border bg-card p-4 ${overdueCount > 0 ? 'border-destructive/30' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${overdueCount > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
                  <AlertTriangle className={`h-4 w-4 ${overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground tabular-nums">{overdueCount}</p>
                  <p className="text-[11px] text-muted-foreground">Overdue</p>
                </div>
              </div>
            </Card>
            <Card className="border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground tabular-nums">{completedCount}</p>
                  <p className="text-[11px] text-muted-foreground">Completed</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="tasks" className="w-full">
            <TabsList className="w-full justify-start bg-secondary/30 border border-border rounded-lg p-1 mb-6">
              <TabsTrigger value="tasks" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <CalendarIcon className="h-3 w-3" /> Tasks
              </TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <CalendarIcon className="h-3 w-3" /> Calendar
              </TabsTrigger>
              <TabsTrigger value="lists" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <List className="h-3 w-3" /> Prospect Lists
              </TabsTrigger>
              <TabsTrigger value="prospects" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <User className="h-3 w-3" /> Prospects
              </TabsTrigger>
            </TabsList>

            {/* ── TASKS TAB ── */}
            <TabsContent value="tasks" className="mt-0">
              {renderTaskForm()}

              <div className="mb-4 flex items-center gap-2 flex-wrap">
                {(['all', 'pending', 'completed', 'assigned_to_me'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>{f === 'assigned_to_me' ? 'My Assignments' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
                ))}
                {selectedDate && (
                  <div className="ml-auto flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5">
                      <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm font-bold text-primary">{filteredTasks.length}</span>
                      <span className="text-xs text-primary/80">task{filteredTasks.length !== 1 ? 's' : ''} on {format(selectedDate, 'MMM d')}</span>
                    </div>
                    <button onClick={() => setSelectedDate(null)} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {filteredTasks.length === 0 ? (
                  <Card className="border-border bg-card p-12 text-center">
                    <Inbox className="mx-auto mb-3 h-12 w-12 text-muted-foreground/20" />
                    <p className="text-sm font-medium text-muted-foreground">{selectedDate ? 'No tasks for this date' : filter === 'completed' ? 'No completed tasks yet' : 'All caught up!'}</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">{selectedDate ? 'Try selecting a different date' : 'Click "New Task" to create one'}</p>
                  </Card>
                ) : filteredTasks.map((task, i) => renderTaskCard(task, i))}
              </div>
            </TabsContent>

            {/* ── CALENDAR TAB ── */}
            <TabsContent value="calendar" className="mt-0">
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="border-border bg-card p-4 lg:col-span-1">
                  <div className="mb-4 flex items-center justify-between">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button>
                    <h3 className="font-display text-sm font-bold">{format(currentMonth, 'MMMM yyyy')}</h3>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><ChevronRight className="h-4 w-4" /></button>
                  </div>

                  <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="py-1">{d}</div>)}
                  </div>

                  <div className="grid grid-cols-7">
                    {calDays.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const count = taskCounts[dateStr] || 0;
                      const overdueForDay = overdueCounts[dateStr] || 0;
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, new Date());
                      const inMonth = isSameMonth(day, currentMonth);
                      return (
                        <button key={dateStr} onClick={() => setSelectedDate(isSelected ? null : day)} className={`relative flex flex-col items-center rounded-md py-1.5 text-xs transition-colors ${!inMonth ? 'text-muted-foreground/30' : isSelected ? 'bg-primary text-primary-foreground' : isToday ? 'bg-primary/10 text-primary font-bold' : 'text-foreground hover:bg-secondary'}`}>
                          {format(day, 'd')}
                          {overdueForDay > 0 && inMonth && (
                            <span className={`mt-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold ${isSelected ? 'bg-destructive/80 text-destructive-foreground' : 'bg-destructive/15 text-destructive'}`}>{overdueForDay}</span>
                          )}
                          {count > 0 && overdueForDay === 0 && inMonth && (
                            <span className={`mt-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold ${isSelected ? 'bg-primary-foreground/30 text-primary-foreground' : 'bg-primary/20 text-primary'}`}>{count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">UPCOMING</p>
                    {Object.entries(taskCounts).filter(([d]) => d >= format(new Date(), 'yyyy-MM-dd')).sort(([a], [b]) => a.localeCompare(b)).slice(0, 5).map(([date, count]) => (
                      <button key={date} onClick={() => setSelectedDate(new Date(date + 'T12:00:00'))} className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs transition-colors hover:bg-secondary">
                        <span className="text-muted-foreground">{format(new Date(date + 'T12:00:00'), 'EEE, MMM d')}</span>
                        <Badge variant="outline" className="bg-primary/10 text-[10px] text-primary">{count} tasks</Badge>
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Tasks for selected date */}
                <div className="lg:col-span-2">
                  {selectedDate ? (
                    <>
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-bold">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h3>
                        </div>
                        <button onClick={() => setSelectedDate(null)} className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><X className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="space-y-2">
                        {tasks.filter(t => t.dueDate.startsWith(format(selectedDate, 'yyyy-MM-dd'))).length === 0 ? (
                          <Card className="border-border bg-card p-8 text-center">
                            <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
                            <p className="text-xs text-muted-foreground">No tasks for this date</p>
                          </Card>
                        ) : tasks.filter(t => t.dueDate.startsWith(format(selectedDate, 'yyyy-MM-dd'))).map((task, i) => renderTaskCard(task, i))}
                      </div>
                    </>
                  ) : (
                    <Card className="border-border bg-card p-12 text-center">
                      <CalendarIcon className="mx-auto mb-3 h-12 w-12 text-muted-foreground/20" />
                      <p className="text-sm font-medium text-muted-foreground">Select a date on the calendar</p>
                      <p className="mt-1 text-xs text-muted-foreground/60">Click any date to view tasks scheduled for that day</p>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── PROSPECT LISTS TAB ── */}
            <TabsContent value="lists" className="mt-0">
              <ProspectLists />
            </TabsContent>

            {/* ── PROSPECTS TAB ── */}
            <TabsContent value="prospects" className="mt-0">
              {(() => {
                const todayDate = format(new Date(), 'yyyy-MM-dd');
                const activeTasks = tasks.filter(t => !t.completed && t.tenantId);
                const prospectMap = new Map<string, { tenantId: string; buildingId: string; tenantName: string; taskCount: number; overdueCount: number; nextDue: string }>();
                activeTasks.forEach(t => {
                  const info = getTenantInfo(t);
                  // Try building tenant name, then mock buildings, then custom prospects, then parse from title
                  let name = info?.tenant?.name;
                  if (!name) {
                    const mockBuilding = buildings.find(b => b.id === t.buildingId);
                    const mockTenant = mockBuilding?.tenants.find(tn => tn.id === t.tenantId);
                    name = mockTenant?.name;
                  }
                  if (!name) {
                    const cp = getCustomProspects().find(p => p.id === t.tenantId);
                    name = cp?.name;
                  }
                  if (!name) {
                    name = t.title.match(/(?:with|for|to)\s+(.+)/i)?.[1] || t.title || 'Unknown';
                  }
                  const existing = prospectMap.get(t.tenantId!);
                  const isOverdue = t.dueDate < todayDate;
                  if (existing) {
                    existing.taskCount++;
                    if (isOverdue) existing.overdueCount++;
                    if (t.dueDate < existing.nextDue) existing.nextDue = t.dueDate;
                  } else {
                    prospectMap.set(t.tenantId!, {
                      tenantId: t.tenantId!,
                      buildingId: t.buildingId || '',
                      tenantName: name,
                      taskCount: 1,
                      overdueCount: isOverdue ? 1 : 0,
                      nextDue: t.dueDate,
                    });
                  }
                });
                const prospects = Array.from(prospectMap.values()).sort((a, b) => {
                  if (a.overdueCount > 0 && b.overdueCount === 0) return -1;
                  if (b.overdueCount > 0 && a.overdueCount === 0) return 1;
                  return a.nextDue.localeCompare(b.nextDue);
                });

                if (prospects.length === 0) {
                  return (
                    <Card className="border-border bg-card p-12 text-center">
                      <User className="mx-auto mb-3 h-12 w-12 text-muted-foreground/20" />
                      <p className="text-sm font-medium text-muted-foreground">No active prospects</p>
                      <p className="mt-1 text-xs text-muted-foreground/60">Prospects with overdue or upcoming tasks will appear here automatically</p>
                    </Card>
                  );
                }

                return (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">{prospects.length} prospect{prospects.length !== 1 ? 's' : ''} with active tasks</p>
                    {prospects.map((p, i) => {
                      const isOverdue = p.overdueCount > 0;
                      return (
                        <motion.div key={p.tenantId} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                          <Card
                            className={`border-border bg-card p-3 transition-colors cursor-pointer hover:border-primary/30 ${isOverdue ? 'border-destructive/30' : ''}`}
                            onClick={() => {
                              if (p.buildingId) navigate(`/building/${p.buildingId}/tenant/${p.tenantId}`);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isOverdue ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                                <Building2 className={`h-4 w-4 ${isOverdue ? 'text-destructive' : 'text-primary'}`} />
                              </div>
                              <p className="text-sm font-medium text-foreground truncate">{p.tenantName}</p>
                              <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Tasks;
