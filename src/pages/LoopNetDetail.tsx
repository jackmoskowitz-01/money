import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, DollarSign, User, ExternalLink, Ruler, Tag, FileText, TreePine, Bus, Landmark, ChevronDown, ChevronUp, Clock, Mail, Phone, Star, Utensils, ShoppingBag, Hospital, Plane, Plus, Trash2, X, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useState } from 'react';
import { toast } from 'sonner';

type Listing = Record<string, unknown>;

/* ── Collapsible Section ── */
const Section = ({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-border bg-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </Card>
  );
};

/* ── Simple key-value field (strings only) ── */
const Field = ({ label, value }: { label: string; value: unknown }) => {
  if (value == null || value === '' || value === '—') return null;
  if (typeof value === 'object') return null; // skip objects, render them with specialized components
  return (
    <div className="py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <p className="text-xs text-foreground mt-0.5">{String(value)}</p>
    </div>
  );
};

/* ── Label/Value pairs table (for propertyFacts, PropertyFactsExtened) ── */
const LabelValueTable = ({ data }: { data: Array<{ label: string; value: string }> }) => {
  const filtered = data.filter(d => d.value && d.value.trim());
  if (filtered.length === 0) return null;
  return (
    <div className="rounded border border-border overflow-hidden">
      <Table>
        <TableBody>
          {filtered.map((row, i) => (
            <TableRow key={i} className="border-border">
              <TableCell className="text-[10px] font-medium text-muted-foreground w-1/3 py-1.5 px-3">{row.label}</TableCell>
              <TableCell className="text-xs text-foreground py-1.5 px-3">{row.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

/* ── Key/value object renderer (for propertyFacts object format) ── */
const KeyValueObject = ({ data }: { data: Record<string, unknown> }) => {
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return null;
  return (
    <div className="rounded border border-border overflow-hidden">
      <Table>
        <TableBody>
          {entries.map(([key, val], i) => (
            <TableRow key={i} className="border-border">
              <TableCell className="text-[10px] font-medium text-muted-foreground w-1/3 py-1.5 px-3">{key.replace(/([A-Z])/g, ' $1').trim()}</TableCell>
              <TableCell className="text-xs text-foreground py-1.5 px-3">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

/* ── Spaces / Availability cards ── */
const SpacesSection = ({ spaces }: { spaces: Array<Record<string, unknown>> }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? spaces : spaces.slice(0, 5);
  return (
    <div className="space-y-2">
      {visible.map((space, i) => (
        <div key={i} className="rounded border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">{String(space.name || `Space ${i + 1}`)}</span>
            <div className="flex gap-2">
              {space.size && <Badge variant="outline" className="text-[10px]">{String(space.size)}</Badge>}
              {space.rate && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">{String(space.rate)}</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-muted-foreground">
            {space.spaceType && <div><span className="font-medium">Type:</span> {String(space.spaceType)}</div>}
            {space.leaseType && <div><span className="font-medium">Lease:</span> {String(space.leaseType)}</div>}
            {space.termLength && <div><span className="font-medium">Term:</span> {String(space.termLength)}</div>}
            {space.spaceUse && <div><span className="font-medium">Use:</span> {String(space.spaceUse)}</div>}
            {space.availability && <div><span className="font-medium">Available:</span> {String(space.availability)}</div>}
            {space.buildOut && <div><span className="font-medium">Build Out:</span> {String(space.buildOut)}</div>}
          </div>
          {Array.isArray(space.highlights) && space.highlights.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(space.highlights as string[]).slice(0, 4).map((h, j) => (
                <Badge key={j} variant="secondary" className="text-[9px] font-normal">{h}</Badge>
              ))}
              {(space.highlights as string[]).length > 4 && <Badge variant="secondary" className="text-[9px]">+{(space.highlights as string[]).length - 4}</Badge>}
            </div>
          )}
        </div>
      ))}
      {spaces.length > 5 && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="text-xs w-full">
          {showAll ? 'Show less' : `Show all ${spaces.length} spaces`}
        </Button>
      )}
    </div>
  );
};

/* ── Brokers cards ── */
const BrokersSection = ({ brokers }: { brokers: Array<Record<string, unknown>> }) => (
  <div className="space-y-3">
    {brokers.map((b, i) => (
      <div key={i} className="flex gap-3 p-3 rounded border border-border">
        {b.photoUrl && String(b.photoUrl).includes('http') && (
          <img src={String(b.photoUrl).replace('{s}', '120')} alt="" className="w-14 h-14 rounded-full object-cover border border-border shrink-0" />
        )}
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{String(b.name || '')}</p>
          {b.title && <p className="text-[10px] text-muted-foreground">{String(b.title)}</p>}
          {b.company && <p className="text-[10px] text-muted-foreground">{String(b.company)}</p>}
          <div className="flex flex-wrap gap-3 mt-1">
            {b.email && (
              <a href={`mailto:${b.email}`} className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                <Mail className="h-3 w-3" /> {String(b.email)}
              </a>
            )}
            {b.phone && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Phone className="h-3 w-3" /> {String(b.phone)}
              </span>
            )}
          </div>
          {b.bio && String(b.bio).length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{String(b.bio)}</p>
          )}
        </div>
      </div>
    ))}
  </div>
);

/* ── Amenities list ── */
const AmenitiesList = ({ items }: { items: Array<Record<string, unknown>> }) => (
  <div className="flex flex-wrap gap-1.5">
    {items.map((a, i) => (
      <Badge key={i} variant="secondary" className="text-[10px] font-normal">{String(a.name || a)}</Badge>
    ))}
  </div>
);

/* ── Highlights list ── */
const HighlightsList = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5">
    {items.map((h, i) => (
      <li key={i} className="text-xs text-foreground flex gap-2">
        <Star className="h-3 w-3 text-primary shrink-0 mt-0.5" />
        <span>{h}</span>
      </li>
    ))}
  </ul>
);

/* ── Nearby table ── */
const NearbyTable = ({ title, icon: Icon, items }: { title: string; icon: React.ElementType; items: Array<Record<string, unknown>> }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[10px] uppercase tracking-wider font-medium">{title}</span>
      </div>
      <div className="rounded border border-border overflow-hidden">
        <Table>
          <TableBody>
            {items.map((item, i) => (
              <TableRow key={i} className="border-border">
                <TableCell className="text-xs text-foreground py-1.5 px-3 font-medium">{String(item.name || '')}</TableCell>
                {item.type && <TableCell className="text-[10px] text-muted-foreground py-1.5 px-3">{String(item.type)}</TableCell>}
                {item.roomCount && <TableCell className="text-[10px] text-muted-foreground py-1.5 px-3">{String(item.roomCount)}</TableCell>}
                <TableCell className="text-[10px] text-muted-foreground py-1.5 px-3 text-right">
                  {String(item.distance || item.travelTime || item.drivingDuration || '')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

/* ── Transportation section ── */
const TransportationSection = ({ data }: { data: Array<Record<string, unknown>> }) => (
  <div className="space-y-2">
    {data.map((t, i) => {
      const stops = (t.stops as Array<Record<string, unknown>>) || [];
      return (
        <div key={i} className="space-y-1">
          {stops.map((stop, j) => {
            const dist = stop.distance as Record<string, string> | undefined;
            const drive = stop.drive as Record<string, string> | undefined;
            return (
              <div key={j} className="flex items-center justify-between py-1.5 px-3 rounded border border-border text-xs">
                <div className="flex items-center gap-2">
                  <Plane className="h-3 w-3 text-muted-foreground" />
                  <span className="text-foreground font-medium">{String(stop.name || '')}</span>
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  {dist?.Display && <span>{dist.Display}</span>}
                  {drive?.Display && <span>{drive.Display} drive</span>}
                </div>
              </div>
            );
          })}
        </div>
      );
    })}
  </div>
);

/* ── Lot details renderer ── */
const LotDetails = ({ data }: { data: Record<string, unknown> }) => {
  const entries = Object.entries(data).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return null;
  return <KeyValueObject data={Object.fromEntries(entries)} />;
};

/* ── Known Tenants (manual entry) ── */
type ManualTenant = { id: string; name: string; industry: string; sqft: string; floor: string; notes: string };

const TenantsSection = ({ buildingAddress }: { buildingAddress: string }) => {
  const storageKey = `loopnet-tenants-${buildingAddress}`;
  const [tenants, setTenants] = useState<ManualTenant[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', industry: '', sqft: '', floor: '', notes: '' });

  const saveTenants = (updated: ManualTenant[]) => {
    setTenants(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const handleAdd = () => {
    if (!form.name.trim()) { toast.error('Tenant name is required'); return; }
    const tenant: ManualTenant = {
      id: `lt-${Date.now()}`,
      name: form.name.trim(),
      industry: form.industry.trim(),
      sqft: form.sqft.trim(),
      floor: form.floor.trim(),
      notes: form.notes.trim(),
    };
    saveTenants([...tenants, tenant]);
    setForm({ name: '', industry: '', sqft: '', floor: '', notes: '' });
    setShowForm(false);
    toast.success(`${tenant.name} added as tenant`);
  };

  const handleRemove = (id: string) => {
    saveTenants(tenants.filter(t => t.id !== id));
    toast.success('Tenant removed');
  };

  return (
    <Section title={`Known Tenants (${tenants.length})`} icon={Users} defaultOpen={true}>
      {tenants.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground mb-2">No tenants tracked yet. Add tenants you discover in this building.</p>
      )}

      {tenants.length > 0 && (
        <div className="space-y-2 mb-3">
          {tenants.map(t => (
            <div key={t.id} className="flex items-center gap-3 rounded border border-border p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{t.name}</p>
                <div className="flex flex-wrap gap-2 mt-0.5 text-[10px] text-muted-foreground">
                  {t.industry && <span>{t.industry}</span>}
                  {t.sqft && <span>· {t.sqft} SF</span>}
                  {t.floor && <span>· Floor {t.floor}</span>}
                </div>
                {t.notes && <p className="text-[10px] text-muted-foreground mt-0.5 italic">{t.notes}</p>}
              </div>
              <button
                onClick={() => handleRemove(t.id)}
                className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <Card className="border-primary/30 bg-card p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Add Tenant</p>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <Input placeholder="Company name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" autoFocus />
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Industry" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
            <Input placeholder="Sq Ft" value={form.sqft} onChange={e => setForm({ ...form, sqft: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
            <Input placeholder="Floor" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
          </div>
          <Input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
          <Button size="sm" onClick={handleAdd} className="w-full text-xs h-8">
            <Plus className="mr-1 h-3 w-3" /> Add Tenant
          </Button>
        </Card>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" /> Add Tenant
        </button>
      )}
    </Section>
  );
};

/* ── Main Component ── */
const LoopNetDetail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const listing: Listing | null = location.state?.listing || null;

  if (!listing) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-10 px-4 flex flex-col items-center justify-center gap-4">
        <Building2 className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No listing data. Go back and select a listing.</p>
        <Button variant="outline" onClick={() => navigate('/loopnet')}>Back to Search</Button>
      </div>
    );
  }

  const get = (...keys: string[]): string => {
    for (const k of keys) {
      if (listing[k] != null && listing[k] !== '' && typeof listing[k] !== 'object') return String(listing[k]);
    }
    return '';
  };

  const getArr = (key: string): unknown[] => {
    const v = listing[key];
    return Array.isArray(v) ? v : [];
  };

  const getObj = (key: string): Record<string, unknown> | null => {
    const v = listing[key];
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v as Record<string, unknown> : null;
  };

  const images = (listing.images as string[] | undefined) || (listing.KVImages as string[] | undefined) || [];
  const name = get('header', 'name', 'address', 'propertyName');
  const listingUrl = get('listingUrl', 'url', 'link');

  // Structured data
  const spaces = getArr('spaces') as Array<Record<string, unknown>>;
  const brokerDetails = getArr('brokerDetails') as Array<Record<string, unknown>>;
  const propertyFactsObj = getObj('propertyFacts');
  const propertyFactsExt = getArr('PropertyFactsExtened') as Array<{ label: string; value: string }>;
  const amenities = getArr('amenities') as Array<Record<string, unknown>>;
  const highlights = getArr('highlights') as string[];
  const investmentHighlights = getArr('investmentHighlights') as string[];
  const dataPoints = getArr('dataPoints') as string[];
  const nearbyAmenities = getArr('nearbyAmenities') as Array<Record<string, unknown>>;
  const nearbyHospitals = getArr('nearbyHospitals') as Array<Record<string, unknown>>;
  const nearbyBusiness = getObj('nearbyBusiness');
  const transportation = getArr('transportation') as Array<Record<string, unknown>>;
  const lotDetails = getObj('lotDetails');
  const contactDetails = getObj('contactDetails');
  const propertyTaxes = getObj('propertyTaxes');
  const sustainability = getObj('sustainability');
  const links = getArr('links') as Array<{ url: string; description: string }>;
  const attachments = getArr('attachments') as Array<{ url?: string; name?: string; description?: string }>;
  const unitMix = getArr('unitMix') as Array<Record<string, unknown>>;

  return (
    <div className="min-h-screen bg-background pt-20 pb-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/loopnet')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{name || 'Listing Detail'}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{[get('address'), get('city'), get('state'), get('zip')].filter(Boolean).join(', ')}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {get('propertyType', 'propertyTypeDetailed') && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  {get('propertyType', 'propertyTypeDetailed')}
                </Badge>
              )}
              {String(listing.isAuction) === 'true' && (
                <Badge variant="destructive" className="text-[10px]">
                  🔨 Auction {get('auctionEndDate') ? `· Ends ${get('auctionEndDate')}` : ''}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {get('logoUrl') && (
              <img src={get('logoUrl')} alt="Logo" className="h-10 w-10 rounded object-contain border border-border" />
            )}
            {listingUrl && (
              <a href={listingUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> View on LoopNet
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Images */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {(images as string[]).slice(0, 8).map((img, i) => (
              <a key={i} href={String(img)} target="_blank" rel="noopener noreferrer">
                <img src={String(img)} alt={`Photo ${i + 1}`} className="w-full h-32 object-cover rounded-lg border border-border hover:opacity-90 transition-opacity" />
              </a>
            ))}
            {images.length > 8 && (
              <div className="flex items-center justify-center h-32 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground">
                +{images.length - 8} more
              </div>
            )}
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Price', value: get('price', 'priceNumeric'), icon: DollarSign },
            { label: 'Building Size', value: get('buildingSize', 'squareFootage'), icon: Ruler },
            { label: 'Cap Rate', value: get('capRate'), icon: Tag },
            { label: 'Listing Type', value: get('listingType'), icon: FileText },
          ].filter(m => m.value).map((m, i) => (
            <Card key={i} className="border-border bg-card p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <m.icon className="h-3 w-3" />
                <span className="text-[10px] uppercase tracking-wider">{m.label}</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{m.value}</p>
            </Card>
          ))}
        </div>

        {/* Description */}
        {(get('description') || get('executiveSummary') || get('summary')) && (
          <Section title="Description" icon={FileText}>
            <Field label="Executive Summary" value={get('executiveSummary')} />
            <Field label="Description" value={get('description')} />
            {typeof listing.summary === 'string' && <Field label="Summary" value={listing.summary} />}
          </Section>
        )}

        {/* Property Facts */}
        <Section title="Property Facts" icon={Building2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <Field label="Property Type" value={get('propertyType')} />
            <Field label="Property Type (Detailed)" value={get('propertyTypeDetailed')} />
            <Field label="Building Size" value={get('buildingSize', 'squareFootage')} />
            <Field label="Number of Units" value={get('numberOfUnits')} />
            <Field label="Zoning" value={get('zoning')} />
            <Field label="Year Built" value={get('yearBuilt')} />
            <Field label="Date on Market" value={get('date_market')} />
            <Field label="Property ID" value={get('propertyId')} />
          </div>
          {lotDetails && (
            <div className="mt-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Lot Details</span>
              <div className="mt-1"><LotDetails data={lotDetails} /></div>
            </div>
          )}
          {propertyFactsObj && (
            <div className="mt-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Building Facts</span>
              <div className="mt-1"><KeyValueObject data={propertyFactsObj} /></div>
            </div>
          )}
          {propertyFactsExt.length > 0 && (
            <div className="mt-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Extended Details</span>
              <div className="mt-1"><LabelValueTable data={propertyFactsExt} /></div>
            </div>
          )}
        </Section>

        {/* Financial */}
        {(get('price') || get('capRate') || propertyTaxes) && (
          <Section title="Financial" icon={DollarSign}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <Field label="Price" value={get('price')} />
              <Field label="Price Currency" value={get('priceCurrency')} />
              <Field label="Cap Rate" value={get('capRate')} />
            </div>
            {propertyTaxes && Object.values(propertyTaxes).some(v => v != null && v !== '') && (
              <div className="mt-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Property Taxes</span>
                <div className="mt-1"><KeyValueObject data={propertyTaxes} /></div>
              </div>
            )}
          </Section>
        )}

        {/* Spaces */}
        {spaces.length > 0 && (
          <Section title={`Available Spaces (${spaces.length})`} icon={Ruler}>
            <SpacesSection spaces={spaces} />
          </Section>
        )}

        {/* Broker & Contact */}
        <Section title="Broker & Contact" icon={User}>
          {get('Broker') && (
            <div className="mb-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Brokerage</span>
              <p className="text-xs font-semibold text-foreground mt-0.5">{get('Broker')}</p>
            </div>
          )}
          {brokerDetails.length > 0 ? (
            <BrokersSection brokers={brokerDetails} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <Field label="Broker Name" value={get('brokerName', 'agent_fullName')} />
              <Field label="Broker Company" value={get('brokerCompany', 'agent_company_name')} />
              <Field label="Phone" value={get('phone', 'contactNumber')} />
              <Field label="First Name" value={get('agent_firstName')} />
              <Field label="Last Name" value={get('agent_lastName')} />
            </div>
          )}
          {get('agent_photoUrl') && (
            <img src={get('agent_photoUrl')} alt="Agent" className="w-16 h-16 rounded-full object-cover border border-border mt-2" />
          )}
          {get('agent_profileUrl') && (
            <a href={get('agent_profileUrl')} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">View Agent Profile</a>
          )}
          {contactDetails && Object.values(contactDetails).some(v => v != null && v !== '') && (
            <div className="mt-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Contact Details</span>
              <div className="mt-1"><KeyValueObject data={contactDetails} /></div>
            </div>
          )}
        </Section>

        {/* Known Tenants (manual entry) */}
        <TenantsSection buildingAddress={[get('address'), get('city'), get('state')].filter(Boolean).join(', ')} />

        {/* Location */}
        <Section title="Location" icon={MapPin} defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <Field label="Address" value={get('address')} />
            <Field label="City" value={get('city')} />
            <Field label="State" value={get('state')} />
            <Field label="Zip" value={get('zip')} />
            <Field label="Country" value={get('country')} />
            <Field label="Latitude" value={get('latitude')} />
            <Field label="Longitude" value={get('longitude')} />
          </div>
        </Section>

        {/* Amenities & Highlights */}
        {(amenities.length > 0 || highlights.length > 0 || investmentHighlights.length > 0) && (
          <Section title="Amenities & Highlights" icon={TreePine} defaultOpen={false}>
            {amenities.length > 0 && (
              <div className="mb-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Amenities</span>
                <div className="mt-1.5"><AmenitiesList items={amenities} /></div>
              </div>
            )}
            {highlights.length > 0 && (
              <div className="mb-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Highlights</span>
                <div className="mt-1.5"><HighlightsList items={highlights} /></div>
              </div>
            )}
            {investmentHighlights.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Investment Highlights</span>
                <div className="mt-1.5"><HighlightsList items={investmentHighlights} /></div>
              </div>
            )}
          </Section>
        )}

        {/* Nearby */}
        {(nearbyAmenities.length > 0 || nearbyBusiness || nearbyHospitals.length > 0 || transportation.length > 0) && (
          <Section title="Nearby & Transportation" icon={Landmark} defaultOpen={false}>
            <div className="space-y-4">
              <NearbyTable title="Hotels" icon={Star} items={nearbyAmenities} />
              <NearbyTable title="Hospitals" icon={Hospital} items={nearbyHospitals} />
              {nearbyBusiness && (
                <>
                  {Array.isArray((nearbyBusiness as Record<string, unknown>).restaurants) && (
                    <NearbyTable title="Restaurants" icon={Utensils} items={(nearbyBusiness as Record<string, unknown>).restaurants as Array<Record<string, unknown>>} />
                  )}
                  {Array.isArray((nearbyBusiness as Record<string, unknown>).retail) && (
                    <NearbyTable title="Retail" icon={ShoppingBag} items={(nearbyBusiness as Record<string, unknown>).retail as Array<Record<string, unknown>>} />
                  )}
                </>
              )}
              {transportation.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Bus className="h-3 w-3" />
                    <span className="text-[10px] uppercase tracking-wider font-medium">Transportation</span>
                  </div>
                  <TransportationSection data={transportation} />
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Data Points */}
        {dataPoints.length > 0 && (
          <Section title="Key Data Points" icon={Star} defaultOpen={false}>
            <HighlightsList items={dataPoints} />
          </Section>
        )}

        {/* Unit Mix */}
        {unitMix.length > 0 && (
          <Section title="Unit Mix" icon={Ruler} defaultOpen={false}>
            {unitMix.map((unit, i) => (
              <div key={i} className="py-1">
                <KeyValueObject data={unit} />
              </div>
            ))}
          </Section>
        )}

        {/* Sustainability */}
        {sustainability && Object.values(sustainability).some(v => v != null && v !== '') && (
          <Section title="Sustainability" icon={TreePine} defaultOpen={false}>
            <KeyValueObject data={sustainability} />
          </Section>
        )}

        {/* Links & Attachments */}
        {(links.length > 0 || attachments.length > 0) && (
          <Section title="Links & Attachments" icon={ExternalLink} defaultOpen={false}>
            <div className="space-y-1">
              {links.map((link, i) => (
                <a key={`l-${i}`} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline py-1">
                  <ExternalLink className="h-3 w-3" />
                  {link.description || link.url}
                </a>
              ))}
              {attachments.map((att, i) => (
                <a key={`a-${i}`} href={String(att.url || '')} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline py-1">
                  <FileText className="h-3 w-3" />
                  {att.name || att.description || String(att.url || `Attachment ${i + 1}`)}
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Additional Metadata */}
        <Section title="Additional Data" icon={FileText} defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <Field label="Ad Level" value={get('adLevel')} />
            <Field label="Access Control" value={get('accessControl')} />
            <Field label="Submarket ID" value={get('submarketId')} />
            <Field label="Position" value={get('position')} />
          </div>
        </Section>

        {/* Raw JSON */}
        <RawJsonSection listing={listing} />
      </div>
    </div>
  );
};

const RawJsonSection = ({ listing }: { listing: Listing }) => {
  const [show, setShow] = useState(false);
  return (
    <Card className="border-border bg-card overflow-hidden">
      <button onClick={() => setShow(!show)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
        <span className="text-xs font-medium text-muted-foreground">Raw JSON Data</span>
        {show ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {show && (
        <pre className="px-4 pb-4 text-[10px] text-muted-foreground overflow-x-auto max-h-96">
          {JSON.stringify(listing, null, 2)}
        </pre>
      )}
    </Card>
  );
};

export default LoopNetDetail;
