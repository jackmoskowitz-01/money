import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Bell, BellOff, AlertTriangle, Building2, Newspaper, TrendingUp, Plus, Filter } from 'lucide-react';
import { marketAlerts, type MarketAlert } from '@/data/pipelineData';
import { buildings } from '@/data/mockData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const alertTypeIcons: Record<MarketAlert['type'], typeof AlertTriangle> = {
  lease_expiry: AlertTriangle,
  news: Newspaper,
  building_sale: Building2,
  vacancy_change: TrendingUp,
  new_listing: Plus,
};

const alertTypeLabels: Record<MarketAlert['type'], string> = {
  lease_expiry: 'Lease Expiry',
  news: 'News',
  building_sale: 'Building Sale',
  vacancy_change: 'Vacancy',
  new_listing: 'New Listing',
};

const priorityColors: Record<string, string> = {
  high: 'bg-destructive/20 text-destructive',
  medium: 'bg-primary/20 text-primary',
  low: 'bg-muted text-muted-foreground',
};

const Alerts = () => {
  const [alerts, setAlerts] = useState<MarketAlert[]>(marketAlerts);
  const [filter, setFilter] = useState<string>('all');

  const unreadCount = alerts.filter(a => !a.read).length;

  const markRead = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, read: true } : a));
  };

  const markAllRead = () => {
    setAlerts(alerts.map(a => ({ ...a, read: true })));
  };

  const filtered = filter === 'all' ? alerts
    : filter === 'unread' ? alerts.filter(a => !a.read)
    : alerts.filter(a => a.type === filter);

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getTenantLink = (alert: MarketAlert) => {
    if (alert.relatedTenantId && alert.relatedBuildingId) {
      return `/building/${alert.relatedBuildingId}/tenant/${alert.relatedTenantId}`;
    }
    if (alert.relatedBuildingId) {
      return '/map';
    }
    return null;
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Alerts</h1>
              <p className="mt-1 text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread alerts` : 'All caught up'}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={markAllRead} className="text-xs">
                <BellOff className="mr-2 h-3 w-3" /> Mark All Read
              </Button>
            )}
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-wrap gap-2">
            {['all', 'unread', 'lease_expiry', 'news', 'building_sale', 'vacancy_change', 'new_listing'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {f === 'all' ? 'All' : f === 'unread' ? `Unread (${unreadCount})` : alertTypeLabels[f as MarketAlert['type']] || f}
              </button>
            ))}
          </div>

          {/* Alert List */}
          <div className="space-y-3">
            {filtered.map((alert, i) => {
              const Icon = alertTypeIcons[alert.type];
              const link = getTenantLink(alert);

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card
                    className={`border-border bg-card p-4 transition-colors ${
                      !alert.read ? 'border-l-2 border-l-primary' : ''
                    }`}
                    onClick={() => markRead(alert.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        alert.priority === 'high' ? 'bg-destructive/10' : 'bg-secondary'
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          alert.priority === 'high' ? 'text-destructive' : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <h3 className={`text-sm font-semibold ${!alert.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {alert.title}
                          </h3>
                          <Badge variant="outline" className={`text-[10px] ${priorityColors[alert.priority]}`}>
                            {alert.priority}
                          </Badge>
                          {!alert.read && (
                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
                          )}
                        </div>
                        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">{alert.description}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-muted-foreground/60">{timeAgo(alert.timestamp)}</span>
                          {link && (
                            <Link
                              to={link}
                              className="text-[11px] font-medium text-primary hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              View details →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Alerts;
