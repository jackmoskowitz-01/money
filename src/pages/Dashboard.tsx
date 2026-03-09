import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Building2, Clock, ExternalLink, Filter } from 'lucide-react';
import { newsItems, buildings, getCategoryColor } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const stats = [
  { label: 'Expiring Leases (12mo)', value: '14', icon: Clock, trend: '+3 this month' },
  { label: 'DC Vacancy Rate', value: '22.0%', icon: TrendingUp, trend: '+1.2% QoQ' },
  { label: 'Active Prospects', value: '47', icon: Building2, trend: '12 high priority' },
  { label: 'Buildings Tracked', value: String(buildings.length), icon: TrendingDown, trend: 'Washington DC' },
];

const categories = ['all', 'lease', 'sale', 'expansion', 'vacancy', 'market', 'contraction'] as const;

const Dashboard = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredNews = activeCategory === 'all'
    ? newsItems
    : newsItems.filter(n => n.category === activeCategory);

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold tracking-tight">Market Intelligence</h1>
          <p className="mt-1 text-muted-foreground">
            Washington DC commercial real estate — latest signals for outreach
          </p>
        </motion.div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{stat.trend}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* News Feed */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Market News</h2>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Category Filter */}
            <div className="mb-4 flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredNews.map((news, i) => (
                <motion.div
                  key={news.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="border-border bg-card p-4 transition-colors hover:bg-secondary/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant="outline" className={getCategoryColor(news.category)}>
                            {news.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{news.date}</span>
                        </div>
                        <h3 className="mb-1 text-sm font-semibold text-foreground">{news.title}</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">{news.summary}</p>
                        <p className="mt-2 text-xs text-muted-foreground/60">{news.source}</p>
                      </div>
                      <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40" />
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Hot Prospects Sidebar */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Hot Prospects</h2>
            <div className="space-y-3">
              {buildings.flatMap(b =>
                b.tenants.filter(t =>
                  t.outreachReasons.some(r => r.urgency === 'high')
                ).map(t => ({
                  tenant: t,
                  building: b,
                }))
              ).slice(0, 6).map(({ tenant, building }, i) => (
                <motion.div
                  key={tenant.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link to={`/building/${building.id}/tenant/${tenant.id}`}>
                    <Card className="border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-[var(--shadow-glow)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground">{building.name}</p>
                        </div>
                        <Badge variant="outline" className="bg-destructive/20 text-destructive text-[10px]">
                          HIGH
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Lease expires {tenant.leaseExpiration} · {tenant.sqft.toLocaleString()} SF
                      </p>
                      <p className="mt-1 text-[11px] text-primary">
                        {tenant.outreachReasons.filter(r => r.urgency === 'high').length} urgent reasons to reach out →
                      </p>
                    </Card>
                  </Link>
                </motion.div>
              ))}

              <Link to="/map">
                <Button variant="outline" className="mt-2 w-full text-xs">
                  View All on Map →
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
