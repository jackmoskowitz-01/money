import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ArrowUp, ArrowDown, Mail, Kanban, Users, Loader2 } from 'lucide-react';
import { useProspectTable, type SortColumn } from '@/hooks/useProspectTable';
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

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffDays > 365) return `${Math.floor(diffDays / 365)}y ago`;
  if (diffDays > 30) return `${Math.floor(diffDays / 30)}mo ago`;
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
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

const sortableColumns: { key: SortColumn; label: string; className?: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'contact', label: 'Contact' },
  { key: 'sfNeed', label: 'SF Need', className: 'text-right' },
  { key: 'pipelineStage', label: 'Stage' },
  { key: 'lastActivity', label: 'Last Activity' },
  { key: 'industry', label: 'Industry' },
];

const ProspectTable = () => {
  const navigate = useNavigate();
  const {
    rows,
    loading,
    sortColumn,
    sortDirection,
    handleSort,
    stageFilter,
    setStageFilter,
    industryFilter,
    setIndustryFilter,
    searchQuery,
    setSearchQuery,
    industries,
    stages,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    totalCount,
  } = useProspectTable();

  const handleRowClick = (row: typeof rows[0]) => {
    if (row.source === 'mock') {
      navigate(`/building/${row.buildingId}/tenant/${row.tenantId}`);
    } else {
      navigate(`/prospect/${row.id}`);
    }
  };

  const SortArrow = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc'
      ? <ArrowUp className="inline h-3 w-3 ml-1" />
      : <ArrowDown className="inline h-3 w-3 ml-1" />;
  };

  return (
    <div className="min-h-screen pt-12 bg-background">
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

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies, contacts, buildings..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
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
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
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
          </div>

          {/* Row count */}
          <div className="mb-3 text-sm text-muted-foreground">
            {totalCount} prospect{totalCount !== 1 ? 's' : ''}
          </div>

          {/* Loading state */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={rows.length > 0 && selectedIds.size === rows.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    {sortableColumns.map(col => (
                      <TableHead
                        key={col.key}
                        className={`cursor-pointer select-none hover:text-foreground ${col.className ?? ''}`}
                        onClick={() => handleSort(col.key)}
                      >
                        {col.label}
                        <SortArrow column={col.key} />
                      </TableHead>
                    ))}
                    <TableHead>Signals</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        No prospects found matching your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map(row => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-secondary/30"
                        onClick={() => handleRowClick(row)}
                      >
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(row.id)}
                            onCheckedChange={() => toggleSelect(row.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground">{row.company}</div>
                          <div className="text-xs text-muted-foreground">{row.buildingName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-foreground">{row.contact || '-'}</div>
                          <div className="text-xs text-muted-foreground">{row.contactTitle}</div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {row.sfNeed > 0 ? `${formatNumber(row.sfNeed)} SF` : '-'}
                        </TableCell>
                        <TableCell>
                          {row.pipelineStage ? (
                            <Badge className={stageColors[row.pipelineStage]}>
                              {stageLabels[row.pipelineStage]}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {relativeDate(row.lastActivity)}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {row.industry}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {row.signals.length === 0 ? (
                              <span className="text-xs text-muted-foreground">-</span>
                            ) : (
                              row.signals.slice(0, 3).map((signal, i) => (
                                <Badge
                                  key={i}
                                  className={`${urgencyColor(signal.urgency)} text-[10px]`}
                                  title={signal.title}
                                >
                                  {signal.urgency}
                                </Badge>
                              ))
                            )}
                            {row.signals.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{row.signals.length - 3}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                if (row.contactEmail) {
                                  window.open(`mailto:${row.contactEmail}`);
                                }
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ProspectTable;
