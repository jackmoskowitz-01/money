import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mail, Copy, Check, X, Loader2, Pencil, Sparkles, Send } from 'lucide-react';
import { toast } from 'sonner';
import RecipientPicker, { type EmailRecipient } from '@/components/RecipientPicker';

const REFINE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refine-email`;

interface EmailDisplayProps {
  emailKey: string;
  emailContent: string;
  isGenerating: boolean;
  label?: string;
  contactName?: string;
  contactEmail?: string;
  subject?: string;
  recipients?: EmailRecipient[];
  onClose: () => void;
  onDismiss?: () => void;
  onUpdateEmail: (key: string, content: string) => void;
}

const EmailDisplay = ({ emailKey, emailContent, isGenerating, label = 'Generated Email', contactName, contactEmail, subject, recipients, onClose, onDismiss, onUpdateEmail }: EmailDisplayProps) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const copyEmail = () => {
    navigator.clipboard.writeText(emailContent);
    setCopied(true);
    toast.success('Email copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const openInEmailClient = () => {
    const to = contactEmail || '';
    const subj = subject || (label ? `Re: ${label}` : '');
    // Strip leading Subject: line from body to avoid duplication
    let body = emailContent;
    const subjectLineMatch = body.match(/^Subject:\s*[^\n]*\n*/i);
    if (subjectLineMatch) {
      body = body.slice(subjectLineMatch[0].length).trimStart();
    }
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
    toast.success('Opening email client...');
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
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          currentEmail: emailContent,
          instruction: refineInput.trim(),
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Refinement failed' }));
        toast.error(err.error || 'Failed to refine email');
        setIsRefining(false);
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
              onUpdateEmail(emailKey, full);
            }
          } catch { /* partial */ }
        }
      }

      setRefineInput('');
      setShowRefine(false);
      toast.success('Email refined');
    } catch {
      toast.error('Failed to refine email');
    }
    setIsRefining(false);
  };

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
            {(isGenerating || isRefining) && <Loader2 className="h-3 w-3 animate-spin" />}
          </p>
          <div className="flex items-center gap-1">
            {!isGenerating && !isRefining && emailContent && !isEditing && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); startEditing(); }}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary"
                  title="Edit email"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRefine(!showRefine); }}
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
                <button
                  onClick={(e) => { e.stopPropagation(); openInEmailClient(); }}
                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-primary-foreground bg-primary hover:bg-primary/90"
                  title={contactEmail ? `Send to ${contactEmail}` : 'Open in email client'}
                >
                  <Send className="h-3 w-3" /> Send
                </button>
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
            {emailContent || (isGenerating ? 'Generating...' : '')}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default EmailDisplay;
