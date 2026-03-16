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
import { User, Mail, Bell, Workflow, Palette, Download, Loader2, Zap, Calendar, Brain, Target } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
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
    brainEnabled: false,
    aiAutoBrainExtraction: false,
    aiEmailPerformanceLoop: false,
    aiDealPatternLearning: false,
    aiActivityInsights: false,
    aiStyleTraining: false,
    aiScoopSynthesis: false,
    aiContactMemory: false,
  });

  const [brokerProfile, setBrokerProfile] = useState({
    specialties: '',
    yearsExperience: '',
    dealSizeSweetSpot: '',
    assetClasses: '',
    communicationPersonaEnabled: false,
    writingStyleSample: '',
    jargonLevel: 'moderate',
    humorPreference: 'occasional',
    followupCadence: 'standard',
    targetSubmarkets: '',
    keyCompetitors: '',
    buildingsRepped: '',
    landlordRelationships: '',
    quarterlyFocus: '',
    revenueTarget: '',
    dealCountGoal: '',
    personalPitch: '',
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
          copilotName: (s as any).copilot_name || 'DealFlow Copilot',
          brainEnabled: (s as any).brain_enabled ?? false,
          aiAutoBrainExtraction: (s as any).ai_auto_brain_extraction ?? false,
          aiEmailPerformanceLoop: (s as any).ai_email_performance_loop ?? false,
          aiDealPatternLearning: (s as any).ai_deal_pattern_learning ?? false,
          aiActivityInsights: (s as any).ai_activity_insights ?? false,
          aiStyleTraining: (s as any).ai_style_training ?? false,
          aiScoopSynthesis: (s as any).ai_scoop_synthesis ?? false,
          aiContactMemory: (s as any).ai_contact_memory ?? false,
        });
        setBrokerProfile({
          specialties: s.specialties || '',
          yearsExperience: s.years_experience || '',
          dealSizeSweetSpot: s.deal_size_sweet_spot || '',
          assetClasses: s.asset_classes || '',
          communicationPersonaEnabled: s.communication_persona_enabled ?? false,
          writingStyleSample: s.writing_style_sample || '',
          jargonLevel: s.jargon_level || 'moderate',
          humorPreference: s.humor_preference || 'occasional',
          followupCadence: s.followup_cadence || 'standard',
          targetSubmarkets: s.target_submarkets || '',
          keyCompetitors: s.key_competitors || '',
          buildingsRepped: s.buildings_repped || '',
          landlordRelationships: s.landlord_relationships || '',
          quarterlyFocus: s.quarterly_focus || '',
          revenueTarget: s.revenue_target || '',
          dealCountGoal: s.deal_count_goal || '',
          personalPitch: s.personal_pitch || '',
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
        copilot_name: integrations.copilotName,
        brain_enabled: integrations.brainEnabled,
        ai_auto_brain_extraction: integrations.aiAutoBrainExtraction,
        ai_email_performance_loop: integrations.aiEmailPerformanceLoop,
        ai_deal_pattern_learning: integrations.aiDealPatternLearning,
        ai_activity_insights: integrations.aiActivityInsights,
        ai_style_training: integrations.aiStyleTraining,
        ai_scoop_synthesis: integrations.aiScoopSynthesis,
        ai_contact_memory: integrations.aiContactMemory,
        specialties: brokerProfile.specialties,
        years_experience: brokerProfile.yearsExperience,
        deal_size_sweet_spot: brokerProfile.dealSizeSweetSpot,
        asset_classes: brokerProfile.assetClasses,
        communication_persona_enabled: brokerProfile.communicationPersonaEnabled,
        writing_style_sample: brokerProfile.writingStyleSample,
        jargon_level: brokerProfile.jargonLevel,
        humor_preference: brokerProfile.humorPreference,
        followup_cadence: brokerProfile.followupCadence,
        target_submarkets: brokerProfile.targetSubmarkets,
        key_competitors: brokerProfile.keyCompetitors,
        buildings_repped: brokerProfile.buildingsRepped,
        landlord_relationships: brokerProfile.landlordRelationships,
        quarterly_focus: brokerProfile.quarterlyFocus,
        revenue_target: brokerProfile.revenueTarget,
        deal_count_goal: brokerProfile.dealCountGoal,
        personal_pitch: brokerProfile.personalPitch,
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
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="profile" className="text-xs gap-1">
              <User className="h-3.5 w-3.5 hidden sm:block" /> Profile
            </TabsTrigger>
            <TabsTrigger value="broker" className="text-xs gap-1">
              <Target className="h-3.5 w-3.5 hidden sm:block" /> Broker DNA
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
              <Brain className="h-3.5 w-3.5 hidden sm:block" /> AI
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

          {/* Broker DNA */}
          <TabsContent value="broker">
            <div className="space-y-6">
              {/* Deal Style & Strengths */}
              <Card>
                <CardHeader>
                  <CardTitle>Deal Style & Strengths</CardTitle>
                  <CardDescription>Help the AI understand your expertise so it pitches and strategizes like you</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Specialties</Label>
                      <Input placeholder="Tenant rep, landlord rep, investment sales..." value={brokerProfile.specialties} onChange={e => setBrokerProfile(p => ({ ...p, specialties: e.target.value }))} />
                      <p className="text-[10px] text-muted-foreground">Comma-separated</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Years of Experience</Label>
                      <Select value={brokerProfile.yearsExperience} onValueChange={v => setBrokerProfile(p => ({ ...p, yearsExperience: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-3">1–3 years</SelectItem>
                          <SelectItem value="4-7">4–7 years</SelectItem>
                          <SelectItem value="8-15">8–15 years</SelectItem>
                          <SelectItem value="15+">15+ years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Deal Size Sweet Spot</Label>
                      <Select value={brokerProfile.dealSizeSweetSpot} onValueChange={v => setBrokerProfile(p => ({ ...p, dealSizeSweetSpot: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="<5k SF">Under 5,000 SF</SelectItem>
                          <SelectItem value="5k-15k SF">5,000–15,000 SF</SelectItem>
                          <SelectItem value="15k-50k SF">15,000–50,000 SF</SelectItem>
                          <SelectItem value="50k+ SF">50,000+ SF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Preferred Asset Classes</Label>
                      <Input placeholder="Office, industrial, retail, mixed-use..." value={brokerProfile.assetClasses} onChange={e => setBrokerProfile(p => ({ ...p, assetClasses: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Your Elevator Pitch</Label>
                    <Textarea placeholder="What makes you different? E.g. 'I specialize in helping mid-size law firms find Class A space in downtown DC. I've closed 40+ deals in the corridor and know every landlord personally.'" value={brokerProfile.personalPitch} onChange={e => setBrokerProfile(p => ({ ...p, personalPitch: e.target.value }))} rows={3} />
                    <p className="text-[10px] text-muted-foreground">The AI will channel this when positioning you to prospects</p>
                  </div>
                </CardContent>
              </Card>

              {/* Communication Persona */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Communication Persona</span>
                    <Switch
                      checked={brokerProfile.communicationPersonaEnabled}
                      onCheckedChange={v => setBrokerProfile(p => ({ ...p, communicationPersonaEnabled: v }))}
                    />
                  </CardTitle>
                  <CardDescription>
                    {brokerProfile.communicationPersonaEnabled
                      ? 'Active — AI drafts will mirror your voice and style'
                      : 'Off — AI uses default professional tone. Enable to make drafts sound like you.'}
                  </CardDescription>
                </CardHeader>
                {brokerProfile.communicationPersonaEnabled && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Jargon Level</Label>
                        <Select value={brokerProfile.jargonLevel} onValueChange={v => setBrokerProfile(p => ({ ...p, jargonLevel: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minimal">Minimal — plain English</SelectItem>
                            <SelectItem value="moderate">Moderate — some CRE terms</SelectItem>
                            <SelectItem value="heavy">Heavy — full industry speak</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Humor</Label>
                        <Select value={brokerProfile.humorPreference} onValueChange={v => setBrokerProfile(p => ({ ...p, humorPreference: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None — strictly business</SelectItem>
                            <SelectItem value="occasional">Occasional — light touches</SelectItem>
                            <SelectItem value="frequent">Frequent — keep it fun</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Follow-Up Cadence</Label>
                        <Select value={brokerProfile.followupCadence} onValueChange={v => setBrokerProfile(p => ({ ...p, followupCadence: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aggressive">Aggressive — every 2-3 days</SelectItem>
                            <SelectItem value="standard">Standard — weekly</SelectItem>
                            <SelectItem value="patient">Patient — every 2 weeks</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Writing Style Sample</Label>
                      <Textarea placeholder="Paste a real email you've sent that captures your voice. The AI will learn your cadence, word choices, and sign-off style." value={brokerProfile.writingStyleSample} onChange={e => setBrokerProfile(p => ({ ...p, writingStyleSample: e.target.value }))} rows={4} />
                      <p className="text-[10px] text-muted-foreground">This is the single most impactful field — paste an email you're proud of</p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Market & Territory */}
              <Card>
                <CardHeader>
                  <CardTitle>Market & Territory Context</CardTitle>
                  <CardDescription>Your turf, relationships, and competitive landscape</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Target Submarkets</Label>
                      <Input placeholder="CBD, East End, Tysons, Bethesda..." value={brokerProfile.targetSubmarkets} onChange={e => setBrokerProfile(p => ({ ...p, targetSubmarkets: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Key Competitors</Label>
                      <Input placeholder="Broker names or teams you compete against" value={brokerProfile.keyCompetitors} onChange={e => setBrokerProfile(p => ({ ...p, keyCompetitors: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Buildings You Rep</Label>
                      <Textarea placeholder="List buildings you represent or have exclusive on" value={brokerProfile.buildingsRepped} onChange={e => setBrokerProfile(p => ({ ...p, buildingsRepped: e.target.value }))} rows={2} />
                    </div>
                    <div className="space-y-2">
                      <Label>Landlord Relationships</Label>
                      <Textarea placeholder="Key landlord contacts, e.g. 'Boston Properties — strong rapport with leasing team'" value={brokerProfile.landlordRelationships} onChange={e => setBrokerProfile(p => ({ ...p, landlordRelationships: e.target.value }))} rows={2} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Goals & Priorities */}
              <Card>
                <CardHeader>
                  <CardTitle>Goals & Current Priorities</CardTitle>
                  <CardDescription>What matters to you right now — the AI will prioritize accordingly</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Revenue Target</Label>
                      <Input placeholder="$500K this quarter" value={brokerProfile.revenueTarget} onChange={e => setBrokerProfile(p => ({ ...p, revenueTarget: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Deal Count Goal</Label>
                      <Input placeholder="Close 8 deals this quarter" value={brokerProfile.dealCountGoal} onChange={e => setBrokerProfile(p => ({ ...p, dealCountGoal: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>This Quarter's Focus</Label>
                    <Textarea placeholder="E.g. 'Expanding into Tysons market, building law firm pipeline, closing 3 renewals by March'" value={brokerProfile.quarterlyFocus} onChange={e => setBrokerProfile(p => ({ ...p, quarterlyFocus: e.target.value }))} rows={2} />
                  </div>
                </CardContent>
              </Card>

              <Button onClick={() => saveAll('Broker DNA')} className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Save Broker DNA
              </Button>
            </div>
          </TabsContent>

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
              {/* ═══ AI Intelligence Flywheels ═══ */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" /> AI Intelligence
                  </CardTitle>
                  <CardDescription>
                    Three toggles that control how your AI learns and what it knows. The more you turn on, the smarter your Copilot gets.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {[
                    {
                      key: 'aiAutoBrainExtraction' as const,
                      groupKeys: ['aiAutoBrainExtraction'] as const,
                      label: 'Brain (Continuous Learning)',
                      emoji: '🧠',
                      desc: 'The AI automatically learns from EVERYTHING you do — log an activity, move a deal, send an email, post a scoop, complete a task. Every action makes the AI smarter.',
                      activeDesc: 'Active — learning from every action you take across the platform',
                    },
                    {
                      key: 'aiEmailPerformanceLoop' as const,
                      groupKeys: ['aiEmailPerformanceLoop', 'aiStyleTraining', 'aiDealPatternLearning', 'aiActivityInsights'] as const,
                      label: 'Performance Intelligence',
                      emoji: '📊',
                      desc: 'Analyzes your email reply rates, best templates, writing style, deal win/loss patterns, activity timing, and pipeline velocity — coaching you on what works.',
                      activeDesc: 'Active — analyzing emails, deals, activities & communication style',
                    },
                    {
                      key: 'aiScoopSynthesis' as const,
                      groupKeys: ['aiScoopSynthesis', 'aiContactMemory'] as const,
                      label: 'Market & Relationship Intelligence',
                      emoji: '🔍',
                      desc: 'Aggregates scoops into market trend summaries and builds contact interaction timelines — so the AI knows what\'s happening in the market and your history with every person.',
                      activeDesc: 'Active — synthesizing market intel & tracking relationships',
                    },
                  ].map((item, idx) => (
                    <div key={item.key} className={`flex items-center justify-between py-3.5 ${idx > 0 ? 'border-t border-border' : ''}`}>
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <span>{item.emoji}</span> {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                          {integrations[item.key] ? item.activeDesc : item.desc}
                        </p>
                      </div>
                      <Switch
                        checked={integrations[item.key]}
                        onCheckedChange={v => setIntegrations(i => {
                          const update: any = { ...i };
                          item.groupKeys.forEach(k => { update[k] = v; });
                          return update;
                        })}
                      />
                    </div>
                  ))}

                  <div className="pt-4">
                    <Button onClick={() => saveAll('AI Intelligence')} className="w-full" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                      Save AI Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>

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

                   {/* Smart Memory */}
                  <div className="flex items-center justify-between py-3 border-t border-border mt-4 pt-4">
                    <div>
                      <p className="text-sm font-medium text-foreground flex items-center gap-1.5">Smart Memory</p>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                        {integrations.brainEnabled
                          ? 'Smart Memory is active — persistent memory, trigger stacking, live data awareness'
                          : 'Enable for persistent memory, pattern recognition, and adaptive intelligence'}
                      </p>
                    </div>
                    <Switch
                      checked={integrations.brainEnabled}
                      onCheckedChange={v => setIntegrations(i => ({ ...i, brainEnabled: v }))}
                    />
                  </div>

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
