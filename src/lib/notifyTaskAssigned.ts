import { getAuthToken } from '@/lib/getAuthToken';

/**
 * Fire-and-forget: emails the assignee when RESEND_API_KEY + APP_URL are configured
 * on the notify-task-assigned edge function. Safe to call without awaiting UX.
 */
export function notifyTaskAssignedEmail(taskId: string): void {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base || !taskId) return;

  void (async () => {
    try {
      const token = await getAuthToken();
      await fetch(`${base.replace(/\/$/, '')}/functions/v1/notify-task-assigned`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ task_id: taskId }),
      });
    } catch {
      /* non-blocking */
    }
  })();
}
