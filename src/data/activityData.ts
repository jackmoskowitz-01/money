// Activity log, tasks, assignments, and enrichment data

export type ActivityType = 'email_sent' | 'call' | 'meeting' | 'note' | 'stage_change' | 'ai_email' | 'task_created';

export type ActivityEntry = {
  id: string;
  tenantId: string;
  buildingId: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  outreachReasonUsed?: string; // track which reason was used to avoid duplicates
};

export type BrokerTask = {
  id: string;
  tenantId?: string;
  buildingId?: string;
  title: string;
  description: string;
  type: 'follow_up' | 'call' | 'meeting' | 'email' | 'research' | 'other';
  dueDate: string; // ISO date string
  completed: boolean;
  createdAt: string;
};

export type BrokerAssignment = {
  tenantId: string;
  buildingId: string;
  brokerId: string;
  brokerName: string;
  assignedAt: string;
};

const ACTIVITY_KEY = 'dealflow-activities';
const TASKS_KEY = 'dealflow-tasks';
const ASSIGNMENTS_KEY = 'dealflow-assignments';

// ---- Activities ----
export const getActivities = (tenantId?: string): ActivityEntry[] => {
  try {
    const stored = localStorage.getItem(ACTIVITY_KEY);
    const all: ActivityEntry[] = stored ? JSON.parse(stored) : seedActivities;
    if (!stored) localStorage.setItem(ACTIVITY_KEY, JSON.stringify(seedActivities));
    return tenantId ? all.filter(a => a.tenantId === tenantId) : all;
  } catch { return []; }
};

export const addActivity = (entry: Omit<ActivityEntry, 'id' | 'timestamp'>): ActivityEntry => {
  const activities = getActivities();
  const newEntry: ActivityEntry = {
    ...entry,
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  const updated = [newEntry, ...activities];
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(updated));
  return newEntry;
};

export const getUsedOutreachReasons = (tenantId: string): string[] => {
  const activities = getActivities(tenantId);
  return activities
    .filter(a => a.outreachReasonUsed)
    .map(a => a.outreachReasonUsed!);
};

// ---- Tasks ----
export const getTasks = (): BrokerTask[] => {
  try {
    const stored = localStorage.getItem(TASKS_KEY);
    const tasks: BrokerTask[] = stored ? JSON.parse(stored) : seedTasks;
    if (!stored) localStorage.setItem(TASKS_KEY, JSON.stringify(seedTasks));
    return tasks;
  } catch { return []; }
};

export const addTask = (task: Omit<BrokerTask, 'id' | 'createdAt'>): BrokerTask => {
  const tasks = getTasks();
  const newTask: BrokerTask = {
    ...task,
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(TASKS_KEY, JSON.stringify([newTask, ...tasks]));
  return newTask;
};

export const updateTask = (id: string, updates: Partial<BrokerTask>) => {
  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx >= 0) {
    tasks[idx] = { ...tasks[idx], ...updates };
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }
};

export const deleteTask = (id: string) => {
  const tasks = getTasks().filter(t => t.id !== id);
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
};

export const getTasksForDate = (dateStr: string): BrokerTask[] => {
  return getTasks().filter(t => t.dueDate.startsWith(dateStr));
};

export const getTaskCountsByDate = (): Record<string, number> => {
  const tasks = getTasks().filter(t => !t.completed);
  const counts: Record<string, number> = {};
  tasks.forEach(t => {
    const date = t.dueDate.split('T')[0];
    counts[date] = (counts[date] || 0) + 1;
  });
  return counts;
};

// ---- Assignments ----
export const getAssignments = (): BrokerAssignment[] => {
  try {
    const stored = localStorage.getItem(ASSIGNMENTS_KEY);
    const assignments: BrokerAssignment[] = stored ? JSON.parse(stored) : seedAssignments;
    if (!stored) localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(seedAssignments));
    return assignments;
  } catch { return []; }
};

export const assignTenant = (tenantId: string, buildingId: string, brokerId: string, brokerName: string) => {
  const assignments = getAssignments();
  const existing = assignments.findIndex(a => a.tenantId === tenantId && a.buildingId === buildingId);
  const entry: BrokerAssignment = { tenantId, buildingId, brokerId, brokerName, assignedAt: new Date().toISOString() };
  if (existing >= 0) {
    assignments[existing] = entry;
  } else {
    assignments.push(entry);
  }
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
};

