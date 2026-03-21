import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Building2, Calendar, FileText, Loader2, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useLeaseAbstracts, type LeaseAbstract } from '@/hooks/useLeaseAbstracts';
import LeaseAbstractViewer from '@/components/LeaseAbstractViewer';
import { toast } from 'sonner';

function formatDate(val: string | null | undefined) {
  if (!val) return '--';
  try {
    return new Date(val + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return val;
  }
}

function CompletenessIndicator({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{score}%</span>
    </div>
  );
}

export default function LeaseAbstracts() {
  const { abstracts, loading, deleteAbstract } = useLeaseAbstracts();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = abstracts.find(a => a.id === selectedId) || null;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this lease abstract?')) return;
    const ok = await deleteAbstract(id);
    if (ok) {
      toast.success('Lease abstract deleted');
      if (selectedId === id) setSelectedId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-6xl mx-auto px-4 pt-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Lease Abstracts</h1>
              <p className="text-sm text-muted-foreground">
                {abstracts.length} parsed {abstracts.length === 1 ? 'abstract' : 'abstracts'}
              </p>
            </div>
          </div>
        </div>

        {abstracts.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No lease abstracts yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Use <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/abstract</code> in the Copilot to upload and parse a lease document.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {abstracts.map(a => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className={`p-4 cursor-pointer transition-colors hover:bg-muted/30 ${selectedId === a.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedId(selectedId === a.id ? null : a.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-semibold truncate">{a.tenant_name || 'Unknown Tenant'}</span>
                          {a.lease_type && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">{a.lease_type}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {a.building_name || 'Unknown'}
                          </span>
                          {a.premises_sf && (
                            <span>{a.premises_sf.toLocaleString()} SF</span>
                          )}
                          {a.commencement_date && a.expiration_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(a.commencement_date)} - {formatDate(a.expiration_date)}
                            </span>
                          )}
                          {a.base_rent_psf && (
                            <span>${a.base_rent_psf.toFixed(2)}/SF</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <CompletenessIndicator score={a.completeness_score} />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(a.id, e)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>

                <AnimatePresence>
                  {selectedId === a.id && selected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <Card className="mt-2 p-6">
                        <LeaseAbstractViewer abstract={selected} />
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
