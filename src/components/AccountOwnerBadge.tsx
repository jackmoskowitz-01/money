import { useState, useEffect } from 'react';
import { UserCheck, UserPlus, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Props = {
  prospectId: string;
};

const AccountOwnerBadge = ({ prospectId }: Props) => {
  const { user, profile } = useAuth();
  const [owner, setOwner] = useState<{ owner_id: string; owner_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const isMyAccount = owner?.owner_id === user?.id;
  const isClaimed = !!owner;

  useEffect(() => {
    const fetchOwner = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('prospect_owners')
        .select('owner_id, owner_name')
        .eq('prospect_id', prospectId)
        .maybeSingle();
      setOwner(data || null);
      setLoading(false);
    };
    fetchOwner();
  }, [prospectId]);

  const claimAccount = async () => {
    if (!user || !profile) return;
    setActing(true);
    const { error } = await supabase
      .from('prospect_owners')
      .insert({
        prospect_id: prospectId,
        owner_id: user.id,
        owner_name: profile.full_name || profile.email || 'Unknown',
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('This account is already claimed by someone else');
      } else {
        toast.error('Failed to claim account');
        console.error(error);
      }
    } else {
      setOwner({ owner_id: user.id, owner_name: profile.full_name || profile.email || 'Unknown' });
      toast.success('You are now the account owner');
    }
    setActing(false);
  };

  const releaseAccount = async () => {
    if (!user) return;
    setActing(true);
    const { error } = await supabase
      .from('prospect_owners')
      .delete()
      .eq('prospect_id', prospectId)
      .eq('owner_id', user.id);

    if (error) {
      toast.error('Failed to release account');
      console.error(error);
    } else {
      setOwner(null);
      toast.success('Account ownership released');
    }
    setActing(false);
  };

  if (loading) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Account Owner
      </Badge>
    );
  }

  if (!isClaimed) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="text-[10px] h-7 gap-1.5 border-dashed border-primary/40 text-primary hover:bg-primary/10"
        onClick={claimAccount}
        disabled={acting}
      >
        {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
        Claim as My Account
      </Button>
    );
  }

  if (isMyAccount) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20">
          <UserCheck className="h-3 w-3" /> My Account
        </Badge>
        <button
          onClick={releaseAccount}
          disabled={acting}
          className="rounded p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Release ownership"
        >
          {acting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-3 w-3" />}
        </button>
      </div>
    );
  }

  // Someone else owns it
  return (
    <Badge variant="outline" className="text-[10px] gap-1 bg-muted text-muted-foreground">
      <UserCheck className="h-3 w-3" /> {owner.owner_name}
    </Badge>
  );
};

export default AccountOwnerBadge;
