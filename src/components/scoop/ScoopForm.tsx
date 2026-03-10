import { useState } from 'react';
import { Send, X, Tag, Building2, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORY_OPTIONS } from './ScoopCategoryBadge';
import type { ScoopCategory } from '@/hooks/useScoops';
import { buildings } from '@/data/mockData';

interface Props {
  onSubmit: (data: {
    content: string;
    category: ScoopCategory;
    tags: string[];
    author_name: string;
    author_avatar: string;
    linked_tenant_name?: string;
    linked_building_name?: string;
  }) => Promise<boolean>;
  onCancel: () => void;
}

const ScoopForm = ({ onSubmit, onCancel }: Props) => {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<ScoopCategory>('general');
  const [tagsInput, setTagsInput] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [linkedBuilding, setLinkedBuilding] = useState('');
  const [linkedTenant, setLinkedTenant] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Get all tenants across buildings for linking
  const allTenants = buildings.flatMap(b => b.tenants.map(t => ({ name: t.name, building: b.name })));
  const uniqueTenants = [...new Map(allTenants.map(t => [t.name, t])).values()];

  const handleSubmit = async () => {
    if (!content.trim() || !authorName.trim()) return;
    setSubmitting(true);
    const avatar = authorName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    const ok = await onSubmit({
      content: content.trim(),
      category,
      tags,
      author_name: authorName.trim(),
      author_avatar: avatar,
      linked_tenant_name: linkedTenant || undefined,
      linked_building_name: linkedBuilding || undefined,
    });
    setSubmitting(false);
    if (ok) onCancel();
  };

  return (
    <Card className="border-primary/30 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">New Scoop</p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <Input
        placeholder="Your name *"
        value={authorName}
        onChange={e => setAuthorName(e.target.value)}
        className="border-border bg-secondary/50 text-sm h-9"
      />

      <Textarea
        placeholder="What are you hearing in the market? *"
        value={content}
        onChange={e => setContent(e.target.value)}
        className="min-h-[80px] border-border bg-secondary/50 text-sm placeholder:text-muted-foreground"
      />

      <div className="grid grid-cols-2 gap-3">
        <Select value={category} onValueChange={v => setCategory(v as ScoopCategory)}>
          <SelectTrigger className="border-border bg-secondary/50 text-sm h-9">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Tag className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Tags (comma separated)"
            value={tagsInput}
            onChange={e => setTagsInput(e.target.value)}
            className="pl-8 border-border bg-secondary/50 text-sm h-9"
          />
        </div>
      </div>

      {/* Link to building/tenant */}
      <div className="grid grid-cols-2 gap-3">
        <Select value={linkedBuilding} onValueChange={setLinkedBuilding}>
          <SelectTrigger className="border-border bg-secondary/50 text-sm h-9">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span className={linkedBuilding ? 'text-foreground' : ''}>{linkedBuilding || 'Link building'}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {buildings.map(b => (
              <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={linkedTenant} onValueChange={setLinkedTenant}>
          <SelectTrigger className="border-border bg-secondary/50 text-sm h-9">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span className={linkedTenant ? 'text-foreground' : ''}>{linkedTenant || 'Link tenant'}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {uniqueTenants.map(t => (
              <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={!content.trim() || !authorName.trim() || submitting}>
          <Send className="mr-1.5 h-3.5 w-3.5" /> {submitting ? 'Posting…' : 'Share Scoop'}
        </Button>
      </div>
    </Card>
  );
};

export default ScoopForm;
