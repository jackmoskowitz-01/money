import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, User, X, Plus, Globe, MapPin, ArrowLeft, Loader2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildings } from '@/data/mockData';
import { getCustomProspects, addCustomProspect, updateCustomProspect, type CustomProspect } from '@/data/customProspects';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const AUTOCOMPLETE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/places-autocomplete`;

type PlacePrediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

type SearchResult = {
  tenantId: string;
  buildingId: string;
  tenantName: string;
  buildingName: string;
  industry: string;
  contactName: string;
  contactTitle: string;
  sqft: number;
  leaseExpiration: string;
  isClient?: boolean;
  isCustom?: boolean;
};

const builtInTenants: SearchResult[] = buildings.flatMap(b =>
  b.tenants.map(t => ({
    tenantId: t.id,
    buildingId: b.id,
    tenantName: t.name,
    buildingName: b.name,
    industry: t.industry,
    contactName: t.contactName,
    contactTitle: t.contactTitle,
    sqft: t.sqft,
    leaseExpiration: t.leaseExpiration,
    isClient: t.isClient,
  }))
);

const ProspectSearch = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'search' | 'create'>('search');
  const [customProspects, setCustomProspects] = useState<CustomProspect[]>(() => getCustomProspects());
  const inputRef = useRef<HTMLInputElement>(null);

  // Refresh custom prospects when search opens or storage changes
  useEffect(() => {
    if (isOpen) setCustomProspects(getCustomProspects());
  }, [isOpen]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dealflow-custom-prospects') {
        setCustomProspects(getCustomProspects());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Create form state
  const [newName, setNewName] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<PlacePrediction[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAddressSuggestions = useCallback(async (input: string) => {
    if (input.length < 2) {
      setAddressSuggestions([]);
      return;
    }
    setAddressLoading(true);
    try {
      const resp = await fetch(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ query: input }),
      });
      const data = await resp.json();
      setAddressSuggestions(data.predictions || []);
      setShowSuggestions(true);
    } catch {
      setAddressSuggestions([]);
    }
    setAddressLoading(false);
  }, []);

  const handleAddressChange = (val: string) => {
    setNewAddress(val);
    setShowSuggestions(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchAddressSuggestions(val), 300);
  };

  const selectSuggestion = (prediction: PlacePrediction) => {
    setNewAddress(prediction.description);
    setShowSuggestions(false);
    setAddressSuggestions([]);
    // Auto-fill name if empty
    if (!newName.trim() && prediction.mainText) {
      setNewName(prediction.mainText);
    }
  };

  const allResults = useMemo<SearchResult[]>(() => {
    const customResults: SearchResult[] = customProspects.map(cp => ({
      tenantId: cp.id,
      buildingId: '',
      tenantName: cp.name,
      buildingName: cp.address,
      industry: 'Custom Prospect',
      contactName: '',
      contactTitle: '',
      sqft: 0,
      leaseExpiration: '',
      isCustom: true,
    }));
    return [...customResults, ...builtInTenants];
  }, [customProspects]);

  const results = useMemo(() => {
    if (!query.trim()) return allResults.slice(0, 10);
    const q = query.toLowerCase();
    return allResults.filter(t =>
      t.tenantName.toLowerCase().includes(q) ||
      t.buildingName.toLowerCase().includes(q) ||
      t.industry.toLowerCase().includes(q) ||
      t.contactName.toLowerCase().includes(q)
    );
  }, [query, allResults]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') closeSearch();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const closeSearch = () => {
    setIsOpen(false);
    setQuery('');
    setView('search');
    setNewName('');
    setNewWebsite('');
    setNewAddress('');
    setAddressSuggestions([]);
    setShowSuggestions(false);
  };

  const selectResult = (result: SearchResult) => {
    if (result.isCustom) {
      navigate(`/prospect/${result.tenantId}`);
    } else {
      navigate(`/building/${result.buildingId}/tenant/${result.tenantId}`);
    }
    closeSearch();
  };

  const handleCreate = () => {
    if (!newName.trim() || !newAddress.trim()) {
      toast.error('Name and address are required');
      return;
    }
    const prospect = addCustomProspect({
      name: newName.trim(),
      website: newWebsite.trim(),
      address: newAddress.trim(),
    });
    setCustomProspects(getCustomProspects());
    toast.success(`${prospect.name} created`);
    navigate(`/prospect/${prospect.id}`);
    closeSearch();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search prospects...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-background/60 backdrop-blur-sm"
              onClick={closeSearch}
            />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-x-0 top-16 z-[70] mx-auto w-[94vw] max-w-xl rounded-lg border border-border bg-card shadow-2xl"
            >
              <AnimatePresence mode="wait">
                {view === 'search' ? (
                  <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {/* Search Input */}
                    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search by name, building, industry, or contact..."
                        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      {query && (
                        <button onClick={() => setQuery('')} className="rounded p-0.5 hover:bg-secondary">
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>

                    {/* Results */}
                    <div className="max-h-[50vh] overflow-y-auto p-2">
                      {results.length === 0 ? (
                        <div className="py-6 text-center">
                          <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
                          <p className="text-sm text-muted-foreground">No prospects found for "{query}"</p>
                          <p className="text-[11px] text-muted-foreground/60 mt-1">Try creating a new prospect instead</p>
                        </div>
                      ) : (
                        <>
                          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {query ? `${results.length} results` : 'All Prospects'}
                          </p>
                          {results.map(result => (
                            <button
                              key={`${result.buildingId || 'custom'}-${result.tenantId}`}
                              onClick={() => selectResult(result)}
                              className="w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-secondary/70 focus:bg-secondary/70 focus:outline-none group"
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${result.isCustom ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'}`}>
                                  <Building2 className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground group-hover:text-primary truncate">
                                      {result.tenantName}
                                    </p>
                                    {result.isClient && (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-success/10 text-success border-success/30 shrink-0">
                                        Client
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {result.isCustom
                                      ? result.buildingName
                                      : `${result.buildingName} · ${result.industry} · ${result.sqft.toLocaleString()} SF`
                                    }
                                  </p>
                                  {!result.isCustom && (
                                    <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground/70">
                                      <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" /> {result.contactName}
                                      </span>
                                      <span>Lease: {result.leaseExpiration}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Footer with Create button */}
                    <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
                      <button
                        onClick={() => { setView('create'); setNewName(query); }}
                        className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create New Prospect
                      </button>
                      <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                        ESC
                      </kbd>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {/* Create Form Header */}
                    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                      <button onClick={() => setView('search')} className="rounded p-0.5 hover:bg-secondary">
                        <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <div>
                        <p className="text-sm font-semibold text-foreground">New Prospect</p>
                        <p className="text-[10px] text-muted-foreground">Enter details to create a prospect account</p>
                      </div>
                    </div>

                    {/* Create Form */}
                    <div className="p-4 space-y-3 overflow-visible">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                          Name <span className="text-destructive">*</span>
                        </label>
                        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="e.g. Acme Corporation"
                            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                            autoFocus
                            maxLength={100}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                          Website URL
                        </label>
                        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
                          <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <input
                            type="text"
                            value={newWebsite}
                            onChange={e => setNewWebsite(e.target.value)}
                            placeholder="e.g. www.acme.com"
                            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                            maxLength={255}
                          />
                        </div>
                      </div>

                      <div className="relative pb-2">
                        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                          Address <span className="text-destructive">*</span>
                        </label>
                        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <input
                            type="text"
                            value={newAddress}
                            onChange={e => handleAddressChange(e.target.value)}
                            onFocus={() => { if (addressSuggestions.length > 0) setShowSuggestions(true); }}
                            placeholder="Start typing a company or address..."
                            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                            maxLength={255}
                          />
                          {addressLoading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
                        </div>
                        {/* Autocomplete dropdown */}
                        {showSuggestions && addressSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-[200px] overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                            {addressSuggestions.map(p => (
                              <button
                                key={p.placeId}
                                onClick={() => selectSuggestion(p)}
                                className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-secondary/70 transition-colors"
                              >
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-foreground truncate">{p.mainText}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{p.secondaryText}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Create Footer */}
                    <div className="border-t border-border px-4 py-3 flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setView('search')}>Cancel</Button>
                      <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || !newAddress.trim()}>
                        <Plus className="mr-1 h-3 w-3" /> Create Prospect
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProspectSearch;
