import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import StackingPlan from '@/components/StackingPlan';
import AutoEnrichBadges from '@/components/AutoEnrichBadges';
import { X, Users, TrendingUp, Search, ChevronDown, ChevronUp, Loader2, Mail, Send, FileText, Sparkles, Radar, Activity } from 'lucide-react';
import { recordVisit, getVisitLog, isStale, getLastVisitLabel, getThresholdDays, setThresholdDays } from '@/lib/buildingVisitTracker';
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
import { getUserGreeting } from '@/lib/getUserGreeting';
import { getActivities, type ActivityEntry } from '@/data/activityData';

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
  const [thresholdDays, setThreshold] = useState(getThresholdDays());
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(String(getThresholdDays()));
  const [visitLog, setVisitLog] = useState(getVisitLog());
  const [trackerEnabled, setTrackerEnabled] = useState(false);
  const [activityOverlay, setActivityOverlay] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const mockMarkersRef = useRef<any[]>([]);
  const activityCirclesRef = useRef<any[]>([]);
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

    const log = getVisitLog();
    blds.forEach(b => {
      const marker = createMapMarker(L, b, log, thresholdDays, trackerEnabled);
      if (marker) googleMarkersRef.current.push(marker);
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

  // Build a tenant→building lookup for search
  const tenantBuildingMap = useMemo(() => {
    const map = new Map<string, Building>();
    for (const b of allBuildingsList) {
      for (const t of b.tenants) {
        map.set(`${t.name.toLowerCase()}::${b.id}`, b);
      }
    }
    return map;
  }, [allBuildingsList]);

  const filteredBuildings = useMemo(() => {
    let list = allBuildingsList;
    
    // When tracker is enabled, only show stale (red) buildings
    if (trackerEnabled) {
      const log = getVisitLog();
      const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
      list = list.filter(b => !log[b.id] || (Date.now() - log[b.id]) > thresholdMs);
    }
    
    // Then apply search — match buildings OR tenants
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.address.toLowerCase().includes(q) ||
      b.tenants.some(t => t.name.toLowerCase().includes(q) || t.industry.toLowerCase().includes(q))
    );
  }, [searchQuery, allBuildingsList, trackerEnabled, thresholdDays]);

  // Track which tenant matched to highlight in the list
  const matchedTenantName = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    // Check if the query matches a tenant rather than a building name/address
    for (const b of allBuildingsList) {
      if (b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q)) continue;
      const tenant = b.tenants.find(t => t.name.toLowerCase().includes(q));
      if (tenant) return tenant.name;
    }
    return null;
  }, [searchQuery, allBuildingsList]);

  // Record visit + clear state when building changes
  useEffect(() => {
    if (selectedBuilding) {
      const updated = recordVisit(selectedBuilding.id);
      setVisitLog(updated);
    }
    setSelectedTenants(new Set());
    setOutreachReason('');
    setGeneratedEmails({});
    setGeneratingKeys(new Set());
    setActiveEmailKey(null);
  }, [selectedBuilding?.id]);

  // Helper to create a map marker — uses red icon when tracker is on and building is stale
  const createMapMarker = useCallback((L: any, building: any, log: Record<string, number>, threshold: number, isTrackerOn: boolean, mapInstance?: any) => {
    const targetMap = mapInstance || mapInstanceRef.current;
    if (!targetMap) return null;

    const stale = isTrackerOn && (!log[building.id] || (Date.now() - log[building.id]) > threshold * 24 * 60 * 60 * 1000);

    const defaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    const redIcon = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
      iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    const marker = L.marker([building.lat, building.lng], {
      icon: stale ? redIcon : defaultIcon,
    }).addTo(targetMap);

    const lastViewedText = !log[building.id] ? 'Never viewed' : `Last viewed ${Math.floor((Date.now() - log[building.id]) / 86400000)}d ago`;
    marker.bindPopup(`
      <div style="min-width:180px">
        <strong>${building.address}</strong><br/>
        ${building.name && building.name !== building.address ? `<span style="font-size:11px;opacity:0.7">${building.name}</span><br/>` : ''}
        <span style="font-size:11px">${building.tenants.length} tenants · ${building.vacancyRate}% vacant</span>
        ${isTrackerOn ? `<br/><span style="font-size:10px;opacity:0.6">${lastViewedText}</span>` : ''}
      </div>
    `);
    marker.on('click', () => setSelectedBuilding(building));
    (marker as any)._buildingId = building.id;
    (marker as any)._defaultIcon = defaultIcon;
    (marker as any)._redIcon = redIcon;
    return marker;
  }, []);

  // Refresh marker icons when visitLog, threshold, or tracker toggle changes
  const refreshMarkerIcons = useCallback(() => {
    const log = getVisitLog();
    [...mockMarkersRef.current, ...googleMarkersRef.current].forEach((marker: any) => {
      const bid = marker._buildingId;
      if (!bid || !marker._defaultIcon || !marker._redIcon) return;
      const stale = trackerEnabled && (!log[bid] || (Date.now() - log[bid]) > thresholdDays * 24 * 60 * 60 * 1000);
      marker.setIcon(stale ? marker._redIcon : marker._defaultIcon);
    });
  }, [thresholdDays, trackerEnabled]);

  useEffect(() => {
    refreshMarkerIcons();
  }, [visitLog, thresholdDays, trackerEnabled, refreshMarkerIcons]);

  // ---- Activity Coverage Overlay ----
  const activityCountsByBuilding = useMemo(() => {
    const all = getActivities();
    const counts: Record<string, number> = {};
    all.forEach(a => {
      if (a.buildingId) counts[a.buildingId] = (counts[a.buildingId] || 0) + 1;
    });
    return counts;
  }, [activityOverlay]); // re-compute when toggled

  const renderActivityCircles = useCallback(async () => {
    // Clear existing
    activityCirclesRef.current.forEach(c => c.remove());
    activityCirclesRef.current = [];

    if (!activityOverlay || !mapInstanceRef.current) return;

    const L = await import('leaflet');
    const allBuildings = [...mockBuildings, ...costarBuildings, ...googleBuildings];

    allBuildings.forEach(b => {
      const count = activityCountsByBuilding[b.id] || 0;
      // Color: green (3+), yellow (1-2), red/transparent (0)
      let color: string;
      let fillOpacity: number;
      let radius: number;
      if (count >= 3) {
        color = 'hsl(142, 71%, 45%)'; // green
        fillOpacity = 0.5;
        radius = 18;
      } else if (count >= 1) {
        color = 'hsl(48, 96%, 53%)'; // yellow
        fillOpacity = 0.45;
        radius = 14;
      } else {
        color = 'hsl(0, 84%, 60%)'; // red
        fillOpacity = 0.3;
        radius = 10;
      }

      const circle = L.circleMarker([b.lat, b.lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity,
        weight: 2,
        opacity: 0.8,
      }).addTo(mapInstanceRef.current);

      circle.bindTooltip(
        `<strong>${b.name}</strong><br/>${count} activit${count === 1 ? 'y' : 'ies'}`,
        { direction: 'top', offset: [0, -10] }
      );
      circle.on('click', () => setSelectedBuilding(b));

      activityCirclesRef.current.push(circle);
    });
  }, [activityOverlay, activityCountsByBuilding, googleBuildings]);

  useEffect(() => {
    renderActivityCircles();
  }, [renderActivityCircles]);

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
      const greeting = await getUserGreeting();
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
          greeting,
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

      const log = getVisitLog();
      mockMarkersRef.current = [];
      [...mockBuildings, ...costarBuildings].forEach(building => {
        const marker = createMapMarker(L, building, log, thresholdDays, trackerEnabled, map);
        if (marker) mockMarkersRef.current.push(marker);
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
      <div className="absolute left-4 top-4 bottom-4 z-[1000] w-80 flex flex-col">
        <Card className="border-border bg-card/95 backdrop-blur-lg flex flex-col max-h-full overflow-hidden">
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
                className="overflow-hidden flex-1 flex flex-col min-h-0"
              >
                <div className="px-3 pb-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search buildings or tenants..."
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && filteredBuildings.length === 1) {
                          const b = filteredBuildings[0];
                          setSelectedBuilding(b);
                          if (mapInstanceRef.current && b.lat && b.lng) {
                            mapInstanceRef.current.setView([b.lat, b.lng], 17, { animate: true });
                          }
                        }
                      }}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  {/* Tenant search hint */}
                  {matchedTenantName && filteredBuildings.length > 0 && (
                    <p className="text-[10px] text-primary px-1">
                      🔍 Found tenant "<span className="font-semibold">{matchedTenantName}</span>" — {filteredBuildings.length === 1 ? 'press Enter to jump' : `in ${filteredBuildings.length} buildings`}
                    </p>
                  )}
                  {loadingGoogle && loadingProgress && (
                    <p className="text-[11px] text-muted-foreground text-center py-1">
                      <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                      {loadingProgress}
                    </p>
                  )}
                </div>
                <div className="flex-1 min-h-0 space-y-2 overflow-y-auto px-3 pb-3">
                  {filteredBuildings.map(b => {
                    const q = searchQuery.toLowerCase().trim();
                    const matchingTenants = q ? b.tenants.filter(t => t.name.toLowerCase().includes(q) || t.industry.toLowerCase().includes(q)) : [];
                    const isTenantMatch = matchingTenants.length > 0 && !b.name.toLowerCase().includes(q) && !b.address.toLowerCase().includes(q);

                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          setSelectedBuilding(b);
                          if (mapInstanceRef.current && b.lat && b.lng) {
                            mapInstanceRef.current.setView([b.lat, b.lng], 17, { animate: true });
                          }
                        }}
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
                        {isTenantMatch && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {matchingTenants.slice(0, 3).map(t => (
                              <span key={t.id} className="inline-flex items-center rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                🔍 {t.name}
                              </span>
                            ))}
                            {matchingTenants.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{matchingTenants.length - 3} more</span>
                            )}
                          </div>
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
                    );
                  })}
                  {filteredBuildings.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground">No buildings found</p>
                  )}
                </div>

                {/* Territory Tracker Button */}
                <div className="px-3 pb-1.5">
                  <button
                    onClick={() => { setThresholdInput(String(thresholdDays)); setShowThresholdModal(true); }}
                    className={`w-full flex items-center gap-2 rounded-md border p-2.5 transition-colors ${trackerEnabled ? 'border-primary/40 bg-primary/10 hover:bg-primary/15' : 'border-border bg-secondary/30 hover:bg-secondary/50'}`}
                  >
                    <Radar className={`h-4 w-4 ${trackerEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="text-left flex-1">
                      <p className="text-[11px] font-bold text-foreground">Territory Tracker</p>
                      <p className="text-[10px] text-muted-foreground">{trackerEnabled ? `On · Stale after ${thresholdDays} days` : 'Off · Click to configure'}</p>
                    </div>
                    <div className={`h-2.5 w-2.5 rounded-full ${trackerEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                  </button>
                </div>

                {/* Activity Coverage Toggle */}
                <div className="px-3 pb-3">
                  <button
                    onClick={() => setActivityOverlay(prev => !prev)}
                    className={`w-full flex items-center gap-2 rounded-md border p-2.5 transition-colors ${activityOverlay ? 'border-accent/40 bg-accent/10 hover:bg-accent/15' : 'border-border bg-secondary/30 hover:bg-secondary/50'}`}
                  >
                    <Activity className={`h-4 w-4 ${activityOverlay ? 'text-accent' : 'text-muted-foreground'}`} />
                    <div className="text-left flex-1">
                      <p className="text-[11px] font-bold text-foreground">Activity Coverage</p>
                      <p className="text-[10px] text-muted-foreground">{activityOverlay ? 'On · Showing engagement heatmap' : 'Off · Visualize outreach gaps'}</p>
                    </div>
                    <div className={`h-2.5 w-2.5 rounded-full ${activityOverlay ? 'bg-accent' : 'bg-muted-foreground/30'}`} />
                  </button>
                  {activityOverlay && (
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground px-1">
                      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: 'hsl(142, 71%, 45%)' }} /> 3+ activities</span>
                      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: 'hsl(48, 96%, 53%)' }} /> 1-2</span>
                      <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full inline-block" style={{ background: 'hsl(0, 84%, 60%)' }} /> None</span>
                    </div>
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
            <Card className="border-border bg-card/95 backdrop-blur-lg max-h-[calc(100vh-6rem)] overflow-y-auto relative">
              {/* Always-visible close button */}
              <button
                onClick={() => setSelectedBuilding(null)}
                className="absolute right-2 top-2 z-10 rounded-md bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
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
              <div className="mb-3">
                <div>
                  <h3 className="font-display text-lg font-bold pr-6">{selectedBuilding.address}</h3>
                  {selectedBuilding.name && selectedBuilding.name !== selectedBuilding.address && (
                    <p className="text-xs text-muted-foreground">{selectedBuilding.name}</p>
                  )}
                </div>
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

              {/* Auto-Enrich */}
              <AutoEnrichBadges tenants={selectedBuilding.tenants} buildingName={selectedBuilding.name} />

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
                            tenantId={tenant.id}
                            tenantName={tenant.name}
                            industry={tenant.industry}
                            buildingId={selectedBuilding.id}
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

      {/* Territory Threshold Modal */}
      <AnimatePresence>
        {showThresholdModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowThresholdModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-80 rounded-xl border border-border bg-card p-5 shadow-xl"
            >
              <div className="flex items-center gap-2 mb-4">
                <Radar className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold text-foreground">Territory Tracker</h3>
              </div>
              {/* Enable toggle */}
              <div className="flex items-center justify-between mb-4">
                <label className="text-xs text-foreground font-medium">Enable tracker</label>
                <button
                  onClick={() => setTrackerEnabled(prev => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${trackerEnabled ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${trackerEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                When enabled, buildings you haven't viewed within this timeframe will show <span className="text-destructive font-semibold">red pins</span> on the map.
              </p>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Stale threshold (days)
              </label>
              <Input
                type="number"
                min={1}
                max={365}
                value={thresholdInput}
                onChange={e => setThresholdInput(e.target.value)}
                className="h-9 text-sm mb-4"
                disabled={!trackerEnabled}
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setShowThresholdModal(false)}
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                  disabled={!trackerEnabled}
                  onClick={() => {
                    const days = Math.max(1, Math.min(365, parseInt(thresholdInput, 10) || 14));
                    setThresholdDays(days);
                    setThreshold(days);
                    setShowThresholdModal(false);
                  }}
                >
                  Apply
                </Button>
              </div>
              {trackerEnabled && (
                <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary inline-block" /> Viewed recently</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-destructive inline-block" /> Needs attention</span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapView;
