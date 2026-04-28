// Pipeline types and helpers
export type PipelineStage = 'hot_prospect' | 'meeting_set' | 'meeting_held' | 'moving_forward' | 'won' | 'closed' | 'lost';

export type Touchpoint = {
  id: string;
  type: 'market_update' | 'lease_comp' | 'space_available' | 'building_news' | 'check_in' | 'intro_colleague' | 'event_invite';
  title: string;
  description: string;
  suggested: boolean;
  sentAt?: string; // ISO date when touchpoint was sent
  followUpDate?: string; // ISO date for follow-up reminder
};

export type PipelineItem = {
  tenantId: string;
  buildingId: string;
  stage: PipelineStage;
  notes: string[];
  lastActivity: string;
  // Manual prospect fields (when not linked to a mock tenant)
  isManual?: boolean;
  prospectName?: string;
  prospectCompany?: string;
  prospectEmail?: string;
  prospectPhone?: string;
  prospectSqft?: number;
  touchpoints?: Touchpoint[];
  sentTouchpoints?: Touchpoint[]; // touchpoints that have been sent
  sortOrder?: number;
};

export const touchpointLabels: Record<Touchpoint['type'], string> = {
  market_update: 'Market Update',
  lease_comp: 'Lease Comp Share',
  space_available: 'New Space Available',
  building_news: 'Building News',
  check_in: 'Check-In',
  intro_colleague: 'Introduce Colleague',
  event_invite: 'Event Invitation',
};

export const touchpointDescriptions: Record<Touchpoint['type'], string> = {
  market_update: 'Share a relevant submarket trend, vacancy shift, or rental rate movement',
  lease_comp: 'Forward a recent comparable lease deal that validates their strategy or creates urgency',
  space_available: 'Alert them to a new space option that fits their requirements',
  building_news: 'Share ownership changes, renovations, or amenity upgrades at their building',
  check_in: 'Casual follow-up to maintain the relationship and gauge timing',
  intro_colleague: 'Connect them with a specialist (capital markets, project mgmt, etc.)',
  event_invite: 'Invite to a firm event, market briefing, or industry panel',
};

export const generateTouchpoints = (item: PipelineItem): Touchpoint[] => {
  const touchpoints: Touchpoint[] = [];
  const types: Touchpoint['type'][] = ['market_update', 'lease_comp', 'space_available', 'building_news', 'check_in', 'intro_colleague', 'event_invite'];

  // Generate contextual touchpoints based on stage
  if (item.stage === 'meeting_set' || item.stage === 'meeting_held') {
    touchpoints.push({
      id: `tp-${item.tenantId}-1`,
      type: 'market_update',
      title: 'Share Q1 2026 submarket report',
      description: 'Send the latest vacancy and rental rate data for their submarket to demonstrate expertise before/after the meeting.',
      suggested: true,
    });
    touchpoints.push({
      id: `tp-${item.tenantId}-2`,
      type: 'lease_comp',
      title: 'Share relevant lease comp',
      description: 'Send a recent comparable deal to frame market expectations and build credibility.',
      suggested: true,
    });
    touchpoints.push({
      id: `tp-${item.tenantId}-3`,
      type: 'check_in',
      title: 'Post-meeting follow-up',
      description: 'Send a brief recap of key discussion points and proposed next steps.',
      suggested: true,
    });
  }

  if (item.stage === 'moving_forward') {
    touchpoints.push({
      id: `tp-${item.tenantId}-4`,
      type: 'space_available',
      title: 'New space option alert',
      description: 'A new listing just hit the market that fits their size requirements — share before competitors.',
      suggested: true,
    });
    touchpoints.push({
      id: `tp-${item.tenantId}-5`,
      type: 'intro_colleague',
      title: 'Introduce project management team',
      description: 'Connect them with your firm\'s project management group to discuss buildout timelines and TI coordination.',
      suggested: true,
    });
    touchpoints.push({
      id: `tp-${item.tenantId}-6`,
      type: 'building_news',
      title: 'Building amenity upgrade news',
      description: 'Share recent building improvements or planned renovations that could affect their decision.',
      suggested: true,
    });
  }

  if (item.stage === 'won' || item.stage === 'closed') {
    touchpoints.push({
      id: `tp-${item.tenantId}-7`,
      type: 'event_invite',
      title: 'Invite to client appreciation event',
      description: 'Strengthen the relationship by inviting them to an upcoming firm event or market briefing.',
      suggested: true,
    });
    touchpoints.push({
      id: `tp-${item.tenantId}-8`,
      type: 'check_in',
      title: 'Quarterly check-in',
      description: 'Touch base on how the space is working out and if any needs have changed.',
      suggested: true,
    });
  }

  // Always add a generic check-in if not already present
  if (!touchpoints.find(t => t.type === 'check_in')) {
    touchpoints.push({
      id: `tp-${item.tenantId}-9`,
      type: 'check_in',
      title: 'Relationship check-in',
      description: 'Maintain the relationship with a casual touchpoint — ask about their business, upcoming plans, or space satisfaction.',
      suggested: false,
    });
  }

  return touchpoints;
};

