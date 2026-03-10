import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import StackingPlan from '@/components/StackingPlan';
import { X, Users, TrendingUp, Search, ChevronDown, ChevronUp, Loader2, MapPin } from 'lucide-react';
import { buildings as mockBuildings, type Building } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type GoogleBuilding = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  ratingCount: number;
  types: string[];
  businessStatus: string;
};

const MapView = () => {
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedGoogleBuilding, setSelectedGoogleBuilding] = useState<GoogleBuilding | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [panelOpen, setPanelOpen] = useState(true);
  const [googleBuildings, setGoogleBuildings] = useState<GoogleBuilding[]>([]);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);

  const fetchGoogleBuildings = useCallback(async () => {
    if (googleLoaded) return;
    setLoadingGoogle(true);
    try {
      const allBuildings: GoogleBuilding[] = [];
      let pageToken: string | null = null;

      // Fetch up to 3 pages (60 buildings)
      for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase.functions.invoke('fetch-dc-buildings', {
          body: { pageToken },
        });

        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || 'Failed to fetch');

        allBuildings.push(...(data.buildings || []));
        pageToken = data.nextPageToken;

        if (!pageToken) break;
        // Google requires a short delay between page token requests
        await new Promise(r => setTimeout(r, 2000));
      }

      setGoogleBuildings(allBuildings);
      setGoogleLoaded(true);
      toast.success(`Loaded ${allBuildings.length} real DC office buildings`);

      // Add markers to map
      if (mapInstanceRef.current) {
        addGoogleMarkersToMap(allBuildings);
      }
    } catch (err) {
      console.error('Error fetching buildings:', err);
      toast.error('Failed to fetch buildings from Google Places');
    } finally {
      setLoadingGoogle(false);
    }
  }, [googleLoaded]);

  const addGoogleMarkersToMap = async (gBuildings: GoogleBuilding[]) => {
    const L = await import('leaflet');

    // Clear existing google markers
    googleMarkersRef.current.forEach(m => m.remove());
    googleMarkersRef.current = [];

    const googleIcon = L.divIcon({
      html: `<div style="background:#3b82f6;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
      className: '',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    gBuildings.forEach(b => {
      if (!b.lat || !b.lng) return;
      const marker = L.marker([b.lat, b.lng], { icon: googleIcon }).addTo(mapInstanceRef.current);
      marker.bindPopup(`
        <div style="min-width:180px">
          <strong>${b.name}</strong><br/>
          <span style="font-size:11px;opacity:0.7">${b.address}</span><br/>
          ${b.rating ? `<span style="font-size:11px">⭐ ${b.rating} (${b.ratingCount} reviews)</span>` : ''}
        </div>
      `);
      marker.on('click', () => {
        setSelectedBuilding(null);
        setSelectedGoogleBuilding(b);
      });
      googleMarkersRef.current.push(marker);
    });
  };

  const allBuildings = useMemo(() => {
    return mockBuildings;
  }, []);

  const filteredMockBuildings = useMemo(() => {
    if (!searchQuery.trim()) return allBuildings;
    const q = searchQuery.toLowerCase();
    return allBuildings.filter(b =>
      b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q)
    );
  }, [searchQuery, allBuildings]);

  const filteredGoogleBuildings = useMemo(() => {
    if (!searchQuery.trim()) return googleBuildings;
    const q = searchQuery.toLowerCase();
    return googleBuildings.filter(b =>
      b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q)
    );
  }, [searchQuery, googleBuildings]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const loadMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      const map = L.map(mapRef.current!, {
        center: [38.9010, -77.0340],
        zoom: 15,
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

      mockBuildings.forEach(building => {
        const marker = L.marker([building.lat, building.lng], { icon: defaultIcon }).addTo(map);
        marker.bindPopup(`
          <div style="min-width:180px">
            <strong>${building.name}</strong><br/>
            <span style="font-size:11px;opacity:0.7">${building.address}</span><br/>
            <span style="font-size:11px">${building.tenants.length} tenants · ${building.vacancyRate}% vacant</span>
          </div>
        `);
        marker.on('click', () => setSelectedBuilding(building));
      });

      mapInstanceRef.current = map;
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
            <h2 className="font-display text-sm font-bold">DC Buildings ({filteredBuildings.length})</h2>
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
                <div className="px-3 pb-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search buildings..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
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
                      <p className="text-sm font-semibold text-foreground">{b.name}</p>
                      <p className="text-[11px] text-muted-foreground">{b.address}</p>
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
            <Card className="border-border bg-card/95 p-4 backdrop-blur-lg max-h-[calc(100vh-6rem)] overflow-y-auto">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold">{selectedBuilding.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedBuilding.address}</p>
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
                  <p className="text-lg font-bold text-foreground">{selectedBuilding.floors}</p>
                  <p className="text-[10px] text-muted-foreground">Floors</p>
                </div>
              </div>

              {selectedBuilding.recentSale && (
                <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 p-2">
                  <p className="text-xs font-medium text-primary">
                    Recent Sale: {selectedBuilding.recentSale.price} ({selectedBuilding.recentSale.date})
                  </p>
                </div>
              )}

              {/* Stacking Plan */}
              <div className="mb-4">
                <StackingPlan building={selectedBuilding} />
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
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapView;
