import { useState } from 'react';
import { Search, Building2, Loader2, ExternalLink, MapPin, DollarSign, User, Phone, Download, Filter, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const US_STATES = [
  { value: 'none', label: 'All States' },
  { value: 'Al', label: 'Alabama' }, { value: 'Ak', label: 'Alaska' }, { value: 'Az', label: 'Arizona' },
  { value: 'Ar', label: 'Arkansas' }, { value: 'Ca', label: 'California' }, { value: 'Co', label: 'Colorado' },
  { value: 'Ct', label: 'Connecticut' }, { value: 'De', label: 'Delaware' }, { value: 'Fl', label: 'Florida' },
  { value: 'Ga', label: 'Georgia' }, { value: 'Hi', label: 'Hawaii' }, { value: 'Id', label: 'Idaho' },
  { value: 'Il', label: 'Illinois' }, { value: 'In', label: 'Indiana' }, { value: 'Ia', label: 'Iowa' },
  { value: 'Ks', label: 'Kansas' }, { value: 'Ky', label: 'Kentucky' }, { value: 'La', label: 'Louisiana' },
  { value: 'Me', label: 'Maine' }, { value: 'Md', label: 'Maryland' }, { value: 'Ma', label: 'Massachusetts' },
  { value: 'Mi', label: 'Michigan' }, { value: 'Mn', label: 'Minnesota' }, { value: 'Ms', label: 'Mississippi' },
  { value: 'Mo', label: 'Missouri' }, { value: 'Mt', label: 'Montana' }, { value: 'Ne', label: 'Nebraska' },
  { value: 'Nv', label: 'Nevada' }, { value: 'Nh', label: 'New Hampshire' }, { value: 'Nj', label: 'New Jersey' },
  { value: 'Nm', label: 'New Mexico' }, { value: 'Ny', label: 'New York' }, { value: 'Nc', label: 'North Carolina' },
  { value: 'Nd', label: 'North Dakota' }, { value: 'Oh', label: 'Ohio' }, { value: 'Ok', label: 'Oklahoma' },
  { value: 'Or', label: 'Oregon' }, { value: 'Pa', label: 'Pennsylvania' }, { value: 'Ri', label: 'Rhode Island' },
  { value: 'Sc', label: 'South Carolina' }, { value: 'Sd', label: 'South Dakota' }, { value: 'Tn', label: 'Tennessee' },
  { value: 'Tx', label: 'Texas' }, { value: 'Ut', label: 'Utah' }, { value: 'Vt', label: 'Vermont' },
  { value: 'Va', label: 'Virginia' }, { value: 'Wa', label: 'Washington' }, { value: 'Wv', label: 'West Virginia' },
  { value: 'Wi', label: 'Wisconsin' }, { value: 'Wy', label: 'Wyoming' },
];

type LoopNetListing = {
  [key: string]: unknown;
};

const LoopNetSearch = () => {
  const [searchUrls, setSearchUrls] = useState('');
  const [state, setState] = useState('none');
  const [city, setCity] = useState('');
  const [maxItems, setMaxItems] = useState('10');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sizeMin, setSizeMin] = useState('');
  const [sizeMax, setSizeMax] = useState('');
  const [includeDetails, setIncludeDetails] = useState(false);
  const [moreResults, setMoreResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LoopNetListing[]>([]);
  const [searchMode, setSearchMode] = useState<'filters' | 'url'>('filters');

  const handleSearch = async () => {
    setLoading(true);
    setResults([]);
    try {
      const body: Record<string, unknown> = {
        maxItems: parseInt(maxItems) || 10,
        includeListingDetails: includeDetails,
        moreResults,
      };

      if (searchMode === 'url' && searchUrls.trim()) {
        body.startUrls = searchUrls.split('\n').map(u => u.trim()).filter(Boolean);
      } else {
        if (state !== 'none') body.State = state;
        if (city.trim()) body.City = city.trim();
        if (priceMin) body.PriceMin = parseInt(priceMin);
        if (priceMax) body.PriceMax = parseInt(priceMax);
        if (sizeMin) body.BuildingSizeRangeMin = parseInt(sizeMin);
        if (sizeMax) body.BuildingSizeRangeMax = parseInt(sizeMax);
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
    // Get all unique keys from results
    const allKeys = Array.from(new Set(results.flatMap(r => Object.keys(r))));
    const rows = results.map(r =>
      allKeys.map(k => `"${(String(r[k] ?? '')).replace(/"/g, '""')}"`)
    );
    const csv = [allKeys.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loopnet-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getField = (listing: LoopNetListing, ...keys: string[]): string => {
    for (const k of keys) {
      if (listing[k] != null && listing[k] !== '') return String(listing[k]);
    }
    return '—';
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
                className="gap-1.5"
              >
                <Filter className="h-3.5 w-3.5" /> Search by Filters
              </Button>
              <Button
                variant={searchMode === 'url' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchMode('url')}
                className="gap-1.5"
              >
                <Link2 className="h-3.5 w-3.5" /> Search by URL
              </Button>
            </div>

            {searchMode === 'url' ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">LoopNet Search URLs (one per line)</Label>
                <textarea
                  placeholder={"https://www.loopnet.com/search/office-space/new-york-ny/for-lease/\nhttps://www.loopnet.com/search/retail-space/los-angeles-ca/for-lease/"}
                  value={searchUrls}
                  onChange={(e) => setSearchUrls(e.target.value)}
                  className="w-full min-h-[80px] rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={3}
                />
                <p className="text-[10px] text-muted-foreground">
                  Paste LoopNet search result URLs. State/City/Price filters are ignored when URLs are provided.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">State</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger className="bg-secondary/30 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">City</Label>
                    <Input
                      placeholder="e.g. Washington, New York"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="bg-secondary/30 border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Min Price ($)</Label>
                    <Input
                      type="number"
                      placeholder="No minimum"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="bg-secondary/30 border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Max Price ($)</Label>
                    <Input
                      type="number"
                      placeholder="No maximum"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="bg-secondary/30 border-border"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Min Building Size (SF)</Label>
                    <Input
                      type="number"
                      placeholder="No minimum"
                      value={sizeMin}
                      onChange={(e) => setSizeMin(e.target.value)}
                      className="bg-secondary/30 border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Max Building Size (SF)</Label>
                    <Input
                      type="number"
                      placeholder="No maximum"
                      value={sizeMax}
                      onChange={(e) => setSizeMax(e.target.value)}
                      className="bg-secondary/30 border-border"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Shared options */}
            <div className="flex flex-wrap items-end gap-6">
              <div className="space-y-2 w-32">
                <Label className="text-xs text-muted-foreground">Max Items</Label>
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  value={maxItems}
                  onChange={(e) => setMaxItems(e.target.value)}
                  className="bg-secondary/30 border-border"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={includeDetails} onCheckedChange={setIncludeDetails} id="details" />
                <Label htmlFor="details" className="text-xs text-muted-foreground cursor-pointer">
                  Include listing details
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={moreResults} onCheckedChange={setMoreResults} id="moreResults" />
                <Label htmlFor="moreResults" className="text-xs text-muted-foreground cursor-pointer">
                  Bypass 500 limit
                </Label>
              </div>
              <Button onClick={handleSearch} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? 'Searching LoopNet...' : 'Search'}
              </Button>
            </div>

            {loading && (
              <p className="text-xs text-muted-foreground animate-pulse">
                ⏱️ This may take 1-5 minutes depending on the number of listings. Hang tight.
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
                    <TableHead className="text-[10px] text-muted-foreground">Name / Address</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Location</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Type</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Size</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Price</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Broker / Agent</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((listing, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="text-xs font-medium text-foreground max-w-[250px]">
                        <div className="flex items-start gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="truncate">
                            {getField(listing, 'name', 'buildingName', 'title', 'address')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {getField(listing, 'location', 'city', 'fullAddress', 'addressLine1')}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {getField(listing, 'propertyType', 'type', 'spaceUse', 'category')}
                      </TableCell>
                      <TableCell className="text-xs text-foreground whitespace-nowrap">
                        {getField(listing, 'size', 'spaceSf', 'buildingSize', 'totalAvailableSf', 'squareFeet')}
                      </TableCell>
                      <TableCell className="text-xs text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-0.5">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          {getField(listing, 'price', 'rentalRate', 'rentalRatePerSfYr', 'askingPrice', 'rate')}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px]">
                        {(() => {
                          const broker = getField(listing, 'brokerName', 'agentName', 'agent', 'contactName', 'broker');
                          const company = getField(listing, 'brokerCompany', 'agentCompany', 'company', 'brokerage');
                          const phone = getField(listing, 'brokerPhone', 'agentPhone', 'phone', 'contactPhone');
                          return broker !== '—' ? (
                            <div>
                              <div className="flex items-center gap-0.5 font-medium text-foreground">
                                <User className="h-3 w-3" />
                                {broker}
                              </div>
                              {company !== '—' && <span className="text-[10px]">{company}</span>}
                              {phone !== '—' && (
                                <div className="flex items-center gap-0.5 text-[10px]">
                                  <Phone className="h-2.5 w-2.5" />
                                  {phone}
                                </div>
                              )}
                            </div>
                          ) : '—';
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const url = getField(listing, 'url', 'listingUrl', 'link', 'detailUrl');
                          return url !== '—' ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null;
                        })()}
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
              Use filters or paste LoopNet search URLs to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoopNetSearch;
