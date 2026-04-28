import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { flexRender } from '@tanstack/react-table';
import {
  Search,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Mail,
  Kanban,
  Users,
  ChevronLeft,
  ChevronRight,
  Settings2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useProspectTable, type ProspectRow } from '@/hooks/useProspectTable';
import { stageLabels, stageColors, type PipelineStage } from '@/data/pipelineData';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─── Formatters ─────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays > 365) return `${Math.floor(diffDays / 365)}y ago`;
  if (diffDays > 30) return `${Math.floor(diffDays / 30)}mo ago`;
  if (diffDays > 0) return `${diffDays}d ago`;
  const diffHr = Math.floor(diffMs / 3_600_000);
  if (diffHr > 0) return `${diffHr}h ago`;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'just now';
}

function urgencyColor(urgency: 'high' | 'medium' | 'low'): string {
  switch (urgency) {
    case 'high': return 'bg-destructive/20 text-destructive';
    case 'medium': return 'bg-warning/20 text-warning';
    case 'low': return 'bg-info/20 text-info';
  }
}

// ─── Sort icon helper ────────────────────────────────────────────────────────

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') return <ArrowUp className="inline h-3 w-3 ml-1 shrink-0" />;
  if (direction === 'desc') return <ArrowDown className="inline h-3 w-3 ml-1 shrink-0" />;
  return <ChevronsUpDown className="inline h-3 w-3 ml-1 shrink-0 opacity-40" />;
}

// ─── Cell renderers ──────────────────────────────────────────────────────────

function CompanyCell({ row }: { row: ProspectRow }) {
  return (
    <div>
      <div className="text-sm font-medium text-foreground">{row.company}</div>
      <div className="text-xs text-muted-foreground">{row.buildingName}</div>
    </div>
  );
}

function ContactCell({ row }: { row: ProspectRow }) {
  return (
    <div>
      <div className="text-sm text-foreground">{row.contact || '-'}</div>
      <div className="text-xs text-muted-foreground">{row.contactTitle}</div>
    </div>
  );
}

function StageCell({ stage }: { stage: PipelineStage | null }) {
  if (!stage) return <span className="text-xs text-muted-foreground">-</span>;
  return <Badge className={stageColors[stage]}>{stageLabels[stage]}</Badge>;
}

