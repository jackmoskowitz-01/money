import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { getAssignmentForTenant, assignTenant, type Broker } from '@/data/activityData';
import { useBrokers } from '@/hooks/useBrokers';

interface Props {
  tenantId: string;
  buildingId: string;
}

const BrokerAssignment = ({ tenantId, buildingId }: Props) => {
  const [assignment, setAssignment] = useState(() => getAssignmentForTenant(tenantId));
  const [showPicker, setShowPicker] = useState(false);

  const handleAssign = (broker: Broker) => {
    assignTenant(tenantId, buildingId, broker.id, broker.name);
    setAssignment({ tenantId, buildingId, brokerId: broker.id, brokerName: broker.name, assignedAt: new Date().toISOString() });
    setShowPicker(false);
  };

  const currentBroker = assignment ? brokers.find(b => b.id === assignment.brokerId) : null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-secondary"
      >
        {currentBroker ? (
          <>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${currentBroker.color}`}>
              {currentBroker.initials}
            </span>
            <span className="text-foreground">{currentBroker.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Assign broker...</span>
        )}
      </button>

      {showPicker && (
        <div className="absolute left-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-card p-1 shadow-lg">
          {brokers.map(broker => (
            <button
              key={broker.id}
              onClick={() => handleAssign(broker)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-secondary ${
                currentBroker?.id === broker.id ? 'bg-primary/10' : ''
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${broker.color}`}>
                {broker.initials}
              </span>
              {broker.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BrokerAssignment;
