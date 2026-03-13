import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  MessageSquare, X, Send, Loader2, Sparkles, Trash2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildings } from '@/data/mockData';
import { usePipeline } from '@/hooks/usePipeline';
import { stageLabels } from '@/data/pipelineData';
import { leaseComps } from '@/data/pipelineData';
import { toast } from 'sonner';

const COPILOT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deal-copilot`;

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  "What's my best next move with McKinsey?",
  "Draft a check-in email for Deloitte",
  "Which prospects are expiring soon?",
  "What are average Class A rents in East End?",
];

export default function DealCopilot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { pipeline } = usePipeline();

  // Build context string from pipeline + buildings
  const buildContext = useCallback(() => {
    const parts: string[] = [];

    // Pipeline summary
    if (pipeline.length > 0) {
      parts.push('### Pipeline Deals');
      pipeline.forEach(item => {
        const building = buildings.find(b => b.id === item.buildingId);
        const tenant = building?.tenants.find(t => t.id === item.tenantId);
        const name = item.isManual ? item.prospectName : tenant?.name;
        const company = item.isManual ? item.prospectCompany : building?.name;
        const sqft = item.isManual ? item.prospectSqft : tenant?.sqft;
        const expiry = tenant?.leaseExpiration || 'N/A';
        const stage = stageLabels[item.stage];
        const notes = item.notes.length > 0 ? ` | Notes: ${item.notes.slice(-2).join('; ')}` : '';
        const touchpoints = (item.sentTouchpoints || []).length;
        parts.push(`- **${name}** at ${company} | ${sqft?.toLocaleString()} SF | Stage: ${stage} | Lease expires: ${expiry} | ${touchpoints} touchpoints sent${notes}`);
      });
    }

    // Buildings summary
    parts.push('\n### Key Buildings');
    buildings.forEach(b => {
      parts.push(`- **${b.name}** (${b.address}) | ${b.class} Class | ${b.sqft.toLocaleString()} SF | Vacancy: ${b.vacancyRate}% | Owner: ${b.owner} | ${b.tenants.length} tenants`);
    });

    // Top lease comps
    parts.push('\n### Recent Lease Comps');
    leaseComps.slice(0, 5).forEach(c => {
      parts.push(`- ${c.tenant} at ${c.building} | ${c.sqft.toLocaleString()} SF | $${c.rentPerSf}/SF | ${c.dealType} | ${c.submarket}`);
    });

    return parts.join('\n');
  }, [pipeline]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Msg = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';

    try {
      const resp = await fetch(COPILOT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages,
          context: buildContext(),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${resp.status})`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            // partial JSON, wait for more
          }
        }
      }
    } catch (e: any) {
      console.error('Copilot error:', e);
      toast.error(e.message || 'Failed to get response');
      // Remove user message if no response
      if (!assistantSoFar) {
        setMessages(prev => prev.slice(0, -1));
      }
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setOpen(true)}
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg shadow-primary/25 p-0"
            >
              <Sparkles className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col w-[420px] h-[600px] max-h-[80vh] rounded-2xl border border-border bg-card shadow-2xl shadow-black/20 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">DealFlow Copilot</h3>
                  <p className="text-[10px] text-muted-foreground">Strategy · Outreach · Market Intel</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setMessages([])}
                    title="Clear chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground"
                  onClick={() => setOpen(false)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">How can I help?</p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-[260px]">
                      I know your pipeline, buildings, and market data. Ask me anything.
                    </p>
                  </div>
                  <div className="w-full space-y-2 mt-2">
                    {SUGGESTIONS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(s)}
                        className="w-full text-left px-3 py-2 rounded-lg border border-border bg-secondary/30 text-xs text-foreground hover:bg-secondary/60 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-secondary/50 text-foreground rounded-bl-md'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>p]:text-sm [&>li]:text-sm">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-secondary/50 rounded-2xl rounded-bl-md px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border px-3 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about deals, market data, or draft outreach..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 max-h-[100px]"
                  style={{ minHeight: '40px' }}
                  onInput={e => {
                    const t = e.target as HTMLTextAreaElement;
                    t.style.height = 'auto';
                    t.style.height = Math.min(t.scrollHeight, 100) + 'px';
                  }}
                />
                <Button
                  size="sm"
                  className="h-10 w-10 rounded-xl p-0 shrink-0"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
