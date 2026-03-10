import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, Mail, Loader2, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmailDisplay from '@/components/EmailDisplay';

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-nonprofit-outreach`;

type Tab = 'newsletter' | 'outreach';

const NonprofitOutreach = () => {
  const [activeTab, setActiveTab] = useState<Tab>('newsletter');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [showContent, setShowContent] = useState(false);

  // Newsletter fields
  const [newsletterContext, setNewsletterContext] = useState('');

  // Outreach fields
  const [orgName, setOrgName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [mission, setMission] = useState('');
  const [memberCount, setMemberCount] = useState('');
  const [currentLeaseSqft, setCurrentLeaseSqft] = useState('');
  const [leaseExpiration, setLeaseExpiration] = useState('');
  const [outreachContext, setOutreachContext] = useState('');

  const streamGenerate = useCallback(async (body: Record<string, unknown>) => {
    setIsGenerating(true);
    setGeneratedContent('');
    setShowContent(true);

    try {
      const resp = await fetch(FUNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Generation failed' }));
        toast.error(err.error || 'Failed to generate content');
        setIsGenerating(false);
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
              setGeneratedContent(full);
            }
          } catch { /* partial */ }
        }
      }

      toast.success(activeTab === 'newsletter' ? 'Newsletter generated!' : 'Outreach email generated!');
    } catch {
      toast.error('Failed to generate content');
    }
    setIsGenerating(false);
  }, [activeTab]);

  const generateNewsletter = () => {
    streamGenerate({ type: 'newsletter', customContext: newsletterContext });
  };

  const generateOutreach = () => {
    if (!orgName.trim()) {
      toast.error('Please enter the organization name');
      return;
    }
    streamGenerate({
      type: 'outreach',
      orgName,
      contactName,
      contactTitle,
      mission,
      memberCount,
      currentLeaseSqft: currentLeaseSqft ? parseInt(currentLeaseSqft) : undefined,
      leaseExpiration,
      customContext: outreachContext,
    });
  };

  const handleUpdateContent = (_key: string, content: string) => {
    setGeneratedContent(content);
  };

  const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40";

  return (
    <div className="min-h-screen bg-background pt-16 pb-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="font-display text-2xl font-bold text-foreground">
            Non-Profit & Association Outreach
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate market newsletters and personalized outreach emails for non-profit organizations and associations.
          </p>
        </motion.div>

        {/* Tab Toggle */}
        <div className="mb-6 flex gap-1 rounded-lg bg-secondary/50 p-1 w-fit">
          <button
            onClick={() => setActiveTab('newsletter')}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'newsletter'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Newspaper className="h-4 w-4" />
            Market Newsletter
          </button>
          <button
            onClick={() => setActiveTab('outreach')}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'outreach'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mail className="h-4 w-4" />
            Personalized Outreach
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Form Panel */}
          <Card className="p-5">
            <AnimatePresence mode="wait">
              {activeTab === 'newsletter' ? (
                <motion.div
                  key="newsletter"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="mb-4 flex items-center gap-2">
                    <Newspaper className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Market Update Newsletter</h2>
                  </div>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Generate a DC market update newsletter tailored for non-profit and association tenants. Includes vacancy trends, rental data, and opportunities.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Additional Context <span className="text-muted-foreground">(optional)</span>
                      </label>
                      <textarea
                        value={newsletterContext}
                        onChange={(e) => setNewsletterContext(e.target.value)}
                        placeholder="e.g. Focus on Capitol Hill, mention upcoming BRAC changes, highlight affordable sublease options..."
                        className={`${inputClass} min-h-[100px] resize-y`}
                      />
                    </div>

                    <div className="rounded-md bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-foreground mb-1.5">Auto-included market data:</p>
                      <ul className="space-y-1 text-[11px] text-muted-foreground">
                        <li>• DC vacancy rates & trends</li>
                        <li>• CBD & East End rental comparisons</li>
                        <li>• Sublease opportunities for non-profits</li>
                        <li>• Capitol Hill & Georgetown association activity</li>
                        <li>• Flex/coworking options for smaller orgs</li>
                      </ul>
                    </div>

                    <Button
                      onClick={generateNewsletter}
                      disabled={isGenerating}
                      className="w-full"
                    >
                      {isGenerating ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                      ) : (
                        <><Sparkles className="h-4 w-4" /> Generate Newsletter</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="outreach"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="mb-4 flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Personalized Outreach</h2>
                  </div>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Generate a tailored outreach email for a specific non-profit or association prospect.
                  </p>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-foreground">Organization Name *</label>
                        <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. National Wildlife Federation" className={inputClass} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-foreground">Contact Name</label>
                          <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. Sarah Johnson" className={inputClass} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-foreground">Title</label>
                          <input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} placeholder="e.g. COO" className={inputClass} />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-foreground">Mission / Focus Area</label>
                        <input value={mission} onChange={(e) => setMission(e.target.value)} placeholder="e.g. Environmental conservation and advocacy" className={inputClass} />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-foreground">Staff/Members</label>
                          <input value={memberCount} onChange={(e) => setMemberCount(e.target.value)} placeholder="e.g. 150" className={inputClass} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-foreground">Current SF</label>
                          <input value={currentLeaseSqft} onChange={(e) => setCurrentLeaseSqft(e.target.value)} placeholder="e.g. 25000" className={inputClass} type="number" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-foreground">Lease Expiry</label>
                          <input value={leaseExpiration} onChange={(e) => setLeaseExpiration(e.target.value)} placeholder="e.g. Q3 2026" className={inputClass} />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-foreground">
                          Additional Context <span className="text-muted-foreground">(optional)</span>
                        </label>
                        <textarea
                          value={outreachContext}
                          onChange={(e) => setOutreachContext(e.target.value)}
                          placeholder="e.g. They were recently mentioned in a WBJ article about expanding operations..."
                          className={`${inputClass} min-h-[60px] resize-y`}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={generateOutreach}
                      disabled={isGenerating}
                      className="w-full"
                    >
                      {isGenerating ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                      ) : (
                        <><Send className="h-4 w-4" /> Generate Outreach Email</>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* Output Panel */}
          <div>
            <AnimatePresence>
              {showContent && (
                <EmailDisplay
                  emailKey="nonprofit"
                  emailContent={generatedContent}
                  isGenerating={isGenerating}
                  label={activeTab === 'newsletter' ? 'Market Newsletter' : 'Outreach Email'}
                  onClose={() => { setShowContent(false); setGeneratedContent(''); }}
                  onUpdateEmail={handleUpdateContent}
                />
              )}
            </AnimatePresence>

            {!showContent && (
              <Card className="flex h-full min-h-[300px] items-center justify-center p-6">
                <div className="text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {activeTab === 'newsletter'
                      ? 'Click "Generate Newsletter" to create a market update'
                      : 'Fill in the org details and generate a personalized email'}
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NonprofitOutreach;