export const stageLabels: Record<PipelineStage, string> = {
  hot_prospect: 'Hot Prospect',
  meeting_set: 'Meeting Set',
  meeting_held: 'Meeting Held',
  moving_forward: 'Moving Forward',
  won: 'Won',
  closed: 'Closed',
  lost: 'Lost',
};

export const stageColors: Record<PipelineStage, string> = {
  hot_prospect: 'bg-destructive/20 text-destructive',
  meeting_set: 'bg-info/20 text-info',
  meeting_held: 'bg-primary/20 text-primary',
  moving_forward: 'bg-warning/20 text-warning',
  won: 'bg-success/20 text-success',
  closed: 'bg-muted text-muted-foreground',
  lost: 'bg-destructive/20 text-destructive',
};

export const stageHues: Record<PipelineStage, string> = {
  hot_prospect: '213 94% 58%',
  meeting_set: '255 88% 66%',
  meeting_held: '230 86% 64%',
  moving_forward: '320 84% 64%',
  won: '28 92% 60%',
  closed: '152 70% 50%',
  lost: '217 12% 48%',
};

export const stagePillClass =
  'inline-flex items-center gap-1 h-[21px] px-2 rounded-full ' +
  'text-[10.5px] font-medium whitespace-nowrap ' +
  'border bg-[hsl(var(--stage-hue)/0.08)] border-[hsl(var(--stage-hue)/0.22)] ' +
  'text-[hsl(var(--stage-hue))]';

const STORAGE_KEY = 'dealflow-pipeline';

export const getPipeline = (): PipelineItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

