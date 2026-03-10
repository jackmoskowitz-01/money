import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Check, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Phone, Mail, Users, Search, StickyNote, MoreHorizontal, List, AlertTriangle, ArrowRight, ArrowDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { buildings } from '@/data/mockData';
import {
  getTasks, addTask, updateTask, deleteTask, getTaskCountsByDate,
  type BrokerTask, type TaskPriority,
} from '@/data/activityData';
import ProspectLists from '@/components/ProspectLists';

const taskTypeIcons: Record<string, typeof Phone> = {
  follow_up: MoreHorizontal,
  call: Phone,
  meeting: Users,
  email: Mail,
  research: Search,
  other: StickyNote,
};

const taskTypeColors: Record<string, string> = {
  follow_up: 'bg-primary/20 text-primary',
  call: 'bg-info/20 text-info',
  meeting: 'bg-success/20 text-success',
  email: 'bg-warning/20 text-warning',
  research: 'bg-accent/20 text-accent',
  other: 'bg-muted text-muted-foreground',
};

const priorityConfig: Record<TaskPriority, { icon: typeof AlertTriangle; label: string; class: string; sortOrder: number }> = {
  high: { icon: AlertTriangle, label: 'High', class: 'text-destructive bg-destructive/10 border-destructive/30', sortOrder: 0 },
  medium: { icon: ArrowRight, label: 'Med', class: 'text-warning bg-warning/10 border-warning/30', sortOrder: 1 },
  low: { icon: ArrowDown, label: 'Low', class: 'text-muted-foreground bg-muted border-border', sortOrder: 2 },
};

