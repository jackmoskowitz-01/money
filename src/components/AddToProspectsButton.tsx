import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { addCustomProspect } from '@/data/customProspects';
import { toast } from 'sonner';

interface AddToProspectsButtonProps {
  defaultName?: string;
  defaultSource?: string;
  onAdded?: () => void;
  variant?: 'icon' | 'button';
}

const industries = [
  'Law Firm',
  'Consulting',
  'Technology',
  'Government',
  'Nonprofit',
  'Financial Services',
  'Other',
];

const AddToProspectsButton = ({
  defaultName = '',
  defaultSource = 'manual',
  onAdded,
  variant = 'button',
}: AddToProspectsButtonProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [industry, setIndustry] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [sfNeed, setSfNeed] = useState('');

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setName(defaultName);
      setIndustry('');
      setContactName('');
      setContactEmail('');
      setSfNeed('');
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Company name is required');
      return;
    }

    addCustomProspect({
      name: name.trim(),
      website: '',
      address: '',
      source: defaultSource,
      enrichment: industry ? {
        industry,
        employeeCount: null,
        companySize: null,
        headquarters: null,
        officeLocations: [],
        description: null,
        recentNews: [],
        spaceDetails: {
          currentSqft: sfNeed || null,
          buildingName: null,
          leaseExpiration: null,
        },
        creSignals: [],
        confidenceScore: 0,
        enrichedAt: new Date().toISOString(),
        citations: [],
        ...(contactName || contactEmail ? {
          keyContacts: [{
            name: contactName || '',
            title: '',
            relevance: contactEmail || '',
          }],
        } : {}),
      } : undefined,
    });

    toast.success('Added to prospects');
    setOpen(false);
    onAdded?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {variant === 'icon' ? (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Add to Prospects">
            <UserPlus className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
            <UserPlus className="h-3.5 w-3.5" /> Add to Prospects
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground text-sm">Add to Prospects</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Company Name *</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Company name"
              className="border-border bg-secondary/50 text-xs h-8"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Industry</label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="border-border bg-secondary/50 text-xs h-8">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {industries.map(ind => (
                  <SelectItem key={ind} value={ind} className="text-xs">{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Contact Name</label>
            <Input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Optional"
              className="border-border bg-secondary/50 text-xs h-8"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Contact Email</label>
            <Input
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="Optional"
              type="email"
              className="border-border bg-secondary/50 text-xs h-8"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-muted-foreground">SF Need</label>
            <Input
              value={sfNeed}
              onChange={e => setSfNeed(e.target.value)}
              placeholder="Optional"
              type="number"
              className="border-border bg-secondary/50 text-xs h-8"
            />
          </div>
          <Button size="sm" className="w-full text-xs h-8" onClick={handleSubmit}>
            Add Prospect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddToProspectsButton;
