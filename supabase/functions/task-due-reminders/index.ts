import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Scheduled edge function: sends email reminders for tasks due today or overdue.
 * Invoke via cron (e.g. daily at 8am) or manual POST.
 * Requires: RESEND_API_KEY, RESEND_FROM, APP_URL
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_resend" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const today = new Date().toISOString().slice(0, 10);

    // Fetch tasks that are due today or overdue, not completed, and assigned to someone
    const { data: tasks, error } = await admin
      .from("tasks")
      .select("id, title, description, due_date, assigned_to, assigned_to_name, assigned_by, priority")
      .eq("completed", false)
      .not("assigned_to", "is", null)
      .lte("due_date", today + "T23:59:59Z")
      .order("due_date", { ascending: true });

    if (error) {
      console.error("task-due-reminders: query error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No tasks due" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group tasks by assignee
    const byAssignee = new Map<string, typeof tasks>();
    for (const task of tasks) {
      const list = byAssignee.get(task.assigned_to) || [];
      list.push(task);
      byAssignee.set(task.assigned_to, list);
    }

    const appUrl = (Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "http://localhost:5173").replace(/\/$/, "");
    const from = Deno.env.get("RESEND_FROM") || "DealFlow <onboarding@resend.dev>";
    let sentCount = 0;

    for (const [userId, userTasks] of byAssignee) {
      // Get assignee email
      const { data: profile } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .single();

      if (!profile?.email) continue;

      const overdue = userTasks.filter(t => t.due_date.slice(0, 10) < today);
      const dueToday = userTasks.filter(t => t.due_date.slice(0, 10) === today);

      const taskRows = [...overdue, ...dueToday].map(t => {
        const isOverdue = t.due_date.slice(0, 10) < today;
        const priority = (t.priority || "medium").toUpperCase();
        return `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(t.title)}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #eee">${priority}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #eee;${isOverdue ? 'color:#dc2626;font-weight:600' : ''}">${isOverdue ? 'OVERDUE' : 'Today'}</td>
        </tr>`;
      }).join("\n");

      const subject = overdue.length > 0
        ? `[DealFlow] ${overdue.length} overdue + ${dueToday.length} due today`
        : `[DealFlow] ${dueToday.length} task${dueToday.length > 1 ? "s" : ""} due today`;

      const html = `
        <p>Hi ${escapeHtml(profile.full_name || "there")},</p>
        <p>Here's your task summary for today:</p>
        ${overdue.length > 0 ? `<p style="color:#dc2626;font-weight:600">${overdue.length} overdue task${overdue.length > 1 ? "s" : ""} need attention.</p>` : ""}
        <table style="border-collapse:collapse;width:100%;max-width:500px">
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Task</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Priority</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Status</th>
          </tr>
          ${taskRows}
        </table>
        <p style="margin-top:16px"><a href="${appUrl}/tasks" style="color:#2563eb">Open Tasks in DealFlow</a></p>
      `;

      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [profile.email], subject, html }),
      });

      if (r.ok) {
        sentCount++;
      } else {
        console.error("Resend error for", profile.email, r.status, await r.text());
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, tasks: tasks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("task-due-reminders:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
