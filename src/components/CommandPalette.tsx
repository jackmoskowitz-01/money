import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, Globe } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";

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
  const [dbProspects, setDbProspects] = React.useState<any[]>([]);

  // Fetch prospects from Supabase when palette opens
  React.useEffect(() => {
    if (!open) return;
    supabase
      .from("prospects")
      .select("id, company_name, website_url, address")
      .order("created_at", { ascending: false })
      .then(({ data }) => setDbProspects(data || []));
  }, [open]);

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

  const prospects = React.useMemo<ProspectResult[]>(() => {
    const results: ProspectResult[] = [];

    // Prospects from Supabase (the new prospects table)
    dbProspects.forEach((p) => {
      results.push({
        label: p.company_name,
        subtitle: [p.address, p.website_url].filter(Boolean).join(" · ") || "Prospect",
        path: `/prospect/${p.id}`,
        icon: <Globe className="mr-2 h-4 w-4 shrink-0" />,
      });
    });

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

    // Pipeline deals (manual prospects)
    pipeline.forEach((deal) => {
      if (deal.isManual && deal.prospectCompany) {
        results.push({
          label: deal.prospectCompany,
          subtitle: `${deal.prospectName || ""} · ${deal.prospectSqft ? deal.prospectSqft.toLocaleString() + " SF" : "Pipeline"} · ${deal.stage.replace(/_/g, " ")}`,
          path: `/prospect/${deal.tenantId}`,
          icon: <Users className="mr-2 h-4 w-4 shrink-0" />,
        });
      }
    });

    return results;
  }, [pipeline, dbProspects]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search prospects and accounts..." />
      <CommandList>
        <CommandEmpty>No matching prospects found.</CommandEmpty>

        <CommandGroup heading="Prospects & Accounts">
          {prospects.map((p, i) => (
            <CommandItem
              key={`${p.path}-${i}`}
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