export const savePipeline = (items: PipelineItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const getOrCreatePipelineItem = (tenantId: string, buildingId: string): PipelineItem => {
  const pipeline = getPipeline();
  const existing = pipeline.find(p => p.tenantId === tenantId && p.buildingId === buildingId);
  if (existing) return existing;
  const item: PipelineItem = {
    tenantId,
    buildingId,
    stage: 'meeting_set',
    notes: [],
    lastActivity: new Date().toISOString(),
  };
  savePipeline([...pipeline, item]);
  return item;
};

export const updatePipelineStage = (tenantId: string, buildingId: string, stage: PipelineStage) => {
  const pipeline = getPipeline();
  const idx = pipeline.findIndex(p => p.tenantId === tenantId && p.buildingId === buildingId);
  if (idx >= 0) {
    pipeline[idx].stage = stage;
    pipeline[idx].lastActivity = new Date().toISOString();
  } else {
    pipeline.push({ tenantId, buildingId, stage, notes: [], lastActivity: new Date().toISOString() });
  }
  savePipeline(pipeline);
};

export const addPipelineNote = (tenantId: string, buildingId: string, note: string) => {
  const pipeline = getPipeline();
  const idx = pipeline.findIndex(p => p.tenantId === tenantId && p.buildingId === buildingId);
  if (idx >= 0) {
    pipeline[idx].notes.push(note);
    pipeline[idx].lastActivity = new Date().toISOString();
  } else {
    pipeline.push({ tenantId, buildingId, stage: 'meeting_set', notes: [note], lastActivity: new Date().toISOString() });
  }
  savePipeline(pipeline);
};

export const markTouchpointSent = (tenantId: string, buildingId: string, touchpoint: Touchpoint) => {
  const pipeline = getPipeline();
  const idx = pipeline.findIndex(p => p.tenantId === tenantId && p.buildingId === buildingId);
  if (idx >= 0) {
    if (!pipeline[idx].sentTouchpoints) pipeline[idx].sentTouchpoints = [];
    const sent: Touchpoint = { ...touchpoint, sentAt: new Date().toISOString(), followUpDate: new Date(Date.now() + 7 * 86400000).toISOString() };
    pipeline[idx].sentTouchpoints!.push(sent);
    pipeline[idx].lastActivity = new Date().toISOString();
    savePipeline(pipeline);
  }
  return getPipeline();
};

export const getOverdueTouchpoints = (): { item: PipelineItem; touchpoint: Touchpoint }[] => {
  const now = new Date().toISOString();
  const results: { item: PipelineItem; touchpoint: Touchpoint }[] = [];
  getPipeline().forEach(item => {
    (item.sentTouchpoints || []).forEach(tp => {
      if (tp.followUpDate && tp.followUpDate < now) {
        results.push({ item, touchpoint: tp });
      }
    });
  });
  return results;
};

// Comp data
export type LeaseComp = {
  id: string;
  tenant: string;
  building: string;
  address: string;
  sqft: number;
  rentPerSf: number;
  tiPerSf: number;
  freeRentMonths: number;
  leaseTerm: number;
  commencementDate: string;
  dealType: 'New' | 'Renewal' | 'Expansion' | 'Sublease';
  submarket: string;
  class: 'A' | 'B' | 'C';
};

export const leaseComps: LeaseComp[] = [
  { id: 'c1', tenant: 'Kirkland & Ellis', building: '1301 Pennsylvania Ave', address: '1301 Pennsylvania Ave NW', sqft: 95000, rentPerSf: 72, tiPerSf: 125, freeRentMonths: 18, leaseTerm: 15, commencementDate: '2025-01-15', dealType: 'New', submarket: 'East End', class: 'A' },
  { id: 'c2', tenant: 'Accenture Federal', building: '800 North Glebe Rd', address: '800 North Glebe Rd, Arlington', sqft: 120000, rentPerSf: 55, tiPerSf: 95, freeRentMonths: 12, leaseTerm: 12, commencementDate: '2025-02-01', dealType: 'Renewal', submarket: 'Rosslyn-Ballston', class: 'A' },
  { id: 'c3', tenant: 'Gibson Dunn', building: '1050 Connecticut Ave', address: '1050 Connecticut Ave NW', sqft: 68000, rentPerSf: 78, tiPerSf: 140, freeRentMonths: 24, leaseTerm: 15, commencementDate: '2024-11-01', dealType: 'New', submarket: 'CBD', class: 'A' },
  { id: 'c4', tenant: 'CACI International', building: '1100 17th St NW', address: '1100 17th St NW', sqft: 45000, rentPerSf: 52, tiPerSf: 80, freeRentMonths: 10, leaseTerm: 10, commencementDate: '2024-12-15', dealType: 'Expansion', submarket: 'CBD', class: 'B' },
  { id: 'c5', tenant: 'Covington & Burling', building: 'CityCenter DC', address: '850 10th St NW', sqft: 210000, rentPerSf: 85, tiPerSf: 150, freeRentMonths: 24, leaseTerm: 17, commencementDate: '2024-09-01', dealType: 'New', submarket: 'East End', class: 'A' },
  { id: 'c6', tenant: 'PwC', building: '101 Constitution Ave', address: '101 Constitution Ave NW', sqft: 88000, rentPerSf: 62, tiPerSf: 100, freeRentMonths: 14, leaseTerm: 12, commencementDate: '2025-03-01', dealType: 'Renewal', submarket: 'Capitol Hill', class: 'A' },
  { id: 'c7', tenant: 'Palantir Technologies', building: '1555 Wilson Blvd', address: '1555 Wilson Blvd, Arlington', sqft: 35000, rentPerSf: 48, tiPerSf: 70, freeRentMonths: 6, leaseTerm: 7, commencementDate: '2025-01-10', dealType: 'Sublease', submarket: 'Rosslyn-Ballston', class: 'B' },
  { id: 'c8', tenant: 'Latham & Watkins', building: '555 11th St NW', address: '555 11th St NW', sqft: 155000, rentPerSf: 82, tiPerSf: 145, freeRentMonths: 20, leaseTerm: 16, commencementDate: '2024-10-01', dealType: 'New', submarket: 'East End', class: 'A' },
];

// Alert data
export type MarketAlert = {
  id: string;
  type: 'lease_expiry' | 'news' | 'building_sale' | 'vacancy_change' | 'new_listing';
  title: string;
  description: string;
  timestamp: string;
  relatedTenantId?: string;
  relatedBuildingId?: string;
  read: boolean;
  priority: 'high' | 'medium' | 'low';
};

export const marketAlerts: MarketAlert[] = [
  { id: 'a1', type: 'lease_expiry', title: 'McKinsey lease expires in 6 months', description: 'McKinsey & Company at 1100 New York Avenue — 85,000 SF lease expires September 30, 2025. Recommend immediate outreach.', timestamp: '2025-03-09T08:00:00Z', relatedTenantId: 't1', relatedBuildingId: 'b1', read: false, priority: 'high' },
  { id: 'a2', type: 'lease_expiry', title: 'WeWork lease expires THIS MONTH', description: 'WeWork at 1100 New York Avenue — 45,000 SF lease expires March 31, 2025. Space may become available.', timestamp: '2025-03-09T08:00:00Z', relatedTenantId: 't3', relatedBuildingId: 'b1', read: false, priority: 'high' },
  { id: 'a3', type: 'news', title: 'Deloitte RFP confirmed in market', description: 'Deloitte has issued an RFP for 100-110K SF, down from their current 150K SF at The Homer Building. Multiple brokers have confirmed receiving the RFP.', timestamp: '2025-03-08T14:00:00Z', relatedTenantId: 't4', relatedBuildingId: 'b2', read: false, priority: 'high' },
  { id: 'a4', type: 'building_sale', title: '1100 New York Ave sale closed', description: 'Boston Properties completed the $285M sale. New ownership group is foreign-based — tenant relations may shift.', timestamp: '2025-03-07T10:00:00Z', relatedBuildingId: 'b1', read: true, priority: 'medium' },
  { id: 'a5', type: 'vacancy_change', title: 'Homer Building vacancy hits 22.5%', description: 'Two additional tenants on floors 2-3 have given notice. Building vacancy expected to reach 30% by Q3 2025.', timestamp: '2025-03-06T16:00:00Z', relatedBuildingId: 'b2', read: true, priority: 'medium' },
  { id: 'a6', type: 'news', title: 'Arnold & Porter hires CBRE for relocation', description: 'Arnold & Porter has engaged CBRE to evaluate relocation options. 160K SF requirement with March 2026 deadline.', timestamp: '2025-03-05T09:00:00Z', relatedTenantId: 't7', relatedBuildingId: 'b3', read: true, priority: 'high' },
  { id: 'a7', type: 'new_listing', title: 'New trophy listing: Midtown Center 80K SF', description: 'Midtown Center has listed 80,000 SF of contiguous Class A+ space. Floors 8-10 available immediately with white-box finish.', timestamp: '2025-03-04T11:00:00Z', read: true, priority: 'low' },
  { id: 'a8', type: 'vacancy_change', title: '2000 Penn Ave vacancy critical at 31%', description: 'Vornado\'s 2000 Pennsylvania Avenue now at 31% vacancy. Aggressive concession packages being offered (18 months free rent on new leases).', timestamp: '2025-03-03T15:00:00Z', relatedBuildingId: 'b5', read: true, priority: 'medium' },
  { id: 'a9', type: 'lease_expiry', title: 'Squire Patton Boggs — year-end expiration', description: 'Squire Patton Boggs at 2000 Penn Ave — 65,000 SF lease expires December 31, 2025. Building at 31% vacancy creates strong relocation motivation.', timestamp: '2025-03-02T08:00:00Z', relatedTenantId: 't9', relatedBuildingId: 'b5', read: true, priority: 'high' },
];
