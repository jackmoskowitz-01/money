import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Building2, Calendar, ChevronDown, DollarSign, FileText, Key, Users } from 'lucide-react';
import type { LeaseAbstract, OptionEntry } from '@/hooks/useLeaseAbstracts';

interface LeaseAbstractViewerProps {
  abstract: LeaseAbstract;
}

function formatCurrency(val: number | null | undefined) {
  if (val === null || val === undefined) return '--';
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(val: string | null | undefined) {
  if (!val) return '--';
  try {
    return new Date(val + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return val;
  }
}

function CompletenessBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor = score >= 80 ? 'text-green-700' : score >= 50 ? 'text-yellow-700' : 'text-red-700';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-medium ${textColor}`}>{score}%</span>
    </div>
  );
}

function OptionCard({ title, options }: { title: string; options: OptionEntry[] }) {
  if (!options || options.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
      {options.map((opt, i) => (
        <Card key={i} className="p-3 bg-muted/30">
          {opt.type && <div className="text-[13px] font-medium">{opt.type}</div>}
          {opt.notice_period && (
            <div className="text-xs text-muted-foreground mt-1">Notice: {opt.notice_period}</div>
          )}
          {opt.terms && <div className="text-xs text-muted-foreground mt-1">{opt.terms}</div>}
        </Card>
      ))}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  const display = value === null || value === undefined || value === '' ? '--' : String(value);
  return (
    <div className="flex justify-between items-baseline py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-[13px] font-medium text-right max-w-[60%]">{display}</span>
    </div>
  );
}

export default function LeaseAbstractViewer({ abstract: a }: LeaseAbstractViewerProps) {
  const [rawOpen, setRawOpen] = useState(false);

  const leaseTypeBadge = a.lease_type || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{a.tenant_name || 'Unknown Tenant'}</h2>
            {leaseTypeBadge && (
              <Badge variant="secondary" className="text-xs">{leaseTypeBadge}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span>{a.building_name || 'Unknown Building'}</span>
            {a.building_address && (
              <>
                <span className="mx-1">|</span>
                <span>{a.building_address}</span>
              </>
            )}
          </div>
        </div>
        <CompletenessBar score={a.completeness_score} />
      </div>

      <Separator />

      {/* Key Terms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Premises & Term</h3>
          <DataRow label="Square Footage" value={a.premises_sf ? `${a.premises_sf.toLocaleString()} RSF` : null} />
          <DataRow label="Floor / Suite" value={a.floor_suite} />
          <DataRow label="Commencement" value={formatDate(a.commencement_date)} />
          <DataRow label="Expiration" value={formatDate(a.expiration_date)} />
          <DataRow label="Term" value={a.term_months ? `${a.term_months} months` : null} />
          <DataRow label="Landlord" value={a.landlord_name} />
        </div>

        {/* Right Column */}
        <div className="space-y-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Economics</h3>
          <DataRow label="Base Rent" value={a.base_rent_psf ? `${formatCurrency(a.base_rent_psf)} /SF` : null} />
          <DataRow label="Escalation" value={a.escalation_type ? `${a.escalation_type}${a.escalation_rate ? ` (${a.escalation_rate}%)` : ''}` : null} />
          <DataRow label="Free Rent" value={a.free_rent_months ? `${a.free_rent_months} months` : null} />
          <DataRow label="TI Allowance" value={a.ti_allowance_psf ? `${formatCurrency(a.ti_allowance_psf)} /SF` : null} />
          <DataRow label="Parking Spaces" value={a.parking_spaces} />
          <DataRow label="Parking Rate" value={a.parking_rate ? `${formatCurrency(a.parking_rate)} /mo` : null} />
        </div>
      </div>

      {/* Rent Schedule */}
      {a.rent_schedule && a.rent_schedule.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rent Schedule</h3>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Year</TableHead>
                  <TableHead className="text-xs text-right">Annual Rent/SF</TableHead>
                  <TableHead className="text-xs text-right">Monthly Rent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.rent_schedule.map((entry, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[13px]">Year {entry.year}</TableCell>
                    <TableCell className="text-[13px] text-right">{formatCurrency(entry.annual_rent_psf)}</TableCell>
                    <TableCell className="text-[13px] text-right">{formatCurrency(entry.monthly_rent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      <Separator />

      {/* Options */}
      {(a.renewal_options?.length > 0 || a.expansion_options?.length > 0 || a.termination_options?.length > 0) && (
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Options</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OptionCard title="Renewal" options={a.renewal_options} />
            <OptionCard title="Expansion" options={a.expansion_options} />
            <OptionCard title="Termination" options={a.termination_options} />
          </div>
        </div>
      )}

      {/* Other Terms */}
      {(a.operating_expenses || a.security_deposit || a.assignment_subletting) && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Other Terms</h3>
          <div className="space-y-3">
            {a.operating_expenses && (
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Operating Expenses</div>
                <div className="text-[13px]">{a.operating_expenses}</div>
              </div>
            )}
            {a.security_deposit && (
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Security Deposit</div>
                <div className="text-[13px]">{a.security_deposit}</div>
              </div>
            )}
            {a.assignment_subletting && (
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Assignment & Subletting</div>
                <div className="text-[13px]">{a.assignment_subletting}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notable Clauses */}
      {a.notable_clauses && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notable Clauses</h3>
          <Card className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50">
            <div className="text-[13px]">{a.notable_clauses}</div>
          </Card>
        </div>
      )}

      {/* Raw Abstract */}
      <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <FileText className="h-3.5 w-3.5" />
          <span>View Raw Abstract</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${rawOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card className="p-4 max-h-96 overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">{a.raw_abstract || 'No raw abstract available'}</pre>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