export const getAssignmentForTenant = (tenantId: string): BrokerAssignment | undefined => {
  return getAssignments().find(a => a.tenantId === tenantId);
};

// ---- Brokers ----
export type Broker = { id: string; name: string; initials: string; color: string };

export const brokers: Broker[] = [
  { id: 'br1', name: 'Sarah Chen', initials: 'SC', color: 'bg-primary/20 text-primary' },
  { id: 'br2', name: 'Mike Johnson', initials: 'MJ', color: 'bg-info/20 text-info' },
  { id: 'br3', name: 'Lisa Park', initials: 'LP', color: 'bg-success/20 text-success' },
  { id: 'br4', name: 'Carlos Rivera', initials: 'CR', color: 'bg-warning/20 text-warning' },
];

// ---- Submarket Trend Data ----
export type SubmarketTrend = {
  submarket: string;
  quarters: { quarter: string; vacancy: number; absorption: number; rentPerSf: number }[];
};

export const submarketTrends: SubmarketTrend[] = [
  {
    submarket: 'East End',
    quarters: [
      { quarter: 'Q1 2024', vacancy: 17.2, absorption: -120000, rentPerSf: 68 },
      { quarter: 'Q2 2024', vacancy: 18.1, absorption: -85000, rentPerSf: 67 },
      { quarter: 'Q3 2024', vacancy: 19.5, absorption: -145000, rentPerSf: 65 },
      { quarter: 'Q4 2024', vacancy: 20.8, absorption: -62000, rentPerSf: 64 },
      { quarter: 'Q1 2025', vacancy: 21.3, absorption: -48000, rentPerSf: 63 },
    ],
  },
  {
    submarket: 'CBD',
    quarters: [
      { quarter: 'Q1 2024', vacancy: 19.8, absorption: -200000, rentPerSf: 58 },
      { quarter: 'Q2 2024', vacancy: 20.5, absorption: -95000, rentPerSf: 57 },
      { quarter: 'Q3 2024', vacancy: 21.8, absorption: -180000, rentPerSf: 55 },
      { quarter: 'Q4 2024', vacancy: 22.5, absorption: -100000, rentPerSf: 54 },
      { quarter: 'Q1 2025', vacancy: 23.1, absorption: -70000, rentPerSf: 53 },
    ],
  },
  {
    submarket: 'Capitol Hill',
    quarters: [
      { quarter: 'Q1 2024', vacancy: 12.5, absorption: 25000, rentPerSf: 52 },
      { quarter: 'Q2 2024', vacancy: 12.1, absorption: 40000, rentPerSf: 53 },
      { quarter: 'Q3 2024', vacancy: 11.8, absorption: 35000, rentPerSf: 54 },
      { quarter: 'Q4 2024', vacancy: 11.5, absorption: 28000, rentPerSf: 55 },
      { quarter: 'Q1 2025', vacancy: 11.2, absorption: 32000, rentPerSf: 56 },
    ],
  },
  {
    submarket: 'Rosslyn-Ballston',
    quarters: [
      { quarter: 'Q1 2024', vacancy: 15.3, absorption: -50000, rentPerSf: 48 },
      { quarter: 'Q2 2024', vacancy: 16.0, absorption: -65000, rentPerSf: 47 },
      { quarter: 'Q3 2024', vacancy: 16.8, absorption: -80000, rentPerSf: 46 },
      { quarter: 'Q4 2024', vacancy: 17.2, absorption: -42000, rentPerSf: 45 },
      { quarter: 'Q1 2025', vacancy: 17.5, absorption: -30000, rentPerSf: 45 },
    ],
  },
];

// ---- Building-to-Submarket mapping ----
export const buildingSubmarkets: Record<string, string> = {
  b1: 'East End',
  b2: 'East End',
  b3: 'East End',
  b4: 'CBD',
  b5: 'CBD',
};

