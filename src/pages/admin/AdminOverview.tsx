import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Kanban, MessageSquare } from 'lucide-react';

type Stats = {
  orgCount: number;
  userCount: number;
  dealCount: number;
  scoopCount: number;
};

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats>({ orgCount: 0, userCount: 0, dealCount: 0, scoopCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [orgs, users, deals, scoops] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('pipeline_deals').select('id', { count: 'exact', head: true }),
        supabase.from('scoops').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        orgCount: orgs.count ?? 0,
        userCount: users.count ?? 0,
        dealCount: deals.count ?? 0,
        scoopCount: scoops.count ?? 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'Organizations', value: stats.orgCount, icon: Building2, color: 'text-blue-500' },
    { label: 'Users', value: stats.userCount, icon: Users, color: 'text-green-500' },
    { label: 'Pipeline Deals', value: stats.dealCount, icon: Kanban, color: 'text-purple-500' },
    { label: 'Scoops', value: stats.scoopCount, icon: MessageSquare, color: 'text-orange-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-sm text-muted-foreground">Platform-wide statistics and management.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '...' : value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
