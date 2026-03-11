import type { Building, Tenant, OutreachReason } from './mockData';

// Simple deterministic hash for consistent offsets
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

// Precise DC NW quadrant coordinate estimation
// DC grid: numbered streets run N-S, lettered/named streets run E-W
// In NW quadrant, block numbers correspond to cross streets:
//   100 block = 1st St, 200 = 2nd St, ..., 1000 = 10th St, etc.
function estimateCoords(address: string): { lat: number; lng: number } {
  const addr = address.toLowerCase().replace(/,.*/, '').trim();
  const blockMatch = addr.match(/^(\d+)/);
  const blockNum = blockMatch ? parseInt(blockMatch[1]) : 1000;

  // --- Longitude: determined by the STREET NAME (N-S streets) ---
  // Precise longitudes for DC numbered streets (NW quadrant)
  const numberedStreetLng: Record<number, number> = {
    5: -77.0184, 6: -77.0198, 7: -77.0215, 8: -77.0230, 9: -77.0245,
    10: -77.0262, 11: -77.0277, 12: -77.0292, 13: -77.0308, 14: -77.0323,
    15: -77.0338, 16: -77.0358, 17: -77.0387, 18: -77.0410, 19: -77.0432,
    20: -77.0455, 21: -77.0475, 22: -77.0495,
  };

  // Named avenue longitudes (approximate center line)
  const namedAveLng: Record<string, number> = {
    'connecticut': -77.0405, 'vermont': -77.0330, 'new hampshire': -77.0440,
    'new york': -77.0290, 'massachusetts': -77.0285, 'thomas': -77.0340,
  };

  // --- Latitude: determined by the STREET NAME (E-W streets) ---
  // Precise latitudes for DC lettered streets
  const letteredStreetLat: Record<string, number> = {
    'c': 38.8930, 'd': 38.8940, 'e': 38.8950, 'f': 38.8965, 'g': 38.8980,
    'h': 38.8998, 'eye': 38.9012, 'i': 38.9012, 'k': 38.9025, 'l': 38.9040,
    'm': 38.9055, 'n': 38.9070, 'o': 38.9083,
  };

  let lat: number | null = null;
  let lng: number | null = null;

  // Determine if it's "### <Street> St" or "### <Avenue> Ave"
  // For addresses like "1425 K St NW": K St gives latitude, block 1425 → ~14th St cross gives longitude
  // For addresses like "910 17th St NW": 17th St gives longitude, block 910 → ~I/K St cross gives latitude

  // Check for lettered street (E-W) → gives latitude, block gives longitude
  for (const [letter, latVal] of Object.entries(letteredStreetLat)) {
    const patterns = [` ${letter} st`, ` ${letter} street`];
    if (patterns.some(p => addr.includes(p))) {
      lat = latVal;
      // Block number on an E-W street tells us the N-S cross street
      // 800 block ≈ 8th St, 1400 block ≈ 14th St, etc.
      const crossStreet = Math.floor(blockNum / 100);
      if (numberedStreetLng[crossStreet]) {
        // Interpolate within the block
        const frac = (blockNum % 100) / 100;
        const nextLng = numberedStreetLng[crossStreet + 1] || (numberedStreetLng[crossStreet] - 0.0015);
        lng = numberedStreetLng[crossStreet] + frac * (nextLng - numberedStreetLng[crossStreet]);
      }
      break;
    }
  }

  // Check for numbered street (N-S) → gives longitude, block gives latitude
  if (lat === null) {
    const stMatch = addr.match(/(\d+)(?:st|nd|rd|th)\s+st/);
    if (stMatch) {
      const stNum = parseInt(stMatch[1]);
      if (numberedStreetLng[stNum]) {
        lng = numberedStreetLng[stNum];
        // Block number on a N-S street tells us the E-W cross street
        // 500-600 ≈ E/F St, 700-800 ≈ G/H St, 900 ≈ I/Eye St, 1000 ≈ K St, etc.
        const letterIdx = Math.floor((blockNum - 400) / 100); // 500→1(E), 600→2(F), ...
        const letters = ['d', 'e', 'f', 'g', 'h', 'i', 'k', 'l', 'm', 'n', 'o'];
        const baseLetter = letters[Math.max(0, Math.min(letterIdx, letters.length - 1))];
        if (letteredStreetLat[baseLetter]) {
          const frac = (blockNum % 100) / 100;
          const nextIdx = Math.min(letterIdx + 1, letters.length - 1);
          const nextLat = letteredStreetLat[letters[nextIdx]] || letteredStreetLat[baseLetter];
          lat = letteredStreetLat[baseLetter] + frac * (nextLat - letteredStreetLat[baseLetter]);
        }
      }
    }
  }

  // Check for named avenues
  for (const [name, lngVal] of Object.entries(namedAveLng)) {
    if (addr.includes(name)) {
      lng = lngVal;
      // For avenues, block num approximates latitude
      const letterIdx = Math.floor((blockNum - 400) / 100);
      const letters = ['d', 'e', 'f', 'g', 'h', 'i', 'k', 'l', 'm', 'n', 'o'];
      const baseLetter = letters[Math.max(0, Math.min(letterIdx, letters.length - 1))];
      if (letteredStreetLat[baseLetter]) {
        lat = letteredStreetLat[baseLetter];
      }
      break;
    }
  }

  // Pennsylvania Ave: runs diagonally, use precise mapping
  if (addr.includes('pennsylvania')) {
    // PA Ave NW runs from Capitol (~38.8895, -77.0090) to Georgetown (~38.9070, -77.0545)
    const paPoints: [number, number, number][] = [
      // [blockNum, lat, lng]
      [1100, 38.8955, -77.0280], [1200, 38.8965, -77.0295], [1275, 38.8970, -77.0305],
      [1300, 38.8975, -77.0310], [1331, 38.8978, -77.0315], [1350, 38.8980, -77.0318],
      [1400, 38.8985, -77.0325], [1455, 38.8990, -77.0332], [1500, 38.8995, -77.0338],
      [1600, 38.9005, -77.0355], [1700, 38.9015, -77.0375], [1701, 38.9015, -77.0376],
      [1717, 38.9017, -77.0379], [1730, 38.9019, -77.0382], [1750, 38.9021, -77.0386],
      [1775, 38.9024, -77.0390], [1800, 38.9027, -77.0395], [1900, 38.9038, -77.0415],
      [1901, 38.9038, -77.0416], [2000, 38.9050, -77.0438], [2001, 38.9050, -77.0439],
      [2099, 38.9060, -77.0458], [2100, 38.9060, -77.0459], [2200, 38.9070, -77.0478],
    ];
    // Find closest two points and interpolate
    let best = paPoints[0];
    let bestNext = paPoints[1];
    for (let i = 0; i < paPoints.length - 1; i++) {
      if (blockNum >= paPoints[i][0] && blockNum <= paPoints[i + 1][0]) {
        best = paPoints[i];
        bestNext = paPoints[i + 1];
        break;
      }
      if (blockNum >= paPoints[i][0]) { best = paPoints[i]; bestNext = paPoints[Math.min(i + 1, paPoints.length - 1)]; }
    }
    const range = bestNext[0] - best[0] || 1;
    const t = (blockNum - best[0]) / range;
    lat = best[1] + t * (bestNext[1] - best[1]);
    lng = best[2] + t * (bestNext[2] - best[2]);
  }

  // Fallback to center of DC CBD
  if (lat === null) lat = 38.9025;
  if (lng === null) lng = -77.0335;

  // Deterministic small offset based on address hash to prevent exact stacking
  const h = hashStr(address);
  const h2 = hashStr(address + 'y');
  lat += ((h % 100) / 100 - 0.5) * 0.0003;
  lng += ((h2 % 100) / 100 - 0.5) * 0.0003;

  return { lat, lng };
}