// ---- Submarket News for touchpoints ----
export type SubmarketNewsItem = {
  id: string;
  submarket: string;
  title: string;
  summary: string;
  source: string;
  date: string;
  url?: string;
  category: 'development' | 'infrastructure' | 'policy' | 'tenant_movement' | 'investment' | 'amenity';
  touchpointAngle: string;
};

export const submarketNews: SubmarketNewsItem[] = [
  {
    id: 'sn1', submarket: 'East End',
    title: 'New Whole Foods Opening at City Center DC',
    summary: 'A 30,000 SF Whole Foods Market is set to open at CityCenterDC in Q3 2025, adding a major amenity draw to the East End submarket.',
    source: 'Washington Business Journal', date: '2025-03-08',
    url: 'https://www.bizjournals.com/washington/news/2025/03/08/whole-foods-citycenterdc-east-end-opening.html',
    category: 'amenity',
    touchpointAngle: 'Mention the new Whole Foods as an added amenity for employees — great for talent retention conversations.',
  },
  {
    id: 'sn2', submarket: 'East End',
    title: 'Metro Silver Line Phase 2 Boosting East End Accessibility',
    summary: 'The completion of Silver Line Phase 2 is driving increased foot traffic and transit scores for East End office buildings.',
    source: 'Greater Greater Washington', date: '2025-03-06',
    url: 'https://ggwash.org/view/2025/03/silver-line-phase-2-east-end-transit-boost',
    category: 'infrastructure',
    touchpointAngle: 'Use improved transit access as a selling point for tenants considering relocation within or to the East End.',
  },
  {
    id: 'sn3', submarket: 'East End',
    title: 'Midtown Center Lands 200K SF Tech Tenant',
    summary: 'A major tech firm has signed a 200,000 SF lease at Midtown Center, signaling continued demand for premium East End space.',
    source: 'Bisnow', date: '2025-03-04',
    url: 'https://www.bisnow.com/washington-dc',
    category: 'tenant_movement',
    touchpointAngle: 'Reference this deal to create urgency — premium East End space is getting absorbed, and tenants need to act before options narrow.',
  },
  {
    id: 'sn4', submarket: 'East End',
    title: 'DC Council Approves Downtown Tax Incentive Zone',
    summary: 'The DC Council has approved a 10-year tax abatement program for new and relocating office tenants in the East End and CBD, effective July 2025.',
    source: 'Washington Post', date: '2025-02-28',
    url: 'https://www.washingtonpost.com/',
    category: 'policy',
    touchpointAngle: 'Lead with cost savings — tenants who move now can lock in significant tax benefits under the new incentive program.',
  },
  {
    id: 'sn5', submarket: 'CBD',
    title: 'GSA Consolidating Federal Offices Along Pennsylvania Ave',
    summary: 'The General Services Administration is consolidating multiple agency offices into renovated buildings on Pennsylvania Avenue, freeing up 400K+ SF.',
    source: 'Federal Times', date: '2025-03-07',
    url: 'https://www.federaltimes.com/',
    category: 'tenant_movement',
    touchpointAngle: 'Alert tenants near Penn Ave about potential disruption and new sublease inventory hitting the market.',
  },
  {
    id: 'sn6', submarket: 'CBD',
    title: 'New Streetcar Extension Connecting CBD to Georgetown',
    summary: 'DDOT announced plans for a streetcar extension from the CBD to Georgetown, with construction starting in 2026.',
    source: 'WTOP', date: '2025-03-03',
    url: 'https://wtop.com/',
    category: 'infrastructure',
    touchpointAngle: 'Use the planned streetcar as a forward-looking amenity — buildings along the route will see increased connectivity and value.',
  },
  {
    id: 'sn7', submarket: 'CBD',
    title: 'JBG SMITH Offering 18-Month Free Rent on CBD Properties',
    summary: 'JBG SMITH is offering aggressive concessions including 18 months of free rent on select CBD properties to combat rising vacancy.',
    source: 'CoStar', date: '2025-02-26',
    url: 'https://www.costar.com/',
    category: 'investment',
    touchpointAngle: 'Use competitor concessions as leverage — if their landlord isn\'t offering similar deals, it might be time to explore options.',
  },
  {
    id: 'sn8', submarket: 'Capitol Hill',
    title: 'Capitol Hill Office Market Tightening as Advocacy Groups Expand',
    summary: 'Advocacy and nonprofit organizations are driving demand on Capitol Hill, with vacancy dropping below 12% for the first time since 2019.',
    source: 'Washington Business Journal', date: '2025-03-05',
    url: 'https://www.bizjournals.com/washington/',
    category: 'tenant_movement',
    touchpointAngle: 'Capitol Hill is tightening — tenants looking for proximity to Congress should move fast before inventory shrinks further.',
  },
  {
    id: 'sn9', submarket: 'Rosslyn-Ballston',
    title: 'Amazon HQ2 Phase 2 Breaking Ground in Arlington',
    summary: 'Amazon has officially broken ground on Phase 2 of its HQ2 campus in Rosslyn-Ballston, expected to bring 25,000+ jobs to the corridor.',
    source: 'Arlington Now', date: '2025-03-02',
    url: 'https://www.arlnow.com/',
    category: 'development',
    touchpointAngle: 'HQ2 is driving massive demand for nearby office space — subcontractors and partners will need proximity.',
  },
  {
    id: 'sn10', submarket: 'Rosslyn-Ballston',
    title: 'Rosslyn BID Unveils $50M Public Space Improvement Plan',
    summary: 'The Rosslyn Business Improvement District announced a $50M investment in parks, streetscape, and public amenities over the next 3 years.',
    source: 'ARLnow', date: '2025-02-20',
    url: 'https://www.arlnow.com/',
    category: 'amenity',
    touchpointAngle: 'Rosslyn is investing heavily in quality of life — a strong talking point for tenants evaluating the corridor vs. downtown DC.',
  },
];

