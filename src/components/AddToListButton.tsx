import { useState } from 'react';
import { ListPlus, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getProspectLists, createProspectList, addProspectsToList } from '@/data/prospectLists';
import { toast } from 'sonner';

interface Props {
  tenantId: string;
  buildingId: string;
  tenantName: string;
}

const AddToListButton = ({ tenantId, buildingId, tenantName }: Props) => {
  const [open, setOpen] = useState(false);
  const [newListName, setNewListName] = useState('');

  const lists = getProspectLists();

  const isInList = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    return list?.entries.some(e => e.tenantId === tenantId) || false;
  };

  const handleAdd = (listId: string) => {
    const added = addProspectsToList(listId, [{ tenantId, buildingId, tenantName }]);
    if (added > 0) {
      const list = lists.find(l => l.id === listId);
      toast.success(`Added to "${list?.name}"`);
    } else {
      toast.info('Already in this list');
    }
    setOpen(false);
  };

  const handleCreateAndAdd = () => {
    if (!newListName.trim()) return;
    const list = createProspectList(newListName.trim());
    addProspectsToList(list.id, [{ tenantId, buildingId, tenantName }]);
    toast.success(`Created "${list.name}" and added prospect`);
    setNewListName('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs h-8">
          <ListPlus className="mr-1.5 h-3.5 w-3.5" /> Add to List
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Add to List
        </p>
        {lists.length > 0 ? (
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {lists.map(list => {
              const alreadyIn = isInList(list.id);
              return (
                <button
                  key={list.id}
                  onClick={() => !alreadyIn && handleAdd(list.id)}
                  disabled={alreadyIn}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${
                    alreadyIn
                      ? 'text-muted-foreground opacity-50'
                      : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  <span className="truncate">{list.name}</span>
                  {alreadyIn ? (
                    <Check className="h-3 w-3 text-success shrink-0" />
                  ) : (
                    <Badge variant="outline" className="text-[9px] shrink-0">{list.entries.length}</Badge>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="px-2 py-2 text-[11px] text-muted-foreground">No lists yet</p>
        )}
        <div className="border-t border-border pt-1.5 mt-1.5">
          <div className="flex gap-1">
            <input
              type="text"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateAndAdd()}
              placeholder="New list name..."
              className="flex-1 rounded-md border border-border bg-secondary/50 px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <Button size="sm" className="text-[10px] h-6 px-2" onClick={handleCreateAndAdd} disabled={!newListName.trim()}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AddToListButton;