// Generate tenants for a building
function generateTenants(buildingId: string, sqft: number, buildingClass: string): Tenant[] {
  const industries = [
    { name: 'Legal', companies: ['Baker & Associates', 'Capitol Law Group', 'Meridian Legal Partners', 'Potomac Law Firm', 'DC Legal Advisors', 'Federal Counsel LLP', 'Latham & Watkins', 'Gibson Dunn', 'Skadden Arps', 'WilmerHale'] },
    { name: 'Consulting', companies: ['Booz Allen Hamilton', 'Deloitte Advisory', 'McKinsey DC Office', 'Bain & Company', 'Accenture Federal', 'KPMG Government', 'PwC Federal', 'EY Government'] },
    { name: 'Technology', companies: ['Palantir Technologies', 'Cloudflare DC', 'Microsoft Federal', 'AWS GovCloud', 'Salesforce Public Sector', 'Oracle Government', 'Google Public Sector', 'IBM Federal'] },
    { name: 'Government Affairs', companies: ['Akin Gump Strauss', 'Covington & Burling', 'Squire Patton Boggs', 'Holland & Knight', 'Brownstein Hyatt', 'Cassidy & Associates'] },
    { name: 'Non-Profit', companies: ['Brookings Institution', 'Heritage Foundation', 'Urban Institute', 'CSIS', 'Atlantic Council', 'Pew Research Center', 'AARP', 'National Geographic Society'] },
    { name: 'Financial Services', companies: ['Goldman Sachs DC', 'JP Morgan Government', 'Capital One Federal', 'Blackrock DC', 'Carlyle Group', 'FTI Consulting', 'Lazard', 'Evercore'] },
    { name: 'Public Relations', companies: ['Edelman DC', 'Weber Shandwick', 'FleishmanHillard', 'APCO Worldwide', 'Brunswick Group', 'Burson'] },
    { name: 'Real Estate', companies: ['CBRE DC', 'JLL Government', 'Cushman & Wakefield', 'Newmark', 'Savills', 'Transwestern'] },
    { name: 'Healthcare', companies: ['PhRMA', 'AMA DC', 'Kaiser Permanente', 'UnitedHealth Group', 'Aetna Government'] },
    { name: 'Trade Association', companies: ['NAM', 'US Chamber of Commerce', 'Business Roundtable', 'AHLA', 'NAR DC Office', 'NAHB'] },
  ];

  const numTenants = Math.max(2, Math.min(6, Math.floor(sqft / 80000) + 2));
  const usedIndustries = new Set<number>();
  const tenants: Tenant[] = [];

  for (let i = 0; i < numTenants; i++) {
    let industryIdx: number;
    do {
      industryIdx = Math.floor(Math.random() * industries.length);
    } while (usedIndustries.has(industryIdx) && usedIndustries.size < industries.length);
    usedIndustries.add(industryIdx);

    const industry = industries[industryIdx];
    const company = industry.companies[Math.floor(Math.random() * industry.companies.length)];
    const tenantSqft = Math.floor((sqft / numTenants) * (0.5 + Math.random() * 0.8));
    const floor = `${Math.floor(Math.random() * 12) + 1}`;
    const leaseYear = 2025 + Math.floor(Math.random() * 5);
    const leaseMonth = Math.floor(Math.random() * 12) + 1;

    const firstNames = ['James', 'Sarah', 'Michael', 'Emily', 'David', 'Jennifer', 'Robert', 'Lisa', 'William', 'Amanda', 'Chris', 'Rachel', 'Mark', 'Laura'];
    const lastNames = ['Thompson', 'Mitchell', 'Rodriguez', 'Chen', 'Williams', 'Davis', 'Martinez', 'Anderson', 'Taylor', 'Wilson', 'Brown', 'Kim', 'Patel'];
    const titles = ['Managing Director', 'VP of Operations', 'Senior Partner', 'Office Manager', 'Regional Director', 'General Counsel', 'Chief of Staff'];

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    const urgencyOptions: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
    const outreachTypes: Array<{ type: OutreachReason['type']; title: string; description: string }> = [
      { type: 'lease_expiration', title: 'Lease Expiring Soon', description: `Lease expires ${leaseMonth}/${leaseYear}` },
      { type: 'expansion', title: 'Potential Expansion', description: 'Company growing headcount in DC market' },
      { type: 'market_news', title: 'Market Activity', description: 'Active in submarket discussions' },
      { type: 'contraction', title: 'Space Reduction', description: 'May be looking to downsize or sublease' },
    ];

    const numReasons = Math.floor(Math.random() * 2) + 1;
    const reasons: OutreachReason[] = [];
    const usedReasonIdx = new Set<number>();
    for (let r = 0; r < numReasons; r++) {
      let rIdx: number;
      do { rIdx = Math.floor(Math.random() * outreachTypes.length); } while (usedReasonIdx.has(rIdx));
      usedReasonIdx.add(rIdx);
      reasons.push({
        ...outreachTypes[rIdx],
        urgency: urgencyOptions[Math.floor(Math.random() * urgencyOptions.length)],
      });
    }

    tenants.push({
      id: `${buildingId}-t${i}`,
      name: company,
      industry: industry.name,
      sqft: tenantSqft,
      floor,
      leaseExpiration: `${leaseMonth}/${leaseYear}`,
      contactName: `${firstName} ${lastName}`,
      contactTitle: titles[Math.floor(Math.random() * titles.length)],
      contactEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      headcount: Math.floor(tenantSqft / 200),
      outreachReasons: reasons,
    });
  }

  return tenants;
}

// Raw CoStar building data: [address, name, class, sqft, floors, yearBuilt, vacancyRate, owner/leasingCo, lastSaleDate, lastSalePrice, submarket]
type RawBuilding = [string, string, string, number, number, number, number, string, string, string, string];

