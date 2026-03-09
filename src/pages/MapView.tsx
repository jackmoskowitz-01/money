import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, Users, TrendingUp } from 'lucide-react';
import { buildings, type Building } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import 'leaflet/dist/leaflet.css';

const markerIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const MapView = () => {
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const center = useMemo(() => [38.9010, -77.0340] as [number, number], []);

  return (
    <div className="relative h-screen pt-14">
      <div className="absolute inset-0 top-14">
        <MapContainer
          center={center}
          zoom={15}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {buildings.map(building => (
            <Marker
              key={building.id}
              position={[building.lat, building.lng]}
              icon={markerIcon}
              eventHandlers={{
                click: () => setSelectedBuilding(building),
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <p className="font-display text-sm font-bold">{building.name}</p>
                  <p className="text-xs opacity-70">{building.address}</p>
                  <p className="mt-1 text-xs">
                    {building.tenants.length} tenants · {building.vacancyRate}% vacant
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Building List Panel */}
      <div className="absolute left-4 top-20 z-[1000] w-80 space-y-2">
        <Card className="border-border bg-card/95 p-3 backdrop-blur-lg">
          <h2 className="mb-2 font-display text-sm font-bold">DC Buildings ({buildings.length})</h2>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {buildings.map(b => (
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
          </div>
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
            className="absolute right-4 top-20 z-[1000] w-96"
          >
            <Card className="border-border bg-card/95 p-4 backdrop-blur-lg">
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

              <h4 className="mb-2 text-sm font-semibold">Tenant List</h4>
              <div className="space-y-2">
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
