export type Building = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  sqft: number;
  floors: number;
  yearBuilt: number;
  vacancyRate: number;
  owner: string;
  class: 'A' | 'B' | 'C';
  recentSale?: { date: string; price: string };
  tenants: Tenant[];
};

export type Tenant = {
  id: string;
  name: string;
  industry: string;
  sqft: number;
  floor: string;
  leaseExpiration: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  headcount: number;
  outreachReasons: OutreachReason[];
  isClient?: boolean;
};

export type OutreachReason = {
  type: 'lease_expiration' | 'vacancy' | 'market_news' | 'building_sale' | 'expansion' | 'contraction';
  title: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
};

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  date: string;
  category: 'lease' | 'sale' | 'expansion' | 'market' | 'vacancy' | 'contraction';
  relatedTenants?: string[];
  relatedBuildings?: string[];
};

export type ScoopPost = {
  id: string;
  author: string;
  authorAvatar: string;
  content: string;
  tags: string[];
  timestamp: string;
  likes: number;
  comments: number;
  verified: boolean;
};

export const buildings: Building[] = [
  {
    id: 'b1',
    name: '1100 New York Avenue',
    address: '1100 New York Ave NW, Washington, DC 20005',
    lat: 38.9007,
    lng: -77.0282,
    sqft: 425000,
    floors: 12,
    yearBuilt: 2004,
    vacancyRate: 14.2,
    owner: 'Boston Properties',
    class: 'A',
    recentSale: { date: '2024-06-15', price: '$285M' },
    tenants: [
      {
        id: 't1', name: 'McKinsey & Company', industry: 'Consulting', sqft: 85000, floor: '8-10',
        leaseExpiration: '2025-09-30', contactName: 'Sarah Mitchell', contactTitle: 'Office Manager',
        contactEmail: 's.mitchell@mckinsey.com', headcount: 320,
        outreachReasons: [
          { type: 'lease_expiration', title: 'Lease Expiring in 6 Months', description: 'McKinsey\'s lease at 1100 NY Ave expires Sept 2025. They occupy 85,000 SF across floors 8-10. Market intelligence suggests they are evaluating options.', urgency: 'high' },
          { type: 'building_sale', title: 'Recent Building Sale', description: 'Boston Properties sold the building for $285M in June 2024. New ownership may impact tenant relationships and building operations.', urgency: 'medium' },
          { type: 'market_news', title: 'Consulting Sector Office Consolidation', description: 'Major consulting firms are consolidating DC footprints. McKinsey may be looking to right-size their space.', urgency: 'medium' },
        ],
      },
      {
        id: 't2', name: 'Hogan Lovells', industry: 'Legal', sqft: 120000, floor: '3-7',
        leaseExpiration: '2027-12-31', contactName: 'James Chen', contactTitle: 'Managing Partner',
        contactEmail: 'j.chen@hoganlovells.com', headcount: 450,
        outreachReasons: [
          { type: 'expansion', title: 'Firm Growth & Hiring', description: 'Hogan Lovells has announced 15% headcount growth in DC. Current space may not accommodate expansion plans.', urgency: 'medium' },
          { type: 'vacancy', title: 'Adjacent Space Available', description: '14.2% vacancy in the building means adjacent floors could allow expansion without relocation.', urgency: 'low' },
        ],
      },
      {
        id: 't3', name: 'WeWork', industry: 'Coworking', sqft: 45000, floor: '11-12',
        leaseExpiration: '2025-03-31', contactName: 'Alex Rivera', contactTitle: 'Regional Director',
        contactEmail: 'a.rivera@wework.com', headcount: 200,
        outreachReasons: [
          { type: 'lease_expiration', title: 'Lease Expiring Imminently', description: 'WeWork lease expires March 2025. Given their restructuring, this space may become available or they may need to renegotiate.', urgency: 'high' },
          { type: 'contraction', title: 'Portfolio Rationalization', description: 'WeWork continues to shed locations post-bankruptcy. This location is at risk of closure.', urgency: 'high' },
        ],
      },
    ],
  },
  {
    id: 'b2',
    name: 'The Homer Building',
    address: '601 13th St NW, Washington, DC 20005',
    lat: 38.8980,
    lng: -77.0306,
    sqft: 540000,
    floors: 14,
    yearBuilt: 1914,
    vacancyRate: 22.5,
    owner: 'Brookfield Properties',
    class: 'A',
    tenants: [
      {
        id: 't4', name: 'Deloitte', industry: 'Consulting', sqft: 150000, floor: '5-9',
        leaseExpiration: '2026-06-30', contactName: 'Patricia Wong', contactTitle: 'Real Estate Director',
        contactEmail: 'p.wong@deloitte.com', headcount: 600,
        outreachReasons: [
          { type: 'lease_expiration', title: 'Lease Expiring 2026', description: 'Deloitte occupies 150K SF with a June 2026 expiration. With 18 months remaining, now is the time to present alternatives.', urgency: 'high' },
          { type: 'vacancy', title: 'High Building Vacancy', description: 'The Homer Building has 22.5% vacancy. Deloitte may have leverage to renegotiate or may be motivated to relocate.', urgency: 'medium' },
          { type: 'contraction', title: 'Hybrid Work Reduction', description: 'Deloitte has publicly committed to hybrid work, potentially reducing their DC footprint by 30%.', urgency: 'high' },
        ],
      },
      {
        id: 't5', name: 'Perkins Coie', industry: 'Legal', sqft: 75000, floor: '10-12',
        leaseExpiration: '2028-09-30', contactName: 'Robert Kim', contactTitle: 'Office Administrator',
        contactEmail: 'r.kim@perkinscoie.com', headcount: 200,
        outreachReasons: [
          { type: 'vacancy', title: 'Surrounding Vacancy Concerns', description: 'High vacancy in The Homer Building could impact amenities and building services, creating relocation motivation.', urgency: 'low' },
        ],
      },
    ],
  },
  {
    id: 'b3',
    name: 'Franklin Square',
    address: '1300 I St NW, Washington, DC 20005',
    lat: 38.9020,
    lng: -77.0300,
    sqft: 680000,
    floors: 16,
    yearBuilt: 1989,
    vacancyRate: 8.3,
    owner: 'Tishman Speyer',
    class: 'A',
    tenants: [
      {
        id: 't6', name: 'Amazon Web Services', industry: 'Technology', sqft: 200000, floor: '1-5',
        leaseExpiration: '2029-12-31', contactName: 'David Park', contactTitle: 'Workplace Manager',
        contactEmail: 'd.park@amazon.com', headcount: 800,
        outreachReasons: [
          { type: 'expansion', title: 'HQ2 Spillover Growth', description: 'AWS continues to expand beyond HQ2 in Arlington. DC office may need additional satellite space.', urgency: 'medium' },
          { type: 'market_news', title: 'Tech Sector DC Expansion', description: 'Major tech firms are increasing their DC presence for government contracts. AWS is leading this trend.', urgency: 'low' },
        ],
      },
      {
        id: 't7', name: 'Arnold & Porter', industry: 'Legal', sqft: 160000, floor: '8-14',
        leaseExpiration: '2026-03-31', contactName: 'Michelle Torres', contactTitle: 'Managing Director',
        contactEmail: 'm.torres@arnoldporter.com', headcount: 500,
        outreachReasons: [
          { type: 'lease_expiration', title: 'Lease Expiring Q1 2026', description: 'Arnold & Porter\'s 160K SF lease expires in early 2026. As a top-20 law firm, they will be evaluating all options.', urgency: 'high' },
          { type: 'market_news', title: 'Law Firm Musical Chairs', description: 'Several major law firms are relocating in DC. Arnold & Porter may be considering a move to newer trophy space.', urgency: 'medium' },
        ],
      },
    ],
  },
  {
    id: 'b4',
    name: 'Capital One Center',
    address: '800 17th St NW, Washington, DC 20006',
    lat: 38.9015,
    lng: -77.0395,
    sqft: 320000,
    floors: 10,
    yearBuilt: 2010,
    vacancyRate: 5.1,
    owner: 'JBG SMITH',
    class: 'A',
    tenants: [
      {
        id: 't8', name: 'Booz Allen Hamilton', industry: 'Defense', sqft: 95000, floor: '6-8',
        leaseExpiration: '2027-06-30', contactName: 'Karen Sullivan', contactTitle: 'VP Real Estate',
        contactEmail: 'k.sullivan@bah.com', headcount: 350,
        outreachReasons: [
          { type: 'expansion', title: 'Government Contract Growth', description: 'BAH recently won several large DoD contracts requiring cleared personnel in DC. May need additional secure space.', urgency: 'medium' },
        ],
      },
    ],
  },
  {
    id: 'b5',
    name: '2000 Pennsylvania Avenue',
    address: '2000 Pennsylvania Ave NW, Washington, DC 20006',
    lat: 38.9005,
    lng: -77.0460,
    sqft: 290000,
    floors: 9,
    yearBuilt: 1982,
    vacancyRate: 31.0,
    owner: 'Vornado Realty Trust',
    class: 'B',
    tenants: [
      {
        id: 't9', name: 'Squire Patton Boggs', industry: 'Legal/Lobbying', sqft: 65000, floor: '4-5',
        leaseExpiration: '2025-12-31', contactName: 'Thomas Grant', contactTitle: 'Office Managing Partner',
        contactEmail: 't.grant@squirepb.com', headcount: 180,
        outreachReasons: [
          { type: 'lease_expiration', title: 'Year-End Lease Expiration', description: 'Squire PB lease expires Dec 2025. With 31% vacancy in the building, they have strong motivation to relocate.', urgency: 'high' },
          { type: 'vacancy', title: 'Critical Building Vacancy', description: '31% vacancy rate is well above market average. Building quality and services may be declining.', urgency: 'high' },
          { type: 'contraction', title: 'Lobbying Firm Downsizing', description: 'K Street firms are reducing physical footprints as remote lobbying becomes more accepted.', urgency: 'medium' },
        ],
      },
    ],
  },
  {
    id: 'b6',
    name: '1000 Vermont Avenue',
    address: '1000 Vermont Ave NW, Washington, DC 20005',
    lat: 38.9025,
    lng: -77.0335,
    sqft: 210000,
    floors: 11,
    yearBuilt: 1972,
    vacancyRate: 18.5,
    owner: 'Columbia Property Trust',
    class: 'B',
    tenants: [
      {
        id: 't10', name: 'American Academy of Nursing', industry: 'Healthcare/Nonprofit', sqft: 12000, floor: '6',
        leaseExpiration: '2027-08-31', contactName: 'Christine Henshaw', contactTitle: 'Executive Director',
        contactEmail: 'c.henshaw@aannet.org', headcount: 45,
        isClient: true,
        outreachReasons: [],
      },
      {
        id: 't11', name: 'National Association of Counties', industry: 'Nonprofit/Government', sqft: 35000, floor: '3-4',
        leaseExpiration: '2026-04-30', contactName: 'Mark Peterson', contactTitle: 'COO',
        contactEmail: 'm.peterson@naco.org', headcount: 120,
        outreachReasons: [
          { type: 'lease_expiration', title: 'Lease Expiring Spring 2026', description: 'NACo\'s 35K SF lease expires April 2026. With 18.5% vacancy in the building, they may seek better terms or relocate.', urgency: 'high' },
          { type: 'vacancy', title: 'High Building Vacancy', description: '18.5% vacancy may be impacting building services and amenities, creating relocation motivation.', urgency: 'medium' },
        ],
      },
      {
        id: 't12', name: 'Center for American Progress', industry: 'Think Tank/Nonprofit', sqft: 28000, floor: '7-8',
        leaseExpiration: '2025-11-30', contactName: 'Danielle Rosen', contactTitle: 'Director of Operations',
        contactEmail: 'd.rosen@americanprogress.org', headcount: 95,
        outreachReasons: [
          { type: 'lease_expiration', title: 'Lease Expiring Nov 2025', description: 'CAP\'s lease expires in under 9 months. As a high-profile think tank, they will want modern, collaborative space.', urgency: 'high' },
          { type: 'contraction', title: 'Post-Election Staffing Shifts', description: 'Think tanks often resize after administration changes. CAP may be adjusting headcount and space needs.', urgency: 'medium' },
        ],
      },
      {
        id: 't13', name: 'International Association of Fire Chiefs', industry: 'Nonprofit/Association', sqft: 18000, floor: '9',
        leaseExpiration: '2026-12-31', contactName: 'Brian Kemp', contactTitle: 'Office Manager',
        contactEmail: 'b.kemp@iafc.org', headcount: 55,
        outreachReasons: [
          { type: 'vacancy', title: 'Building Quality Concerns', description: 'With aging Class B infrastructure and rising vacancy, IAFC may consider upgrading to a better-maintained property.', urgency: 'low' },
        ],
      },
    ],
  },
];

