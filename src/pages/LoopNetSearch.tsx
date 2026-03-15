import { useState } from 'react';
import { Search, Building2, Loader2, ExternalLink, MapPin, DollarSign, User, Phone, Download, Image } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type LoopNetListing = {
  [key: string]: unknown;
};

const LoopNetSearch = () => {
  const [searchUrls, setSearchUrls] = useState('');
  const [maxItems, setMaxItems] = useState('50');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LoopNetListing[]>([]);

  const handleSearch = async () => {
    const urls = searchUrls.split('\n').map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) {
      toast.error('Enter at least one LoopNet search URL');
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke('loopnet-search', {
        body: { searchUrls: urls, maxItems: parseInt(maxItems) || 50 },
      });

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

        <Card className="border-border bg-card p-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">LoopNet Search URLs (one per line)</Label>
              <textarea
                placeholder={"https://www.loopnet.com/search/office-space/washington-dc/for-lease/\nhttps://www.loopnet.com/search/retail-space/new-york-ny/for-lease/"}
                value={searchUrls}
                onChange={(e) => setSearchUrls(e.target.value)}
                className="w-full min-h-[100px] rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground">
                Go to <a href="https://www.loopnet.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">loopnet.com</a>, run your search with filters, then paste the URL(s) here.
              </p>
            </div>

            <div className="flex items-end gap-4">
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
              <Button onClick={handleSearch} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {loading ? 'Scraping LoopNet...' : 'Search'}
              </Button>
            </div>

            {loading && (
              <p className="text-xs text-muted-foreground animate-pulse">
                ⏱️ This may take 1-5 minutes depending on the number of listings. Hang tight.
              </p>
            )}
          </div>
        </Card>

        {results.length > 0 && (
          <Card className="border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">{results.length} Listings Found</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[10px] text-muted-foreground w-[60px]">Image</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Name / Address</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Location</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Type</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Size</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Price</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Agent</TableHead>
                    <TableHead className="text-[10px] text-muted-foreground">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((listing, i) => {
                    const imgUrl = getField(listing, 'imageUrl', 'image', 'thumbnailUrl', 'photo');
                    return (
                      <TableRow key={i} className="border-border">
                        <TableCell className="p-1">
                          {imgUrl !== '—' ? (
                            <img src={imgUrl} alt="" className="w-14 h-10 object-cover rounded" />
                          ) : (
                            <div className="w-14 h-10 bg-muted rounded flex items-center justify-center">
                              <Image className="h-4 w-4 text-muted-foreground/30" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground max-w-[250px]">
                          <div className="flex items-start gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="truncate">
                              {getField(listing, 'name', 'title', 'buildingName', 'address', 'propertyName')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {getField(listing, 'location', 'city', 'fullAddress', 'addressLine1', 'address')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {getField(listing, 'propertyType', 'type', 'spaceUse', 'category')}
                        </TableCell>
                        <TableCell className="text-xs text-foreground whitespace-nowrap">
                          {getField(listing, 'size', 'spaceSf', 'buildingSize', 'squareFeet', 'totalAvailableSf')}
                        </TableCell>
                        <TableCell className="text-xs text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-0.5">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            {getField(listing, 'price', 'rentalRate', 'askingPrice', 'rate', 'rentalRatePerSfYr')}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[180px]">
                          {(() => {
                            const agent = getField(listing, 'agentName', 'brokerName', 'agent', 'contactName', 'broker', 'listingAgent');
                            const company = getField(listing, 'agentCompany', 'brokerCompany', 'company', 'brokerage');
                            const phone = getField(listing, 'agentPhone', 'brokerPhone', 'phone', 'contactPhone');
                            return agent !== '—' ? (
                              <div>
                                <div className="flex items-center gap-0.5 font-medium text-foreground">
                                  <User className="h-3 w-3" />
                                  {agent}
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {!loading && results.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">Search LoopNet for commercial real estate listings</p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              Paste LoopNet search result URLs above to scrape listings
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoopNetSearch;
