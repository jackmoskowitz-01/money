import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { addActivity } from '@/data/activityData';
import { toast } from 'sonner';

interface LogActivityButtonProps {
  tenantId: string;
  buildingId: string;
  prospectName: string;
  variant?: 'icon' | 'button';
}

const activityTypes = [
  { value: 'call', label: 'Call' },
  { value: 'email_sent', label: 'Email Sent' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
] as const;

type ActivityTypeValue = typeof activityTypes[number]['value'];

const titleForType = (type: ActivityTypeValue, prospectName: string) => {
  switch (type) {
    case 'call': return `Call with ${prospectName}`;
    case 'email_sent': return `Email to ${prospectName}`;
    case 'meeting': return `Meeting with ${prospectName}`;
    case 'note': return `Note about ${prospectName}`;
    default: return `Activity — ${prospectName}`;
  }
};

const LogActivityButton = ({
  tenantId,
  buildingId,
  prospectName,
  variant = 'button',
}: LogActivityButtonProps) => {
  const [open, setOpen] = useState(false);
  const [activityType, setActivityType] = useState<ActivityTypeValue>('call');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setActivityType('call');
      setDescription('');
    }
  };

  const handleSubmit = async () => {
    if (!activityType) return;
    setSubmitting(true);

    const title = titleForType(activityType, prospectName);

    // Save to localStorage via addActivity
    addActivity({
      tenantId,
      buildingId,
      type: activityType,
      title,
      description: description.trim(),
    });

    // Also try Supabase insert
    await supabase.from('activities').insert({
      tenant_id: tenantId,
      building_id: buildingId,
      type: activityType,
      title,
      description: description.trim(),
      timestamp: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.error('Activity DB insert error:', error);
    });

    toast.success('Activity logged');
    setSubmitting(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {variant === 'icon' ? (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Log Activity">
            <ClipboardList className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
            <ClipboardList className="h-3.5 w-3.5" /> Log Activity
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground text-sm">Log Activity — {prospectName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Activity Type</label>
            <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityTypeValue)}>
              <SelectTrigger className="border-border bg-secondary/50 text-xs h-8">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
              Title: {titleForType(activityType, prospectName)}
            </label>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add details..."
              className="border-border bg-secondary/50 text-xs min-h-[80px]"
            />
          </div>
          <Button
            size="sm"
            className="w-full text-xs h-8"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Log Activity'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LogActivityButton;
