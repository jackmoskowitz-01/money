import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Copy, Check, X, Loader2, Pencil, Sparkles, Send, Type, Hash, ChevronDown, FlipHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import RecipientPicker, { type EmailRecipient } from '@/components/RecipientPicker';
import { getAuthToken } from '@/lib/getAuthToken';
import { useOrganizationId } from '@/hooks/useOrganization';

const REFINE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refine-email`;
const SMART_DRAFT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-drafting`;
const SMART_OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-outreach`;

const tones = [
  { id: 'formal', label: 'Formal', icon: '🏛️', desc: 'Polished & professional' },
  { id: 'casual', label: 'Casual', icon: '👋', desc: 'Friendly & conversational' },
  { id: 'consultative', label: 'Consultative', icon: '📊', desc: 'Advisory & data-driven' },
  { id: 'urgent', label: 'Urgent', icon: '⚡', desc: 'Time-sensitive & action-oriented' },
] as const;

interface EmailDisplayProps {
  emailKey: string;
  emailContent: string;
  isGenerating: boolean;
  label?: string;
  contactName?: string;
  contactEmail?: string;
  subject?: string;
  recipients?: EmailRecipient[];
  tenantId?: string;
  tenantName?: string;
  industry?: string;
  buildingId?: string;
  buildingName?: string;
  sqft?: number;
  leaseExpiration?: string;
  outreachReason?: string;
  onClose: () => void;
  onDismiss?: () => void;
  onUpdateEmail: (key: string, content: string) => void;
}

const EmailDisplay = ({
  emailKey, emailContent, isGenerating, label = 'Generated Email',
  contactName, contactEmail, subject, recipients,
  tenantId, tenantName, industry, buildingId, buildingName, sqft, leaseExpiration, outreachReason,
  onClose, onDismiss, onUpdateEmail,
}: EmailDisplayProps) => {
  const orgId = useOrganizationId();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [showToneSelector, setShowToneSelector] = useState(false);
  const [activeTone, setActiveTone] = useState<string | null>(null);
  const [isRewritingTone, setIsRewritingTone] = useState(false);
  const [showSubjectLines, setShowSubjectLines] = useState(false);
  const [subjectLines, setSubjectLines] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [abVariant, setAbVariant] = useState('');
  const [isGeneratingAB, setIsGeneratingAB] = useState(false);
  const [showABVariant, setShowABVariant] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Extract subject from AI-generated content
  const parsedSubject = (() => {
    const match = emailContent.match(/^Subject:\s*([^\n]*)\n*/i);
    return match ? match[1].trim() : '';
  })();

  const displayBody = (() => {
    const match = emailContent.match(/^Subject:\s*[^\n]*\n*/i);
    return match ? emailContent.slice(match[0].length).trimStart() : emailContent;
  })();

  const copyEmail = () => {
    const subj = selectedSubject || parsedSubject || subject || '';
    const text = subj ? `Subject: ${subj}\n\n${displayBody}` : emailContent;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Email copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const logActivity = async (recipientEmails?: string[]) => {
    try {
      const toList = recipientEmails?.join(', ') || contactEmail || 'unknown';
      await supabase.from('activities').insert({
        type: 'email',
        title: `Email sent to ${contactName || tenantName || 'prospect'}`,
        description: `Outreach email sent to ${toList}${outreachReason ? `. Reason: ${outreachReason}` : ''}`,
        tenant_id: tenantId || tenantName || 'unknown',
        building_id: buildingId || buildingName || '',
        outreach_reason_used: outreachReason || null,
        ...(orgId ? { organization_id: orgId } : {}),
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const openInEmailClient = (toEmails?: string[]) => {
    const to = toEmails ? toEmails.join(',') : (contactEmail || '');
    const subj = selectedSubject || parsedSubject || subject || (label ? `Re: ${label}` : '');
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(displayBody)}`;
    window.open(mailto, '_blank');
    logActivity(toEmails);
    toast.success('Opening email client & logging activity...');
  };

  const startEditing = () => {
    setEditText(emailContent);
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const saveEdit = () => {
    onUpdateEmail(emailKey, editText);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditText('');
  };

  const refineWithAI = async () => {
    if (!refineInput.trim() || isRefining) return;
    setIsRefining(true);
    try {
      const resp = await fetch(REFINE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({ currentEmail: emailContent, instruction: refineInput.trim() }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Refinement failed' }));
        toast.error(err.error || 'Failed to refine email');
        setIsRefining(false);
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
            if (content) { full += content; onUpdateEmail(emailKey, full); }
          } catch { /* partial */ }
        }
      }
      setRefineInput('');
      setShowRefine(false);
      toast.success('Email refined');
    } catch { toast.error('Failed to refine email'); }
    setIsRefining(false);
  };

  const rewriteTone = async (tone: string) => {
    if (isRewritingTone || !emailContent) return;
    setActiveTone(tone);
    setIsRewritingTone(true);
    setShowToneSelector(false);
    try {
      const resp = await fetch(SMART_DRAFT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({ action: 'rewrite_tone', currentEmail: emailContent, tone }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Tone rewrite failed' }));
        toast.error(err.error || 'Failed to rewrite tone');
        setIsRewritingTone(false);
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
            if (content) { full += content; onUpdateEmail(emailKey, full); }
          } catch { /* partial */ }
        }
      }
      toast.success(`Rewritten in ${tone} tone`);
    } catch { toast.error('Failed to rewrite tone'); }
    setIsRewritingTone(false);
  };

  const generateSubjectLines = async () => {
    if (isLoadingSubjects || !emailContent) return;
    setIsLoadingSubjects(true);
    setShowSubjectLines(true);
    setSubjectLines([]);
    try {
      const resp = await fetch(SMART_DRAFT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          action: 'subject_lines',
          currentEmail: emailContent,
          tenantName, industry, buildingName, sqft, leaseExpiration, outreachReason,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Failed' }));
        toast.error(err.error || 'Failed to generate subject lines');
        setShowSubjectLines(false);
        setIsLoadingSubjects(false);
        return;
      }
      const data = await resp.json();
      setSubjectLines(data.subjects || []);
    } catch {
      toast.error('Failed to generate subject lines');
      setShowSubjectLines(false);
    }
    setIsLoadingSubjects(false);
  };

  const selectSubject = (subj: string) => {
    setSelectedSubject(subj);
    setShowSubjectLines(false);
    toast.success('Subject line selected');
  };

  const generateABVariant = useCallback(async () => {
    if (isGeneratingAB || !emailContent) return;
    setIsGeneratingAB(true);
    setShowABVariant(true);
    setAbVariant('');

    try {
      const resp = await fetch(SMART_OUTREACH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          action: 'ab_variant',
          currentEmail: emailContent,
          tenantName,
          industry,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || 'Failed to generate variant');
        setShowABVariant(false);
        setIsGeneratingAB(false);
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
            if (content) { full += content; setAbVariant(full); }
          } catch { /* partial */ }
        }
      }
      toast.success('A/B variant generated');
    } catch { toast.error('Failed to generate variant'); setShowABVariant(false); }
    setIsGeneratingAB(false);
  }, [isGeneratingAB, emailContent, tenantName, industry]);

  const useVariant = () => {
    onUpdateEmail(emailKey, abVariant);
    setShowABVariant(false);
    setAbVariant('');
    toast.success('Switched to variant B');
  };

  const actionButtonsDisabled = isGenerating || isRefining || isRewritingTone || isGeneratingAB;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="overflow-hidden"
    >
      <div className="mt-1 rounded-md border border-primary/20 bg-card p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-primary flex items-center gap-1">
            <Mail className="h-3 w-3" /> {label}
            {(isGenerating || isRefining || isRewritingTone) && <Loader2 className="h-3 w-3 animate-spin" />}
            {activeTone && !isRewritingTone && (
              <span className="text-[9px] text-muted-foreground ml-1">
                ({tones.find(t => t.id === activeTone)?.icon} {activeTone})
              </span>
            )}
          </p>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {!actionButtonsDisabled && emailContent && !isEditing && (
              <>
                {/* Tone Selector */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowToneSelector(!showToneSelector); setShowRefine(false); }}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-colors ${showToneSelector ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}
                    title="Change tone"
                  >
                    <Type className="h-3 w-3" /> Tone
                  </button>
                  <AnimatePresence>
                    {showToneSelector && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-border bg-card shadow-lg overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-1">
                          {tones.map(tone => (
                            <button
                              key={tone.id}
                              onClick={() => rewriteTone(tone.id)}
                              className={`w-full text-left rounded-md px-2.5 py-1.5 text-[10px] transition-colors hover:bg-secondary ${activeTone === tone.id ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                            >
                              <span className="font-medium">{tone.icon} {tone.label}</span>
                              <span className="block text-[9px] text-muted-foreground">{tone.desc}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Subject Line Generator */}
                <button
                  onClick={(e) => { e.stopPropagation(); generateSubjectLines(); }}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-colors ${showSubjectLines ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}
                  title="Generate subject lines"
                  disabled={isLoadingSubjects}
                >
                  {isLoadingSubjects ? <Loader2 className="h-3 w-3 animate-spin" /> : <Hash className="h-3 w-3" />}
                  Subject
                </button>

                {/* A/B Variant */}
                <button
                  onClick={(e) => { e.stopPropagation(); generateABVariant(); }}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-colors ${showABVariant ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}
                  title="Generate A/B variant"
                  disabled={isGeneratingAB}
                >
                  {isGeneratingAB ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlipHorizontal className="h-3 w-3" />}
                  A/B
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); startEditing(); }}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary"
                  title="Edit email"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRefine(!showRefine); setShowToneSelector(false); }}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-colors ${showRefine ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary'}`}
                  title="Refine with AI"
                >
                  <Sparkles className="h-3 w-3" /> Refine
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); copyEmail(); }}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary"
                >
                  {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {recipients && recipients.length > 0 ? (
                  <RecipientPicker
                    recipients={recipients}
                    onSend={(emails) => openInEmailClient(emails)}
                  />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); openInEmailClient(); }}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-primary-foreground bg-primary hover:bg-primary/90"
                    title={contactEmail ? `Send to ${contactEmail}` : 'Open in email client'}
                  >
                    <Send className="h-3 w-3" /> Send
                  </button>
                )}
              </>
            )}
            {isEditing && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-primary hover:bg-primary/10"
                >
                  <Check className="h-3 w-3" /> Save
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
              </>
            )}
            {!isEditing && (
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss ? onDismiss() : onClose(); }}
                className="rounded p-0.5 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Displayed Subject Line (extracted from AI or manually selected) */}
        {(selectedSubject || parsedSubject) && !isEditing && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-primary/5 border border-primary/20 px-2.5 py-1.5">
            <Hash className="h-3 w-3 text-primary shrink-0" />
            <span className="text-[10px] font-medium text-foreground flex-1 truncate">{selectedSubject || parsedSubject}</span>
            {selectedSubject && (
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedSubject(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )}

        {/* Subject Line Options */}
        <AnimatePresence>
          {showSubjectLines && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-2"
            >
              <div className="rounded-md border border-border bg-secondary/20 p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3 text-primary" /> Subject Line Options
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowSubjectLines(false); }}
                    className="rounded p-0.5 text-muted-foreground hover:bg-secondary"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
                {isLoadingSubjects ? (
                  <div className="flex items-center gap-2 py-3 justify-center">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="text-[10px] text-muted-foreground">Generating subject lines...</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {subjectLines.map((subj, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); selectSubject(subj); }}
                        className="w-full text-left rounded-md px-2.5 py-1.5 text-[10px] text-foreground hover:bg-primary/10 hover:text-primary transition-colors border border-transparent hover:border-primary/20"
                      >
                        {subj}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* A/B Variant Panel */}
        <AnimatePresence>
          {showABVariant && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-2"
            >
              <div className="rounded-md border border-border bg-secondary/20 p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-foreground flex items-center gap-1">
                    <FlipHorizontal className="h-3 w-3 text-primary" /> A/B Variant
                  </p>
                  <div className="flex items-center gap-1">
                    {abVariant && !isGeneratingAB && (
                      <button
                        onClick={(e) => { e.stopPropagation(); useVariant(); }}
                        className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-primary-foreground bg-primary hover:bg-primary/90"
                      >
                        Use This Version
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowABVariant(false); }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-secondary"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
                {isGeneratingAB ? (
                  <div className="text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {abVariant || 'Generating alternative version...'}
                  </div>
                ) : (
                  <div className="text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {abVariant}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Refine Input */}
        {showRefine && !isEditing && (
          <div className="mb-2 flex gap-1.5">
            <input
              type="text"
              value={refineInput}
              onChange={(e) => setRefineInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && refineWithAI()}
              placeholder="e.g. Make it shorter, more casual, add urgency..."
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
              disabled={isRefining}
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => { e.stopPropagation(); refineWithAI(); }}
              disabled={!refineInput.trim() || isRefining}
              className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
            >
              {isRefining ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </button>
          </div>
        )}

        {/* Email Content */}
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="w-full min-h-[150px] rounded-md border border-primary/30 bg-background p-2 text-[11px] leading-relaxed text-foreground/90 resize-y focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        ) : (
          <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/90">
            {displayBody || (isGenerating ? 'Generating...' : '')}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default EmailDisplay;
