import { useState, useCallback } from 'react';
import { FileText, Loader2, Copy, Check, Printer, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/lib/sanitize';

const MEETING_PREP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meeting-prep`;

interface MeetingPrepBriefProps {
  tenantName: string;
  industry: string;
  sqft: number;
  headcount: number;
  leaseExpiration: string;
  floor: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  buildingName: string;
  buildingClass?: string;
  buildingFloors?: number;
  buildingYearBuilt?: number;
  vacancyRate: number;
  owner?: string;
  outreachReasons: { type: string; urgency: string; title: string; description: string }[];
  submarketNews?: { title: string; summary: string }[];
  scoopIntel?: { author: string; content: string }[];
  activityHistory?: { date: string; title: string }[];
}

const MeetingPrepBrief = (props: MeetingPrepBriefProps) => {
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setBrief('');
    try {
      const resp = await fetch(MEETING_PREP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(props),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || 'Failed to generate brief');
        setLoading(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              full += content;
              setBrief(full);
            }
          } catch { /* partial */ }
        }
      }
    } catch {
      toast.error('Failed to generate meeting prep brief');
    }
    setLoading(false);
  }, [props]);

  const copyBrief = () => {
    navigator.clipboard.writeText(brief);
    setCopied(true);
    toast.success('Brief copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const printBrief = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Meeting Prep — ${props.tenantName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; font-size: 13px; }
        h1 { font-size: 20px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px; }
        h2 { font-size: 15px; margin-top: 24px; color: #333; }
        ul, ol { padding-left: 20px; }
        li { margin-bottom: 4px; }
      </style></head><body>
      <h1>Meeting Prep: ${props.tenantName}</h1>
      ${brief.replace(/## (.*)/g, '<h2>$1</h2>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/- (.*)/g, '<li>$1</li>')
        .replace(/\n/g, '<br>')}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  // Simple markdown rendering
  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    const elements: JSX.Element[] = [];
    let i = 0;

    for (const line of lines) {
      i++;
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={i} className="text-xs font-bold text-foreground mt-4 mb-1.5 flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-primary inline-block" />
            {line.slice(3)}
          </h3>
        );
      } else if (line.startsWith('- ')) {
        const text = line.slice(2)
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        elements.push(
          <div key={i} className="flex items-start gap-1.5 ml-2 mb-0.5">
            <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
            <p className="text-[11px] text-foreground/80 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }} />
          </div>
        );
      } else if (line.trim()) {
        const text = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        elements.push(
          <p key={i} className="text-[11px] text-foreground/80 leading-relaxed mb-1" dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }} />
        );
      }
    }
    return elements;
  };

  return (
    <Card className="border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10">
            <FileText className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-xs font-semibold text-foreground">Meeting Prep</p>
        </div>
        <div className="flex items-center gap-1">
          {brief && (
            <>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={copyBrief}>
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={printBrief}>
                <Printer className="h-3 w-3 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={generate} disabled={loading}>
                <RefreshCw className={`h-3 w-3 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="p-4">
        {!brief && !loading ? (
          <div className="text-center py-4">
            <p className="text-[11px] text-muted-foreground mb-3">
              Generate a one-pager with tenant data, building info, market intel, and talking points.
            </p>
            <Button size="sm" className="text-xs h-7" onClick={generate}>
              <FileText className="mr-1.5 h-3 w-3" /> Generate Brief
            </Button>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto pr-1">
            {renderMarkdown(brief)}
            {loading && (
              <div className="flex items-center gap-1.5 mt-2">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="text-[10px] text-muted-foreground">Generating brief...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default MeetingPrepBrief;
