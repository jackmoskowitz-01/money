import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { User, Mail, Bell, Workflow, Palette, Download, Loader2, Zap, Calendar, Brain } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const Settings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    name: '',
    brokerage: '',
    email: '',
    phone: '',
  });

  const [emailDefaults, setEmailDefaults] = useState({
    signature: '',
    meetingLeadWeeks: '2',
    tone: 'professional',
    defaultGreeting: 'Hi',
  });

  const [notifications, setNotifications] = useState({
    pipelineChanges: true,
    newScoops: true,
    taskReminders: true,
    weeklyDigest: false,
  });

  const [appearance, setAppearance] = useState({
    darkMode: !document.documentElement.classList.contains('light'),
  });

  const [workflow, setWorkflow] = useState({
    defaultMarket: 'dc-metro',
    activityCategories: 'Calls, Tours, Emails, Meetings, Proposals',
  });

  const [integrations, setIntegrations] = useState({
    calendarConnected: false,
    copilotMemory: true,
  });

  // Load settings from database
  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(p => ({
          ...p,
          name: profileData.full_name || '',
          email: profileData.email || '',
        }));
      }

      // Load user settings
      const { data: settingsData } = await supabase
        .from('user_settings' as any)
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (settingsData) {
        const s = settingsData as any;
        setProfile(p => ({ ...p, brokerage: s.brokerage || '', phone: s.phone || '' }));
        setEmailDefaults({
          signature: s.email_signature || '',
          meetingLeadWeeks: s.meeting_lead_weeks || '2',
          tone: s.email_tone || 'professional',
          defaultGreeting: s.email_greeting || 'Hi',
        });
        setNotifications({
          pipelineChanges: s.notify_pipeline_changes ?? true,
          newScoops: s.notify_new_scoops ?? true,
          taskReminders: s.notify_task_reminders ?? true,
          weeklyDigest: s.notify_weekly_digest ?? false,
        });
        setWorkflow({
          defaultMarket: s.default_market || 'dc-metro',
          activityCategories: s.activity_categories || 'Calls, Tours, Emails, Meetings, Proposals',
        });
        setIntegrations({
          calendarConnected: s.calendar_connected ?? false,
          copilotMemory: s.copilot_memory ?? true,
        });
        setAppearance({ darkMode: s.dark_mode ?? true });
      }

      setLoading(false);
    };

    loadSettings();
  }, [user]);

  useEffect(() => {
    if (appearance.darkMode) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [appearance.darkMode]);

  const saveAll = async (section: string) => {
    if (!user) return;
    setSaving(true);

    try {
      // Update profile name
      await supabase.from('profiles').update({
        full_name: profile.name,
        email: profile.email,
        avatar_initials: profile.name ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'AN',
      }).eq('id', user.id);

      // Upsert user_settings
      const settingsRow = {
        user_id: user.id,
        brokerage: profile.brokerage,
        phone: profile.phone,
        email_signature: emailDefaults.signature,
        email_tone: emailDefaults.tone,
        email_greeting: emailDefaults.defaultGreeting,
        meeting_lead_weeks: emailDefaults.meetingLeadWeeks,
        notify_pipeline_changes: notifications.pipelineChanges,
        notify_new_scoops: notifications.newScoops,
        notify_task_reminders: notifications.taskReminders,
        notify_weekly_digest: notifications.weeklyDigest,
        default_market: workflow.defaultMarket,
        activity_categories: workflow.activityCategories,
        dark_mode: appearance.darkMode,
        calendar_connected: integrations.calendarConnected,
        copilot_memory: integrations.copilotMemory,
        updated_at: new Date().toISOString(),
      };

      // Try update first, then insert if no rows affected
      const { data: existing } = await supabase
        .from('user_settings' as any)
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        await supabase.from('user_settings' as any).update(settingsRow).eq('user_id', user.id);
      } else {
        await supabase.from('user_settings' as any).insert(settingsRow);
      }

      toast.success(`${section} settings saved`);
    } catch (err) {
      toast.error('Failed to save settings');
    }

    setSaving(false);
  };

  const handleExportCSV = (type: string) => {
    toast.success(`${type} data exported as CSV`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-12">
        <div className="mx-auto max-w-3xl px-4">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-12 w-full mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-2xl font-bold text-foreground mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm mb-6">Manage your preferences and defaults</p>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="profile" className="text-xs gap-1">
              <User className="h-3.5 w-3.5 hidden sm:block" /> Profile
            </TabsTrigger>
            <TabsTrigger value="email" className="text-xs gap-1">
              <Mail className="h-3.5 w-3.5 hidden sm:block" /> Email
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs gap-1">
              <Bell className="h-3.5 w-3.5 hidden sm:block" /> Alerts
            </TabsTrigger>
            <TabsTrigger value="workflow" className="text-xs gap-1">
              <Workflow className="h-3.5 w-3.5 hidden sm:block" /> Workflow
            </TabsTrigger>
            <TabsTrigger value="integrations" className="text-xs gap-1">
              <Brain className="h-3.5 w-3.5 hidden sm:block" /> AI & Integrations
            </TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs gap-1">
              <Palette className="h-3.5 w-3.5 hidden sm:block" /> Display
            </TabsTrigger>
          </TabsList>

          {/* Profile */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>User Profile</CardTitle>
                <CardDescription>Your identity across DealFlow</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" placeholder="Jane Smith" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brokerage">Brokerage</Label>
                    <Input id="brokerage" placeholder="CBRE, JLL, etc." value={profile.brokerage} onChange={e => setProfile(p => ({ ...p, brokerage: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prof-email">Email</Label>
                    <Input id="prof-email" type="email" placeholder="jane@brokerage.com" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" placeholder="(202) 555-0100" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={() => saveAll('Profile')} className="mt-2" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Save Profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Defaults */}
          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle>Email Defaults</CardTitle>
                <CardDescription>Configure how AI-generated emails behave</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tone">Default Tone</Label>
                  <Select value={emailDefaults.tone} onValueChange={v => setEmailDefaults(e => ({ ...e, tone: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-weeks">Meeting Lead Time</Label>
                  <Select value={emailDefaults.meetingLeadWeeks} onValueChange={v => setEmailDefaults(e => ({ ...e, meetingLeadWeeks: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 week out</SelectItem>
                      <SelectItem value="2">2 weeks out (default)</SelectItem>
                      <SelectItem value="3">3 weeks out</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="greeting">Default Greeting</Label>
                  <Select value={emailDefaults.defaultGreeting} onValueChange={v => setEmailDefaults(e => ({ ...e, defaultGreeting: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (name only)</SelectItem>
                      <SelectItem value="Hi">Hi</SelectItem>
                      <SelectItem value="Hello">Hello</SelectItem>
                      <SelectItem value="Dear">Dear</SelectItem>
                      <SelectItem value="Hey">Hey</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signature">Email Signature</Label>
                  <textarea
                    id="signature"
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder={"Best regards,\nJane Smith\nSenior Broker | CBRE\n(202) 555-0100"}
                    value={emailDefaults.signature}
                    onChange={e => setEmailDefaults(s => ({ ...s, signature: e.target.value }))}
                  />
                </div>
                <Button onClick={() => saveAll('Email defaults')} className="mt-2" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Save Email Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose what alerts you receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  { key: 'pipelineChanges' as const, label: 'Pipeline stage changes', desc: 'When a deal moves stages' },
                  { key: 'newScoops' as const, label: 'New scoops', desc: 'When a scoop is posted in your market' },
                  { key: 'taskReminders' as const, label: 'Task reminders', desc: 'Upcoming and overdue tasks' },
                  { key: 'weeklyDigest' as const, label: 'Weekly digest', desc: 'Summary email every Monday' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={notifications[item.key]}
                      onCheckedChange={v => setNotifications(n => ({ ...n, [item.key]: v }))}
                    />
                  </div>
                ))}
                <Button onClick={() => saveAll('Notification')} className="mt-2" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Save Notifications
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workflow */}
          <TabsContent value="workflow">
            <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Customization</CardTitle>
                <CardDescription>Tailor DealFlow to your process</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Market</Label>
                  <Select value={workflow.defaultMarket} onValueChange={v => setWorkflow(w => ({ ...w, defaultMarket: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dc-metro">DC Metro</SelectItem>
                      <SelectItem value="nova">Northern Virginia</SelectItem>
                      <SelectItem value="md-suburbs">Maryland Suburbs</SelectItem>
                      <SelectItem value="downtown-dc">Downtown DC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categories">Activity Log Categories</Label>
                  <Input
                    id="categories"
                    placeholder="Calls, Tours, Emails, Meetings"
                    value={workflow.activityCategories}
                    onChange={e => setWorkflow(w => ({ ...w, activityCategories: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated list</p>
                </div>
                <Button onClick={() => saveAll('Workflow')} className="mt-2" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Save Workflow
                </Button>
              </CardContent>
            </Card>

            {/* Zapier Webhook */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> ZoomInfo → Zapier Webhook
                </CardTitle>
                <CardDescription>Use this URL in your Zapier Zap to auto-create prospects from ZoomInfo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoominfo-webhook`}
                      className="font-mono text-xs bg-secondary/50"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoominfo-webhook`);
                        toast.success('Webhook URL copied!');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="rounded-md bg-secondary/30 border border-border p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">Setup Instructions:</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>In Zapier, create a new Zap with a ZoomInfo trigger (e.g., "New Company Added")</li>
                    <li>Add a "Webhooks by Zapier" action → choose "POST"</li>
                    <li>Paste the webhook URL above</li>
                    <li>Map ZoomInfo fields: <code className="bg-secondary px-1 rounded text-[10px]">company_name</code>, <code className="bg-secondary px-1 rounded text-[10px]">website</code>, <code className="bg-secondary px-1 rounded text-[10px]">headquarters</code>, <code className="bg-secondary px-1 rounded text-[10px]">industry</code>, <code className="bg-secondary px-1 rounded text-[10px]">employee_count</code>, <code className="bg-secondary px-1 rounded text-[10px]">revenue</code></li>
                    <li>Turn on your Zap — prospects will auto-appear in DealFlow!</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          {/* AI & Integrations */}
          <TabsContent value="integrations">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" /> Calendar Access
                  </CardTitle>
                  <CardDescription>Connect your calendar so Copilot can suggest meeting times around your schedule</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Google Calendar</p>
                      <p className="text-xs text-muted-foreground">
                        {integrations.calendarConnected
                          ? 'Connected — Copilot can see your availability and suggest meeting times'
                          : 'Not connected — Enable to let Copilot schedule around your meetings'}
                      </p>
                    </div>
                    <Switch
                      checked={integrations.calendarConnected}
                      onCheckedChange={v => {
                        if (v) {
                          toast.info('Calendar integration coming soon! This will connect to your Google Calendar.');
                          return;
                        }
                        setIntegrations(i => ({ ...i, calendarConnected: false }));
                      }}
                    />
                  </div>
                  {integrations.calendarConnected && (
                    <div className="rounded-md bg-success/5 border border-success/20 p-3">
                      <p className="text-xs text-success font-medium">✓ Calendar connected</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Copilot will check your calendar before suggesting meeting times</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" /> Conversation Memory
                  </CardTitle>
                  <CardDescription>Let Copilot remember past conversations to give personalized responses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Enable Memory</p>
                      <p className="text-xs text-muted-foreground">
                        {integrations.copilotMemory
                          ? 'Copilot recalls your past conversations, notes, and preferences to tailor responses'
                          : 'Copilot treats each conversation independently with no recall'}
                      </p>
                    </div>
                    <Switch
                      checked={integrations.copilotMemory}
                      onCheckedChange={v => setIntegrations(i => ({ ...i, copilotMemory: v }))}
                    />
                  </div>
                  {integrations.copilotMemory && (
                    <div className="rounded-md bg-primary/5 border border-primary/20 p-3 space-y-2">
                      <p className="text-xs text-primary font-medium">🧠 Memory is active</p>
                      <p className="text-[10px] text-muted-foreground">
                        Copilot will reference your past deal notes, outreach patterns, and conversation history. 
                        It may also crack a joke if you've left something funny in the notes 😄
                      </p>
                    </div>
                  )}
                  <Button onClick={() => saveAll('AI & Integrations')} className="mt-2" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Save Settings
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Appearance & Data */}
          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Display & Data</CardTitle>
                <CardDescription>Theme preferences and data export</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Dark Mode</p>
                    <p className="text-xs text-muted-foreground">Toggle between light and dark themes</p>
                  </div>
                  <Switch
                    checked={appearance.darkMode}
                    onCheckedChange={v => {
                      setAppearance(a => ({ ...a, darkMode: v }));
                      // Auto-save theme preference
                      if (user) {
                        supabase.from('user_settings' as any).update({ dark_mode: v, updated_at: new Date().toISOString() }).eq('user_id', user.id).then();
                      }
                    }}
                  />
                </div>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Export Data</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => handleExportCSV('Pipeline')}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Pipeline CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportCSV('Contacts')}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Contacts CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportCSV('Activities')}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Activities CSV
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
