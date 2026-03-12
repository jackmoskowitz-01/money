import { useState, useCallback, useEffect } from 'react';
import { Loader2, Newspaper, ExternalLink, RefreshCw, Zap, Clock3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const COMPANY_NEWS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-company-news`;

type CompanyNewsItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  date: string;
  category: string;
  url?: string | null;
  matchedCompanyName?: string;
  relevanceScore?: number;
};

type Props = {
  companyId: string;
  companyName: string;
  buildingId?: string;
  onOutreachTrigger?: (title: string, summary: string) => void;
  onNewsLoaded?: (news: CompanyNewsItem[]) => void;
};

const categoryColors: Record<string, string> = {
  lease: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  sale: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  expansion: 'bg-green-500/10 text-green-600 border-green-500/20',
  vacancy: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  market: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  contraction: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const CompanyNewsCard = ({ companyId, companyName, buildingId, onOutreachTrigger, onNewsLoaded }: Props) => {
  const [news, setNews] = useState<CompanyNewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<string>('fresh');

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(COMPANY_NEWS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          companies: [{ id: companyId, name: companyName, buildingId: buildingId || '' }],
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch news');
      }

      const data = await resp.json();
      const incomingNews = Array.isArray(data.companyNews) ? data.companyNews : [];

      setNews(prev => (incomingNews.length > 0 ? incomingNews : prev.length > 0 ? prev : incomingNews));
      if (incomingNews.length > 0) {
        onNewsLoaded?.(incomingNews);
      }

      setLastFetchedAt(data.fetchedAt || new Date().toISOString());
      setFreshness(data.freshness || 'fresh');
      setHasLoaded(true);
    } catch (e) {
      console.error('Company news fetch failed:', e);
      toast.error('Failed to fetch company news');
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [companyId, companyName, buildingId]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return dateStr;
  };

  return (
    <Card className="border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Real-Time News</h3>
          {news.length > 0 && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">
              {news.length}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={fetchNews}
          disabled={loading}
          title="Refresh news"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="p-3">
        {loading && !hasLoaded ? (
          <div className="flex items-center gap-2 py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Searching for {companyName} news...</span>
          </div>
        ) : news.length === 0 ? (
          <div className="py-6 text-center">
            <Newspaper className="mx-auto mb-2 h-6 w-6 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground">No recent news found</p>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">We'll keep checking automatically</p>
          </div>
        ) : (
          <div className="space-y-2">
            {news.map(item => (
              <div
                key={item.id}
                className={`rounded-md border border-border bg-secondary/20 p-3 transition-colors ${
                  onOutreachTrigger ? 'hover:bg-secondary/40 hover:border-primary/30 cursor-pointer' : ''
                }`}
                onClick={() => onOutreachTrigger?.(item.title, item.summary)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 capitalize ${categoryColors[item.category] || 'bg-muted text-muted-foreground'}`}
                      >
                        {item.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground/60">{getTimeSince(item.date)}</span>
                      {item.relevanceScore && item.relevanceScore >= 70 && (
                        <Badge variant="outline" className="text-[8px] px-1 py-0 bg-destructive/10 text-destructive border-destructive/20">
                          <Zap className="h-2 w-2 mr-0.5" /> High Signal
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-foreground leading-snug mb-1">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3">{item.summary}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground/50">{item.source}</span>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-0.5 text-[9px] text-primary hover:underline"
                        >
                          <ExternalLink className="h-2.5 w-2.5" /> Source
                        </a>
                      )}
                      {onOutreachTrigger && (
                        <span className="text-[9px] text-primary/60 ml-auto">Click to draft outreach →</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default CompanyNewsCard;
