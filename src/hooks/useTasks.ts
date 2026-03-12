import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskType = 'follow_up' | 'call' | 'meeting' | 'email' | 'research' | 'other';

export type Task = {
  id: string;
  tenantId?: string;
  buildingId?: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  dueDate: string;
  completed: boolean;
  createdAt: string;
};

type DbRow = {
  id: string;
  tenant_id: string | null;
  building_id: string | null;
  title: string;
  description: string;
  type: string;
  priority: string;
  due_date: string;
  completed: boolean;
  created_at: string;
};

const rowToTask = (r: DbRow): Task => ({
  id: r.id,
  tenantId: r.tenant_id || undefined,
  buildingId: r.building_id || undefined,
  title: r.title,
  description: r.description,
  type: (r.type || 'other') as TaskType,
  priority: (r.priority || 'medium') as TaskPriority,
  dueDate: r.due_date?.split('T')[0] || new Date().toISOString().split('T')[0],
  completed: r.completed,
  createdAt: r.created_at,
});

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      setLoading(false);
      return;
    }

    const rows = (data || []) as unknown as DbRow[];
    const items = rows.map(rowToTask);

    // Seed some default tasks if empty
    if (items.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const seedRows = [
        { title: 'Follow up with McKinsey on space study', description: 'Check on their space study progress', type: 'follow_up', priority: 'high', due_date: today, completed: false },
        { title: 'Prepare meeting brief for Deloitte', description: 'Pull comps and market data', type: 'meeting', priority: 'medium', due_date: tomorrow, completed: false },
        { title: 'Send lease comp package to Amazon', description: 'Include East End and NoMa options', type: 'email', priority: 'medium', due_date: tomorrow, completed: false },
      ];

      const { data: inserted } = await supabase.from('tasks').insert(seedRows).select('*');
      if (inserted) {
        setTasks((inserted as unknown as DbRow[]).map(rowToTask));
      }
    } else {
      setTasks(items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks]);

  const addTask = useCallback(async (task: {
    title: string; description: string; type: TaskType; priority: TaskPriority; dueDate: string;
    tenantId?: string; buildingId?: string;
  }) => {
    const row = {
      title: task.title.trim(),
      description: task.description.trim(),
      type: task.type,
      priority: task.priority,
      due_date: task.dueDate,
      completed: false,
      tenant_id: task.tenantId || null,
      building_id: task.buildingId || null,
    };

    const { data, error } = await supabase.from('tasks').insert(row).select('*').single();
    if (!error && data) {
      const newTask = rowToTask(data as unknown as DbRow);
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    }
    return null;
  }, []);

  const updateTask = useCallback(async (id: string, updates: Partial<{ completed: boolean; title: string; description: string; priority: TaskPriority; dueDate: string }>) => {
    const dbUpdates: Record<string, any> = {};
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;

    const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', id);
    if (!error) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  }, []);

  return { tasks, loading, addTask, updateTask, deleteTask, refetch: fetchTasks };
}
