
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganizationId } from '@/hooks/useOrganization';
import { embedAfterSave } from '@/hooks/useAskDealflow';
import { notifyTaskAssignedEmail } from '@/lib/notifyTaskAssigned';

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskType = 'follow_up' | 'call' | 'meeting' | 'email' | 'research' | 'other';
export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'completed';

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
  status: TaskStatus;
  createdAt: string;
  assignedTo?: string;
  assignedBy?: string;
  assignedToName?: string;
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
  status: string;
  created_at: string;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_to_name: string | null;
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
  status: (r.status || (r.completed ? 'completed' : 'not_started')) as TaskStatus,
  createdAt: r.created_at,
  assignedTo: r.assigned_to || undefined,
  assignedBy: r.assigned_by || undefined,
  assignedToName: r.assigned_to_name || undefined,
});

async function logTaskActivity(taskId: string, action: string, detail: Record<string, unknown> = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    await supabase.from('task_activity').insert({
      task_id: taskId,
      user_id: user.id,
      user_name: profile?.full_name || user.email || '',
      action,
      detail,
    });
  } catch { /* non-blocking */ }
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const orgId = useOrganizationId();

  const fetchTasks = useCallback(async () => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Fetch tasks: either unassigned (team-wide), assigned to me, or created by me
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) {
      toast.error('Failed to load tasks');
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
        { title: 'Follow up with McKinsey on space study', description: 'Check on their space study progress', type: 'follow_up', priority: 'high', due_date: today, completed: false, ...(orgId ? { organization_id: orgId } : {}) },
        { title: 'Prepare meeting brief for Deloitte', description: 'Pull comps and market data', type: 'meeting', priority: 'medium', due_date: tomorrow, completed: false, ...(orgId ? { organization_id: orgId } : {}) },
        { title: 'Send lease comp package to Amazon', description: 'Include East End and NoMa options', type: 'email', priority: 'medium', due_date: tomorrow, completed: false, ...(orgId ? { organization_id: orgId } : {}) },
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        // Check if a new task was just assigned to current user
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new as DbRow;
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && row.assigned_to === user.id && row.assigned_by !== user.id) {
              // Dispatch custom event for notification
              window.dispatchEvent(new CustomEvent('task-assigned', {
                detail: { title: row.title, assignedToName: row.assigned_to_name }
              }));
            }
          });
        }
        fetchTasks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks]);

  const addTask = useCallback(async (task: {
    title: string; description: string; type: TaskType; priority: TaskPriority; dueDate: string;
    tenantId?: string; buildingId?: string; assignedTo?: string; assignedToName?: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();

    const row: Record<string, unknown> = {
      title: task.title.trim(),
      description: task.description.trim(),
      type: task.type,
      priority: task.priority,
      due_date: task.dueDate,
      completed: false,
      status: 'not_started',
      tenant_id: task.tenantId || null,
      building_id: task.buildingId || null,
    };

    if (task.assignedTo) {
      row.assigned_to = task.assignedTo;
      row.assigned_to_name = task.assignedToName || '';
      if (user?.id && task.assignedTo !== user.id) {
        row.assigned_by = user.id;
      }
    }

    if (orgId) row.organization_id = orgId;

    const { data, error } = await supabase.from('tasks').insert(row).select('*').single();
    if (error) {
      toast.error('Failed to create task');
      return null;
    }
    if (data) {
      const newTask = rowToTask(data as unknown as DbRow);
      setTasks(prev => [newTask, ...prev]);
      logTaskActivity(data.id, 'created', { title: task.title });
      if (task.assignedTo && user?.id && task.assignedTo !== user.id) {
        logTaskActivity(data.id, 'assigned', { assigned_to: task.assignedTo, assigned_to_name: task.assignedToName });
        notifyTaskAssignedEmail(data.id);
      }
      embedAfterSave('activity', data.id, {
        type: task.type,
        title: task.title,
        description: task.description,
        tenant_id: task.tenantId,
        timestamp: new Date().toISOString(),
      });
      return newTask;
    }
    return null;
  }, []);

  const updateTask = useCallback(async (id: string, updates: Partial<{ completed: boolean; status: TaskStatus; title: string; description: string; priority: TaskPriority; dueDate: string; assignedTo: string; assignedToName: string }>) => {
    const dbUpdates: Record<string, unknown> = {};
    let newAssignedBy: string | undefined;
    if (updates.completed !== undefined) dbUpdates.completed = updates.completed;
    if (updates.status !== undefined) {
      dbUpdates.status = updates.status;
      dbUpdates.completed = updates.status === 'completed';
    }
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.assignedTo !== undefined) {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      dbUpdates.assigned_to = updates.assignedTo || null;
      dbUpdates.assigned_to_name = updates.assignedToName || '';
      if (updates.assignedTo && currentUser && updates.assignedTo !== currentUser.id) {
        dbUpdates.assigned_by = currentUser.id;
        newAssignedBy = currentUser.id;
      } else {
        dbUpdates.assigned_by = null;
        newAssignedBy = undefined;
      }
    }
    // Sync: if completed toggled via checkbox, also update status
    if (updates.completed !== undefined && updates.status === undefined) {
      dbUpdates.status = updates.completed ? 'completed' : 'not_started';
    }

    const { error } = await supabase.from('tasks').update(dbUpdates as Record<string, unknown>).eq('id', id);
    if (error) {
      toast.error('Failed to update task');
      return;
    }
    {
      const task = tasks.find(t => t.id === id);
      const prevAssignedTo = task?.assignedTo;
      setTasks(prev => prev.map(t => {
        if (t.id !== id) return t;
        const next = { ...t, ...updates };
        if (updates.dueDate !== undefined) next.dueDate = updates.dueDate;
        if (updates.status !== undefined) {
          next.status = updates.status;
          next.completed = updates.status === 'completed';
        }
        if (updates.completed !== undefined && updates.status === undefined) {
          next.status = updates.completed ? 'completed' : 'not_started';
        }
        if (updates.assignedTo !== undefined) {
          next.assignedTo = updates.assignedTo || undefined;
          next.assignedToName = updates.assignedToName || undefined;
          next.assignedBy = newAssignedBy;
        }
        return next;
      }));

      // Log activity
      if (updates.status !== undefined) {
        logTaskActivity(id, 'status_changed', { from: task?.status, to: updates.status });
      } else if (updates.completed !== undefined) {
        logTaskActivity(id, updates.completed ? 'completed' : 'reopened', {});
      }
      if (updates.assignedTo !== undefined) {
        const isReassign = prevAssignedTo && prevAssignedTo !== updates.assignedTo;
        logTaskActivity(id, isReassign ? 'reassigned' : 'assigned', {
          from: prevAssignedTo,
          assigned_to: updates.assignedTo,
          assigned_to_name: updates.assignedToName,
        });
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u && updates.assignedTo && updates.assignedTo !== u.id) {
          notifyTaskAssignedEmail(id);
        }
      }

      // Auto-digest: feed task completion to AI brain
      const isCompleted = updates.completed === true || updates.status === 'completed';
      if (isCompleted && task) {
        const { digestEvent } = await import('@/lib/autoDigest');
        digestEvent('task_completed', {
          title: task.title,
          description: task.description,
          type: task.type,
          priority: task.priority,
          tenantId: task.tenantId || '',
          daysToComplete: Math.round((Date.now() - new Date(task.createdAt).getTime()) / 86400000),
        });
      }
    }
  }, [tasks]);

  const bulkAssign = useCallback(async (taskIds: string[], assignedTo: string, assignedToName: string) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const dbUpdates: Record<string, unknown> = {
      assigned_to: assignedTo,
      assigned_to_name: assignedToName,
      assigned_by: currentUser?.id || null,
    };
    const { error } = await supabase.from('tasks').update(dbUpdates).in('id', taskIds);
    if (error) {
      toast.error('Failed to bulk assign tasks');
      return;
    }
    setTasks(prev => prev.map(t => {
      if (!taskIds.includes(t.id)) return t;
      return { ...t, assignedTo, assignedToName, assignedBy: currentUser?.id };
    }));
    for (const id of taskIds) {
      logTaskActivity(id, 'assigned', { assigned_to: assignedTo, assigned_to_name: assignedToName });
      notifyTaskAssignedEmail(id);
    }
    toast.success(`Assigned ${taskIds.length} task${taskIds.length > 1 ? 's' : ''} to ${assignedToName}`);
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete task');
      return;
    }
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  return { tasks, loading, addTask, updateTask, deleteTask, bulkAssign, refetch: fetchTasks };
}
