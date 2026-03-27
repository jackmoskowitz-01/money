import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const SESSION_KEY = 'email_capture_shown';

const BULLET_POINTS = [
  '6 ready-to-send email templates for tenant rep brokers',
  'Subject line variants for A/B testing',
  'Complete follow-up sequences with timing',
  'Personalization framework for 2-minute customization',
];

interface EmailCapturePopupProps {
  inline?: boolean;
}

function CaptureContent({ onSubmit, submitted }: { onSubmit: (email: string) => void; submitted: boolean }) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      onSubmit(email.trim());
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 py-6 text-center"
      >
        <CheckCircle2 className="h-12 w-12 text-primary" />
        <p className="text-lg font-semibold text-foreground">Check your inbox!</p>
        <p className="text-sm text-muted-foreground">
          Your templates are on the way. While you wait, check out more insights on the{' '}
          <a href="/blog" className="text-primary underline underline-offset-4 hover:opacity-80">
            blog
          </a>
          .
        </p>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-xl font-bold text-foreground">
          7 Cold Email Templates That Book Meetings With Tenants
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Battle-tested outreach templates built specifically for tenant rep brokers.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {BULLET_POINTS.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="pl-9"
          />
        </div>
        <Button type="submit" className="shrink-0">
          Send Me the Templates
        </Button>
      </form>
    </div>
  );
}

export default function EmailCapturePopup({ inline = false }: EmailCapturePopupProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback((email: string) => {
    // In a real implementation, send email to your backend/API
    console.log('Email captured:', email);
    setSubmitted(true);
  }, []);

  // Popup trigger logic (only for non-inline mode)
  useEffect(() => {
    if (inline) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    let triggered = false;

    const trigger = () => {
      if (triggered) return;
      triggered = true;
      sessionStorage.setItem(SESSION_KEY, 'true');
      setOpen(true);
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };

    // Timer: 30 seconds
    const timer = setTimeout(trigger, 30_000);

    // Scroll: 50% of page
    const onScroll = () => {
      const scrollPercent =
        window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      if (scrollPercent >= 0.5) {
        trigger();
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [inline]);

  // Inline mode: render content directly in a styled card
  if (inline) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4 }}
        className="rounded-lg border border-border bg-card p-6 sm:p-8"
      >
        <CaptureContent onSubmit={handleSubmit} submitted={submitted} />
      </motion.section>
    );
  }

  // Popup mode: render inside a Dialog
  return (
    <AnimatePresence>
      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent asChild>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg border border-border bg-background p-6 shadow-lg"
            >
              <DialogHeader className="sr-only">
                <DialogTitle>Email Templates</DialogTitle>
                <DialogDescription>
                  Sign up to receive cold email templates for tenant rep brokers.
                </DialogDescription>
              </DialogHeader>
              <CaptureContent onSubmit={handleSubmit} submitted={submitted} />
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
