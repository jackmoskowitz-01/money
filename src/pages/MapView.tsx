import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import StackingPlan from '@/components/StackingPlan';
import { X, Users, TrendingUp, Search, ChevronDown, ChevronUp, Loader2, Mail, Send, FileText, Sparkles } from 'lucide-react';
import { buildings as mockBuildings, type Building, type Tenant } from '@/data/mockData';
import { costarBuildings } from '@/data/costarBuildings';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import EmailDisplay from '@/components/EmailDisplay';
import { getContacts } from '@/data/companyContacts';
import { type EmailRecipient } from '@/components/RecipientPicker';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outreach`;

const MapView = () => {
  const navigate = useNavigate();
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedTenants, setSelectedTenants] = useState<Set<string>>(new Set());
  const [outreachReason, setOutreachReason] = useState('');
  const [generatingKeys, setGeneratingKeys] = useState<Set<string>>(new Set());
  const [generatedEmails, setGeneratedEmails] = useState<Record<string, string>>({});
  const [activeEmailKey, setActiveEmailKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const [googleBuildings, setGoogleBuildings] = useState<Building[]>([]);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const fetchedRef = useRef(false);

  const fetchGoogleBuildings = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoadingGoogle(true);

    try {
      const allBuildings: Building[] = [];
      const seenIds = new Set<string>();

      // Add mock building IDs to prevent duplicates
      mockBuildings.forEach(b => seenIds.add(b.name.toLowerCase()));

      const totalQueries = 7;
      for (let i = 0; i < totalQueries; i++) {
        setLoadingProgress(`Searching... (${i + 1}/${totalQueries})`);

        const { data, error } = await supabase.functions.invoke('fetch-dc-buildings', {
          body: { queryIndex: i },
        });

        if (error) {
          console.error(`Query ${i} failed:`, error.message);
          continue;
        }
        if (!data?.success) {
          console.error(`Query ${i} failed:`, data?.error);
          continue;
        }

        for (const b of (data.buildings || [])) {
          const key = b.name.toLowerCase();
          if (!seenIds.has(key) && b.lat && b.lng) {
            seenIds.add(key);
            allBuildings.push(b as Building);
          }
        }
      }

      setGoogleBuildings(allBuildings);
      toast.success(`Loaded ${allBuildings.length} real DC office buildings`);

      if (mapInstanceRef.current) {
        addGoogleMarkersToMap(allBuildings);
      }
    } catch (err) {
      console.error('Error fetching buildings:', err);
      toast.error('Failed to fetch buildings from Google Places');
    } finally {
      setLoadingGoogle(false);
      setLoadingProgress('');
    }
  }, []);

  const addGoogleMarkersToMap = async (blds: Building[]) => {
    const L = await import('leaflet');

    googleMarkersRef.current.forEach(m => m.remove());
    googleMarkersRef.current = [];

    const icon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    });

    blds.forEach(b => {
      const marker = L.marker([b.lat, b.lng], { icon }).addTo(mapInstanceRef.current);
      marker.bindPopup(`
        <div style="min-width:180px">
          <strong>${b.address}</strong><br/>
          ${b.name && b.name !== b.address ? `<span style="font-size:11px;opacity:0.7">${b.name}</span><br/>` : ''}
          <span style="font-size:11px">${b.tenants.length} tenants · ${b.vacancyRate}% vacant</span>
        </div>
      `);
      marker.on('click', () => setSelectedBuilding(b));
      googleMarkersRef.current.push(marker);
    });
  };

  const allBuildingsList = useMemo(() => {
    const seen = new Set<string>();
    const result: Building[] = [];
    for (const b of [...mockBuildings, ...costarBuildings, ...googleBuildings]) {
      const key = b.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(b);
      }
    }
    return result;
  }, [googleBuildings]);

  const filteredBuildings = useMemo(() => {
    if (!searchQuery.trim()) return allBuildingsList;
    const q = searchQuery.toLowerCase();
    return allBuildingsList.filter(b =>
      b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q)
    );
  }, [searchQuery, allBuildingsList]);

  // Clear state when building changes
  useEffect(() => {
    setSelectedTenants(new Set());
    setOutreachReason('');
    setGeneratedEmails({});
    setGeneratingKeys(new Set());
    setActiveEmailKey(null);
  }, [selectedBuilding?.id]);

  const buildRecipients = (tenant: Tenant): EmailRecipient[] => {
    const list: EmailRecipient[] = [{
      id: 'primary',
      name: tenant.contactName,
      email: tenant.contactEmail,
      title: tenant.contactTitle,
      isPrimary: true,
    }];
    getContacts(tenant.id).forEach(c => {
      list.push({ id: c.id, name: c.name, email: c.email, title: c.title });
    });
    return list;
  };

  const generateEmailForTenant = useCallback(async (tenant: Tenant, building: Building, reason: string, key: string) => {
    if (generatedEmails[key]) return;
    setGeneratingKeys(prev => new Set(prev).add(key));
    setGeneratedEmails(prev => ({ ...prev, [key]: '' }));

    try {
      const clientsInBuilding = building.tenants
        .filter(t => t.isClient && t.id !== tenant.id)
        .map(t => t.name);

      const resp = await fetch(OUTREACH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          tenantName: tenant.name,
          buildingName: building.name,
          contactName: tenant.contactName,
          contactTitle: tenant.contactTitle,
          industry: tenant.industry,
          sqft: tenant.sqft,
          leaseExpiration: tenant.leaseExpiration,
          outreachReason: reason,
          vacancyRate: building.vacancyRate,
          headcount: tenant.headcount,
          clientsInBuilding,
        }),
      });

      if (!resp.ok) {
        setGeneratingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
        setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
        toast.error(`Failed to generate email for ${tenant.name}`);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              full += content;
              setGeneratedEmails(prev => ({ ...prev, [key]: full }));
            }
          } catch { /* partial */ }
        }
      }
    } catch {
      setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
      toast.error(`Failed to generate email for ${tenant.name}`);
    }
    setGeneratingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
  }, [generatedEmails]);

  const generateForSelected = useCallback(() => {
    if (!selectedBuilding || selectedTenants.size === 0) return;
    const reason = outreachReason.trim() || 'General outreach for building tenants';

    for (const tenantId of selectedTenants) {
      const tenant = selectedBuilding.tenants.find(t => t.id === tenantId);
      if (tenant) {
        const key = `map::${selectedBuilding.id}::${tenant.id}`;
        generateEmailForTenant(tenant, selectedBuilding, reason, key);
      }
    }
  }, [selectedBuilding, selectedTenants, outreachReason, generateEmailForTenant]);

  const updateEmail = useCallback((key: string, content: string) => {
    setGeneratedEmails(prev => ({ ...prev, [key]: content }));
  }, []);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const loadMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      const map = L.map(mapRef.current!, {
        center: [38.9010, -77.0340],
        zoom: 14,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO',
      }).addTo(map);

      const defaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      });

      [...mockBuildings, ...costarBuildings].forEach(building => {
        const marker = L.marker([building.lat, building.lng], { icon: defaultIcon }).addTo(map);
        marker.bindPopup(`
          <div style="min-width:180px">
            <strong>${building.address}</strong><br/>
            ${building.name && building.name !== building.address ? `<span style="font-size:11px;opacity:0.7">${building.name}</span><br/>` : ''}
            <span style="font-size:11px">${building.tenants.length} tenants · ${building.vacancyRate}% vacant</span>
          </div>
        `);
        marker.on('click', () => setSelectedBuilding(building));
      });

      mapInstanceRef.current = map;
      fetchGoogleBuildings();
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 top-14">
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Building List Panel */}
      <div className="absolute left-4 top-4 z-[1000] w-80">
        <Card className="border-border bg-card/95 backdrop-blur-lg">
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="flex w-full items-center justify-between p-3"
          >
            <h2 className="font-display text-sm font-bold">
              DC Buildings ({filteredBuildings.length})
              {loadingGoogle && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
            </h2>
            {panelOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {panelOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search buildings..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  {loadingGoogle && loadingProgress && (
                    <p className="text-[11px] text-muted-foreground text-center py-1">
                      <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                      {loadingProgress}
                    </p>
                  )}
                </div>
                <div className="max-h-[55vh] space-y-2 overflow-y-auto px-3 pb-3">
                  {filteredBuildings.map(b => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBuilding(b)}
                      className={`w-full rounded-md border p-2.5 text-left transition-all ${
                        selectedBuilding?.id === b.id
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border bg-secondary/30 hover:border-border hover:bg-secondary/60'
                      }`}
                    >
                      <p className="text-sm font-semibold text-foreground">{b.address}</p>
                      {b.name && b.name !== b.address && (
                        <p className="text-[11px] text-muted-foreground">{b.name}</p>
                      )}
                      <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" /> {b.tenants.length} tenants
                        </span>
                        <span className={`flex items-center gap-1 ${b.vacancyRate > 20 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          <TrendingUp className="h-3 w-3" /> {b.vacancyRate}% vacant
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Class {b.class}
                        </Badge>
                      </div>
                    </button>
                  ))}
                  {filteredBuildings.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">No buildings found</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      {/* Selected Building Detail Panel */}
      <AnimatePresence>
        {selectedBuilding && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute right-4 top-4 z-[1000] w-96"
          >
            <Card className="border-border bg-card/95 backdrop-blur-lg max-h-[calc(100vh-6rem)] overflow-y-auto">
              {selectedBuilding.photoUrl && (
                <div className="w-full h-40 overflow-hidden rounded-t-lg">
                  <img
                    src={selectedBuilding.photoUrl}
                    alt={selectedBuilding.address}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
              <div className="p-4">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold">{selectedBuilding.address}</h3>
                  {selectedBuilding.name && selectedBuilding.name !== selectedBuilding.address && (
                    <p className="text-xs text-muted-foreground">{selectedBuilding.name}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedBuilding(null)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-secondary p-2">
                  <p className="text-lg font-bold text-foreground">{selectedBuilding.sqft.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Total SF</p>
                </div>
                <div className="rounded-md bg-secondary p-2">
                  <p className={`text-lg font-bold ${selectedBuilding.vacancyRate > 20 ? 'text-destructive' : 'text-foreground'}`}>
                    {selectedBuilding.vacancyRate}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Vacancy</p>
                </div>
                <div className="rounded-md bg-secondary p-2">
                  <p className="text-[11px] font-bold text-foreground leading-tight break-words">{selectedBuilding.owner}</p>
                  <p className="text-[10px] text-muted-foreground">Landlord</p>
                </div>
              </div>

              {selectedBuilding.leasingBroker && (
                <div className="mb-4 rounded-md border border-border bg-secondary/30 p-2">
                  <p className="text-xs text-muted-foreground">
                    Listing Broker: <span className="font-medium text-foreground">{selectedBuilding.leasingBroker}</span>
                  </p>
                </div>
              )}

              {selectedBuilding.recentSale && (
                <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 p-2">
                  <p className="text-xs font-medium text-primary">
                    Recent Sale: {selectedBuilding.recentSale.price} ({selectedBuilding.recentSale.date})
                  </p>
                </div>
              )}

              <div className="mb-4">
                <StackingPlan building={selectedBuilding} />
              </div>

              {/* Outreach Section */}
              <div className="mb-4 rounded-md border border-border bg-secondary/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-semibold">Outreach</h4>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => {
                        const allIds = selectedBuilding.tenants.filter(t => !t.isClient).map(t => t.id);
                        if (selectedTenants.size === allIds.length) {
                          setSelectedTenants(new Set());
                        } else {
                          setSelectedTenants(new Set(allIds));
                        }
                      }}
                    >
                      {selectedTenants.size === selectedBuilding.tenants.filter(t => !t.isClient).length && selectedTenants.size > 0
                        ? 'Deselect All'
                        : 'Select All'}
                    </Button>
                  </div>
                </div>

                <div className="max-h-32 space-y-1 overflow-y-auto mb-2">
                  {selectedBuilding.tenants.filter(t => !t.isClient).map(tenant => (
                    <label
                      key={tenant.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-secondary/40 transition-colors"
                    >
                      <Checkbox
                        checked={selectedTenants.has(tenant.id)}
                        onCheckedChange={(checked) => {
                          setSelectedTenants(prev => {
                            const next = new Set(prev);
                            if (checked) next.add(tenant.id);
                            else next.delete(tenant.id);
                            return next;
                          });
                        }}
                      />
                      <span className="flex-1 truncate font-medium text-foreground">{tenant.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{tenant.industry}</span>
                    </label>
                  ))}
                  {selectedBuilding.tenants.filter(t => !t.isClient).length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-2">No prospects in this building</p>
                  )}
                </div>

                {selectedTenants.size > 0 && (
                  <div className="space-y-2 pt-1 border-t border-border/50">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                        <FileText className="h-3 w-3 inline mr-1" />
                        Outreach Reason / Article
                      </label>
                      <textarea
                        value={outreachReason}
                        onChange={e => setOutreachReason(e.target.value)}
                        placeholder="Paste a news article, market insight, or describe why you're reaching out..."
                        className="w-full rounded-md border border-border bg-secondary/50 px-2.5 py-2 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                        rows={3}
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full text-xs h-8"
                      onClick={generateForSelected}
                      disabled={generatingKeys.size > 0}
                    >
                      {generatingKeys.size > 0 ? (
                        <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Generating...</>
                      ) : (
                        <><Sparkles className="mr-1.5 h-3 w-3" /> Generate Emails for {selectedTenants.size} {selectedTenants.size === 1 ? 'Tenant' : 'Tenants'}</>
                      )}
                    </Button>
                  </div>
                )}

                {/* Generated Emails */}
                {selectedBuilding && Object.entries(generatedEmails).filter(([k]) => k.startsWith(`map::${selectedBuilding.id}::`)).map(([key, content]) => {
                  const tenantId = key.split('::')[2];
                  const tenant = selectedBuilding.tenants.find(t => t.id === tenantId);
                  if (!tenant) return null;
                  const isGen = generatingKeys.has(key);

                  return (
                    <div key={key} className="mt-2">
                      <button
                        onClick={() => setActiveEmailKey(activeEmailKey === key ? null : key)}
                        className="flex w-full items-center justify-between rounded-md border border-border bg-secondary/30 px-2.5 py-2 text-left hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-medium text-foreground">{tenant.name}</span>
                        </div>
                        {isGen ? (
                          <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        ) : (
                          <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary">Ready</Badge>
                        )}
                      </button>
                      {activeEmailKey === key && content && (
                        <div className="mt-1">
                          <EmailDisplay
                            emailKey={key}
                            emailContent={content}
                            isGenerating={isGen}
                            label={`Email to ${tenant.name}`}
                            contactName={tenant.contactName}
                            contactEmail={tenant.contactEmail}
                            recipients={buildRecipients(tenant)}
                            tenantName={tenant.name}
                            industry={tenant.industry}
                            buildingName={selectedBuilding.name}
                            sqft={tenant.sqft}
                            leaseExpiration={tenant.leaseExpiration}
                            outreachReason={outreachReason}
                            onClose={() => setActiveEmailKey(null)}
                            onUpdateEmail={updateEmail}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <h4 className="mb-2 text-sm font-semibold">Tenant List</h4>
              <div className="max-h-[30vh] space-y-2 overflow-y-auto">
                {selectedBuilding.tenants.map(tenant => {
                  const urgentCount = tenant.outreachReasons.filter(r => r.urgency === 'high').length;
                  return (
                    <Link
                      key={tenant.id}
                      to={`/building/${selectedBuilding.id}/tenant/${tenant.id}`}
                      className="block rounded-md border border-border bg-secondary/30 p-2.5 transition-all hover:border-primary/30 hover:bg-secondary/60"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{tenant.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {tenant.industry} · {tenant.sqft.toLocaleString()} SF · Floor {tenant.floor}
                          </p>
                        </div>
                        {urgentCount > 0 && (
                          <Badge variant="outline" className="bg-destructive/20 text-destructive text-[10px]">
                            {urgentCount} urgent
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Lease expires: {tenant.leaseExpiration}
                      </p>
                    </Link>
                  );
                })}
              </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapView;
