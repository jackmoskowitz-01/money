import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSearch, Loader2, X, Shield, MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SMART_OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-outreach`;

interface ResearchBriefProps {
  tenantName: string;
  industry: string;
  sqft: number;
  buildingName: string;
  leaseExpiration: string;
  headcount: number;
  contactName: string;
  contactTitle: string;
}

const ResearchBrief = ({
  tenantName, industry, sqft, buildingName, leaseExpiration, headcount, contactName, contactTitle,
}: ResearchBriefProps) => {
  const [brief, setBrief] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBrief, setShowBrief] = useState(false);

  // Objection handler
  const [objection, setObjection] = useState('');
  const [objectionResponse, setObjectionResponse] = useState('');
  const [isHandlingObjection, setIsHandlingObjection] = useState(false);
  const [showObjection, setShowObjection] = useState(false);

  const generateBrief = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setShowBrief(true);
    setBrief('');

    try {
      const resp = await fetch(SMART_OUTREACH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'research_brief',
          tenantName, industry, sqft, buildingName, leaseExpiration, headcount, contactName, contactTitle,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || 'Failed to generate brief');
        setShowBrief(false);
        setIsLoading(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '', full = '';

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
            if (content) { full += content; setBrief(full); }
          } catch { /* partial */ }
        }
      }
    } catch { toast.error('Failed to generate brief'); setShowBrief(false); }
    setIsLoading(false);
  }, [tenantName, industry, sqft, buildingName, leaseExpiration, headcount, contactName, contactTitle, isLoading]);

  const handleObjection = useCallback(async () => {
    if (!objection.trim() || isHandlingObjection) return;
    setIsHandlingObjection(true);
    setObjectionResponse('');

    try {
      const resp = await fetch(SMART_OUTREACH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'handle_objection',
          objection: objection.trim(),
          tenantName, industry, sqft, leaseExpiration, buildingName,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || 'Failed to handle objection');
        setIsHandlingObjection(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '', full = '';

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
            if (content) { full += content; setObjectionResponse(full); }
          } catch { /* partial */ }
        }
      }
    } catch { toast.error('Failed to handle objection'); }
    setIsHandlingObjection(false);
  }, [objection, isHandlingObjection, tenantName, industry, sqft, leaseExpiration, buildingName]);

  const commonObjections = [
    "We just signed a lease",
    "We're happy with our current space",
    "Not the right time",
    "We're downsizing / going remote",
    "Already working with another broker",
  ];

  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold">AI Research & Response</h3>
        </div>
      </div>

      {/* Research Brief */}
      <div className="mb-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs h-8 justify-start gap-2"
          onClick={generateBrief}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileSearch className="h-3 w-3" />}
          {showBrief ? 'Regenerate Research Brief' : 'Generate Research Brief'}
        </Button>

        <AnimatePresence>
          {showBrief && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-3 max-h-80 overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-primary">Research Brief — {tenantName}</p>
                  <button onClick={() => setShowBrief(false)} className="rounded p-0.5 hover:bg-secondary">
                    <X className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
                <div className="text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap prose prose-xs prose-headings:text-xs prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-1">
                  {brief || (isLoading ? 'Researching...' : '')}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Objection Handler */}
      <div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs h-8 justify-start gap-2"
          onClick={() => setShowObjection(!showObjection)}
        >
          <Shield className="h-3 w-3" />
          Objection Handler
        </Button>

        <AnimatePresence>
          {showObjection && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 rounded-md border border-border bg-secondary/20 p-3">
                <p className="text-[10px] text-muted-foreground mb-2">What objection did the prospect raise?</p>
                
                {/* Quick objection buttons */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {commonObjections.map(obj => (
                    <button
                      key={obj}
                      onClick={() => setObjection(obj)}
                      className={`rounded-full px-2 py-0.5 text-[9px] transition-colors ${
                        objection === obj
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {obj}
                    </button>
                  ))}
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={objection}
                    onChange={(e) => setObjection(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleObjection()}
                    placeholder="Type or select an objection..."
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    disabled={isHandlingObjection}
                  />
                  <Button
                    size="sm"
                    className="h-7 text-[10px] px-2"
                    onClick={handleObjection}
                    disabled={!objection.trim() || isHandlingObjection}
                  >
                    {isHandlingObjection ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                  </Button>
                </div>

                {objectionResponse && (
                  <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2.5 max-h-60 overflow-y-auto">
                    <div className="text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {objectionResponse}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
};

export default ResearchBrief;
