import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Send, X, ChevronRight, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { addActivity } from '@/data/activityData';
import RecipientPicker, { type EmailRecipient } from '@/components/RecipientPicker';
import {
  emailTemplates,
  categoryLabels,
  categoryColors,
  fillTemplate,
  type EmailTemplateCategory,
} from '@/data/emailTemplates';

interface EmailComposerProps {
  tenantId: string;
  buildingId: string;
  tenantName: string;
  contactName: string;
  contactEmail?: string;
  buildingName: string;
  submarket?: string;
  sqft?: number;
  leaseExpiration?: string;
  floor?: string;
  brokerName?: string;
  recipients?: EmailRecipient[];
}

const categories: EmailTemplateCategory[] = ['cold_outreach', 'follow_up', 'tour_confirmation', 'check_in', 'market_update'];

const EmailComposer = ({
  tenantId,
  buildingId,
  tenantName,
  contactName,
  contactEmail,
  buildingName,
  submarket = 'DC',
  sqft = 0,
  leaseExpiration = '',
  floor = '',
  brokerName = '[Your Name]',
  recipients,
}: EmailComposerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<EmailTemplateCategory | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editableSubject, setEditableSubject] = useState('');
  const [editableBody, setEditableBody] = useState('');
  const [copied, setCopied] = useState(false);

  const contactFirstName = contactName.split(' ')[0];

  const templateVars: Record<string, string> = {
    contactFirstName,
    contactName,
    tenantName,
    buildingName,
    submarket,
    sqft: sqft ? sqft.toLocaleString() : '',
    leaseExpiration,
    floor,
    brokerName,
    buildingAddress: buildingName,
    tourDate: '[Date]',
    tourTime: '[Time]',
  };

  const filteredTemplates = useMemo(() => {
    if (!selectedCategory) return emailTemplates;
    return emailTemplates.filter(t => t.category === selectedCategory);
  }, [selectedCategory]);

  const selectTemplate = (templateId: string) => {
    const template = emailTemplates.find(t => t.id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    setEditableSubject(fillTemplate(template.subject, templateVars));
    setEditableBody(fillTemplate(template.body, templateVars));
  };

  const handleSendEmail = (toEmails?: string[]) => {
    const to = toEmails ? toEmails.join(',') : (contactEmail || '');
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(editableSubject)}&body=${encodeURIComponent(editableBody)}`;
    window.open(mailto, '_blank');

    // Log activity
    addActivity({
      tenantId,
      buildingId,
      type: 'email_sent',
      title: `Email sent: ${editableSubject}`,
      description: `Template email sent to ${contactName} (${contactEmail || 'no email'})`,
    });

    toast.success('Opening email client...');
    handleClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${editableSubject}\n\n${editableBody}`);
    setCopied(true);
    toast.success('Email copied to clipboard');

    addActivity({
      tenantId,
      buildingId,
      type: 'email_sent',
      title: `Email drafted: ${editableSubject}`,
      description: `Template email copied for ${contactName}`,
    });

    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedCategory(null);
    setSelectedTemplateId(null);
    setEditableSubject('');
    setEditableBody('');
  };

  const goBack = () => {
    setSelectedTemplateId(null);
    setEditableSubject('');
    setEditableBody('');
  };

  return (
    <div>
      <Button
        size="sm"
        variant="default"
        className="text-xs h-9 shadow-sm hover:shadow-md transition-shadow"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Mail className="mr-1.5 h-4 w-4" /> Email Templates
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-lg border border-border bg-card">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  {selectedTemplateId ? 'Edit & Send' : 'Choose a Template'}
                </p>
                <button onClick={handleClose} className="rounded p-0.5 hover:bg-secondary">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>

              {!selectedTemplateId ? (
                <>
                  {/* Category Filters */}
                  <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-border bg-muted/30">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${
                        !selectedCategory ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20' : 'bg-background border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                      }`}
                    >
                      All Templates
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                        className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${
                          selectedCategory === cat ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20' : 'bg-background border border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                        }`}
                      >
                        {categoryLabels[cat]}
                      </button>
                    ))}
                  </div>

                  {/* Template List */}
                  <div className="max-h-[320px] overflow-y-auto p-3 space-y-1">
                    {filteredTemplates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => selectTemplate(template.id)}
                        className="w-full rounded-lg border border-border px-4 py-3 text-left transition-all hover:border-primary/30 hover:shadow-sm hover:bg-muted/20 group bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                {template.name}
                              </p>
                              <Badge className={`text-[10px] px-2 py-0.5 font-medium border-0 ${categoryColors[template.category]}`}>
                                {categoryLabels[template.category]}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{template.description}</p>
                          </div>
                          <div className="shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                /* Editor View */
                <div className="p-4 space-y-3">
                  <button
                    onClick={goBack}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1 mb-1"
                  >
                    ← Back to templates
                  </button>

                  {/* Subject */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Subject</label>
                    <input
                      type="text"
                      value={editableSubject}
                      onChange={e => setEditableSubject(e.target.value)}
                      className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>

                  {/* To */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">To</label>
                    <p className="text-xs text-foreground">
                      {contactName} {contactEmail ? `<${contactEmail}>` : <span className="text-muted-foreground">(no email on file)</span>}
                    </p>
                  </div>

                  {/* Body */}
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Body</label>
                    <textarea
                      value={editableBody}
                      onChange={e => setEditableBody(e.target.value)}
                      className="w-full min-h-[200px] rounded-md border border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-y"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    {recipients && recipients.length > 0 ? (
                      <RecipientPicker
                        recipients={recipients}
                        onSend={(emails) => handleSendEmail(emails)}
                      />
                    ) : (
                      <Button size="sm" className="text-xs h-8" onClick={() => handleSendEmail()}>
                        <Send className="mr-1 h-3 w-3" /> Send via Email Client
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs h-8" onClick={handleCopy}>
                      {copied ? <Check className="mr-1 h-3 w-3 text-success" /> : <Copy className="mr-1 h-3 w-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-8" onClick={handleClose}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmailComposer;
