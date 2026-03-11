import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { User, Mail, Bell, Workflow, Palette, Download } from 'lucide-react';

const Settings = () => {
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
    darkMode: true,
  });

  const [workflow, setWorkflow] = useState({
    defaultMarket: 'dc-metro',
    activityCategories: 'Calls, Tours, Emails, Meetings, Proposals',
  });

  const handleSave = (section: string) => {
    toast.success(`${section} settings saved`);
  };

  const handleExportCSV = (type: string) => {
    toast.success(`${type} data exported as CSV`);
  };

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="text-2xl font-bold text-foreground mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm mb-6">Manage your preferences and defaults</p>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
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
                <Button onClick={() => handleSave('Profile')} className="mt-2">Save Profile</Button>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                <Button onClick={() => handleSave('Email defaults')} className="mt-2">Save Email Settings</Button>
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
                <Button onClick={() => handleSave('Notification')} className="mt-2">Save Notifications</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workflow */}
          <TabsContent value="workflow">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Customization</CardTitle>
                <CardDescription>Tailor DealFlow to your process</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Market</Label>
                  <Select value={workflow.defaultMarket} onValueChange={v => setWorkflow(w => ({ ...w, defaultMarket: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                <Button onClick={() => handleSave('Workflow')} className="mt-2">Save Workflow</Button>
              </CardContent>
            </Card>
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
                    onCheckedChange={v => setAppearance(a => ({ ...a, darkMode: v }))}
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