export const getSubmarketNews = (submarket: string): SubmarketNewsItem[] => {
  return submarketNews.filter(n => n.submarket === submarket);
};

// ---- Tenant Enrichment ----
export type TenantEnrichment = {
  tenantId: string;
  financialSignals: { type: 'hiring' | 'layoffs' | 'funding' | 'earnings'; title: string; date: string }[];
  spacePerEmployee: number;
  marketAvgSpacePerEmployee: number;
};

export const tenantEnrichments: Record<string, TenantEnrichment> = {
  t1: {
    tenantId: 't1',
    financialSignals: [
      { type: 'hiring', title: 'Posted 45 new DC positions on LinkedIn', date: '2025-03-01' },
      { type: 'earnings', title: 'Revenue up 8% YoY per industry reports', date: '2025-02-15' },
    ],
    spacePerEmployee: 266, // 85000 / 320
    marketAvgSpacePerEmployee: 175,
  },
  t4: {
    tenantId: 't4',
    financialSignals: [
      { type: 'layoffs', title: 'Cut 1,200 consulting staff globally', date: '2025-02-20' },
      { type: 'earnings', title: 'Q4 revenue declined 3%', date: '2025-01-30' },
    ],
    spacePerEmployee: 250,
    marketAvgSpacePerEmployee: 175,
  },
  t6: {
    tenantId: 't6',
    financialSignals: [
      { type: 'hiring', title: 'GovCloud division hiring 200+ in DC area', date: '2025-03-05' },
      { type: 'funding', title: 'Won $10B JEDI II contract', date: '2025-02-28' },
    ],
    spacePerEmployee: 250,
    marketAvgSpacePerEmployee: 175,
  },
  t7: {
    tenantId: 't7',
    financialSignals: [
      { type: 'hiring', title: 'Lateral hires: 12 new partners from competitors', date: '2025-03-02' },
    ],
    spacePerEmployee: 320,
    marketAvgSpacePerEmployee: 175,
  },
  t9: {
    tenantId: 't9',
    financialSignals: [
      { type: 'layoffs', title: 'Reduced lobbying staff by 15%', date: '2025-01-15' },
    ],
    spacePerEmployee: 361,
    marketAvgSpacePerEmployee: 175,
  },
};

// ---- Building Ownership History ----
export type OwnershipRecord = {
  buildingId: string;
  history: { owner: string; acquiredDate: string; price?: string; capRate?: string }[];
};

