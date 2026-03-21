import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpDown, Search, Filter } from 'lucide-react';
import { leaseComps, type LeaseComp } from '@/data/pipelineData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const dealTypeColors: Record<string, string> = {
  New: 'bg-success/20 text-success',
  Renewal: 'bg-info/20 text-info',
  Expansion: 'bg-primary/20 text-primary',
  Sublease: 'bg-warning/20 text-warning',
};

type SortKey = 'rentPerSf' | 'sqft' | 'commencementDate' | 'tiPerSf' | 'freeRentMonths';

const CompTracker = () => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('commencementDate');
  const [sortAsc, setSortAsc] = useState(false);
  const [dealTypeFilter, setDealTypeFilter] = useState<string>('all');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const filtered = leaseComps
    .filter(c => {
      const matchesSearch = !search || c.tenant.toLowerCase().includes(search.toLowerCase()) ||
        c.building.toLowerCase().includes(search.toLowerCase()) ||
        c.submarket.toLowerCase().includes(search.toLowerCase());
      const matchesType = dealTypeFilter === 'all' || c.dealType === dealTypeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const mult = sortAsc ? 1 : -1;
      if (sortKey === 'commencementDate') return mult * (new Date(a[sortKey]).getTime() - new Date(b[sortKey]).getTime());
      return mult * ((a[sortKey] as number) - (b[sortKey] as number));
    });

  const avgRent = filtered.length ? (filtered.reduce((s, c) => s + c.rentPerSf, 0) / filtered.length).toFixed(0) : '0';
  const avgTI = filtered.length ? (filtered.reduce((s, c) => s + c.tiPerSf, 0) / filtered.length).toFixed(0) : '0';
  const avgFreeRent = filtered.length ? (filtered.reduce((s, c) => s + c.freeRentMonths, 0) / filtered.length).toFixed(1) : '0';
  const totalSF = filtered.reduce((s, c) => s + c.sqft, 0);

  return (
    <div className="min-h-screen pt-12">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Comp Tracker</h1>
            <p className="mt-1 text-muted-foreground">Recent lease transactions — DC Metro</p>
          </div>

          {/* Market Summary */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-primary">${avgRent}</p>
              <p className="text-[11px] text-muted-foreground">Avg Rent/SF</p>
            </Card>
            <Card className="border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-foreground">${avgTI}</p>
              <p className="text-[11px] text-muted-foreground">Avg TI/SF</p>
            </Card>
            <Card className="border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{avgFreeRent}</p>
              <p className="text-[11px] text-muted-foreground">Avg Free Rent (mo)</p>
            </Card>
            <Card className="border-border bg-card p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{totalSF.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground">Total SF Transacted</p>
            </Card>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tenant, building, submarket..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="border-border bg-secondary/50 pl-9 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'New', 'Renewal', 'Expansion', 'Sublease'].map(t => (
                <button
                  key={t}
                  onClick={() => setDealTypeFilter(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    dealTypeFilter === t
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {t === 'all' ? 'All Types' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <Card className="border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tenant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Building</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Submarket</th>
                    <th className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-muted-foreground" onClick={() => handleSort('sqft')}>
                      <span className="inline-flex items-center gap-1">SF <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-muted-foreground" onClick={() => handleSort('rentPerSf')}>
                      <span className="inline-flex items-center gap-1">Rent/SF <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-muted-foreground" onClick={() => handleSort('tiPerSf')}>
                      <span className="inline-flex items-center gap-1">TI/SF <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-muted-foreground" onClick={() => handleSort('freeRentMonths')}>
                      <span className="inline-flex items-center gap-1">Free Rent <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Term</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((comp, i) => (
                    <motion.tr
                      key={comp.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 transition-colors hover:bg-secondary/20"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{comp.tenant}</td>
                      <td className="px-4 py-3 text-muted-foreground">{comp.building}</td>
                      <td className="px-4 py-3 text-muted-foreground">{comp.submarket}</td>
                      <td className="px-4 py-3 text-right text-foreground">{comp.sqft.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">${comp.rentPerSf}</td>
                      <td className="px-4 py-3 text-right text-foreground">${comp.tiPerSf}</td>
                      <td className="px-4 py-3 text-right text-foreground">{comp.freeRentMonths} mo</td>
                      <td className="px-4 py-3 text-right text-foreground">{comp.leaseTerm} yr</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${dealTypeColors[comp.dealType]}`}>
                          {comp.dealType}
                        </Badge>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default CompTracker;
