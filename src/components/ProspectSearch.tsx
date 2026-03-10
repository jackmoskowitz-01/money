import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildings } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';

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
};

const allTenants: SearchResult[] = buildings.flatMap(b =>
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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => {
    if (!query.trim()) return allTenants.slice(0, 8);
    const q = query.toLowerCase();
    return allTenants.filter(t =>
      t.tenantName.toLowerCase().includes(q) ||
      t.buildingName.toLowerCase().includes(q) ||
      t.industry.toLowerCase().includes(q) ||
      t.contactName.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectResult = (result: SearchResult) => {
    navigate(`/building/${result.buildingId}/tenant/${result.tenantId}`);
    setIsOpen(false);
    setQuery('');
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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-background/60 backdrop-blur-sm"
              onClick={() => { setIsOpen(false); setQuery(''); }}
            />

            {/* Search Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-16 z-[70] w-[90vw] max-w-lg -translate-x-1/2 rounded-lg border border-border bg-card shadow-2xl overflow-hidden"
            >
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
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {results.length === 0 ? (
                  <div className="py-8 text-center">
                    <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No prospects found for "{query}"</p>
                  </div>
                ) : (
                  <>
                    <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {query ? `${results.length} results` : 'All Prospects'}
                    </p>
                    {results.map(result => (
                      <button
                        key={`${result.buildingId}-${result.tenantId}`}
                        onClick={() => selectResult(result)}
                        className="w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-secondary/70 focus:bg-secondary/70 focus:outline-none group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
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
                              {result.buildingName} · {result.industry} · {result.sqft.toLocaleString()} SF
                            </p>
                            <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground/70">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" /> {result.contactName}
                              </span>
                              <span>Lease: {result.leaseExpiration}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border px-4 py-2 flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  Navigate to prospect profile with contract info & activity log
                </p>
                <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                  ESC
                </kbd>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProspectSearch;