export const newsItems: NewsItem[] = [
  {
    id: 'n1', title: 'McKinsey Exploring DC Office Options as Lease Nears Expiration',
    summary: 'McKinsey & Company is reportedly evaluating multiple buildings in downtown DC as their 85,000 SF lease at 1100 New York Avenue approaches its September 2025 expiration.',
    source: 'Washington Business Journal', date: '2025-03-07', category: 'lease',
    relatedTenants: ['t1'], relatedBuildings: ['b1'],
  },
  {
    id: 'n2', title: 'DC Office Vacancy Hits 22% — Highest in Two Decades',
    summary: 'The Washington DC office market recorded a 22% vacancy rate in Q4 2024, driven by continued federal and private-sector space reductions.',
    source: 'CoStar', date: '2025-03-05', category: 'vacancy',
  },
  {
    id: 'n3', title: 'Arnold & Porter Hires Real Estate Advisory for Relocation Study',
    summary: 'AmLaw 50 firm Arnold & Porter has engaged CBRE to evaluate relocation options ahead of their March 2026 lease expiration at Franklin Square.',
    source: 'Bisnow', date: '2025-03-04', category: 'lease',
    relatedTenants: ['t7'], relatedBuildings: ['b3'],
  },
  {
    id: 'n4', title: 'Deloitte to Cut DC Office Space by 30%',
    summary: 'Deloitte announced plans to reduce its Washington DC office footprint by approximately 30%, impacting its 150,000 SF space at The Homer Building.',
    source: 'Wall Street Journal', date: '2025-03-03', category: 'contraction',
    relatedTenants: ['t4'], relatedBuildings: ['b2'],
  },
  {
    id: 'n5', title: 'AWS Expands Government Cloud Division in DC',
    summary: 'Amazon Web Services is growing its government cloud team in Washington DC, potentially requiring additional office space beyond its current Franklin Square footprint.',
    source: 'Federal News Network', date: '2025-03-01', category: 'expansion',
    relatedTenants: ['t6'], relatedBuildings: ['b3'],
  },
  {
    id: 'n6', title: 'Boston Properties Completes $285M Sale of 1100 New York Avenue',
    summary: 'Boston Properties has completed the sale of 1100 New York Avenue NW to a foreign investment group for $285 million, raising questions about future tenant retention.',
    source: 'Real Capital Analytics', date: '2025-02-28', category: 'sale',
    relatedBuildings: ['b1'],
  },
  {
    id: 'n7', title: 'WeWork Exits Three More DC Locations',
    summary: 'WeWork has announced the closure of three additional Washington DC locations as part of ongoing portfolio optimization following its Chapter 11 emergence.',
    source: 'Bloomberg', date: '2025-02-25', category: 'vacancy',
    relatedTenants: ['t3'],
  },
  {
    id: 'n8', title: 'K Street Lobbying Firms Embrace Hybrid, Shed Office Space',
    summary: 'Multiple lobbying firms along K Street are downsizing their physical offices as virtual meetings with lawmakers become more accepted.',
    source: 'Politico', date: '2025-02-20', category: 'market',
    relatedTenants: ['t9'],
  },
  {
    id: 'n9', title: 'Nonprofits Shrinking More Than Most in DC Office Market',
    summary: 'Nonprofit leasing volume fell to 1.3M SF in 2024 — 18% below the historic average. Organizations are cutting footprints by 30-50% as hybrid work normalizes and funding pressures mount. Brokers report some nonprofits going from 70K SF to just 5K SF of meeting-only space.',
    source: 'Bisnow', date: '2025-03-06', category: 'contraction',
    relatedTenants: ['t11', 't12', 't13'],
    relatedBuildings: ['b6'],
  },
  {
    id: 'n10', title: 'Federal Funding Cuts Hit 501(c)(3) Nonprofits — Associations Less Affected',
    summary: 'New administration funding cuts are disproportionately impacting mission-driven 501(c)(3) nonprofits reliant on government dollars, while trade associations funded by membership dues remain stable. Real estate advisors urge affected orgs to renegotiate leases now while tenant leverage is high.',
    source: 'Cresa / Nonprofit Benchmarking Report', date: '2025-03-08', category: 'market',
    relatedTenants: ['t11', 't12', 't13'],
  },
  {
    id: 'n11', title: 'Two-Thirds of Nonprofits Plan to Downsize or Renew — Only 12.5% Expanding',
    summary: 'Cresa\'s 2025 Nonprofit Benchmarking Report reveals 65% of nonprofits would renew or downsize if their lease expired this year. Assigned seating dropped from 74% to 70% as orgs shift to shared, collaboration-focused layouts. Most spend just 1-5% of revenue on occupancy.',
    source: 'Cresa', date: '2025-03-09', category: 'contraction',
    relatedTenants: ['t11', 't12', 't13'],
    relatedBuildings: ['b6'],
  },
  {
    id: 'n12', title: 'DC Sublease Inventory Surges — Opportunity for Budget-Conscious Nonprofits',
    summary: 'Large sublease blocks from downsizing corporate tenants are flooding the DC market at 30-40% below direct lease rates. Capitol Hill and East End seeing increased interest from associations seeking proximity to the Hill at reduced costs.',
    source: 'CoStar', date: '2025-03-02', category: 'vacancy',
    relatedTenants: ['t11', 't12', 't13'],
  },
];

