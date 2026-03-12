import { supabase } from '@/integrations/supabase/client';

// Maps activity types to task types for matching
const activityToTaskTypeMap: Record<string, string[]> = {
  email_sent: ['email'],
  ai_email: ['email'],
  call: ['call'],
  meeting: ['meeting'],
  note: [],
  stage_change: [],
  task_created: [],
};

/**
 * When an activity is logged for a tenant, find any pending tasks
 * that match the same tenant + compatible type, and mark them complete.
 * Returns the number of tasks auto-completed.
 */
export async function autoCompleteTasks(
  tenantId: string,
  activityType: string
): Promise<{ completedCount: number; taskTitles: string[] }> {
  if (!tenantId) return { completedCount: 0, taskTitles: [] };

  const matchingTaskTypes = activityToTaskTypeMap[activityType];
  if (!matchingTaskTypes || matchingTaskTypes.length === 0) {
    return { completedCount: 0, taskTitles: [] };
  }

  try {
    // Find pending tasks for this tenant with matching type
    const { data: pendingTasks, error: fetchErr } = await supabase
      .from('tasks')
      .select('id, title, type')
      .eq('tenant_id', tenantId)
      .eq('completed', false)
      .in('type', matchingTaskTypes);

    if (fetchErr || !pendingTasks || pendingTasks.length === 0) {
      return { completedCount: 0, taskTitles: [] };
    }

    // Complete the most relevant task (earliest due / first match)
    // We complete just the first matching task to avoid accidentally closing unrelated ones
    const taskToComplete = pendingTasks[0];
    
    const { error: updateErr } = await supabase
      .from('tasks')
      .update({ completed: true })
      .eq('id', taskToComplete.id);

    if (updateErr) {
      console.error('Failed to auto-complete task:', updateErr);
      return { completedCount: 0, taskTitles: [] };
    }

    return {
      completedCount: 1,
      taskTitles: [taskToComplete.title],
    };
  } catch (err) {
    console.error('autoCompleteTasks error:', err);
    return { completedCount: 0, taskTitles: [] };
  }
}