export const ownershipHistory: Record<string, OwnershipRecord> = {
  b1: {
    buildingId: 'b1',
    history: [
      { owner: 'Foreign Investment Group', acquiredDate: '2024-06-15', price: '$285M', capRate: '5.8%' },
      { owner: 'Boston Properties', acquiredDate: '2012-03-01', price: '$195M', capRate: '6.2%' },
      { owner: 'Mack-Cali Realty', acquiredDate: '2004-09-01', price: '$142M' },
    ],
  },
  b2: {
    buildingId: 'b2',
    history: [
      { owner: 'Brookfield Properties', acquiredDate: '2018-11-01', price: '$310M', capRate: '5.5%' },
      { owner: 'Hines', acquiredDate: '2008-06-01', price: '$245M', capRate: '6.0%' },
    ],
  },
  b3: {
    buildingId: 'b3',
    history: [
      { owner: 'Tishman Speyer', acquiredDate: '2016-04-01', price: '$420M', capRate: '5.2%' },
    ],
  },
  b5: {
    buildingId: 'b5',
    history: [
      { owner: 'Vornado Realty Trust', acquiredDate: '2010-08-01', price: '$155M', capRate: '6.8%' },
      { owner: 'Beacon Capital', acquiredDate: '2002-01-01', price: '$98M' },
    ],
  },
};

// ---- Seed Data ----
const seedActivities: ActivityEntry[] = [
  { id: 'act-1', tenantId: 't1', buildingId: 'b1', type: 'email_sent', title: 'Sent lease expiration outreach', description: 'Emailed Sarah Mitchell about upcoming Sept 2025 lease expiration. Mentioned market alternatives.', timestamp: '2025-03-06T10:30:00Z', outreachReasonUsed: 'Lease Expiring in 6 Months' },
  { id: 'act-2', tenantId: 't1', buildingId: 'b1', type: 'note', title: 'Intel from colleague', description: 'Mike J mentioned McKinsey is doing a space study with JLL. May be looking to downsize 20%.', timestamp: '2025-03-05T14:00:00Z' },
  { id: 'act-3', tenantId: 't4', buildingId: 'b2', type: 'call', title: 'Cold call to Patricia Wong', description: 'Left voicemail. Will try again Thursday. Her assistant said she\'s in meetings all week.', timestamp: '2025-03-04T09:15:00Z' },
  { id: 'act-4', tenantId: 't4', buildingId: 'b2', type: 'email_sent', title: 'Sent hybrid work angle', description: 'Sent email about Deloitte reducing footprint. Included 3 alternative buildings with modern spec.', timestamp: '2025-03-02T11:00:00Z', outreachReasonUsed: 'Hybrid Work Reduction' },
  { id: 'act-5', tenantId: 't7', buildingId: 'b3', type: 'meeting', title: 'Coffee meeting with Michelle Torres', description: 'Met at Blue Bottle. She confirmed Arnold & Porter is actively looking. Shortlist of 4 buildings. They want trophy space, modern amenities, and good Metro access.', timestamp: '2025-03-03T15:30:00Z' },
  { id: 'act-6', tenantId: 't9', buildingId: 'b5', type: 'email_sent', title: 'Vacancy concern outreach', description: 'Highlighted the 31% vacancy issue and aggressive concessions from Vornado. Suggested exploring Class A alternatives.', timestamp: '2025-03-01T10:00:00Z', outreachReasonUsed: 'Critical Building Vacancy' },
  { id: 'act-7', tenantId: 't3', buildingId: 'b1', type: 'stage_change', title: 'Moved to Lost', description: 'WeWork confirmed they are exiting 1100 NY Ave. Space will be available April 1.', timestamp: '2025-02-28T16:00:00Z' },
];