const Tasks = () => {
  const [tasks, setTasks] = useState<BrokerTask[]>(() => getTasks());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', type: 'follow_up' as BrokerTask['type'], priority: 'medium' as TaskPriority, dueDate: format(new Date(), 'yyyy-MM-dd') });
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.filter(t => !t.completed).forEach(t => {
      const date = t.dueDate.split('T')[0];
      counts[date] = (counts[date] || 0) + 1;
    });
    return counts;
  }, [tasks]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const filteredTasks = useMemo(() => {
    let t = tasks;
    if (filter === 'pending') t = t.filter(x => !x.completed);
    if (filter === 'completed') t = t.filter(x => x.completed);
    if (selectedDate) t = t.filter(x => x.dueDate.startsWith(format(selectedDate, 'yyyy-MM-dd')));
    return t.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, filter, selectedDate]);

  const handleAdd = () => {
    if (!newTask.title.trim()) return;
    const task = addTask({ ...newTask, completed: false });
    setTasks([task, ...tasks]);
    setNewTask({ title: '', description: '', type: 'follow_up', dueDate: format(new Date(), 'yyyy-MM-dd') });
    setShowForm(false);
  };

  const handleToggle = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    updateTask(id, { completed: !task.completed });
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleDelete = (id: string) => {
    deleteTask(id);
    setTasks(tasks.filter(t => t.id !== id));
  };

  const getTenantInfo = (task: BrokerTask) => {
    if (!task.tenantId || !task.buildingId) return null;
    const building = buildings.find(b => b.id === task.buildingId);
    const tenant = building?.tenants.find(t => t.id === task.tenantId);
    return tenant ? { tenant, building } : null;
  };

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Tasks & Calendar</h1>
          </div>

          <Tabs defaultValue="tasks" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="tasks" className="gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" /> Tasks
              </TabsTrigger>
              <TabsTrigger value="lists" className="gap-1.5">
                <List className="h-3.5 w-3.5" /> Lists
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tasks">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {tasks.filter(t => !t.completed).length} pending · {tasks.filter(t => t.completed).length} completed
                </p>
                <Button size="sm" onClick={() => setShowForm(!showForm)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> New Task
                </Button>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Calendar */}
                <Card className="border-border bg-card p-4 lg:col-span-1">
                  <div className="mb-4 flex items-center justify-between">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <h3 className="font-display text-sm font-bold">{format(currentMonth, 'MMMM yyyy')}</h3>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="py-1">{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {calDays.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const count = taskCounts[dateStr] || 0;
                      const isSelected = selectedDate && isSameDay(day, selectedDate);
                      const isToday = isSameDay(day, new Date());
                      const inMonth = isSameMonth(day, currentMonth);

                      return (
                        <button
                          key={dateStr}
                          onClick={() => setSelectedDate(isSelected ? null : day)}
                          className={`relative flex flex-col items-center rounded-md py-1.5 text-xs transition-colors ${
                            !inMonth ? 'text-muted-foreground/30' :
                            isSelected ? 'bg-primary text-primary-foreground' :
                            isToday ? 'bg-primary/10 text-primary font-bold' :
                            'text-foreground hover:bg-secondary'
                          }`}
                        >
                          {format(day, 'd')}
                          {count > 0 && inMonth && (
                            <span className={`mt-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                              isSelected ? 'bg-primary-foreground/30 text-primary-foreground' : 'bg-primary/20 text-primary'
                            }`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">UPCOMING</p>
                    {Object.entries(taskCounts)
                      .filter(([d]) => d >= format(new Date(), 'yyyy-MM-dd'))
                      .sort(([a], [b]) => a.localeCompare(b))
                      .slice(0, 5)
                      .map(([date, count]) => (
                        <button
                          key={date}
                          onClick={() => setSelectedDate(new Date(date + 'T12:00:00'))}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs transition-colors hover:bg-secondary"
                        >
                          <span className="text-muted-foreground">{format(new Date(date + 'T12:00:00'), 'EEE, MMM d')}</span>
                          <Badge variant="outline" className="bg-primary/10 text-[10px] text-primary">{count} tasks</Badge>
                        </button>
                      ))}
                  </div>
                </Card>

                {/* Tasks List */}
                <div className="lg:col-span-2">
                  <div className="mb-4 flex items-center gap-2">
                    {(['all', 'pending', 'completed'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                          filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                    {selectedDate && (
                      <Badge variant="outline" className="ml-auto cursor-pointer text-xs" onClick={() => setSelectedDate(null)}>
                        {format(selectedDate, 'MMM d, yyyy')} ✕
                      </Badge>
                    )}
                  </div>

                  {showForm && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <Card className="mb-4 border-primary/30 bg-card p-4">
                        <Input
                          placeholder="Task title..."
                          value={newTask.title}
                          onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                          className="mb-3 border-border bg-secondary/50"
                        />
                        <Textarea
                          placeholder="Description..."
                          value={newTask.description}
                          onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                          className="mb-3 min-h-[60px] border-border bg-secondary/50"
                        />
                        <div className="mb-3 flex flex-wrap gap-2">
                          {Object.entries(taskTypeIcons).map(([type, Icon]) => (
                            <button
                              key={type}
                              onClick={() => setNewTask({ ...newTask, type: type as BrokerTask['type'] })}
                              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                newTask.type === type
                                  ? taskTypeColors[type]
                                  : 'bg-secondary text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              <Icon className="h-3 w-3" />
                              {type.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                        <div className="mb-3">
                          <label className="mb-1 block text-xs text-muted-foreground">Due Date</label>
                          <Input
                            type="date"
                            value={newTask.dueDate}
                            onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                            className="w-48 border-border bg-secondary/50"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                          <Button size="sm" onClick={handleAdd}>Create Task</Button>
                        </div>
                      </Card>
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    {filteredTasks.length === 0 ? (
                      <Card className="border-border bg-card p-8 text-center">
                        <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">No tasks {selectedDate ? 'for this date' : 'found'}</p>
                      </Card>
                    ) : (
                      filteredTasks.map((task, i) => {
                        const Icon = taskTypeIcons[task.type] || StickyNote;
                        const info = getTenantInfo(task);
                        const isOverdue = !task.completed && task.dueDate < format(new Date(), 'yyyy-MM-dd');

                        return (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.02 }}
                          >
                            <Card className={`border-border bg-card p-3 transition-colors ${task.completed ? 'opacity-60' : ''} ${isOverdue ? 'border-destructive/30' : ''}`}>
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => handleToggle(task.id)}
                                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                    task.completed ? 'border-success bg-success/20 text-success' : 'border-border hover:border-primary'
                                  }`}
                                >
                                  {task.completed && <Check className="h-3 w-3" />}
                                </button>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className={`text-sm font-medium ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                      {task.title}
                                    </p>
                                    <Badge variant="outline" className={`text-[10px] ${taskTypeColors[task.type]}`}>
                                      <Icon className="mr-1 h-2.5 w-2.5" />
                                      {task.type.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  {task.description && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p>
                                  )}
                                  <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                                    <span className={isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                                      {isOverdue ? '⚠ Overdue: ' : ''}
                                      {format(new Date(task.dueDate + 'T12:00:00'), 'EEE, MMM d')}
                                    </span>
                                    {info && (
                                      <span className="text-muted-foreground/60">
                                        {info.tenant.name} · {info.building!.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDelete(task.id)}
                                  className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </Card>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="lists">
              <ProspectLists />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Tasks;
