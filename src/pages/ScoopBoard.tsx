import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, Loader2, Inbox } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useScoops, type ScoopCategory } from '@/hooks/useScoops';
import ScoopCard from '@/components/scoop/ScoopCard';
import ScoopForm from '@/components/scoop/ScoopForm';
import { CATEGORY_OPTIONS } from '@/components/scoop/ScoopCategoryBadge';
import { toast } from 'sonner';

const ScoopBoard = () => {
  const { scoops, loading, likedIds, createScoop, toggleLike, verifyScoop } = useScoops();
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<ScoopCategory | 'all'>('all');
  const [filterVerified, setFilterVerified] = useState(false);

  const filteredScoops = useMemo(() => {
    let result = scoops;

    if (filterCategory !== 'all') {
      result = result.filter(s => s.category === filterCategory);
    }
    if (filterVerified) {
      result = result.filter(s => s.verified);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.content.toLowerCase().includes(q) ||
        s.author_name.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q)) ||
        s.linked_tenant_name?.toLowerCase().includes(q) ||
        s.linked_building_name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [scoops, filterCategory, filterVerified, searchQuery]);


  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Scoop Board</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Broker intel — share what you're hearing in the market
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1.5 h-4 w-4" /> Post Scoop
          </Button>
        </div>

        {/* New post form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6">
              <ScoopForm
                onSubmit={async (data) => {
                  const ok = await createScoop(data);
                  if (ok) toast.success('Scoop posted!');
                  return ok;
                }}
                onCancel={() => setShowForm(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search & Filters */}
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search scoops, tags, tenants, buildings…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 border-border bg-secondary/50 text-sm h-9"
            />
          </div>

          {/* Category filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-2 py-0.5 rounded-full text-[11px] transition-colors border ${
                filterCategory === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary/50 text-muted-foreground border-border hover:border-primary/30'
              }`}
            >
              All
            </button>
            {CATEGORY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterCategory(filterCategory === opt.value ? 'all' : opt.value)}
                className={`px-2 py-0.5 rounded-full text-[11px] transition-colors border ${
                  filterCategory === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary/50 text-muted-foreground border-border hover:border-primary/30'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => setFilterVerified(!filterVerified)}
              className={`px-2 py-0.5 rounded-full text-[11px] transition-colors border ml-1 ${
                filterVerified
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary/50 text-muted-foreground border-border hover:border-primary/30'
              }`}
            >
              ✓ Verified Only
            </button>
          </div>

        </div>

        {/* Stats bar */}
        <div className="mb-4 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{filteredScoops.length} scoop{filteredScoops.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{scoops.filter(s => s.verified).length} verified</span>
          <span>·</span>
          <span>{scoops.reduce((sum, s) => sum + s.likes_count, 0)} total likes</span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredScoops.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No scoops found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery || filterCategory !== 'all' || filterVerified
                ? 'Try adjusting your filters'
                : 'Be the first to share market intel!'}
            </p>
          </div>
        )}

        {/* Posts */}
        <div className="space-y-4">
          {filteredScoops.map(scoop => (
            <ScoopCard
              key={scoop.id}
              scoop={scoop}
              isLiked={likedIds.has(scoop.id)}
              onLike={toggleLike}
              onVerify={verifyScoop}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScoopBoard;