const seedTasks: BrokerTask[] = [
  { id: 'task-1', tenantId: 't1', buildingId: 'b1', title: 'Follow up with Sarah Mitchell (McKinsey)', description: 'Call to discuss lease renewal vs relocation. She hasn\'t responded to email.', type: 'follow_up', dueDate: '2025-03-10', completed: false, createdAt: '2025-03-06T10:30:00Z' },
  { id: 'task-2', tenantId: 't4', buildingId: 'b2', title: 'Call Patricia Wong (Deloitte)', description: 'Second attempt. Try calling before 9am.', type: 'call', dueDate: '2025-03-11', completed: false, createdAt: '2025-03-04T09:15:00Z' },
  { id: 'task-3', tenantId: 't7', buildingId: 'b3', title: 'Send tour options to Arnold & Porter', description: 'Michelle wants to see Midtown Center, CityCenter, and 1200 17th St.', type: 'email', dueDate: '2025-03-10', completed: false, createdAt: '2025-03-03T16:00:00Z' },
  { id: 'task-4', tenantId: 't9', buildingId: 'b5', title: 'Research Class A alternatives for Squire PB', description: 'Find 3-4 buildings with 60-70K SF available, good Metro access, under $70/SF.', type: 'research', dueDate: '2025-03-12', completed: false, createdAt: '2025-03-01T10:00:00Z' },
  { id: 'task-5', title: 'Prep weekly pipeline review', description: 'Update all pipeline stages and notes before Friday team meeting.', type: 'other', dueDate: '2025-03-14', completed: false, createdAt: '2025-03-07T08:00:00Z' },
  { id: 'task-6', tenantId: 't6', buildingId: 'b3', title: 'Meeting with David Park (AWS)', description: 'Discuss expansion needs for GovCloud team. Bring comps for NoMa and East End.', type: 'meeting', dueDate: '2025-03-13', completed: false, createdAt: '2025-03-05T11:00:00Z' },
  { id: 'task-7', tenantId: 't4', buildingId: 'b2', title: 'Send Deloitte RFP response', description: 'Prepare and send RFP response with 3 building options.', type: 'email', dueDate: '2025-03-15', completed: false, createdAt: '2025-03-08T09:00:00Z' },
  { id: 'task-8', tenantId: 't1', buildingId: 'b1', title: 'Tour McKinsey at Midtown Center', description: 'Confirmed tour with building management. Meet Sarah at lobby 2pm.', type: 'meeting', dueDate: '2025-03-17', completed: false, createdAt: '2025-03-07T14:00:00Z' },
];

const seedAssignments: BrokerAssignment[] = [
  { tenantId: 't1', buildingId: 'b1', brokerId: 'br1', brokerName: 'Sarah Chen', assignedAt: '2025-02-15T08:00:00Z' },
  { tenantId: 't2', buildingId: 'b1', brokerId: 'br2', brokerName: 'Mike Johnson', assignedAt: '2025-02-15T08:00:00Z' },
  { tenantId: 't3', buildingId: 'b1', brokerId: 'br1', brokerName: 'Sarah Chen', assignedAt: '2025-02-15T08:00:00Z' },
  { tenantId: 't4', buildingId: 'b2', brokerId: 'br3', brokerName: 'Lisa Park', assignedAt: '2025-02-20T08:00:00Z' },
  { tenantId: 't5', buildingId: 'b2', brokerId: 'br2', brokerName: 'Mike Johnson', assignedAt: '2025-02-20T08:00:00Z' },
  { tenantId: 't6', buildingId: 'b3', brokerId: 'br4', brokerName: 'Carlos Rivera', assignedAt: '2025-03-01T08:00:00Z' },
  { tenantId: 't7', buildingId: 'b3', brokerId: 'br1', brokerName: 'Sarah Chen', assignedAt: '2025-03-01T08:00:00Z' },
  { tenantId: 't8', buildingId: 'b4', brokerId: 'br4', brokerName: 'Carlos Rivera', assignedAt: '2025-03-01T08:00:00Z' },
  { tenantId: 't9', buildingId: 'b5', brokerId: 'br3', brokerName: 'Lisa Park', assignedAt: '2025-03-01T08:00:00Z' },
];

// Activity type display helpers
export const activityTypeLabels: Record<ActivityType, string> = {
  email_sent: 'Email Sent',
  call: 'Phone Call',
  meeting: 'Meeting',
  note: 'Note',
  stage_change: 'Stage Change',
  ai_email: 'AI Email Generated',
  task_created: 'Task Created',
};

export const activityTypeIcons: Record<ActivityType, string> = {
  email_sent: '📧',
  call: '📞',
  meeting: '🤝',
  note: '📝',
  stage_change: '🔄',
  ai_email: '✨',
  task_created: '📋',
};