function SignalsCell({ signals }: { signals: ProspectRow['signals'] }) {
  if (signals.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1 max-w-[200px]">
      {signals.slice(0, 3).map((signal, i) => (
        <Badge key={i} className={`${urgencyColor(signal.urgency)} text-[10px]`} title={signal.title}>
          {signal.urgency}
        </Badge>
      ))}
      {signals.length > 3 && (
        <span className="text-[10px] text-muted-foreground">+{signals.length - 3}</span>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

const ProspectTable = () => {
  const navigate = useNavigate();
  const {
    table,
    loading,
    globalFilter,
    setGlobalFilter,
    stageFilter,
    setStageFilter,
    industryFilter,
    setIndustryFilter,
    industries,
    stages,
    totalCount,
  } = useProspectTable();

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const rowsOnPage = table.getRowModel().rows;

  // All visible (post-filter) rows for select-all logic
  const allFilteredRowIds = table
    .getFilteredRowModel()
    .rows.map(r => r.id);

  function handleRowClick(row: ProspectRow) {
    if (row.source === 'mock') {
      navigate(`/building/${row.buildingId}/tenant/${row.tenantId}`);
    } else {
      navigate(`/prospect/${row.id}`);
    }
  }

  // Note: rows with source 'db' or 'custom' both navigate to /prospect/{id},
  // which is handled by CustomProspectDetail with dual-source loading.

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-semibold text-foreground">Prospects</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Track and manage all prospective tenants across your portfolio.
            </p>
          </div>

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            {/* Global search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies, contacts, buildings..."
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Stage filter */}
            <Select value={stageFilter} onValueChange={v => { setStageFilter(v); table.setPageIndex(0); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {stages.map(stage => (
                  <SelectItem key={stage} value={stage}>
                    {stageLabels[stage]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Industry filter */}
            <Select value={industryFilter} onValueChange={v => { setIndustryFilter(v); table.setPageIndex(0); }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {industries.map(ind => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Column visibility toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 shrink-0">
                  <Settings2 className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                  Toggle columns
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllColumns()
                  .filter(col => col.getCanHide())
                  .map(col => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      className="capitalize text-sm"
                      checked={col.getIsVisible()}
                      onCheckedChange={value => col.toggleVisibility(value)}
                    >
                      {typeof col.columnDef.header === 'string'
                        ? col.columnDef.header
                        : col.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Row count */}
          <div className="mb-3 text-sm text-muted-foreground">
            {totalCount} prospect{totalCount !== 1 ? 's' : ''}
            {table.getFilteredRowModel().rows.length !== totalCount && (
              <span> &mdash; {table.getFilteredRowModel().rows.length} matching search</span>
            )}
          </div>

          {/* Loading */}
          {loading ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Checkbox col */}
                    <TableHead className="w-10">
                      <Skeleton className="h-4 w-4" />
                    </TableHead>
                    {/* Company */}
                    <TableHead><Skeleton className="h-3.5 w-20" /></TableHead>
                    {/* Building */}
                    <TableHead className="hidden lg:table-cell"><Skeleton className="h-3.5 w-24" /></TableHead>
                    {/* Contact */}
                    <TableHead><Skeleton className="h-3.5 w-16" /></TableHead>
                    {/* SF Need */}
                    <TableHead><Skeleton className="h-3.5 w-14" /></TableHead>
                    {/* Stage */}
                    <TableHead><Skeleton className="h-3.5 w-16" /></TableHead>
                    {/* Last Activity */}
                    <TableHead><Skeleton className="h-3.5 w-20" /></TableHead>
                    {/* Industry */}
                    <TableHead><Skeleton className="h-3.5 w-16" /></TableHead>
                    {/* Signals */}
                    <TableHead><Skeleton className="h-3.5 w-14" /></TableHead>
                    {/* Actions */}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 9 }).map((_, i) => (
                    <TableRow key={i}>
                      {/* Checkbox */}
                      <TableCell className="w-10">
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                      {/* Company + building sub-label */}
                      <TableCell>
                        <Skeleton className="h-4 w-32 mb-1.5" />
                        <Skeleton className="h-3 w-24" />
                      </TableCell>
                      {/* Building */}
                      <TableCell className="hidden lg:table-cell">
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      {/* Contact + title */}
                      <TableCell>
                        <Skeleton className="h-4 w-24 mb-1.5" />
                        <Skeleton className="h-3 w-20" />
                      </TableCell>
                      {/* SF Need */}
                      <TableCell className="text-right">
                        <Skeleton className="h-4 w-16 ml-auto" />
                      </TableCell>
                      {/* Stage badge */}
                      <TableCell>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </TableCell>
                      {/* Last Activity */}
                      <TableCell>
                        <Skeleton className="h-4 w-14" />
                      </TableCell>
                      {/* Industry */}
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      {/* Signals */}
                      <TableCell>
                        <div className="flex gap-1">
                          <Skeleton className="h-4 w-10 rounded-full" />
                          <Skeleton className="h-4 w-10 rounded-full" />
                        </div>
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Skeleton className="h-7 w-14" />
                          <Skeleton className="h-7 w-16" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map(headerGroup => (
                      <TableRow key={headerGroup.id}>
                        {/* Checkbox col */}
                        <TableHead className="w-10">
                          <Checkbox
                            checked={
                              allFilteredRowIds.length > 0 &&
                              allFilteredRowIds.every(id => table.getState().rowSelection[id])
                            }
                            onCheckedChange={checked => {
                              const next: Record<string, boolean> = {};
                              if (checked) allFilteredRowIds.forEach(id => { next[id] = true; });
                              table.setRowSelection(next);
                            }}
                          />
                        </TableHead>

                        {headerGroup.headers
                          .filter(h => h.column.id !== 'select')
                          .map(header => {
                            const canSort = header.column.getCanSort();
                            const sortDir = header.column.getIsSorted();
                            return (
                              <TableHead
                                key={header.id}
                                className={
                                  canSort
                                    ? 'cursor-pointer select-none hover:text-foreground'
                                    : ''
                                }
                                style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                              >
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(header.column.columnDef.header, header.getContext())}
                                {canSort && <SortIcon direction={sortDir} />}
                              </TableHead>
                            );
                          })}
                      </TableRow>
                    ))}
                  </TableHeader>

                  <TableBody>
                    {rowsOnPage.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                          No prospects found matching your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rowsOnPage.map(row => {
                        const data = row.original;
                        return (
                          <TableRow
                            key={row.id}
                            className="cursor-pointer hover:bg-secondary/30"
                            data-state={row.getIsSelected() ? 'selected' : undefined}
                            onClick={() => handleRowClick(data)}
                          >
                            {/* Checkbox */}
                            <TableCell onClick={e => e.stopPropagation()}>
                              <Checkbox
                                checked={row.getIsSelected()}
                                onCheckedChange={value => row.toggleSelected(!!value)}
                              />
                            </TableCell>

                            {/* Company */}
                            {row.getVisibleCells().find(c => c.column.id === 'company') && (
                              <TableCell>
                                <CompanyCell row={data} />
                              </TableCell>
                            )}

                            {/* Building */}
                            {row.getVisibleCells().find(c => c.column.id === 'buildingName') && (
                              <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                                {data.buildingName || '-'}
                              </TableCell>
                            )}

                            {/* Contact */}
                            {row.getVisibleCells().find(c => c.column.id === 'contact') && (
                              <TableCell>
                                <ContactCell row={data} />
                              </TableCell>
                            )}

                            {/* SF Need */}
                            {row.getVisibleCells().find(c => c.column.id === 'sfNeed') && (
                              <TableCell className="text-right text-sm">
                                {data.sfNeed > 0 ? `${formatNumber(data.sfNeed)} SF` : '-'}
                              </TableCell>
                            )}

                            {/* Stage */}
                            {row.getVisibleCells().find(c => c.column.id === 'pipelineStage') && (
                              <TableCell>
                                <StageCell stage={data.pipelineStage} />
                              </TableCell>
                            )}

                            {/* Last Activity */}
                            {row.getVisibleCells().find(c => c.column.id === 'lastActivity') && (
                              <TableCell className="text-sm text-muted-foreground">
                                {relativeDate(data.lastActivity)}
                              </TableCell>
                            )}

                            {/* Industry */}
                            {row.getVisibleCells().find(c => c.column.id === 'industry') && (
                              <TableCell className="text-sm text-foreground">
                                {data.industry}
                              </TableCell>
                            )}

                            {/* Signals */}
                            {row.getVisibleCells().find(c => c.column.id === 'signals') && (
                              <TableCell>
                                <SignalsCell signals={data.signals} />
                              </TableCell>
                            )}

                            {/* Actions */}
                            {row.getVisibleCells().find(c => c.column.id === 'actions') && (
                              <TableCell
                                className="text-right"
                                onClick={e => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => {
                                      if (data.contactEmail) window.open(`mailto:${data.contactEmail}`);
                                    }}
                                  >
                                    <Mail className="h-3 w-3 mr-1" />
                                    Email
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => navigate('/pipeline')}
                                  >
                                    <Kanban className="h-3 w-3 mr-1" />
                                    Pipeline
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pageCount > 1 && (
                <div className="flex items-center justify-between mt-4 px-1">
                  <p className="text-sm text-muted-foreground">
                    Page {pageIndex + 1} of {pageCount}
                    <span className="ml-2 text-muted-foreground/60">
                      ({pageIndex * pageSize + 1}–
                      {Math.min((pageIndex + 1) * pageSize, table.getFilteredRowModel().rows.length)} of{' '}
                      {table.getFilteredRowModel().rows.length})
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ProspectTable;
