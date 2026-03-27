import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { buildings } from "@/data/mockData";
import { usePipeline } from "@/hooks/usePipeline";

interface ProspectResult {
  label: string;
  subtitle: string;
  path: string;
  icon: React.ReactNode;
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { pipeline } = usePipeline();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Build searchable list of all prospects/accounts
  const prospects = React.useMemo<ProspectResult[]>(() => {
    const results: ProspectResult[] = [];

    // Tenants from buildings (mock data)
    buildings.forEach((b) => {
      b.tenants.forEach((t) => {
        results.push({
          label: t.name,
          subtitle: `${b.name} · ${t.sqft.toLocaleString()} SF · ${t.industry}`,
          path: `/building/${b.id}/tenant/${t.id}`,
          icon: <Building2 className="mr-2 h-4 w-4 shrink-0" />,
        });
      });
    });

    // Pipeline deals (manual prospects from Supabase)
    pipeline.forEach((deal) => {
      if (deal.isManual && deal.prospectCompany) {
        results.push({
          label: deal.prospectCompany,
          subtitle: `${deal.prospectName || ''} · ${deal.prospectSqft ? deal.prospectSqft.toLocaleString() + ' SF' : 'Pipeline'} · ${deal.stage.replace(/_/g, ' ')}`,
          path: `/prospect/${deal.tenantId}`,
          icon: <Users className="mr-2 h-4 w-4 shrink-0" />,
        });
      }
    });

    return results;
  }, [pipeline]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search prospects and accounts..." />
      <CommandList>
        <CommandEmpty>No matching prospects found.</CommandEmpty>

        <CommandGroup heading="Prospects & Accounts">
          {prospects.map((p) => (
            <CommandItem
              key={p.path}
              value={`${p.label} ${p.subtitle}`}
              onSelect={() => {
                setOpen(false);
                navigate(p.path);
              }}
            >
              {p.icon}
              <div className="flex flex-col">
                <span>{p.label}</span>
                <span className="text-xs text-muted-foreground">{p.subtitle}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
