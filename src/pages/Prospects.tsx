import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Building2, Calendar, ChevronDown, MapPin, Mail, User, Users, Briefcase, TrendingUp, AlertTriangle, Info, Zap } from 'lucide-react';
import { buildings, getUrgencyColor, type Tenant, type Building } from '@/data/mockData';
import { getPipeline } from '@/data/pipelineData';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type ProspectEntry = {
  tenant: Tenant;
  building: Building;
  pipelineStage?: string;
};

const urgencyOrder = { high: 0, medium: 1, low: 2 };

const reasonTypeIcons: Record<string, typeof AlertTriangle> = {
  lease_expiration: Calendar,
  vacancy: Building2,
  market_news: TrendingUp,
  building_sale: Briefcase,
  expansion: TrendingUp,
  contraction: AlertTriangle,
};

const reasonTypeLabels: Record<string, string> = {
  lease_expiration: 'Lease Expiration',
  vacancy: 'Vacancy Signal',
  market_news: 'Market News',
  building_sale: 'Building Sale',
  expansion: 'Expansion Signal',
  contraction: 'Contraction Signal',
};

const Prospects = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [filterIndustry, setFilterIndustry] = useState<string>('all');

  const pipeline = getPipeline();

  const prospects = useMemo<ProspectEntry[]>(() => {
    const all: ProspectEntry[] = [];
    buildings.forEach(building => {
      building.tenants.forEach(tenant => {
        const pipelineEntry = pipeline.find(p => p.tenantId === tenant.id);
        if (!pipelineEntry || !['won', 'lost'].includes(pipelineEntry.stage)) {
          all.push({ tenant, building, pipelineStage: pipelineEntry?.stage });
        }
      });
    });
    // Sort by highest urgency reason
    return all.sort((a, b) => {
      const aMax = Math.min(...a.tenant.outreachReasons.map(r => urgencyOrder[r.urgency]));
      const bMax = Math.min(...b.tenant.outreachReasons.map(r => urgencyOrder[r.urgency]));
      return aMax - bMax;
    });
  }, [pipeline]);

  const industries = useMemo(() => {
    const set = new Set(prospects.map(p => p.tenant.industry));
    return ['all', ...Array.from(set).sort()];
  }, [prospects]);

  const filtered = useMemo(() => {
    return prospects.filter(p => {
      if (filterIndustry !== 'all' && p.tenant.industry !== filterIndustry) return false;
      if (filterUrgency !== 'all') {
        const hasUrgency = p.tenant.outreachReasons.some(r => r.urgency === filterUrgency);
        if (!hasUrgency) return false;
      }
      return true;
    });
  }, [prospects, filterUrgency, filterIndustry]);

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link to="/" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Active Prospects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} prospects with actionable outreach opportunities
          </p>
        </motion.div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {['all', 'high', 'medium', 'low'].map(u => (
            <button
              key={u}
              onClick={() => setFilterUrgency(u)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filterUrgency === u
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {u === 'all' ? 'All Urgency' : u}
            </button>
          ))}
          <select
            value={filterIndustry}
            onChange={e => setFilterIndustry(e.target.value)}
            className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground"
          >
            {industries.map(i => (
              <option key={i} value={i}>{i === 'all' ? 'All Industries' : i}</option>
            ))}
          </select>
        </div>

        {/* Prospect List */}
        <div className="space-y-3">
          {filtered.map((entry, i) => {
            const { tenant, building } = entry;
            const isExpanded = expandedId === tenant.id;
            const highCount = tenant.outreachReasons.filter(r => r.urgency === 'high').length;
            const medCount = tenant.outreachReasons.filter(r => r.urgency === 'medium').length;

            return (
              <motion.div
                key={tenant.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="border-border bg-card overflow-hidden">
                  {/* Summary Row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : tenant.id)}
                    className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-secondary/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-foreground truncate">{tenant.name}</p>
                        {highCount > 0 && (
                          <Badge variant="outline" className="bg-destructive/20 text-destructive text-[10px] shrink-0">
                            {highCount} urgent
                          </Badge>
                        )}
                        {medCount > 0 && (
                          <Badge variant="outline" className="bg-primary/20 text-primary text-[10px] shrink-0">
                            {medCount} medium
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {building.name}</span>
                        <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {tenant.industry}</span>
                        <span>{tenant.sqft.toLocaleString()} SF</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Exp: {tenant.leaseExpiration}</span>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Expanded Detail */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                          {/* Contact & Space Info */}
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-md bg-secondary/50 p-2.5">
                              <p className="text-[10px] text-muted-foreground mb-0.5">Contact</p>
                              <p className="text-xs font-medium text-foreground">{tenant.contactName}</p>
                              <p className="text-[10px] text-muted-foreground">{tenant.contactTitle}</p>
                            </div>
                            <div className="rounded-md bg-secondary/50 p-2.5">
                              <p className="text-[10px] text-muted-foreground mb-0.5">Headcount</p>
                              <p className="text-xs font-medium text-foreground">{tenant.headcount}</p>
                              <p className="text-[10px] text-muted-foreground">{Math.round(tenant.sqft / tenant.headcount)} SF/person</p>
                            </div>
                            <div className="rounded-md bg-secondary/50 p-2.5">
                              <p className="text-[10px] text-muted-foreground mb-0.5">Floor(s)</p>
                              <p className="text-xs font-medium text-foreground">{tenant.floor}</p>
                              <p className="text-[10px] text-muted-foreground">{tenant.sqft.toLocaleString()} SF</p>
                            </div>
                            <div className="rounded-md bg-secondary/50 p-2.5">
                              <p className="text-[10px] text-muted-foreground mb-0.5">Building Vacancy</p>
                              <p className={`text-xs font-medium ${building.vacancyRate > 20 ? 'text-destructive' : 'text-foreground'}`}>
                                {building.vacancyRate}%
                              </p>
                              <p className="text-[10px] text-muted-foreground">Class {building.class}</p>
                            </div>
                          </div>

                          {/* Outreach Reasons */}
                          <div>
                            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
                              <Zap className="h-3.5 w-3.5 text-primary" /> Reasons to Reach Out
                            </p>
                            <div className="space-y-2">
                              {tenant.outreachReasons
                                .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
                                .map((reason, ri) => {
                                  const Icon = reasonTypeIcons[reason.type] || Info;
                                  return (
                                    <div
                                      key={ri}
                                      className={`rounded-md border p-3 ${
                                        reason.urgency === 'high'
                                          ? 'border-destructive/30 bg-destructive/5'
                                          : reason.urgency === 'medium'
                                          ? 'border-primary/30 bg-primary/5'
                                          : 'border-border bg-secondary/30'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2">
                                        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                          reason.urgency === 'high' ? 'text-destructive' : reason.urgency === 'medium' ? 'text-primary' : 'text-muted-foreground'
                                        }`} />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <p className="text-xs font-semibold text-foreground">{reason.title}</p>
                                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${getUrgencyColor(reason.urgency)}`}>
                                              {reason.urgency}
                                            </Badge>
                                            <span className="text-[9px] text-muted-foreground">{reasonTypeLabels[reason.type]}</span>
                                          </div>
                                          <p className="text-[11px] leading-relaxed text-muted-foreground">{reason.description}</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-1">
                            <Link to={`/building/${building.id}/tenant/${tenant.id}`}>
                              <Button size="sm" className="text-xs h-8">View Full Profile →</Button>
                            </Link>
                            <a href={`mailto:${tenant.contactEmail}`}>
                              <Button size="sm" variant="outline" className="text-xs h-8">
                                <Mail className="mr-1 h-3 w-3" /> Email {tenant.contactName.split(' ')[0]}
                              </Button>
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Prospects;
