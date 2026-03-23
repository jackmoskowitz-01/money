/**
 * Mock Supabase client for local development without a backend.
 * Maintains an in-memory data store with realistic seed data.
 */

const uuid = () => `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];

// ─── Mock User ───
const MOCK_USER = {
  id: 'mock-user-001',
  email: 'demo@dealflow.local',
  app_metadata: {},
  user_metadata: { full_name: 'Demo User' },
  aud: 'authenticated',
  created_at: now(),
  role: 'authenticated',
  updated_at: now(),
};

const MOCK_SESSION = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer' as const,
  user: MOCK_USER,
};

// ─── In-Memory Data Store ───
const store: Record<string, any[]> = {
  profiles: [
    { id: 'mock-user-001', email: 'demo@dealflow.local', full_name: 'Demo User', avatar_initials: 'DU', created_at: now() },
  ],

  pipeline_deals: [
    { id: uuid(), tenant_id: 't1', building_id: 'b1', stage: 'hot_prospect', notes: ['Initial outreach sent'], last_activity: daysAgo(1), is_manual: false, prospect_name: null, prospect_company: null, prospect_email: null, prospect_phone: null, prospect_sqft: null, sent_touchpoints: [], sort_order: 0, outcome: null, outcome_reason: null, created_at: daysAgo(14), updated_at: daysAgo(1) },
    { id: uuid(), tenant_id: 't4', building_id: 'b2', stage: 'meeting_set', notes: ['Meeting scheduled for next week'], last_activity: daysAgo(2), is_manual: false, prospect_name: null, prospect_company: null, prospect_email: null, prospect_phone: null, prospect_sqft: null, sent_touchpoints: [], sort_order: 0, created_at: daysAgo(10), updated_at: daysAgo(2) },
    { id: uuid(), tenant_id: 't7', building_id: 'b3', stage: 'meeting_held', notes: ['Great meeting — interested in 2 options'], last_activity: daysAgo(3), is_manual: false, prospect_name: null, prospect_company: null, prospect_email: null, prospect_phone: null, prospect_sqft: null, sent_touchpoints: [{ id: 'tp1', type: 'lease_comp', title: 'East End Comp Package', description: 'Shared recent comps', suggested: false, sentAt: daysAgo(5) }], sort_order: 0, created_at: daysAgo(21), updated_at: daysAgo(3) },
    { id: uuid(), tenant_id: 't6', building_id: 'b3', stage: 'moving_forward', notes: ['LOI being drafted'], last_activity: daysAgo(1), is_manual: false, prospect_name: null, prospect_company: null, prospect_email: null, prospect_phone: null, prospect_sqft: null, sent_touchpoints: [], sort_order: 0, created_at: daysAgo(30), updated_at: daysAgo(1) },
    { id: uuid(), tenant_id: 't9', building_id: 'b5', stage: 'hot_prospect', notes: [], last_activity: daysAgo(4), is_manual: false, prospect_name: null, prospect_company: null, prospect_email: null, prospect_phone: null, prospect_sqft: null, sent_touchpoints: [], sort_order: 1, created_at: daysAgo(7), updated_at: daysAgo(4) },
    { id: uuid(), tenant_id: 't8', building_id: 'b4', stage: 'meeting_set', notes: ['Discussing secure space needs'], last_activity: daysAgo(2), is_manual: false, prospect_name: null, prospect_company: null, prospect_email: null, prospect_phone: null, prospect_sqft: null, sent_touchpoints: [], sort_order: 1, created_at: daysAgo(8), updated_at: daysAgo(2) },
    { id: uuid(), tenant_id: 't2', building_id: 'b1', stage: 'meeting_held', notes: ['Exploring expansion options'], last_activity: daysAgo(5), is_manual: false, prospect_name: null, prospect_company: null, prospect_email: null, prospect_phone: null, prospect_sqft: null, sent_touchpoints: [], sort_order: 1, created_at: daysAgo(15), updated_at: daysAgo(5) },
    { id: uuid(), tenant_id: 't12', building_id: 'b6', stage: 'hot_prospect', notes: ['Lease expiring soon'], last_activity: daysAgo(1), is_manual: false, prospect_name: null, prospect_company: null, prospect_email: null, prospect_phone: null, prospect_sqft: null, sent_touchpoints: [], sort_order: 2, created_at: daysAgo(5), updated_at: daysAgo(1) },
    { id: uuid(), tenant_id: 't11', building_id: 'b6', stage: 'meeting_set', notes: [], last_activity: daysAgo(3), is_manual: false, prospect_name: null, prospect_company: null, prospect_email: null, prospect_phone: null, prospect_sqft: null, sent_touchpoints: [], sort_order: 2, created_at: daysAgo(12), updated_at: daysAgo(3) },
    { id: uuid(), tenant_id: 't5', building_id: 'b2', stage: 'won', notes: ['Deal closed — 75K SF renewal'], last_activity: daysAgo(7), is_manual: false, prospect_name: null, prospect_company: null, prospect_email: null, prospect_phone: null, prospect_sqft: null, sent_touchpoints: [], sort_order: 0, outcome: 'won', outcome_reason: 'Competitive concession package', created_at: daysAgo(60), updated_at: daysAgo(7) },
    { id: uuid(), tenant_id: 't3', building_id: 'b1', stage: 'lost', notes: ['Chose to consolidate elsewhere'], last_activity: daysAgo(14), is_manual: false, prospect_name: null, prospect_company: null, prospect_email: null, prospect_phone: null, prospect_sqft: null, sent_touchpoints: [], sort_order: 0, outcome: 'lost', outcome_reason: 'Went with competitor', created_at: daysAgo(45), updated_at: daysAgo(14) },
    // Manual prospect
    { id: uuid(), tenant_id: `manual-${Date.now()}`, building_id: 'manual', stage: 'meeting_set', notes: ['Referred by existing client'], last_activity: daysAgo(1), is_manual: true, prospect_name: 'Latham & Watkins', prospect_company: 'Latham & Watkins LLP', prospect_email: 'j.bradley@lw.com', prospect_phone: '202-555-0188', prospect_sqft: 95000, sent_touchpoints: [], sort_order: 3, created_at: daysAgo(3), updated_at: daysAgo(1) },
  ],

  tasks: [
    { id: uuid(), title: 'Follow up with McKinsey on space study', description: 'Check on their space evaluation progress and offer to provide additional comps', type: 'follow_up', priority: 'high', due_date: daysFromNow(0), completed: false, created_at: daysAgo(3), tenant_id: 't1', building_id: 'b1', assigned_to: null, assigned_by: null, assigned_to_name: null },
    { id: uuid(), title: 'Prepare meeting brief for Deloitte', description: 'Pull comps, vacancy data, and concession trends for Homer Building area', type: 'meeting', priority: 'high', due_date: daysFromNow(1), completed: false, created_at: daysAgo(2), tenant_id: 't4', building_id: 'b2', assigned_to: null, assigned_by: null, assigned_to_name: null },
    { id: uuid(), title: 'Send lease comp package to Amazon', description: 'Include East End and NoMa options with recent deal activity', type: 'email', priority: 'medium', due_date: daysFromNow(2), completed: false, created_at: daysAgo(1), tenant_id: 't6', building_id: 'b3', assigned_to: null, assigned_by: null, assigned_to_name: null },
    { id: uuid(), title: 'Call Squire Patton Boggs re: lease expiry', description: 'Discuss relocation options given high vacancy at 2000 Penn', type: 'call', priority: 'high', due_date: daysFromNow(0), completed: false, created_at: daysAgo(5), tenant_id: 't9', building_id: 'b5', assigned_to: null, assigned_by: null, assigned_to_name: null },
    { id: uuid(), title: 'Research Arnold & Porter space requirements', description: 'Gather intel on their trophy space wishlist and shortlist buildings', type: 'research', priority: 'medium', due_date: daysFromNow(3), completed: false, created_at: daysAgo(4), tenant_id: 't7', building_id: 'b3', assigned_to: null, assigned_by: null, assigned_to_name: null },
    { id: uuid(), title: 'Update pipeline notes for Booz Allen', description: 'Add notes from last week\'s secure space discussion', type: 'other', priority: 'low', due_date: daysFromNow(5), completed: false, created_at: daysAgo(2), tenant_id: 't8', building_id: 'b4', assigned_to: null, assigned_by: null, assigned_to_name: null },
    { id: uuid(), title: 'Send intro email to NACo', description: 'Initial outreach about upcoming lease expiration', type: 'email', priority: 'medium', due_date: daysFromNow(-1), completed: true, created_at: daysAgo(7), tenant_id: 't11', building_id: 'b6', assigned_to: null, assigned_by: null, assigned_to_name: null },
  ],

  activities: [
    { id: uuid(), tenant_id: 't1', building_id: 'b1', type: 'email', title: 'Outreach to McKinsey', description: 'Sent market update on East End vacancy trends', timestamp: daysAgo(1), outreach_reason_used: 'lease_expiration' },
    { id: uuid(), tenant_id: 't4', building_id: 'b2', type: 'meeting', title: 'Meeting with Deloitte', description: 'Discussed hybrid work strategy and potential space reduction', timestamp: daysAgo(2), outreach_reason_used: null },
    { id: uuid(), tenant_id: 't7', building_id: 'b3', type: 'call', title: 'Call with Arnold & Porter', description: 'Reviewed trophy space options in East End. Very interested in Midtown Center.', timestamp: daysAgo(3), outreach_reason_used: 'lease_expiration' },
    { id: uuid(), tenant_id: 't6', building_id: 'b3', type: 'email', title: 'LOI sent to Amazon', description: 'Sent LOI for additional 50K SF at Franklin Square', timestamp: daysAgo(1), outreach_reason_used: 'expansion' },
    { id: uuid(), tenant_id: 't9', building_id: 'b5', type: 'research', title: 'Market analysis for Squire PB', description: 'Prepared competitive analysis of Class A options near K Street', timestamp: daysAgo(4), outreach_reason_used: null },
    { id: uuid(), tenant_id: 't8', building_id: 'b4', type: 'meeting', title: 'Toured secure space with BAH', description: 'Showed SCIF-ready options at Capital One Center', timestamp: daysAgo(2), outreach_reason_used: 'expansion' },
    { id: uuid(), tenant_id: 't12', building_id: 'b6', type: 'email', title: 'Intro to Center for American Progress', description: 'Cold outreach highlighting modern collaborative space options', timestamp: daysAgo(1), outreach_reason_used: 'lease_expiration' },
    { id: uuid(), tenant_id: 't2', building_id: 'b1', type: 'call', title: 'Check-in with Hogan Lovells', description: 'Discussed expansion plans and adjacent floor availability', timestamp: daysAgo(5), outreach_reason_used: 'expansion' },
    { id: uuid(), tenant_id: 't11', building_id: 'b6', type: 'email', title: 'Follow-up with NACo', description: 'Sent comp package for Downtown and East End', timestamp: daysAgo(3), outreach_reason_used: 'lease_expiration' },
    { id: uuid(), tenant_id: 't5', building_id: 'b2', type: 'meeting', title: 'Closing meeting with Perkins Coie', description: 'Finalized 75K SF renewal terms at Homer Building', timestamp: daysAgo(7), outreach_reason_used: null },
  ],

  scoops: [
    { id: uuid(), content: 'Hearing that Arnold & Porter is seriously looking at the new Midtown Center development. They want trophy space with modern amenities. 160K SF requirement.', author_name: 'Mike Johnson', author_avatar: 'MJ', category: 'lease_move', tags: ['Arnold & Porter', 'Midtown Center', 'Legal'], linked_tenant_id: 't7', linked_building_id: 'b3', linked_tenant_name: 'Arnold & Porter', linked_building_name: 'Franklin Square', likes_count: 24, comments_count: 8, verified: true, created_at: daysAgo(1), updated_at: daysAgo(1) },
    { id: uuid(), content: 'Deloitte RFP is out. Looking for 100-110K SF, down from 150K current. Prioritizing Metro access and modern conference facilities. Shortlist expected by April.', author_name: 'Lisa Park', author_avatar: 'LP', category: 'rfp', tags: ['Deloitte', 'RFP', 'Consulting'], linked_tenant_id: 't4', linked_building_id: 'b2', linked_tenant_name: 'Deloitte', linked_building_name: 'The Homer Building', likes_count: 42, comments_count: 15, verified: true, created_at: daysAgo(2), updated_at: daysAgo(2) },
    { id: uuid(), content: 'Source at JBG SMITH says they are offering 18 months free rent on new leases at 2000 Penn Ave to combat the 31% vacancy. Aggressive concession packages.', author_name: 'Carlos Rivera', author_avatar: 'CR', category: 'concession', tags: ['JBG SMITH', '2000 Penn', 'Concessions'], linked_tenant_id: null, linked_building_id: 'b5', linked_tenant_name: null, linked_building_name: '2000 Pennsylvania Avenue', likes_count: 31, comments_count: 12, verified: false, created_at: daysAgo(3), updated_at: daysAgo(3) },
    { id: uuid(), content: 'Big tech company (not AWS) is looking for 250K+ SF in East End. Government contracts driving the need. Expect announcement within 60 days.', author_name: 'Rachel Thompson', author_avatar: 'RT', category: 'expansion', tags: ['Tech', 'East End', 'Large Requirement'], linked_tenant_id: null, linked_building_id: null, linked_tenant_name: null, linked_building_name: null, likes_count: 56, comments_count: 23, verified: false, created_at: daysAgo(4), updated_at: daysAgo(4) },
    { id: uuid(), content: 'The Homer Building is going to hit 30% vacancy by Q3. Two more tenants on floors 2-3 have given notice. Brookfield considering converting upper floors to residential.', author_name: 'David Kim', author_avatar: 'DK', category: 'conversion', tags: ['Homer Building', 'Vacancy', 'Conversion'], linked_tenant_id: null, linked_building_id: 'b2', linked_tenant_name: null, linked_building_name: 'The Homer Building', likes_count: 38, comments_count: 18, verified: true, created_at: daysAgo(5), updated_at: daysAgo(5) },
    { id: uuid(), content: 'McKinsey partner told me they\'re evaluating 3 buildings for their DC consolidation. Want to go from 85K to 60K SF. Decision by Q3.', author_name: 'Sarah Chen', author_avatar: 'SC', category: 'contraction', tags: ['McKinsey', 'Consolidation'], linked_tenant_id: 't1', linked_building_id: 'b1', linked_tenant_name: 'McKinsey & Company', linked_building_name: '1100 New York Avenue', likes_count: 19, comments_count: 7, verified: false, created_at: daysAgo(1), updated_at: daysAgo(1) },
  ],

  email_threads: [
    { id: uuid(), user_id: 'mock-user-001', prospect_name: 'Sarah Mitchell', prospect_email: 's.mitchell@mckinsey.com', subject: 'DC Office Market Update — East End Vacancy Trends', body_preview: 'Hi Sarah, I wanted to share some recent market data that may be relevant as you evaluate your space options...', sent_at: daysAgo(3), template_used: 'Market Update', tone_used: 'Professional', outreach_reason: 'lease_expiration', industry: 'Consulting', reply_detected: true, reply_at: daysAgo(2), reply_content: 'Thanks for sending this over. We are indeed evaluating options. Could you send over some comps for the East End?', reply_sentiment: 'positive', is_relevant: true, relevance_score: 1, spam_reason: null, ai_suggested_replies: ['Happy to pull comps together — I\'ll have a package over by EOD tomorrow.', 'Great to hear. I\'ll include East End, NoMa, and Capitol Riverfront options.'], response_time_hours: 18.5, thread_status: 'replied', tenant_id: 't1', building_id: 'b1', activity_id: null, created_at: daysAgo(3), updated_at: daysAgo(2) },
    { id: uuid(), user_id: 'mock-user-001', prospect_name: 'Patricia Wong', prospect_email: 'p.wong@deloitte.com', subject: 'Deloitte DC Space — Flexible Options to Consider', body_preview: 'Patricia, with your lease expiration approaching in 2026, I wanted to share a few properties that match your hybrid work requirements...', sent_at: daysAgo(5), template_used: 'Space Introduction', tone_used: 'Consultative', outreach_reason: 'lease_expiration', industry: 'Consulting', reply_detected: true, reply_at: daysAgo(3), reply_content: 'We have an RFP in the market. Happy to include your properties if you can provide details by Friday.', reply_sentiment: 'positive', is_relevant: true, relevance_score: 1, spam_reason: null, ai_suggested_replies: ['Excellent — I\'ll prepare a comprehensive response by Thursday EOD.'], response_time_hours: 42.3, thread_status: 'replied', tenant_id: 't4', building_id: 'b2', activity_id: null, created_at: daysAgo(5), updated_at: daysAgo(3) },
    { id: uuid(), user_id: 'mock-user-001', prospect_name: 'Michelle Torres', prospect_email: 'm.torres@arnoldporter.com', subject: 'Trophy Space Options for Arnold & Porter', body_preview: 'Michelle, I understand Arnold & Porter is considering a move to a more modern building. I have several options that would be an excellent fit...', sent_at: daysAgo(4), template_used: 'New Space Introduction', tone_used: 'Professional', outreach_reason: 'lease_expiration', industry: 'Legal', reply_detected: false, reply_at: null, reply_content: null, reply_sentiment: null, is_relevant: true, relevance_score: 0, spam_reason: null, ai_suggested_replies: [], response_time_hours: null, thread_status: 'pending', tenant_id: 't7', building_id: 'b3', activity_id: null, created_at: daysAgo(4), updated_at: daysAgo(4) },
    { id: uuid(), user_id: 'mock-user-001', prospect_name: 'Thomas Grant', prospect_email: 't.grant@squirepb.com', subject: 'Relocation Options Near K Street', body_preview: 'Thomas, given the current vacancy challenges at 2000 Penn Ave, I wanted to present some compelling alternatives in the East End and Downtown...', sent_at: daysAgo(6), template_used: 'Relocation Pitch', tone_used: 'Direct', outreach_reason: 'vacancy', industry: 'Lobbying', reply_detected: true, reply_at: daysAgo(4), reply_content: 'Appreciate the outreach. We\'re not actively looking right now but will keep your info on file.', reply_sentiment: 'neutral', is_relevant: true, relevance_score: 0.5, spam_reason: null, ai_suggested_replies: ['Understood — I\'ll check back in a few months. In the meantime, happy to share any market updates.'], response_time_hours: 36.0, thread_status: 'replied', tenant_id: 't9', building_id: 'b5', activity_id: null, created_at: daysAgo(6), updated_at: daysAgo(4) },
    { id: uuid(), user_id: 'mock-user-001', prospect_name: 'David Park', prospect_email: 'd.park@amazon.com', subject: 'Expansion Space at Franklin Square', body_preview: 'David, with AWS continuing to grow its DC presence, I wanted to flag some available space adjacent to your current offices at Franklin Square...', sent_at: daysAgo(2), template_used: 'Expansion Opportunity', tone_used: 'Professional', outreach_reason: 'expansion', industry: 'Technology', reply_detected: false, reply_at: null, reply_content: null, reply_sentiment: null, is_relevant: true, relevance_score: 0, spam_reason: null, ai_suggested_replies: [], response_time_hours: null, thread_status: 'pending', tenant_id: 't6', building_id: 'b3', activity_id: null, created_at: daysAgo(2), updated_at: daysAgo(2) },
    { id: uuid(), user_id: 'mock-user-001', prospect_name: 'Danielle Rosen', prospect_email: 'd.rosen@americanprogress.org', subject: 'Modern Collaborative Space for CAP', body_preview: 'Danielle, with your lease at 1000 Vermont expiring this November, now is the perfect time to explore options that better support your team\'s needs...', sent_at: daysAgo(1), template_used: 'Lease Expiration Alert', tone_used: 'Consultative', outreach_reason: 'lease_expiration', industry: 'Nonprofit/Association', reply_detected: false, reply_at: null, reply_content: null, reply_sentiment: null, is_relevant: true, relevance_score: 0, spam_reason: null, ai_suggested_replies: [], response_time_hours: null, thread_status: 'pending', tenant_id: 't12', building_id: 'b6', activity_id: null, created_at: daysAgo(1), updated_at: daysAgo(1) },
    { id: uuid(), user_id: 'mock-user-001', prospect_name: 'Karen Sullivan', prospect_email: 'k.sullivan@bah.com', subject: 'Secure Space Solutions for BAH', body_preview: 'Karen, following our conversation about your growing cleared personnel requirements, I\'ve identified two SCIF-ready options...', sent_at: daysAgo(7), template_used: 'Follow-Up', tone_used: 'Professional', outreach_reason: 'expansion', industry: 'Defense', reply_detected: true, reply_at: daysAgo(5), reply_content: 'This is great timing. We just got a new contract and need an additional 15K SF of secure space. Can we meet next week?', reply_sentiment: 'positive', is_relevant: true, relevance_score: 1, spam_reason: null, ai_suggested_replies: ['Absolutely — I have availability Tuesday or Wednesday afternoon. I\'ll bring floor plans for both options.'], response_time_hours: 52.0, thread_status: 'replied', tenant_id: 't8', building_id: 'b4', activity_id: null, created_at: daysAgo(7), updated_at: daysAgo(5) },
  ],

  critical_dates: [
    { id: uuid(), user_id: 'mock-user-001', date_type: 'lease_expiration', date_value: '2025-09-30', prospect_id: 't1', prospect_name: 'McKinsey & Company', building_name: '1100 New York Avenue', description: 'McKinsey lease expiration — 85,000 SF', acknowledged: false, remind_days_before: 180, source: 'manual', lease_abstract_id: null, created_at: daysAgo(30), updated_at: daysAgo(30) },
    { id: uuid(), user_id: 'mock-user-001', date_type: 'lease_expiration', date_value: '2026-03-31', prospect_id: 't7', prospect_name: 'Arnold & Porter', building_name: 'Franklin Square', description: 'Arnold & Porter lease expiration — 160,000 SF', acknowledged: false, remind_days_before: 365, source: 'manual', lease_abstract_id: null, created_at: daysAgo(30), updated_at: daysAgo(30) },
    { id: uuid(), user_id: 'mock-user-001', date_type: 'lease_expiration', date_value: '2026-06-30', prospect_id: 't4', prospect_name: 'Deloitte', building_name: 'The Homer Building', description: 'Deloitte lease expiration — 150,000 SF (may downsize to 100-110K)', acknowledged: true, remind_days_before: 365, source: 'manual', lease_abstract_id: null, created_at: daysAgo(60), updated_at: daysAgo(5) },
    { id: uuid(), user_id: 'mock-user-001', date_type: 'renewal_date', date_value: daysFromNow(14), prospect_id: 't9', prospect_name: 'Squire Patton Boggs', building_name: '2000 Pennsylvania Avenue', description: 'Renewal option deadline — must exercise or vacate', acknowledged: false, remind_days_before: 30, source: 'abstract', lease_abstract_id: null, created_at: daysAgo(90), updated_at: daysAgo(10) },
    { id: uuid(), user_id: 'mock-user-001', date_type: 'lease_expiration', date_value: '2025-11-30', prospect_id: 't12', prospect_name: 'Center for American Progress', building_name: '1000 Vermont Avenue', description: 'CAP lease expiration — 28,000 SF', acknowledged: false, remind_days_before: 180, source: 'manual', lease_abstract_id: null, created_at: daysAgo(20), updated_at: daysAgo(20) },
  ],

  scoop_likes: [],
  scoop_comments: [],
  scoop_verifications: [],
  copilot_brain: [],
  copilot_messages: [],
  copilot_templates: [],
  prospect_lists: [],
  prospect_list_items: [],
  prospect_owners: [],
  custom_prospects: [],
  prospect_files: [],
  company_contacts: [],
  broker_assignments: [],
  stacking_plans: [],
  user_settings: [],
  cached_buildings: [],
  cached_company_news: [],
  task_comments: [],
};

// ─── Query Builder ───
function createQueryBuilder(table: string, operation: 'select' | 'insert' | 'update' | 'upsert' | 'delete', payload?: any) {
  let filters: Array<{ col: string; val: any }> = [];
  let orderCols: Array<{ col: string; asc: boolean }> = [];
  let limitCount = Infinity;
  let selectCols = '*';
  let isSingle = false;
  let isMaybeSingle = false;
  let hasSelect = operation === 'select';

  const resolve = () => {
    let rows = store[table] || [];

    if (operation === 'insert') {
      const toInsert = Array.isArray(payload) ? payload : [payload];
      const inserted = toInsert.map((r: any) => ({ id: uuid(), created_at: now(), updated_at: now(), ...r }));
      if (!store[table]) store[table] = [];
      store[table].push(...inserted);
      if (!hasSelect) return { data: null, error: null };
      rows = inserted;
    }

    if (operation === 'update') {
      rows = store[table] || [];
      let updated: any[] = [];
      rows.forEach((r, i) => {
        if (filters.every(f => r[f.col] === f.val)) {
          store[table][i] = { ...r, ...payload, updated_at: now() };
          updated.push(store[table][i]);
        }
      });
      if (!hasSelect) return { data: null, error: null };
      rows = updated;
    }

    if (operation === 'upsert') {
      const toUpsert = Array.isArray(payload) ? payload : [payload];
      toUpsert.forEach((item: any) => {
        const idx = (store[table] || []).findIndex((r: any) => r.id === item.id);
        if (idx >= 0) {
          store[table][idx] = { ...store[table][idx], ...item, updated_at: now() };
        } else {
          if (!store[table]) store[table] = [];
          store[table].push({ id: uuid(), created_at: now(), updated_at: now(), ...item });
        }
      });
      if (!hasSelect) return { data: null, error: null };
      rows = store[table];
    }

    if (operation === 'delete') {
      const before = store[table]?.length || 0;
      store[table] = (store[table] || []).filter(
        (r: any) => !filters.every(f => r[f.col] === f.val)
      );
      return { data: null, error: null, count: before - (store[table]?.length || 0) };
    }

    // Apply filters (for select)
    if (operation === 'select') {
      rows = rows.filter((r: any) => filters.every(f => r[f.col] === f.val));
    }

    // Apply ordering
    if (orderCols.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const { col, asc } of orderCols) {
          const av = a[col], bv = b[col];
          if (av < bv) return asc ? -1 : 1;
          if (av > bv) return asc ? 1 : -1;
        }
        return 0;
      });
    }

    // Apply limit
    if (limitCount < Infinity) rows = rows.slice(0, limitCount);

    if (isSingle || isMaybeSingle) {
      return { data: rows[0] || null, error: null };
    }
    return { data: rows, error: null };
  };

  const builder: any = {};

  // Chain methods that add filters
  builder.eq = (col: string, val: any) => { filters.push({ col, val }); return builder; };
  builder.neq = (_col: string, _val: any) => builder;
  builder.gt = (_col: string, _val: any) => builder;
  builder.gte = (_col: string, _val: any) => builder;
  builder.lt = (_col: string, _val: any) => builder;
  builder.lte = (_col: string, _val: any) => builder;
  builder.like = (_col: string, _val: any) => builder;
  builder.ilike = (_col: string, _val: any) => builder;
  builder.in = (_col: string, _val: any) => builder;
  builder.is = (_col: string, _val: any) => builder;
  builder.not = (_col: string, _op: string, _val: any) => builder;
  builder.or = (_expr: string) => builder;
  builder.filter = (_col: string, _op: string, _val: any) => builder;
  builder.contains = (_col: string, _val: any) => builder;
  builder.containedBy = (_col: string, _val: any) => builder;
  builder.overlaps = (_col: string, _val: any) => builder;
  builder.textSearch = (_col: string, _val: any) => builder;
  builder.match = (_query: any) => builder;
  builder.range = (_from: number, _to: number) => builder;

  builder.select = (cols?: string) => { hasSelect = true; if (cols) selectCols = cols; return builder; };
  builder.order = (col: string, opts?: { ascending?: boolean }) => {
    orderCols.push({ col, asc: opts?.ascending !== false });
    return builder;
  };
  builder.limit = (n: number) => { limitCount = n; return builder; };
  builder.single = () => { isSingle = true; return Promise.resolve(resolve()); };
  builder.maybeSingle = () => { isMaybeSingle = true; return Promise.resolve(resolve()); };

  // Make thenable for await
  builder.then = (onFulfilled: (v: any) => any, onRejected?: (e: any) => any) => {
    return Promise.resolve(resolve()).then(onFulfilled, onRejected);
  };

  return builder;
}

// ─── Channel (realtime) ───
function createChannel() {
  const channel: any = {};
  channel.on = () => channel;
  channel.subscribe = () => channel;
  channel.unsubscribe = () => {};
  return channel;
}

// ─── Auth ───
type AuthCallback = (event: string, session: typeof MOCK_SESSION | null) => void;
let authCallbacks: AuthCallback[] = [];

const auth = {
  getSession: () => Promise.resolve({ data: { session: MOCK_SESSION }, error: null }),
  getUser: () => Promise.resolve({ data: { user: MOCK_USER }, error: null }),
  signInWithPassword: () => {
    for (const cb of authCallbacks) cb('SIGNED_IN', MOCK_SESSION);
    return Promise.resolve({ data: { user: MOCK_USER, session: MOCK_SESSION }, error: null });
  },
  signUp: () => {
    for (const cb of authCallbacks) cb('SIGNED_IN', MOCK_SESSION);
    return Promise.resolve({ data: { user: MOCK_USER, session: MOCK_SESSION }, error: null });
  },
  signOut: () => {
    for (const cb of authCallbacks) cb('SIGNED_OUT', null);
    return Promise.resolve({ error: null });
  },
  resetPasswordForEmail: () => Promise.resolve({ data: {}, error: null }),
  updateUser: () => Promise.resolve({ data: { user: MOCK_USER }, error: null }),
  onAuthStateChange: (callback: AuthCallback) => {
    authCallbacks.push(callback);
    setTimeout(() => callback('INITIAL_SESSION', MOCK_SESSION), 0);
    return {
      data: {
        subscription: {
          id: 'mock-sub',
          unsubscribe: () => { authCallbacks = authCallbacks.filter(cb => cb !== callback); },
        },
      },
    };
  },
};

// ─── Edge Functions ───
const functions = {
  invoke: (name: string, _opts?: any) => {
    if (name === 'daily-briefing') {
      return Promise.resolve({
        data: {
          briefing: {
            greeting: 'Good morning! Here\'s your daily briefing.',
            priorities: [
              { action: 'Follow up with McKinsey on space study results', reason: 'Lease expires Sept 2025 — decision timeline is narrowing', urgency: 'high', type: 'follow_up' },
              { action: 'Respond to Deloitte RFP by Friday deadline', reason: 'They\'re shortlisting properties this month', urgency: 'high', type: 'email' },
              { action: 'Schedule tour with Booz Allen for secure space', reason: 'New contract win creating immediate space need', urgency: 'medium', type: 'meeting' },
              { action: 'Send comp package to Arnold & Porter', reason: 'Active in market for 160K SF trophy space', urgency: 'medium', type: 'email' },
            ],
            insights: [
              'Your email response rate is 57% this month — above the 40% industry average.',
              'The East End submarket has seen 3 major requirements in the last 30 days.',
              'Homer Building vacancy is trending toward 30% — watch for concession opportunities.',
            ],
            stale_alert: null,
          },
          context: {
            pipelineCount: store.pipeline_deals?.length || 0,
            overdueCount: 1,
            dueTodayCount: 2,
            staleCount: 0,
            weeklyActivities: store.activities?.length || 0,
            generatedAt: now(),
          },
        },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  },
};

// ─── Exported Client ───
export const supabase = {
  auth,
  from: (table: string) => createQueryBuilder(table, 'select'),
  channel: () => createChannel(),
  removeChannel: () => {},
  functions,
  storage: {
    from: () => ({
      upload: () => Promise.resolve({ data: { path: '' }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
      download: () => Promise.resolve({ data: null, error: null }),
      remove: () => Promise.resolve({ data: null, error: null }),
      list: () => Promise.resolve({ data: [], error: null }),
    }),
  },
} as any;

// Override `from` to support insert/update/delete/upsert
const originalFrom = supabase.from;
supabase.from = (table: string) => {
  const selectBuilder = originalFrom(table);
  selectBuilder.insert = (data: any) => createQueryBuilder(table, 'insert', data);
  selectBuilder.update = (data: any) => createQueryBuilder(table, 'update', data);
  selectBuilder.upsert = (data: any) => createQueryBuilder(table, 'upsert', data);
  selectBuilder.delete = () => createQueryBuilder(table, 'delete');
  return selectBuilder;
};

// ─── Fetch Interceptor for Edge Functions ───
// Edge functions are called via fetch() directly, not through supabase.functions.invoke

function createSSEStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const words = text.split(' ');
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < words.length) {
        const chunk = (i === 0 ? '' : ' ') + words[i];
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`;
        controller.enqueue(encoder.encode(sseData));
        i++;
      } else {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });
}

