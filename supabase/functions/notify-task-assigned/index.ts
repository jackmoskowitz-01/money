import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!anonKey) {
      console.error("notify-task-assigned: SUPABASE_ANON_KEY missing");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    let body: { task_id?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const taskId = body.task_id;
    if (!taskId || typeof taskId !== "string") {
      return new Response(JSON.stringify({ error: "task_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: task, error: taskErr } = await admin
      .from("tasks")
      .select("id,title,description,due_date,assigned_to,assigned_by,assigned_to_name")
      .eq("id", taskId)
      .single();

    if (taskErr || !task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (task.assigned_by !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!task.assigned_to || task.assigned_to === user.id) {
      return new Response(JSON.stringify({ skipped: true, reason: "not_delegated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_resend" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: assigneeProfile } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", task.assigned_to)
      .single();

    const { data: assignerProfile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    if (!assigneeProfile?.email) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_assignee_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = (Deno.env.get("APP_URL") || Deno.env.get("SITE_URL") || "http://localhost:5173").replace(/\/$/, "");
    const tasksUrl = `${appUrl}/tasks`;
    const assignerName = assignerProfile?.full_name || assignerProfile?.email || "A teammate";
    const due = task.due_date
      ? new Date(task.due_date).toISOString().slice(0, 10)
      : "";

    const subject = `[DealFlow] ${assignerName} assigned you: ${task.title}`;
    const safeDesc = (task.description || "").slice(0, 2000);
    const html = `
      <p><strong>${assignerName}</strong> assigned you a task in DealFlow.</p>
      <p><strong>${escapeHtml(task.title)}</strong></p>
      ${safeDesc ? `<p>${escapeHtml(safeDesc).replace(/\n/g, "<br/>")}</p>` : ""}
      ${due ? `<p>Due: <strong>${due}</strong></p>` : ""}
      <p><a href="${tasksUrl}">Open Tasks</a></p>
    `;

    const from = Deno.env.get("RESEND_FROM") || "DealFlow <onboarding@resend.dev>";

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [assigneeProfile.email],
        subject,
        html,
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("Resend error:", r.status, t);
      return new Response(JSON.stringify({ error: "Email provider error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-task-assigned:", e);
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
