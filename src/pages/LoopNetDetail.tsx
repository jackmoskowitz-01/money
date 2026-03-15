import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, DollarSign, User, Phone, ExternalLink, Mail, Image, Ruler, Calendar, Tag, FileText, Shield, TreePine, Bus, Landmark, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';

type Listing = Record<string, unknown>;

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

const Field = ({ label, value }: { label: string; value: unknown }) => {
  if (value == null || value === '' || value === '—') return null;
  const str = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  const isLong = str.length > 200;
  return (
    <div className="py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {isLong ? (
        <pre className="text-xs text-foreground mt-0.5 whitespace-pre-wrap break-words bg-muted/20 rounded p-2 max-h-48 overflow-y-auto">{str}</pre>
      ) : (
        <p className="text-xs text-foreground mt-0.5">{str}</p>
      )}
    </div>
  );
};

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
      if (listing[k] != null && listing[k] !== '') return String(listing[k]);
    }
    return '';
  };

  const getObj = (key: string): unknown => listing[key] ?? null;
  const images = (listing.images as string[] | undefined) || (listing.KVImages as string[] | undefined) || [];
  const name = get('header', 'name', 'address', 'propertyName');
  const listingUrl = get('listingUrl', 'url', 'link');

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
              <span>{get('address', 'city') && get('state') ? `${get('address')}, ${get('city')}, ${get('state')} ${get('zip')}` : get('address', 'city', 'state')}</span>
            </div>
            {get('propertyType', 'propertyTypeDetailed') && (
              <Badge variant="outline" className="mt-2 text-[10px] bg-primary/10 text-primary border-primary/20">
                {get('propertyType', 'propertyTypeDetailed')}
              </Badge>
            )}
          </div>
          {listingUrl && (
            <a href={listingUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> View on LoopNet
              </Button>
            </a>
          )}
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

        {/* Description / Summary */}
        {(get('description') || get('executiveSummary') || get('summary')) && (
          <Section title="Description" icon={FileText}>
            <Field label="Executive Summary" value={get('executiveSummary')} />
            <Field label="Description" value={get('description')} />
            <Field label="Summary" value={get('summary')} />
          </Section>
        )}

        {/* Property Facts */}
        <Section title="Property Facts" icon={Building2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <Field label="Property Type" value={get('propertyType')} />
            <Field label="Property Type (Detailed)" value={get('propertyTypeDetailed')} />
            <Field label="Building Size" value={get('buildingSize', 'squareFootage')} />
            <Field label="Number of Units" value={get('numberOfUnits')} />
            <Field label="Lot Details" value={getObj('lotDetails')} />
            <Field label="Zoning" value={get('zoning')} />
            <Field label="Year Built" value={get('yearBuilt')} />
            <Field label="Date on Market" value={get('date_market')} />
            <Field label="Property ID" value={get('propertyId')} />
            <Field label="Submarket ID" value={get('submarketId')} />
          </div>
          {getObj('propertyFacts') && <Field label="Property Facts (Full)" value={getObj('propertyFacts')} />}
          {getObj('PropertyFactsExtened') && <Field label="Property Facts Extended" value={getObj('PropertyFactsExtened')} />}
        </Section>

        {/* Financial */}
        {(get('price') || get('capRate') || getObj('propertyTaxes')) && (
          <Section title="Financial" icon={DollarSign}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <Field label="Price" value={get('price')} />
              <Field label="Price (Numeric)" value={get('priceNumeric')} />
              <Field label="Price Currency" value={get('priceCurrency')} />
              <Field label="Cap Rate" value={get('capRate')} />
            </div>
            <Field label="Property Taxes" value={getObj('propertyTaxes')} />
            <Field label="Property Taxes (Extended)" value={getObj('propertyTaxesExtended')} />
          </Section>
        )}

        {/* Spaces / Availability */}
        {(getObj('spaces') || getObj('availability')) && (
          <Section title="Spaces & Availability" icon={Ruler}>
            <Field label="Spaces" value={getObj('spaces')} />
            <Field label="Availability" value={getObj('availability')} />
            <Field label="Unit Mix" value={getObj('unitMix')} />
          </Section>
        )}

        {/* Broker / Contact */}
        <Section title="Broker & Contact" icon={User}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <Field label="Broker Name" value={get('brokerName', 'agent_fullName')} />
            <Field label="Broker Company" value={get('brokerCompany', 'agent_company_name')} />
            <Field label="Phone" value={get('phone', 'contactNumber')} />
            <Field label="Agent Photo" value={get('agent_photoUrl') ? undefined : undefined} />
          </div>
          {get('agent_photoUrl') && (
            <img src={get('agent_photoUrl')} alt="Agent" className="w-16 h-16 rounded-full object-cover border border-border mt-2" />
          )}
          {get('agent_profileUrl') && (
            <a href={get('agent_profileUrl')} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">View Agent Profile</a>
          )}
          <Field label="Broker Details" value={getObj('brokerDetails')} />
          <Field label="Broker (Full)" value={getObj('Broker')} />
          <Field label="Contact Details" value={getObj('contactDetails')} />
        </Section>

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
            <Field label="Position" value={getObj('position')} />
          </div>
        </Section>

        {/* Amenities & Highlights */}
        {(getObj('amenities') || getObj('highlights') || getObj('investmentHighlights')) && (
          <Section title="Amenities & Highlights" icon={TreePine} defaultOpen={false}>
            <Field label="Amenities" value={getObj('amenities')} />
            <Field label="Highlights" value={getObj('highlights')} />
            <Field label="Investment Highlights" value={getObj('investmentHighlights')} />
            <Field label="Sustainability" value={getObj('sustainability')} />
          </Section>
        )}

        {/* Nearby */}
        {(getObj('nearbyAmenities') || getObj('nearbyBusiness') || getObj('nearbyHospitals') || getObj('transportation') || getObj('demographics')) && (
          <Section title="Nearby & Demographics" icon={Landmark} defaultOpen={false}>
            <Field label="Nearby Amenities" value={getObj('nearbyAmenities')} />
            <Field label="Nearby Business" value={getObj('nearbyBusiness')} />
            <Field label="Nearby Hospitals" value={getObj('nearbyHospitals')} />
            <Field label="Transportation" value={getObj('transportation')} />
            <Field label="Demographics" value={getObj('demographics')} />
          </Section>
        )}

        {/* Other / Misc */}
        <Section title="Additional Data" icon={FileText} defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            <Field label="Ad Level" value={get('adLevel')} />
            <Field label="Access Control" value={get('accessControl')} />
            <Field label="Is Auction" value={get('isAuction')} />
            <Field label="Auction End Date" value={get('auctionEndDate')} />
            <Field label="Logo URL" value={get('logoUrl')} />
          </div>
          <Field label="Data Points" value={getObj('dataPoints')} />
          <Field label="Attachments" value={getObj('attachments')} />
          <Field label="Links" value={getObj('links')} />
        </Section>

        {/* Raw JSON toggle */}
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