const rawBuildings: RawBuilding[] = [
  ['600 14th St NW', 'Hamilton Square', 'A', 316778, 9, 1929, 0, 'CBRE', '6/1/12', '$198,000,000', 'East End'],
  ['875 15th St NW', 'The Bowen Building', 'A', 231000, 12, 1922, 0, 'Hines', '5/1/18', '$140,000,000', 'East End'],
  ['2001 L St NW', '', 'A', 172135, 10, 1986, 28.1, 'Cambridge Property Group', '10/16/24', '$30,550,000', 'CBD'],
  ['1901 Pennsylvania Ave NW', '', 'A', 104944, 11, 1960, 58.6, 'Cushman & Wakefield', '4/6/22', '$41,500,000', 'CBD'],
  ['1101 14th St NW', '', 'B', 123443, 14, 1981, 27.4, 'Cambridge Property Group', '12/19/23', '$18,200,000', 'East End'],
  ['1220 L St NW', '', 'B', 321980, 12, 1982, 36.1, 'JLL', '', '', 'East End'],
  ['1350 Eye St NW', '', 'A', 415861, 12, 1989, 24.8, 'JLL', '11/2/10', '$41,736,762', 'East End'],
  ['1425 K St NW', '', 'A', 232501, 12, 1970, 14.3, 'Blake Real Estate', '', '', 'East End'],
  ['1156 15th St NW', '', 'A', 154666, 12, 1967, 50.4, 'JLL', '8/1/06', '$71,216,618', 'East End'],
  ['555 12th St NW', 'District Center', 'A', 810029, 13, 1995, 6.2, 'Stream Realty Partners', '1/7/14', '$505,000,000', 'East End'],
  ['1100 13th St NW', 'Franklin Square North', 'A', 269627, 12, 2004, 19.0, 'Cushman & Wakefield', '', '', 'East End'],
  ['607 14th St NW', 'The Westory', 'A', 272093, 11, 2001, 39.3, 'Cushman & Wakefield', '7/17/12', '$159,359,500', 'East End'],
  ['717 14th St NW', '', 'A', 147884, 12, 1928, 40.9, 'Lincoln Property Company', '', '', 'East End'],
  ['1099 14th St NW', 'Franklin Court', 'A', 538084, 11, 1991, 11.8, 'Lincoln Property Company', '12/10/99', '$115,325,000', 'East End'],
  ['655 15th St NW', 'Metropolitan Square', 'A', 718241, 12, 1983, 23.5, 'Newmark', '10/20/16', '$288,100,000', 'East End'],
  ['740 15th St NW', '', 'A', 179177, 11, 1907, 5.6, 'Stream Realty Partners', '6/21/16', '$88,200,000', 'East End'],
  ['1015 15th St NW', '', 'A', 196651, 12, 1978, 25.4, 'Cushman & Wakefield', '9/28/06', '$91,080,000', 'East End'],
  ['1030 15th St NW', 'Ten30', 'A', 332022, 12, 2008, 96.0, 'Cushman & Wakefield', '10/11/16', '$228,000,000', 'East End'],
  ['1100 15th St NW', 'Midtown Center - East Tower', 'A', 478315, 14, 2017, 24.4, 'Carr Properties', '4/27/21', '$189,540,365', 'East End'],
  ['1152 15th St NW', 'Columbia Center', 'A', 394165, 12, 2007, 56.8, 'Cushman & Wakefield', '4/30/25', '', 'East End'],
  ['1155 15th St NW', 'Madison Office Building', 'B', 98372, 12, 1963, 28.3, 'Stream Realty Partners', '5/26/16', '$34,870,000', 'East End'],
  ['1201 15th St NW', 'National Association of Home Builders', 'A', 231433, 9, 1973, 30.9, 'Transwestern', '', '', 'East End'],
  ['815 16th St NW', 'AFL-CIO Bldg', 'B', 215388, 8, 1956, 0, 'NAI Michael', '', '', 'CBD'],
  ['910 17th St NW', 'Barr Building', 'B', 115404, 11, 1927, 27.0, '', '12/4/03', '$22,550,000', 'CBD'],
  ['1101 17th St NW', '1101 17th Street', 'B', 215812, 14, 1964, 16.7, 'JBG SMITH Properties', '10/19/10', '$43,480,770', 'CBD'],
  ['1015 18th St NW', '', 'A', 169592, 12, 1970, 12.6, '', '12/18/15', '$39,000,000', 'CBD'],
  ['900 19th St NW', '', 'A', 118833, 8, 1986, 21.8, 'Tishman Speyer', '11/25/06', '$11,265,387', 'CBD'],
  ['1111 19th St NW', '', 'A', 271369, 12, 1979, 18.0, 'Stream Realty Partners', '9/19/17', '$203,000,000', 'CBD'],
  ['800 Connecticut Ave NW', '', 'A', 127393, 12, 1992, 32.8, 'Donohoe', '', '', 'CBD'],
  ['1025 Connecticut Ave NW', 'The Blake Building', 'A', 333626, 12, 1969, 5.8, 'Blake Real Estate', '', '', 'CBD'],
  ['1050 Connecticut Ave NW', 'Washington Square', 'A', 967088, 12, 1982, 28.3, 'CBRE', '', '', 'CBD'],
  ['1140 Connecticut Ave NW', '', 'A', 188578, 12, 1967, 57.4, 'Stream Realty Partners', '7/26/21', '$38,800,000', 'CBD'],
  ['1150 Connecticut Ave NW', '', 'A', 175457, 12, 1975, 8.4, 'Blake Real Estate', '', '', 'CBD'],
  ['1200 G St NW', 'Metro Center', 'A', 183808, 11, 1991, 14.1, 'JLL', '', '', 'East End'],
  ['1100 H St NW', 'Gas Light Building', 'A', 155436, 12, 1942, 26.2, 'RB Properties', '3/1/03', '$16,300,000', 'East End'],
  ['1250 H St NW', '', 'A', 204579, 11, 1992, 32.0, 'Cushman & Wakefield', '11/26/24', '$27,500,000', 'East End'],
  ['1333 H St NW', '', 'A', 449465, 12, 1982, 13.7, 'Avison Young', '12/10/15', '$162,500,000', 'East End'],
  ['1750 H St NW', '', 'A', 124386, 10, 2002, 31.5, '', '7/8/25', '$28,800,000', 'CBD'],
  ['1720 I St NW', '', 'B', 72545, 9, 1967, 45.7, 'Lincoln Property Company', '', '', 'CBD'],
  ['1775 I St NW', 'Paramount Building', 'A', 191219, 11, 1964, 14.0, 'JLL', '7/26/21', '$80,500,000', 'CBD'],
  ['1776 I St NW', 'Republic Place', 'A', 225000, 10, 1987, 8.0, 'Avison Young', '3/6/12', '$119,785,600', 'CBD'],
  ['901 K St NW', '901 K', 'A', 274148, 12, 2009, 30.4, 'Avison Young', '', '', 'East End'],
  ['1420 K St NW', '', 'B', 60828, 11, 1986, 42.1, 'Lincoln Property Company', '11/20/25', '$13,312,920', 'East End'],
  ['1432 K St NW', '', 'B', 32674, 12, 1918, 35.6, 'JLL', '', '', 'East End'],
  ['1612 K St NW', 'The City Bldg', 'B', 75515, 14, 1958, 40.7, 'Cushman & Wakefield', '5/31/19', '$28,000,000', 'CBD'],
  ['1629 K St NW', 'The Davis Building', 'B', 98000, 12, 1964, 14.6, 'Transwestern', '', '', 'CBD'],
  ['1717 K St NW', '', 'A', 430428, 12, 2012, 2.7, 'JBG SMITH Properties', '', '', 'CBD'],
  ['1800 K St NW', 'International Club Building', 'A', 217070, 11, 1971, 5.2, '', '9/28/06', '$98,000,000', 'CBD'],
  ['1875 K St NW', '1875 K', 'A', 202000, 12, 2002, 8.8, '', '7/16/25', '$54,506,857', 'CBD'],
  ['2021 K St NW', '', 'B', 172500, 8, 1972, 23.6, 'Health-Pro Realty Group', '10/21/25', '', 'CBD'],
  ['1300 L St NW', '', 'A', 79294, 12, 1986, 10.7, 'Transwestern', '5/1/96', '$16,000,000', 'East End'],
  ['1660 L St NW', '', 'A', 207740, 12, 1967, 19.1, 'Lincoln Property Company', '12/2/05', '$52,000,000', 'CBD'],
  ['1901 L St NW', '1901 L', 'A', 211228, 12, 2020, 6.6, 'CBRE', '', '', 'CBD'],
  ['2100 L St NW', '2100 L', 'A', 190000, 10, 2020, 6.2, 'Avison Young', '', '', 'CBD'],
  ['1850 M St NW', '', 'A', 243635, 12, 1985, 41.4, 'Transwestern', '', '', 'CBD'],
  ['1900 M St NW', 'The Row on 19th', 'A', 127551, 8, 1975, 77.6, 'Cushman & Wakefield', '10/1/12', '$54,989,157', 'CBD'],
  ['2000 M St NW', '2000 M', 'A', 238721, 8, 1971, 32.4, 'Stream Realty Partners', '7/26/21', '$42,000,000', 'CBD'],
  ['2025 M St NW', '', 'A', 191248, 8, 1971, 40.0, 'Lincoln Property Company', '3/16/15', '$109,000,000', 'CBD'],
  ['1201 New York Ave NW', '', 'A', 444000, 13, 1987, 6.5, 'Stream Realty Partners', '6/15/11', '', 'East End'],
  ['1201 Pennsylvania Ave NW', 'Heurich Building', 'A', 440782, 13, 1980, 2.7, 'JLL', '', '', 'East End'],
  ['1300 Pennsylvania Ave NW', 'Ronald Reagan Building', 'A', 299000, 8, 1998, 26.9, 'Trade Center Management', '', '', 'East End'],
  ['1455 Pennsylvania Ave NW', 'The Willard Office Building', 'A', 242787, 12, 1986, 16.0, 'CBRE', '', '', 'East End'],
  ['1701 Pennsylvania Ave NW', '', 'A', 220603, 12, 1962, 16.8, 'Cushman & Wakefield', '', '', 'CBD'],
  ['1717 Pennsylvania Ave NW', '', 'A', 202471, 13, 1960, 23.0, 'Tishman Speyer', '11/25/06', '$121,000,000', 'CBD'],
  ['1730 Pennsylvania Ave NW', '', 'A', 266655, 12, 1972, 16.3, 'Tishman Speyer', '11/25/06', '$23,192,967', 'CBD'],
  ['2000 Pennsylvania Ave NW', 'Western Market', 'A', 402090, 10, 1983, 18.2, '', '5/21/18', '$75,500,000', 'CBD'],
  ['1 Thomas Cir NW', 'One Thomas Circle', 'A', 235400, 12, 1982, 52.8, 'JLL', '9/1/16', '$116,750,000', 'East End'],
  ['1029 Vermont Ave NW', '', 'B', 46188, 12, 1921, 14.9, 'Cushman & Wakefield', '8/3/21', '$12,000,000', 'East End'],
  ['1101 Vermont Ave NW', '', 'A', 175663, 12, 1980, 57.0, '', '3/27/24', '$15,822,125', 'East End'],
  ['601 13th St NW', 'Homer Building', 'A', 460000, 12, 1913, 9.2, 'JLL', '1/9/12', '$252,000,000', 'East End'],
  ['699 14th St NW', 'The Bank Bldg', 'A', 168597, 11, 2021, 19.7, 'Lincoln Property Company', '', '', 'East End'],
  ['801 17th St NW', 'Lafayette Tower', 'A', 244522, 11, 2009, 10.2, 'Stream Realty Partners', '2/21/14', '$148,750,549', 'CBD'],
  ['900 17th St NW', 'Farragut Bldg', 'A', 146648, 12, 1964, 21.3, 'Cushman & Wakefield', '9/1/10', '$93,500,000', 'CBD'],
  ['1300 I St NW', 'Franklin Square', 'A', 490291, 12, 1989, 1.9, 'Avison Young', '12/20/24', '$111,299,760', 'East End'],
  ['1500 K St NW', '1500 K Street', 'A', 263942, 11, 1928, 9.0, 'CBRE', '9/4/02', '$83,625,000', 'East End'],
  ['1601 K St NW', '', 'A', 218239, 11, 2006, 17.9, 'Stream Realty Partners', '9/30/05', '$150,351,509', 'CBD'],
  ['1750 K St NW', '', 'B', 176024, 12, 1970, 89.1, 'Lincoln Property Company', '9/2/25', '', 'CBD'],
  ['2175 K St NW', 'Washington Park', 'A', 136389, 11, 1985, 25.4, 'Lincoln Property Company', '3/4/19', '$102,990,276', 'CBD'],
  ['1331 L St NW', '', 'A', 178646, 10, 2008, 94.8, 'Lincoln Property Company', '2/17/22', '', 'East End'],
  ['1441 L St NW', '', 'A', 211452, 13, 1967, 0, '', '', '', 'East End'],
  ['2001 M St NW', '', 'A', 284994, 10, 1986, 4.5, '', '1/30/26', '$163,250,000', 'CBD'],
  ['1101 New York Ave NW', '', 'A', 512092, 12, 2006, 5.7, 'Stream Realty Partners', '7/3/17', '$389,300,000', 'East End'],
  ['1212 New York Ave NW', '', 'B', 155790, 12, 1987, 44.1, '', '2/1/02', '$23,250,000', 'East End'],
  ['2099 Pennsylvania Ave NW', '2099 Pennsylvania Avenue', 'A', 208656, 12, 2000, 6.4, 'Avison Young', '8/9/18', '$220,000,000', 'CBD'],
  ['555 13th St NW', 'Columbia Square', 'A', 618085, 13, 1987, 5.9, 'CBRE', '', '', 'East End'],
  ['600 13th St NW', '', 'A', 252381, 11, 1998, 55.4, 'CBRE', '', '', 'East End'],
  ['700 13th St NW', 'Metro Center One', 'A', 258692, 12, 1989, 15.8, 'Newmark', '3/5/14', '$220,146,900', 'East End'],
  ['529 14th St NW', 'National Press Building', 'B', 559652, 14, 1928, 38.7, 'JLL', '3/31/16', '$155,500,000', 'East End'],
  ['700 14th St NW', 'Commercial National Bank Bldg', 'A', 224558, 11, 1917, 20.2, 'Colliers', '8/7/13', '$198,000,000', 'East End'],
  ['1012 14th St NW', 'Continental Building', 'B', 99360, 15, 1954, 32.6, 'JLL', '4/18/97', '$1,816,000', 'East End'],
  ['1111 14th St NW', '', 'B', 66019, 12, 1981, 32.9, '', '3/25/25', '$12,650,000', 'East End'],
  ['1121 14th St NW', '', 'A', 88752, 11, 2006, 36.4, 'Akridge', '2/1/06', '$19,361,516', 'East End'],
  ['805 15th St NW', 'Southern Building', 'A', 205000, 11, 1910, 25.2, 'JLL', '', '', 'East End'],
  ['901 15th St NW', 'McPherson Bldg', 'A', 255968, 12, 1988, 27.5, 'Avison Young', '11/7/19', '$209,100,000', 'East End'],
  ['915 15th St NW', '', 'B', 37028, 10, 1956, 28.5, 'Clarefield Partners', '9/15/03', '$8,000,000', 'East End'],
  ['1023 15th St NW', '', 'B', 66909, 12, 1985, 47.3, 'Summit Commercial', '3/14/00', '$7,425,000', 'East End'],
  ['1100 15th St NW', 'Midtown Center - West Tower', 'A', 427102, 14, 2017, 0, '', '4/27/21', '$168,206,582', 'East End'],
  ['1101 15th St NW', '', 'A', 236723, 12, 1973, 10.8, 'JLL', '8/1/06', '$72,205,737', 'East End'],
  ['1133 15th St NW', '1133 Fifteenth', 'A', 286200, 12, 1969, 28.5, 'JLL', '10/3/17', '$100,500,000', 'East End'],
  ['905 16th St NW', '', 'A', 126911, 9, 1959, 3.9, 'Union Realty Advisors', '', '', 'CBD'],
  ['1101 16th St NW', '1101 Sixteenth', 'A', 102000, 7, 2018, 5.3, 'JLL', '', '', 'CBD'],
  ['1112 16th St NW', 'The William Calomiris Building', 'B', 59996, 9, 1940, 18.8, 'Transwestern', '1/9/98', '$1,800,000', 'CBD'],
  ['1126 16th St NW', 'Raul Yzaguirre Building', 'B', 66477, 7, 1955, 11.9, 'Colliers', '4/15/04', '$13,900,000', 'CBD'],
  ['750 17th St NW', '', 'A', 230571, 12, 1989, 12.6, 'JLL', '', '', 'CBD'],
  ['800 17th St NW', 'PNC Place', 'A', 370962, 12, 2010, 0, 'JLL', '12/20/24', '$131,412,300', 'CBD'],
  ['888 17th St NW', 'Brawner Bldg', 'B', 120000, 12, 1964, 17.1, 'JLL', '', '', 'CBD'],
  ['1050 17th St NW', '1050 17th', 'A', 159380, 11, 2020, 15.3, 'CBRE', '3/31/23', '$59,812,500', 'CBD'],
  ['1100 17th St NW', '', 'A', 146976, 13, 1963, 49.4, '', '2/28/19', '$61,750,000', 'CBD'],
  ['818 18th St NW', '', 'B', 55403, 11, 1964, 19.6, 'Summit Commercial', '11/12/09', '$17,800,000', 'CBD'],
  ['919 18th St NW', 'Farragut West', 'A', 107092, 10, 1981, 39.5, '', '12/28/23', '$16,250,000', 'CBD'],
  ['1150 18th St NW', '', 'A', 179000, 10, 1990, 10.7, 'Avison Young', '3/25/11', '$43,000,000', 'CBD'],
  ['1020 19th St NW', '', 'B', 215504, 8, 1982, 11.0, 'JLL', '3/13/07', '$48,000,000', 'CBD'],
  ['1120 19th St NW', 'Wheeler Bldg', 'B', 118834, 8, 1975, 8.9, 'Cushman & Wakefield', '4/25/07', '$47,855,000', 'CBD'],
  ['1140 19th St NW', 'The Row on 19th', 'A', 82821, 9, 1980, 23.8, 'Cushman & Wakefield', '6/15/15', '$40,500,000', 'CBD'],
  ['1200 19th St NW', '1200 Nineteenth', 'A', 334175, 11, 1964, 75.1, '', '6/28/13', '$296,000,000', 'CBD'],
  ['1120 20th St NW', 'One Lafayette Centre', 'A', 337143, 10, 1980, 51.4, 'Cushman & Wakefield', '2/22/17', '$179,133,600', 'CBD'],
  ['1133 21st St NW', 'Two Lafayette Centre', 'B', 145218, 10, 1985, 11.1, 'Cushman & Wakefield', '2/22/17', '$73,662,527', 'CBD'],
  ['815 Connecticut Ave NW', '', 'A', 231784, 12, 1964, 13.4, 'CBRE', '8/27/19', '$231,250,000', 'CBD'],
  ['818 Connecticut Ave NW', '', 'B', 92378, 12, 1977, 36.0, 'Cushman & Wakefield', '3/31/25', '$16,000,000', 'CBD'],
  ['1001 Connecticut Ave NW', '', 'A', 202740, 12, 1953, 18.3, 'JLL', '12/1/00', '$23,000,000', 'CBD'],
  ['1100 Connecticut Ave NW', '', 'B', 160000, 13, 1967, 36.5, '', '', '', 'CBD'],
  ['1101 Connecticut Ave NW', '', 'A', 196094, 12, 1978, 15.1, 'JLL', '6/30/21', '$53,090,956', 'CBD'],
  ['1130 Connecticut Ave NW', '', 'A', 290618, 12, 1984, 25.4, 'JLL', '11/15/11', '$105,500,000', 'CBD'],
  ['1133 Connecticut Ave NW', '', 'A', 156525, 12, 1988, 27.6, 'CBRE', '', '', 'CBD'],
  ['1201 Eye St NW', '', 'A', 305868, 12, 2001, 48.3, 'Cushman & Wakefield', '', '', 'East End'],
  ['1225 Eye St NW', '', 'A', 224538, 12, 1985, 14.8, 'Cushman & Wakefield', '', '', 'East End'],
  ['1201 F St NW', '', 'A', 244655, 12, 2000, 24.9, 'Tishman Speyer', '11/25/06', '$156,960,750', 'East End'],
  ['1317 F St NW', 'Sun Bldg', 'B', 49000, 10, 1887, 46.7, 'Summit Commercial', '11/1/05', '$10,600,000', 'East End'],
  ['1331 F St NW', '', 'A', 168668, 10, 1989, 3.8, 'JLL', '12/20/02', '$36,761,875', 'East End'],
  ['1310 G St NW', '', 'A', 209035, 12, 1991, 56.0, 'Transwestern', '6/7/00', '$59,800,000', 'East End'],
  ['1325 G St NW', '', 'A', 305259, 10, 1969, 49.5, 'JLL', '10/31/19', '$175,000,000', 'East End'],
  ['1401 H St NW', 'City Center', 'A', 371903, 12, 1992, 13.2, 'Cushman & Wakefield', '3/13/25', '$118,086,001', 'East End'],
  ['1250 I St NW', '', 'A', 177906, 12, 1982, 9.4, '', '12/27/23', '$36,000,000', 'East End'],
  ['1400 I St NW', '', 'B', 175127, 12, 1983, 26.4, 'JLL', '11/18/11', '$58,450,000', 'East End'],
  ['1401 I St NW', 'Franklin Tower', 'A', 255291, 12, 1965, 29.9, 'CBRE', '7/23/15', '$183,910,000', 'East End'],
  ['1620 I St NW', 'Golden Triangle', 'A', 115778, 10, 1971, 31.6, 'JLL', '8/1/06', '$49,577,645', 'CBD'],
  ['1627 I St NW', 'The Army Navy Building', 'A', 108216, 12, 1912, 19.0, 'JLL', '7/26/21', '$64,000,000', 'CBD'],
  ['1634 I St NW', 'One Farragut Square South', 'B', 70064, 12, 1961, 12.2, 'JLL', '12/1/00', '$12,550,000', 'CBD'],
  ['1725 I St NW', 'Farragut Center', 'A', 296145, 10, 2001, 25.6, '', '', '', 'CBD'],
  ['1825 I St NW', 'International Square 3', 'A', 420822, 12, 1982, 10.0, 'Tishman Speyer', '11/25/06', '$200,698,755', 'CBD'],
  ['1875 I St NW', 'International Square 2', 'A', 329298, 12, 1979, 39.8, 'Tishman Speyer', '11/25/06', '$169,061,591', 'CBD'],
  ['800 K St NW', 'The Octagon Building', 'A', 130000, 12, 2019, 39.1, '', '', '', 'East End'],
  ['1050 K St NW', '1050 K Street', 'A', 155198, 11, 2008, 18.9, 'CBRE', '', '', 'East End'],
  ['1275 K St NW', '', 'B', 245000, 12, 1983, 50.5, 'Newmark', '6/13/06', '$123,000,000', 'East End'],
  ['1301 K St NW', 'One Franklin Square', 'A', 638807, 12, 1990, 6.6, 'CBRE', '4/24/96', '$181,000,000', 'East End'],
  ['1400 K St NW', '', 'B', 197000, 12, 1982, 36.3, '', '10/31/25', '$35,500,000', 'East End'],
  ['1401 K St NW', 'Tower Bldg', 'A', 148725, 12, 1929, 27.3, 'Stream Realty Partners', '10/2/17', '', 'East End'],
  ['1411 K St NW', '', 'B', 70074, 14, 1958, 86.4, '', '12/29/25', '$7,000,000', 'East End'],
  ['1501 K St NW', 'The Investment Building', 'A', 401433, 12, 1922, 24.2, 'CBRE', '12/18/18', '$385,400,000', 'East End'],
  ['1600 K St NW', '', 'B', 82653, 11, 1950, 31.3, 'JLL', '7/31/19', '$43,000,000', 'CBD'],
  ['1625 K St NW', 'Commonwealth Bldg', 'B', 112040, 12, 1941, 48.7, 'JLL', '7/16/14', '$47,200,000', 'CBD'],
  ['1627 K St NW', '', 'B', 77000, 12, 1977, 33.5, 'Summit Commercial', '10/1/04', '$15,950,000', 'CBD'],
  ['1666 K St NW', '', 'A', 289522, 12, 1972, 4.4, 'JBG SMITH Properties', '', '', 'CBD'],
  ['1667 K St NW', 'Flagship of Farragut Square', 'B', 188154, 12, 1983, 35.3, 'JLL', '1/31/01', '$55,750,000', 'CBD'],
  ['1700 K St NW', '', 'A', 386000, 12, 2005, 2.9, 'JBG SMITH Properties', '', '', 'CBD'],
  ['1701 K St NW', 'Farragut Park', 'B', 70785, 12, 1954, 17.2, 'JLL', '9/10/02', '$15,000,000', 'CBD'],
  ['1775 K St NW', '', 'A', 271333, 11, 1969, 7.0, 'Union Realty Advisors', '', '', 'CBD'],
  ['1801 K St NW', '1801 K', 'A', 570000, 13, 1972, 10.8, 'JLL', '1/9/15', '$445,000,000', 'CBD'],
  ['1825 K St NW', '1825 K', 'A', 357667, 13, 1966, 25.9, 'Colliers', '', '', 'CBD'],
  ['1850 K St NW', 'International Square 1', 'A', 437439, 12, 1977, 33.7, 'Tishman Speyer', '11/25/06', '$225,786,599', 'CBD'],
  ['1909 K St NW', 'The Millennium Building', 'A', 238918, 12, 1973, 13.6, 'CBRE', '', '', 'CBD'],
  ['1999 K St NW', '1999 K Street', 'A', 250345, 12, 2009, 18.1, 'JLL', '9/1/09', '$207,751,142', 'CBD'],
  ['2000 K St NW', '2000 K Street', 'A', 233292, 12, 2017, 12.4, 'JLL', '7/15/24', '$140,200,000', 'CBD'],
  ['2020 K St NW', '', 'A', 411651, 11, 1975, 11.4, 'JLL', '12/18/03', '', 'CBD'],
  ['2033 K St NW', '', 'A', 126953, 8, 1975, 73.1, 'CBRE', '7/18/25', '$20,500,000', 'CBD'],
  ['2121 K St NW', '', 'A', 195194, 11, 1981, 16.6, 'CBRE', '11/15/10', '$82,443,249', 'CBD'],
  ['1310 L St NW', '', 'A', 144073, 10, 2001, 0, 'Colliers', '', '', 'East End'],
  ['1400 L St NW', 'The Aleck', 'A', 172000, 12, 1987, 12.1, 'CBRE', '5/18/16', '$70,000,000', 'East End'],
  ['1602 L St NW', '', 'A', 52498, 9, 2007, 28.6, 'Transwestern', '2/6/08', '$30,500,000', 'CBD'],
  ['1620 L St NW', '', 'B', 173802, 12, 1989, 16.5, 'JLL', '3/21/17', '$98,500,000', 'CBD'],
  ['1707 L St NW', '', 'B', 102631, 10, 1963, 6.8, 'Transwestern', '5/1/09', '', 'CBD'],
  ['1801 L St NW', '', 'A', 199846, 10, 1988, 20.2, 'Summit Commercial', '7/6/22', '$64,750,000', 'CBD'],
  ['1828 L St NW', '', 'A', 285000, 12, 1969, 21.1, 'Transwestern', '', '', 'CBD'],
  ['1899 L St NW', '', 'A', 152000, 12, 1978, 26.2, '', '3/29/24', '$26,650,000', 'CBD'],
  ['1900 L St NW', '', 'B', 155462, 10, 1965, 28.1, 'JLL', '12/3/01', '$16,600,000', 'CBD'],
  ['1920 L St NW', '', 'A', 110000, 8, 1963, 24.7, 'JLL', '12/14/06', '$47,500,000', 'CBD'],
  ['2055 L St NW', '2055 L', 'A', 254290, 7, 1963, 0, 'CBRE', '', '', 'CBD'],
  ['2101 L St NW', '', 'A', 384000, 10, 1975, 21.6, 'CBRE', '12/19/24', '$110,100,907', 'CBD'],
  ['2120 L St NW', '', 'B', 118368, 8, 1970, 30.0, 'Cushman & Wakefield', '', '', 'CBD'],
  ['1501 M St NW', '1501 M St', 'A', 178233, 11, 1991, 40.0, 'CBRE', '12/20/24', '$29,375,000', 'East End'],
  ['1800 M St NW', '', 'A', 565000, 10, 1978, 13.0, 'Cushman & Wakefield', '12/8/21', '$227,838,766', 'CBD'],
  ['1919 M St NW', '', 'A', 298983, 8, 1967, 26.8, 'JBG SMITH Properties', '', '', 'CBD'],
  ['1990 M St NW', '', 'A', 107361, 8, 1971, 56.6, 'Summit Commercial', '3/26/13', '$41,741,991', 'CBD'],
  ['1200 New Hampshire Ave NW', '', 'A', 309039, 8, 1980, 53.8, '', '9/18/18', '$174,500,000', 'CBD'],
  ['1099 New York Ave NW', '', 'A', 210235, 11, 2008, 7.2, 'JLL', '3/22/24', '$95,000,000', 'East End'],
  ['1100 New York Ave NW', 'Greyhound Building', 'A', 514000, 12, 1991, 6.1, 'JLL', '12/12/14', '$290,000,000', 'East End'],
  ['1200 New York Ave NW', 'AAAS Headquarters', 'A', 323000, 12, 1995, 8.1, 'Savills', '', '', 'East End'],
  ['1307 New York Ave NW', 'The Herald', 'A', 144144, 10, 1923, 23.5, 'Avison Young', '3/3/21', '$29,050,000', 'East End'],
  ['1399 New York Ave NW', 'The Executive Tower', 'A', 132000, 11, 2001, 22.8, 'JLL', '9/21/18', '$121,445,000', 'East End'],
  ['1445 New York Ave NW', 'SunTrust Bank Bldg', 'A', 203542, 9, 1888, 12.0, 'Cushman & Wakefield', '11/13/07', '$87,000,000', 'East End'],
  ['1700 New York Ave NW', '', 'A', 123099, 8, 2013, 11.0, 'JLL', '8/19/13', '', 'CBD'],
  ['1735 New York Ave NW', '', 'A', 183768, 7, 1973, 9.7, 'Cresa', '', '', 'CBD'],
  ['1750 New York Ave NW', 'United Unions Building', 'B', 188555, 8, 1972, 24.4, 'Cushman & Wakefield', '', '', 'CBD'],
  ['1275 Pennsylvania Ave NW', 'Pennsylvania Bldg', 'A', 243321, 13, 1987, 3.6, 'CBRE', '', '', 'East End'],
  ['1331 Pennsylvania Ave NW', 'National Place', 'A', 691200, 15, 1984, 16.3, 'Cushman & Wakefield', '', '', 'East End'],
  ['1747 Pennsylvania Ave NW', '', 'A', 166954, 12, 1969, 16.4, 'Tishman Speyer', '11/25/06', '$13,520,144', 'CBD'],
  ['1750 Pennsylvania Ave NW', '', 'A', 278063, 13, 1963, 15.1, 'CBRE', '9/4/15', '$182,000,000', 'CBD'],
  ['1775 Pennsylvania Ave NW', '', 'A', 157002, 12, 1975, 49.5, 'Avison Young', '11/25/06', '$19,116,724', 'CBD'],
  ['1801 Pennsylvania Ave NW', '1801 Penn', 'A', 276842, 13, 1991, 3.7, 'Cushman & Wakefield', '1/31/06', '$149,490,100', 'CBD'],
  ['1899 Pennsylvania Ave NW', '1899 Pennsylvania Avenue', 'A', 205741, 11, 1915, 7.2, 'JLL', '12/24/20', '$92,200,000', 'CBD'],
  ['1919 Pennsylvania Ave NW', '', 'A', 336111, 9, 1979, 17.9, 'Tishman Speyer', '12/19/00', '$75,163,500', 'CBD'],
  ['2100 Pennsylvania Ave NW', '2100 Penn', 'A', 475849, 11, 2022, 5.0, 'Newmark', '', '', 'CBD'],
  ['2112 Pennsylvania Ave NW', '2112 Penn', 'A', 240620, 11, 2018, 14.8, 'CBRE', '', '', 'CBD'],
  ['1025 Vermont Ave NW', '', 'B', 116046, 12, 1963, 29.1, 'JLL', '12/19/18', '$48,500,000', 'East End'],
  ['1100 Vermont Ave NW', '', 'A', 69019, 12, 1961, 36.6, 'JLL', '11/28/18', '$41,000,000', 'East End'],
  ['1110 Vermont Ave NW', '', 'A', 306600, 12, 1980, 57.3, 'CBRE', '2/19/14', '$162,500,000', 'East End'],
  ['1120 Vermont Ave NW', 'Midtown DC', 'B', 502009, 12, 1981, 34.4, 'Stream Realty Partners', '', '', 'East End'],
  ['800 10th St NW', 'Two CityCenter (South Tower)', 'A', 293010, 11, 2014, 0, 'Hines', '2/28/13', '$7,849,789', 'East End'],
  ['850 10th St NW', 'One CityCenter (North Tower)', 'A', 282931, 11, 2014, 0, 'Hines', '2/28/13', '$7,015,193', 'East End'],
  ['701 13th St NW', 'One Metro Center', 'A', 421235, 12, 2003, 9.6, 'CBRE', '7/30/13', '$307,500,000', 'East End'],
  ['1155 16th St NW', 'American Chemical Society', 'A', 115470, 9, 1959, 0, '', '', '', 'CBD'],
  ['888 16th St NW', '', 'A', 192203, 8, 1969, 2.1, 'CBRE', '', '', 'CBD'],
  ['900 16th St NW', '', 'A', 122136, 9, 2016, 4.2, 'Avison Young', '6/30/17', '$151,000,000', 'CBD'],
  ['701 18th St NW', 'World Bank Building J', 'A', 487894, 11, 1986, 0, 'World Bank Group', '', '', 'CBD'],
  ['801 18th St NW', '', 'A', 59813, 10, 1982, 8.9, 'Avison Young', '12/13/21', '$23,000,000', 'CBD'],
  ['600 19th St NW', '', 'B', 463151, 10, 1981, 0, '', '', '', 'CBD'],
  ['1133 19th St NW', '', 'B', 194000, 12, 1981, 0, 'The Tower Companies', '', '', 'CBD'],
  ['1145 19th St NW', '1145 Medical Office Building', 'B', 133000, 8, 1967, 39.1, 'JLL', '12/17/25', '$30,000,000', 'CBD'],
  ['1129 20th St NW', 'Liberty Building', 'A', 185339, 10, 1969, 63.2, '', '12/22/20', '$84,830,000', 'CBD'],
  ['1133 20th St NW', '', 'B', 127561, 8, 1984, 32.6, 'Cushman & Wakefield', '9/30/05', '$46,875,000', 'CBD'],
  ['1155 21st St NW', 'Three Lafayette Centre', 'A', 304038, 10, 1986, 0, 'Cushman & Wakefield', '2/22/17', '$151,203,873', 'CBD'],
  ['1120 Connecticut Ave NW', 'The Bender Building', 'B', 369000, 12, 1960, 30.4, 'Blake Real Estate', '', '', 'CBD'],
  ['801 Eye St NW', '', 'A', 292295, 12, 1990, 35.4, 'JLL', '4/2/14', '$136,500,000', 'East End'],
  ['1575 Eye St NW', 'ASAE Center', 'A', 288798, 12, 1979, 13.5, 'JLL', '11/10/15', '$107,900,000', 'East End'],
  ['1625 Eye St NW', '', 'A', 386567, 12, 2003, 17.9, 'Avison Young', '9/24/19', '$259,000,000', 'CBD'],
  ['1722 Eye St NW', '', 'B', 195513, 9, 1982, 0, 'CBRE', '', '', 'CBD'],
  ['1818 H St NW', 'World Bank Ph 1', 'A', 400000, 13, 1993, 0, '', '', '', 'CBD'],
  ['1615 H St NW', '', 'A', 149562, 6, 1924, 0, '', '', '', 'CBD'],
  ['1100 L St NW', '', 'B', 318492, 12, 1969, 0, 'Blake Real Estate', '', '', 'East End'],
  ['1200 H St NW', '', 'B', 100343, 9, 1922, 0, '', '', '', 'East End'],
  ['1331 H St NW', '', 'B', 74290, 12, 1964, 52.5, 'Coldwell Banker', '11/24/25', '$3,000,000', 'East End'],
  ['1717 H St NW', '', 'B', 320032, 11, 1990, 85.3, 'JLL', '', '', 'CBD'],
  ['1101 K St NW', '', 'A', 313852, 10, 2006, 22.0, 'Avison Young', '6/24/15', '$244,250,000', 'East End'],
  ['1200 K St NW', '', 'A', 403503, 12, 1992, 100, '', '6/18/15', '$138,639,644', 'East End'],
  ['1430 K St NW', '', 'A', 109176, 12, 2006, 0, 'Cresa', '', '', 'East End'],
  ['1900 K St NW', '', 'A', 362964, 13, 1996, 24.4, '', '12/21/04', '$216,900,000', 'CBD'],
  ['2001 K St NW', 'Alexander Court South Building', 'A', 246520, 12, 2000, 0, 'Avison Young', '8/3/01', '$95,000,000', 'CBD'],
  ['2001 K St NW', 'Alexander Court North Building', 'A', 552477, 13, 1968, 5.0, 'Avison Young', '9/16/13', '$192,000,000', 'CBD'],
  ['2100 K St NW', '', 'A', 153425, 11, 2019, 0, 'Blake Real Estate', '', '', 'CBD'],
  ['2131 K St NW', '', 'B', 88070, 8, 1981, 0, '', '12/21/11', '$28,800,000', 'CBD'],
  ['2141 K St NW', 'University Medical Bldg', 'B', 98292, 9, 1966, 40.3, 'Gittleson Zuppas', '1/20/09', '$23,577,952', 'CBD'],
  ['1889 F St NW', 'Building of the Americas', 'B', 268848, 8, 1978, 7.5, 'CBRE', '', '', 'CBD'],
  ['1777 F St NW', '', 'B', 83209, 8, 1981, 0, 'Colliers', '6/14/07', '$34,000,000', 'CBD'],
  ['1776 G St NW', '', 'B', 266000, 8, 1979, 0, '', '12/19/19', '$129,500,000', 'CBD'],
  ['1800 G St NW', 'The Northwestern Building', 'B', 608515, 12, 1965, 0, 'Blake Real Estate', '', '', 'CBD'],
  ['1341 G St NW', 'Colorado Building', 'A', 132714, 11, 1903, 0, 'Lincoln Property Company', '1/13/26', '$20,000,000', 'East End'],
  ['1330 G St NW', 'Barbara Jordan Conference Center', 'A', 70455, 10, 2003, 0, '', '', '', 'East End'],
  ['1510 H St NW', '1510 H Street Condos', 'A', 57668, 12, 1967, 0, '', '5/18/01', '$6,500,000', 'East End'],
  ['1850 Eye St NW', 'World Bank Building 1', 'B', 477446, 13, 1979, 0, '', '', '', 'CBD'],
  ['700 19th St NW', 'International Monetary Fund Ph 1-3', 'B', 1700000, 12, 1972, 0, '', '', '', 'CBD'],
  ['1900 Pennsylvania Ave NW', 'IMF Headquarters 2', 'A', 649350, 12, 2005, 0.3, 'International Monetary Fund', '', '', 'CBD'],
  ['1300 New York Ave NW', 'Inter-American Development Bank', 'A', 1018508, 12, 1984, 0, '', '', '', 'East End'],
  ['1301 New York Ave NW', '', 'B', 201281, 12, 1983, 0, '', '8/21/13', '$135,000,000', 'East End'],
  ['1350 New York Ave NW', '', 'B', 144637, 12, 1983, 0, '', '5/20/97', '$21,250,000', 'East End'],
  ['1400 New York Ave NW', 'The Bond Building', 'B', 171920, 12, 1901, 0, '', '3/22/13', '$109,000,000', 'East End'],
  ['1401 New York Ave NW', '', 'A', 211446, 12, 1983, 6.3, 'Carr Properties', '1/20/26', '$85,000,000', 'East End'],
  ['1440 New York Ave NW', 'Washington Building', 'A', 228254, 11, 1927, 2.5, 'CBRE', '1/24/18', '$254,500,000', 'East End'],
  ['901 New York Ave NW', '', 'A', 542000, 11, 2005, 16.0, 'Cushman & Wakefield', '1/8/24', '$10,000,000', 'East End'],
  ['1101 Pennsylvania Ave NW', 'Evening Star Building', 'A', 226641, 13, 1898, 19.3, 'JLL', '12/20/24', '$69,506,065', 'East End'],
  ['1111 Pennsylvania Ave NW', 'Presidential Bldg', 'B', 337429, 14, 2002, 0, 'CBRE', '11/9/18', '$188,000,000', 'East End'],
  ['1299 Pennsylvania Ave NW', 'The Warner', 'A', 657430, 13, 1924, 15.6, 'CBRE', '12/28/18', '$376,500,000', 'East End'],
  ['1301 Pennsylvania Ave NW', 'One Freedom Plaza', 'A', 286850, 13, 2018, 0.7, 'Cushman & Wakefield', '', '', 'East End'],
  ['1325 Pennsylvania Ave NW', '', 'B', 51814, 7, 1910, 0, 'Cushman & Wakefield', '12/19/25', '$5,500,000', 'East End'],
  ['1350 Pennsylvania Ave NW', 'John A. Wilson Bldg', 'A', 255000, 6, 1904, 0, 'D.C. Department of General Services', '', '', 'East End'],
  ['1700 Pennsylvania Ave NW', 'The Mills Building', 'A', 208772, 12, 1966, 0, 'Avison Young', '1/8/24', '$100,533,000', 'CBD'],
  ['1875 Pennsylvania Ave NW', '', 'A', 281583, 13, 2006, 100, 'Cushman & Wakefield', '1/1/06', '$198,800,000', 'CBD'],
  ['2001 Pennsylvania Ave NW', 'James Monroe Building', 'A', 161000, 11, 1990, 0, 'Carr Properties', '10/31/24', '$35,000,000', 'CBD'],
  ['2121 Pennsylvania Ave NW', 'IFC Headquarters Building', 'B', 550000, 11, 1996, 0, '', '', '', 'CBD'],
  ['2150 Pennsylvania Ave NW', '', 'B', 67397, 11, 1931, 0, '', '', '', 'CBD'],
  ['2200 Pennsylvania Ave NW', 'The Avenue', 'A', 459811, 10, 2011, 7.6, '', '', '', 'West End'],
  ['2050 M St NW', '2050 M Street', 'A', 338000, 11, 2020, 1.8, 'Tishman Speyer', '', '', 'CBD'],
  ['2100 M St NW', '', 'B', 301347, 8, 1969, 100, '', '12/15/25', '$55,000,000', 'CBD'],
  ['1525 M St NW', '', 'A', 147772, 8, 1962, 0, 'National Education Association', '', '', 'East End'],
  ['1090 Vermont Ave NW', '', 'A', 158739, 12, 1980, 100, 'JLL', '4/2/13', '$62,750,000', 'East End'],
  ['1625 L St NW', 'The Gerald W. McEntce Building', 'C', 83538, 8, 1955, 0, 'AFSCME', '', '', 'CBD'],
  ['2021 L St NW', 'American Society of Hematology', 'A', 81032, 10, 1969, 3.7, 'JLL', '10/2/08', '$50,972,000', 'CBD'],
  ['1413 K St NW', '', 'B', 48600, 15, 1954, 38.2, 'Summit Commercial', '7/6/01', '$2,837,500', 'East End'],
  ['1424 K St NW', 'Orme Building', 'B', 43091, 7, 1905, 31.2, 'CBRE', '5/31/00', '$3,300,000', 'East End'],
  ['1518 K St NW', '', 'B', 26004, 6, 1928, 59.9, '', '12/19/12', '$5,789,056', 'East End'],
  ['1319 F St NW', 'International Office Bldg', 'B', 66306, 10, 1912, 15.1, 'Cushman & Wakefield', '5/31/19', '$20,000,000', 'East End'],
  ['1444 I St NW', '', 'B', 77026, 11, 1983, 52.4, 'Lincoln Property Company', '', '', 'East End'],
  ['1710 I St NW', '', 'B', 79710, 10, 1960, 18.8, 'JLL', '', '', 'CBD'],
  ['1915 I St NW', '', 'B', 20425, 8, 1982, 37.6, 'Summit Commercial', '7/11/14', '$8,700,000', 'CBD'],
  ['1325 Massachusetts Ave NW', 'NATCA', 'B', 45747, 7, 1966, 13.6, 'Union Realty Advisors', '12/8/99', '$8,100,000', 'East End'],
  ['1401 Massachusetts Ave NW', '', 'A', 51918, 5, 1954, 23.9, 'Transwestern', '5/3/19', '$6,000,000', 'East End'],
  ['1819 L St NW', '', 'B', 70262, 10, 1983, 12.5, '', '', '', 'CBD'],
  ['1003 K St NW', 'Carpenters Union Bldg', 'B', 39576, 8, 1926, 40.7, 'JLL', '', '', 'East End'],
  ['730 12th St NW', '', 'C', 197259, 7, 1928, 0, '', '', '', 'East End'],
  ['112 15th St NW', '', 'B', 112000, 10, 1931, 0, '', '11/20/15', '$53,080,544', 'East End'],
  ['1001 11th St NW', '', 'C', 29834, 3, 1880, 0, 'Douglas Development', '6/26/03', '$650,000', 'East End'],
];

