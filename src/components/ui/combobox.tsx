import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Optional class names applied to the label inside the dropdown item */
  badgeClassName?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Extra classes on the trigger button */
  triggerClassName?: string;
  /** Extra classes on the popover content */
  contentClassName?: string;
  /** Render a custom trigger label instead of plain text */
  renderTriggerLabel?: (selected: ComboboxOption | undefined) => React.ReactNode;
  /** Render a custom item label in the dropdown */
  renderOptionLabel?: (option: ComboboxOption) => React.ReactNode;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found.',
  triggerClassName,
  contentClassName,
  renderTriggerLabel,
  renderOptionLabel,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find(o => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'justify-between font-normal',
            !value && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          {renderTriggerLabel
            ? renderTriggerLabel(selected)
            : (selected?.label ?? placeholder)}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('p-0', contentClassName)}
        align="start"
        // Prevent the popover from stealing the card's click handler
        onOpenAutoFocus={e => e.preventDefault()}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="py-4 text-xs">{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map(option => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  <Check
                    className={cn(
                      'mr-2 h-3.5 w-3.5 shrink-0',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {renderOptionLabel
                    ? renderOptionLabel(option)
                    : (
                      <span className={option.badgeClassName}>{option.label}</span>
                    )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