export const scoopPosts: ScoopPost[] = [
  {
    id: 's1', author: 'Mike Johnson', authorAvatar: 'MJ',
    content: 'Hearing that Arnold & Porter is seriously looking at the new Midtown Center development. They want trophy space with modern amenities. 160K SF requirement.',
    tags: ['Arnold & Porter', 'Midtown Center', 'Legal'], timestamp: '2025-03-08T14:30:00Z', likes: 24, comments: 8, verified: true,
  },
  {
    id: 's2', author: 'Lisa Park', authorAvatar: 'LP',
    content: 'Deloitte RFP is out. Looking for 100-110K SF, down from 150K current. Prioritizing Metro access and modern conference facilities. Shortlist expected by April.',
    tags: ['Deloitte', 'RFP', 'Consulting'], timestamp: '2025-03-07T10:15:00Z', likes: 42, comments: 15, verified: true,
  },
  {
    id: 's3', author: 'Carlos Rivera', authorAvatar: 'CR',
    content: 'Source at JBG SMITH says they are offering 18 months free rent on new leases at 2000 Penn Ave to combat the 31% vacancy. Aggressive concession packages.',
    tags: ['JBG SMITH', '2000 Penn', 'Concessions'], timestamp: '2025-03-06T16:45:00Z', likes: 31, comments: 12, verified: false,
  },
  {
    id: 's4', author: 'Rachel Thompson', authorAvatar: 'RT',
    content: 'Big tech company (not AWS) is looking for 250K+ SF in East End. Government contracts driving the need. Expect announcement within 60 days.',
    tags: ['Tech', 'East End', 'Large Requirement'], timestamp: '2025-03-05T09:00:00Z', likes: 56, comments: 23, verified: false,
  },
  {
    id: 's5', author: 'David Kim', authorAvatar: 'DK',
    content: 'The Homer Building is going to hit 30% vacancy by Q3. Two more tenants on floors 2-3 have given notice. Brookfield considering converting upper floors to residential.',
    tags: ['Homer Building', 'Vacancy', 'Conversion'], timestamp: '2025-03-04T11:30:00Z', likes: 38, comments: 18, verified: true,
  },
];

export const getCategoryColor = (category: string) => {
  switch (category) {
    case 'lease': return 'bg-primary/20 text-primary';
    case 'sale': return 'bg-info/20 text-info';
    case 'expansion': return 'bg-success/20 text-success';
    case 'vacancy': return 'bg-destructive/20 text-destructive';
    case 'market': return 'bg-muted text-muted-foreground';
    case 'contraction': return 'bg-warning/20 text-warning';
    default: return 'bg-muted text-muted-foreground';
  }
};

export const getUrgencyColor = (urgency: string) => {
  switch (urgency) {
    case 'high': return 'bg-destructive/20 text-destructive';
    case 'medium': return 'bg-primary/20 text-primary';
    case 'low': return 'bg-muted text-muted-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
};