// Existing mock building addresses (normalized) to prevent duplicates
const existingAddresses = new Set([
  '1100 new york ave nw',     // b1 - note: CoStar has "1100 New York Ave NW" as "Greyhound Building"
  '601 13th st nw',           // b2 - Homer Building
  '1300 i st nw',             // b3 - Franklin Square
  '800 17th st nw',           // b4 - Capital One Center (CoStar: PNC Place)
  '2000 pennsylvania ave nw', // b5
  '1000 vermont ave nw',      // b6
]);

function buildCostarBuildings(): Building[] {
  const buildings: Building[] = [];
  const seenAddresses = new Set<string>();

  rawBuildings.forEach((raw, index) => {
    const [address, name, cls, sqft, floors, yearBuilt, vacancyRate, leasingBroker, lastSaleDate, lastSalePrice, submarket] = raw;
    const normalizedAddr = address.toLowerCase().replace(/\s+/g, ' ').trim();

    // Skip duplicates with existing mock data
    if (existingAddresses.has(normalizedAddr)) return;

    // Skip if we've already seen this address in CoStar data
    if (seenAddresses.has(normalizedAddr)) return;
    seenAddresses.add(normalizedAddr);

    const id = `cs-${index}`;
    const coords = estimateCoords(address);
    const tenants = generateTenants(id, sqft, cls);
    const displayName = name || address;

    const building: Building = {
      id,
      name: displayName,
      address: `${address}, Washington, DC`,
      lat: coords.lat,
      lng: coords.lng,
      sqft,
      floors,
      yearBuilt,
      vacancyRate: Math.round(vacancyRate * 10) / 10,
      owner: generateOwner(index),
      leasingBroker: leasingBroker || undefined,
      class: cls as 'A' | 'B' | 'C',
      tenants,
    };

    if (lastSaleDate && lastSalePrice) {
      building.recentSale = { date: lastSaleDate, price: lastSalePrice };
    }

    buildings.push(building);
  });

  return buildings;
}

export const costarBuildings: Building[] = buildCostarBuildings();