function sseResponse(text: string): Response {
  return new Response(createSSEStream(text), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function jsonResponse(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generateMockEmail(body: any): string {
  const tenant = body.tenantName || 'your team';
  const contact = body.contactName || 'there';
  const building = body.buildingName || 'your current building';
  const industry = body.industry || 'your industry';
  const sqft = body.sqft ? `${(body.sqft / 1000).toFixed(0)}K SF` : 'your current space';
  const reason = body.outreachReason || 'lease_expiration';

  const reasonIntros: Record<string, string> = {
    lease_expiration: `With ${tenant}'s lease approaching expiration, I wanted to reach out to discuss how the current market conditions could work in your favor.`,
    expansion: `I've been following ${tenant}'s growth trajectory and wanted to share some expansion options that align with your needs.`,
    vacancy: `Given the evolving dynamics at ${building}, I wanted to connect about some compelling alternatives worth considering.`,
    building_sale: `With the recent ownership change at ${building}, I thought it would be a good time to discuss how this might impact your tenancy and what options are available.`,
    market_news: `Some recent developments in the DC office market are particularly relevant to ${tenant}, and I wanted to make sure you had this intelligence.`,
    contraction: `I understand many organizations in the ${industry} sector are rethinking their space strategy. I have some flexible options that could help ${tenant} optimize its footprint.`,
  };

  const intro = reasonIntros[reason] || reasonIntros.lease_expiration;

  return `Subject: ${tenant} — Office Space Opportunities in DC

Hi ${contact},

${intro}

The DC office market is experiencing significant shifts right now, with vacancy rates creating opportunities for tenants like ${tenant} to secure premium space at favorable terms. Given your ${sqft} requirement, I've identified several Class A properties that could be an excellent fit:

1. **Midtown Center** — New trophy development with best-in-class amenities, LEED Platinum certified, direct Metro access
2. **Capitol Crossing** — Modern campus-style offering with flexible floor plates, ideal for collaborative work environments
3. **1900 N Street** — Recently renovated with state-of-the-art conference facilities and a tenant-only fitness center

Current market concessions are historically generous — we're seeing 12-18 months of free rent and $85-100/SF in tenant improvement allowances for commitments of this size.

I'd welcome the opportunity to walk you through these options and discuss how they align with ${tenant}'s priorities. Would you have 20 minutes this week for a brief call?

Best regards,
Demo User
Senior Vice President
DealFlow Commercial Real Estate
(202) 555-0150`;
}

function generateMockFollowUp(body: any): string {
  const tenant = body.tenantName || 'your team';
  const contact = body.contactName || 'there';
  const days = body.daysSince || 7;

  return `Subject: Re: ${tenant} — Following Up

Hi ${contact},

I wanted to circle back on my note from ${days} days ago regarding office space options for ${tenant}. I know how busy things can get, so I'll keep this brief.

Since we last connected, a few new developments worth noting:

• A prime floor just became available at Midtown Center that wasn't on the market before
• Concession packages in the East End have gotten even more aggressive this month
• I've put together a custom market analysis specific to ${tenant}'s requirements

Would it be helpful if I sent over a brief summary of the most relevant options? No pressure — I'm happy to be a resource whenever the timing is right.

Best,
Demo User`;
}

function generateMockResearchBrief(body: any): string {
  const tenant = body.tenantName || 'Company';
  const industry = body.industry || 'Professional Services';
  const sqft = body.sqft ? `${(body.sqft / 1000).toFixed(0)}K SF` : 'N/A';

  return `# Research Brief: ${tenant}

## Company Overview
**Industry:** ${industry}
**Current Space:** ${sqft}
**Lease Expiration:** ${body.leaseExpiration || 'TBD'}

## Market Position
${tenant} is a leading organization in the ${industry} sector with a significant DC presence. Recent industry trends suggest a focus on modernizing office environments to support hybrid work models.

## Key Decision Drivers
1. **Lease Timeline** — With the current lease approaching expiration, there is a natural decision point ahead
2. **Space Optimization** — Many ${industry} firms are right-sizing their footprints, targeting 15-25% reductions
3. **Talent Attraction** — Premium office amenities are increasingly important for recruitment and retention
4. **Location Strategy** — Proximity to Metro and walkable amenities are top priorities

## Competitive Intelligence
- Two competing brokers have reportedly shown them properties in the East End
- Internal sources suggest a preference for newer construction (post-2015)
- Budget appears to be in the $55-65/SF gross range

## Recommended Approach
Lead with market data showing favorable conditions for tenants. Emphasize your deep relationships with building ownership and ability to negotiate aggressive concession packages. Position yourself as a strategic advisor, not just a transaction broker.

## Talking Points
- Current vacancy rates give tenants unprecedented leverage
- Highlight 3 specific properties that match their stated preferences
- Reference successful relocations you've handled for similar organizations`;
}

function generateMockABVariant(body: any): string {
  const original = body.currentEmail || '';
  const subjectMatch = original.match(/^Subject:\s*([^\n]*)/i);
  const subject = subjectMatch ? subjectMatch[1].trim() : 'Office Space Opportunity';

  return `Subject: Quick question about ${subject.replace(/Subject:\s*/i, '').split('—')[0].trim()}'s office strategy

Hi there,

I'll get straight to the point — the DC office market is in a rare window where tenants have significant leverage, and I think that's directly relevant to your situation.

I've been tracking your lease timeline and have identified three properties that could save you 15-20% on your current occupancy costs while upgrading your space quality.

Rather than send a lengthy email, could I share a one-page comparison? Takes 2 minutes to review and could save your team months of searching.

Happy to send it over if helpful — just reply "yes" and I'll have it in your inbox within the hour.

Best,
Demo User`;
}

const MOCK_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const originalFetch = window.fetch;

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Only intercept calls to our mock Supabase URL
  if (!url.startsWith(MOCK_SUPABASE_URL) || !MOCK_SUPABASE_URL.includes('your-project')) {
    return originalFetch(input, init);
  }

  const body = init?.body ? JSON.parse(init.body as string) : {};

  // generate-outreach
  if (url.includes('/generate-outreach')) {
    console.info('[Mock] generate-outreach →', body.tenantName);
    return sseResponse(generateMockEmail(body));
  }

  // refine-email
  if (url.includes('/refine-email')) {
    console.info('[Mock] refine-email');
    const instruction = body.instruction || 'Make it better';
    const refined = body.currentEmail
      ? body.currentEmail.replace(/Best regards,/, `Looking forward to connecting.\n\nBest regards,`)
      : generateMockEmail(body);
    return sseResponse(`${refined}\n\n[Refined per your instruction: "${instruction}"]`);
  }

  // smart-drafting
  if (url.includes('/smart-drafting')) {
    const action = body.action;
    console.info('[Mock] smart-drafting →', action);

    if (action === 'subject_lines') {
      const tenant = body.tenantName || 'Your Company';
      return jsonResponse({
        subjects: [
          `${tenant} — DC Market Opportunity You Should Know About`,
          `Quick question about ${tenant}'s office strategy`,
          `The DC office deal window is closing — here's what it means for ${tenant}`,
          `3 properties that match ${tenant}'s requirements`,
          `${tenant}: Exclusive options before they hit the market`,
        ],
      });
    }

    if (action === 'rewrite_tone') {
      const tone = body.tone || 'professional';
      const tonePrefix: Record<string, string> = {
        formal: 'Subject: Office Space Inquiry — Formal Market Assessment\n\nDear Sir/Madam,\n\nI am writing to bring to your attention several commercial real estate opportunities that align with your organization\'s current requirements.',
        casual: 'Subject: Hey — some cool office spaces I found for you\n\nHey there!\n\nHope you\'re having a great week. I stumbled across some really interesting spaces that I think could be a perfect fit for your team.',
        consultative: 'Subject: Strategic Space Options — A Tailored Analysis\n\nHi there,\n\nAfter studying your organization\'s growth trajectory and current market dynamics, I\'ve developed a targeted recommendation of properties that could support your strategic objectives.',
        urgent: 'Subject: TIME-SENSITIVE: Premium Spaces Going Fast\n\nHi there,\n\nI wanted to flag something important — two of the best-fit properties for your team just hit the market, and based on current demand, they won\'t last long.',
      };
      const content = tonePrefix[tone] || tonePrefix.consultative;
      return sseResponse(`${content}\n\nI\'ve prepared a detailed analysis of the top options and would welcome the opportunity to walk you through them at your convenience.\n\nBest regards,\nDemo User`);
    }

    return sseResponse(body.currentEmail || 'Refined email content here.');
  }

  // smart-outreach
  if (url.includes('/smart-outreach')) {
    const action = body.action;
    console.info('[Mock] smart-outreach →', action);

    if (action === 'ab_variant') {
      return sseResponse(generateMockABVariant(body));
    }

    if (action === 'follow_up') {
      return sseResponse(generateMockFollowUp(body));
    }

    if (action === 'research_brief') {
      return sseResponse(generateMockResearchBrief(body));
    }

    if (action === 'build_sequence') {
      const tenant = body.tenantName || 'Prospect';
      const steps = body.steps || 5;
      const sequence = [];
      const timings = ['Day 0', 'Day 3', 'Day 7', 'Day 14', 'Day 21', 'Day 30', 'Day 45'];
      const subjects = [
        `${tenant} — DC Office Market Intelligence`,
        `Re: ${tenant} — Quick Follow-Up`,
        `${tenant} — New Property Alert`,
        `${tenant} — Market Comp Data You Should See`,
        `${tenant} — Final Thought Before I Go Quiet`,
        `${tenant} — Quarterly Check-In`,
        `${tenant} — Year-End Planning`,
      ];
      for (let i = 0; i < Math.min(steps, 7); i++) {
        sequence.push({
          step: i + 1,
          timing: timings[i],
          subject: subjects[i],
          body: i === 0
            ? generateMockEmail({ ...body, contactName: body.contactName || 'there' })
            : generateMockFollowUp({ ...body, daysSince: parseInt(timings[i].split(' ')[1]) }),
        });
      }
      return jsonResponse({ sequence });
    }

    if (action === 'handle_objection') {
      const objection = body.objection || 'We\'re not looking right now';
      return sseResponse(`Subject: Re: ${body.tenantName || 'Your'} Office Space\n\nI completely understand — "${objection}" is something I hear often, and I respect that.\n\nThat said, I'd offer one thought: the current market conditions are unusually favorable for tenants, and several organizations that weren't actively looking have used this window to lock in terms they wouldn't have gotten even 6 months ago.\n\nNo pressure at all — I just wanted to make sure you had the market intelligence to make an informed decision on your timeline. I'm always happy to be a resource whenever the time is right.\n\nBest,\nDemo User`);
    }

    return sseResponse('Generated content here.');
  }

  // fetch-market-news
  if (url.includes('/fetch-market-news')) {
    console.info('[Mock] fetch-market-news');
    return jsonResponse({
      news: [
        { id: 'n1', title: 'DC Office Vacancy Hits Record 22% — Tenants Gain Unprecedented Leverage', summary: 'The District\'s office market continues to soften, with overall vacancy reaching 22.1% in Q1. Landlords are offering historically generous concession packages to attract and retain tenants, including 15-18 months free rent and TI allowances above $90/SF.', source: 'CoStar Analytics', date: daysAgo(1), category: 'vacancy', relatedBuildings: ['b2', 'b5'] },
        { id: 'n2', title: 'Arnold & Porter Launches 160K SF Requirement in DC', summary: 'Am Law 100 firm Arnold & Porter has formally kicked off a search for approximately 160,000 SF of trophy-quality office space in DC, with a preference for East End locations near Metro. The firm currently occupies space at Franklin Square under a lease expiring Q1 2026.', source: 'Bisnow DC', date: daysAgo(2), category: 'lease', relatedTenants: ['t7'] },
        { id: 'n3', title: 'Tech Giant Eyes 250K SF in East End for Government Contracts Division', summary: 'An unnamed major technology company is reportedly seeking over 250,000 SF in the East End submarket to house its expanding government contracts division. Sources indicate the deal could be announced within 60 days.', source: 'Washington Business Journal', date: daysAgo(3), category: 'expansion' },
        { id: 'n4', title: 'Brookfield Mulls Residential Conversion at Homer Building', summary: 'Brookfield Properties is reportedly studying the feasibility of converting upper floors of the Homer Building at 601 13th St NW to residential use, as office vacancy in the 14-story building approaches 30%.', source: 'The Real Deal', date: daysAgo(4), category: 'vacancy', relatedBuildings: ['b2'] },
        { id: 'n5', title: 'Deloitte RFP: Firm Seeks 100-110K SF, Down From 150K', summary: 'Deloitte has issued an RFP for 100,000-110,000 SF of office space in DC, a significant reduction from its current 150,000 SF at the Homer Building. The firm is prioritizing Metro access, modern conference facilities, and flexibility for hybrid work.', source: 'Commercial Observer', date: daysAgo(2), category: 'contraction', relatedTenants: ['t4'], relatedBuildings: ['b2'] },
        { id: 'n6', title: 'JBG SMITH Offers 18-Month Free Rent at 2000 Penn Ave', summary: 'JBG SMITH is offering up to 18 months of free rent on new leases at 2000 Pennsylvania Avenue NW, as vacancy at the Class B building has reached 31%. The aggressive incentive package also includes $95/SF in tenant improvement allowances.', source: 'Bisnow DC', date: daysAgo(5), category: 'market', relatedBuildings: ['b5'] },
        { id: 'n7', title: 'AWS Expanding DC Presence Beyond HQ2', summary: 'Amazon Web Services is actively seeking satellite office space in DC proper to complement its Arlington HQ2 campus. The company is looking for 30,000-50,000 SF in the East End or Downtown submarkets for its government cloud team.', source: 'Washington Business Journal', date: daysAgo(3), category: 'expansion', relatedTenants: ['t6'] },
      ],
    });
  }

  // scan-company-news
  if (url.includes('/scan-company-news')) {
    console.info('[Mock] scan-company-news →', body.companyName || body.company_name);
    const company = body.companyName || body.company_name || 'Company';
    return jsonResponse({
      news: [
        { id: `cn-${uuid()}`, title: `${company} Reports Strong Q1 Revenue Growth`, summary: `${company} exceeded analyst expectations with 12% year-over-year revenue growth, signaling potential expansion of its DC operations.`, source: 'Reuters', date: daysAgo(5), category: 'expansion' },
        { id: `cn-${uuid()}`, title: `${company} Names New Head of Real Estate`, summary: `${company} has appointed a new VP of Corporate Real Estate, suggesting a strategic review of its office portfolio may be underway.`, source: 'BusinessWire', date: daysAgo(10), category: 'market' },
      ],
      citations: [`https://example.com/news/${company.toLowerCase().replace(/\s+/g, '-')}`],
    });
  }

  // daily-briefing (also called via fetch in DailyBriefing.tsx)
  if (url.includes('/daily-briefing')) {
    console.info('[Mock] daily-briefing');
    return jsonResponse({
      briefing: {
        greeting: 'Good morning! Here\'s your daily briefing.',
        priorities: [
          { action: 'Follow up with McKinsey on space study results', reason: 'Lease expires Sept 2025 — decision timeline is narrowing', urgency: 'high', type: 'follow_up' },
          { action: 'Respond to Deloitte RFP by Friday deadline', reason: 'They\'re shortlisting properties this month', urgency: 'high', type: 'email' },
          { action: 'Schedule tour with Booz Allen for secure space', reason: 'New contract win creating immediate space need', urgency: 'medium', type: 'meeting' },
          { action: 'Send comp package to Arnold & Porter', reason: 'Active in market for 160K SF trophy space', urgency: 'medium', type: 'email' },
        ],
        insights: [
          'Your email response rate is 57% this month — above the 40% industry average.',
          'The East End submarket has seen 3 major requirements in the last 30 days.',
          'Homer Building vacancy is trending toward 30% — watch for concession opportunities.',
        ],
        stale_alert: null,
      },
      context: {
        pipelineCount: store.pipeline_deals?.length || 0,
        overdueCount: 1,
        dueTodayCount: 2,
        staleCount: 0,
        weeklyActivities: store.activities?.length || 0,
        generatedAt: now(),
      },
    });
  }

  // deal-copilot
  if (url.includes('/deal-copilot')) {
    console.info('[Mock] deal-copilot');
    return sseResponse('I\'ve analyzed your current pipeline and here are my top recommendations:\n\n1. **McKinsey** is your highest-priority follow-up — their lease expires in 6 months and they\'re actively evaluating options.\n\n2. **Deloitte\'s RFP** represents your biggest near-term opportunity. Focus on properties with strong Metro access and modern conference facilities.\n\n3. Consider reaching out to **Center for American Progress** — their November expiration is approaching fast and they haven\'t started looking yet.\n\nWould you like me to draft an outreach email for any of these prospects?');
  }

  // enrich-prospect
  if (url.includes('/enrich-prospect')) {
    console.info('[Mock] enrich-prospect');
    return jsonResponse({
      company: body.prospectName || 'Company',
      revenue: '$2.4B',
      employees: 12500,
      headcount_dc: 450,
      industry: body.industry || 'Professional Services',
      recent_news: ['Announced Q1 earnings beat', 'New DC office leadership appointed'],
      competitors: ['Competitor A', 'Competitor B', 'Competitor C'],
      decision_makers: [
        { name: 'Jane Smith', title: 'VP Real Estate', email: 'j.smith@company.com' },
        { name: 'Tom Brown', title: 'COO', email: 't.brown@company.com' },
      ],
    });
  }

  // Catch-all for other edge function calls
  if (url.includes('/functions/v1/')) {
    console.info('[Mock] Unhandled edge function:', url);
    return jsonResponse({ data: null, error: null });
  }

  return originalFetch(input, init);
};
