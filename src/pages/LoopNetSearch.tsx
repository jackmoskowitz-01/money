import { useState } from 'react';
import { Search, Building2, Loader2, ExternalLink, MapPin, DollarSign, User, Phone, Calendar, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const SPACE_USE_OPTIONS = [
  { value: 'commercial-real-estate', label: 'All Commercial' },
  { value: 'office-space', label: 'Office' },
  { value: 'retail-space', label: 'Retail' },
  { value: 'industrial-space', label: 'Industrial' },
  { value: 'flex-space', label: 'Flex' },
  { value: 'coworking', label: 'CoWorking' },
];

type LoopNetListing = {
  listingId?: string;
  listingUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  buildingName?: string;
  buildingClass?: string;
  propertyType?: string;
  spaceUse?: string;
  floor?: string;
  spaceSf?: string | number;
  totalAvailableSf?: string | number;
  leaseTerm?: string;
  rentalRatePerSfYr?: string;
  rentalRatePerSfMo?: string;
  spaceCondition?: string;
  availableDate?: string;
  brokerName?: string;
  brokerCompany?: string;
  brokerPhone?: string;
  listingAdLevel?: string;
  premiumLister?: boolean;
  collectedAt?: string;
  // Some actors may use different field names
  [key: string]: unknown;
};

const LoopNetSearch = () => {
  const [searchUrl, setSearchUrl] = useState('');
  const [spaceUse, setSpaceUse] = useState('commercial-real-estate');
  const [location, setLocation] = useState('');
  const [maxItems, setMaxItems] = useState('10');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LoopNetListing[]>([]);
  const [searchMode, setSearchMode] = useState<'filters' | 'url'>('filters');

  const handleSearch = async () => {
    setLoading(true);
    setResults([]);
    try {
      const body: Record<string, unknown> = {
        maxItems: parseInt(maxItems) || 10,
      };

      if (searchMode === 'url' && searchUrl.trim()) {
        body.searchUrl = searchUrl.trim();
      } else {
        body.spaceUse = spaceUse;
        if (location.trim()) body.location = location.trim();
      }

      const { data, error } = await supabase.functions.invoke('loopnet-search', { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const items = data?.data || [];
      setResults(items);
      toast.success(`Found ${items.length} listing${items.length !== 1 ? 's' : ''}`);
    } catch (e) {
      console.error('LoopNet search failed:', e);
      toast.error(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (results.length === 0) return;
    const headers = [
      'Address', 'City', 'State', 'ZIP', 'Building Name', 'Building Class',
      'Property Type', 'Space Use', 'Floor', 'Space (SF)', 'Total Available (SF)',
      'Lease Term', 'Rate $/SF/YR', 'Rate $/SF/MO', 'Condition', 'Available Date',
      'Broker Name', 'Broker Company', 'Broker Phone',
    ];
    const rows = results.map(r => [
      r.address, r.city, r.state, r.zipCode, r.buildingName, r.buildingClass,
      r.propertyType, r.spaceUse, r.floor, r.spaceSf, r.totalAvailableSf,
      r.leaseTerm, r.rentalRatePerSfYr, r.rentalRatePerSfMo, r.spaceCondition,
      r.availableDate, r.brokerName, r.brokerCompany, r.brokerPhone,
    ].map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`));

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loopnet-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background pt-20 pb-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">LoopNet Search</h1>
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
              Commercial RE
            </Badge>
          </div>
          {results.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          )}
        </div>

        {/* Search Controls */}
        <Card className="border-border bg-card p-5">
          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex gap-2">
              <Button
                variant={searchMode === 'filters' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchMode('filters')}
              >
                Search by Filters
              </Button>
              <Button
                variant={searchMode === 'url' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchMode('url')}
              >
                Search by URL
              </Button>
            </div>

            {searchMode === 'url' ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">LoopNet Search URL</Label>
                <Input
                  placeholder="https://www.loopnet.com/search/office-space/new-york-ny/for-lease/"
                  value={searchUrl}
                  onChange={(e) => setSearchUrl(e.target.value)}
                  className="bg-secondary/30 border-border"
                />
                <p className="text-[10px] text-muted-foreground">
                  Paste a LoopNet search results URL. Space Use and Location filters are ignored when a URL is provided.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Space Use</Label>
                  <Select value={spaceUse} onValueChange={setSpaceUse}>
                    <SelectTrigger className="bg-secondary/30 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPACE_USE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <Input
                    placeholder="e.g. washington-dc, new-york-ny, los-angeles-ca"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="bg-secondary/30 border-border"
                  />
                  <p className="text-[10px] text-muted-foreground">City-state slug format</p>
                </div>
              </div>
            )}

            <div className="flex items-end gap-4">
              <div className="space-y-2 w-32">
                <Label className="text-xs text-muted-foreground">Max Items</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000000}
                  value={maxItems}
                  onChange={(e) => setMaxItems(e.target.value)}
                  className="bg-secondary/30 border-border"
                />
              </div>
              <Button onClick={handleSearch} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? 'Searching LoopNet...' : 'Search'}
              </Button>
            </div>

            {loading && (
              <p className="text-xs text-muted-foreground animate-pulse">
                ⏱️ This may take 1-5 minutes depending on the number of listings. LoopNet scraping is not instant — hang tight.
              </p>
            )}
          </div>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card className="border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">{results.length} Listings Found</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[10px] text-muted-foreground">Address</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">City/State</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Building</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Type</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Space (SF)</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Rate $/SF/YR</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Rate $/SF/MO</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Condition</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Available</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Broker</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((listing, i) => (
                    <TableRow key={listing.listingId || i} className="border-border">
                      <TableCell className="text-xs font-medium text-foreground max-w-[200px] truncate">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          {listing.address || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {[listing.city, listing.state].filter(Boolean).join(', ') || '—'}
                        {listing.zipCode && <span className="text-muted-foreground/50 ml-1">{listing.zipCode}</span>}
                      </TableCell>
                      <TableCell className="text-xs text-foreground max-w-[150px] truncate">
                        {listing.buildingName || '—'}
                        {listing.buildingClass && (
                          <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">
                            Class {listing.buildingClass}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {listing.propertyType || listing.spaceUse || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-foreground whitespace-nowrap">
                        {listing.spaceSf ? `${listing.spaceSf}` : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-0.5">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {listing.rentalRatePerSfYr || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground whitespace-nowrap">
                        {listing.rentalRatePerSfMo || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {listing.spaceCondition || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-0.5">
                          <Calendar className="h-3 w-3" />
                          {listing.availableDate || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px]">
                        {listing.brokerName ? (
                          <div>
                            <div className="flex items-center gap-0.5 font-medium text-foreground">
                              <User className="h-3 w-3" />
                              {listing.brokerName}
                            </div>
                            {listing.brokerCompany && (
                              <span className="text-[10px]">{listing.brokerCompany}</span>
                            )}
                            {listing.brokerPhone && (
                              <div className="flex items-center gap-0.5 text-[10px]">
                                <Phone className="h-2.5 w-2.5" />
                                {listing.brokerPhone}
                              </div>
                            )}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {listing.listingUrl && (
                          <a
                            href={listing.listingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Search LoopNet for commercial real estate listings</p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              Use filters or paste a LoopNet search URL to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoopNetSearch;
