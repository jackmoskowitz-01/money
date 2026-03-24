import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { History, MessageSquare, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  conversation_id: string;
  first_message: string;
  message_count: number;
  last_at: string;
}

interface Props {
  userId: string;
  currentConversationId: string | null;
  onLoadConversation: (convId: string, messages: { role: string; content: string }[]) => void;
  onNewConversation: () => void;
}

export default function CopilotHistory({ userId, currentConversationId, onLoadConversation, onNewConversation }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    loadConversations();
  }, [open, userId]);

  const loadConversations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('copilot_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      const grouped = new Map<string, any[]>();
      data.forEach((m: any) => {
        const list = grouped.get(m.conversation_id) || [];
        list.push(m);
        grouped.set(m.conversation_id, list);
      });

      const convs: Conversation[] = Array.from(grouped.entries())
        .map(([id, msgs]) => ({
          conversation_id: id,
          first_message: msgs[msgs.length - 1]?.content?.slice(0, 100) || 'New conversation',
          message_count: msgs.length,
          last_at: msgs[0]?.created_at || '',
        }))
        .sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime());

      setConversations(convs);
    }
    setLoading(false);
  };

  const handleSelect = async (convId: string) => {
    const { data } = await supabase
      .from('copilot_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    if (data) {
      onLoadConversation(convId, data.map((m: any) => ({ role: m.role, content: m.content })));
      setOpen(false);
    }
  };

  const handleNew = () => {
    onNewConversation();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" title="Chat history">
          <History className="h-3.5 w-3.5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[320px] p-0 z-[60]">
        <SheetHeader className="px-4 pr-12 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm">Conversations</SheetTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleNew}>
              <Plus className="h-3 w-3" />
              New
            </Button>
          </div>
        </SheetHeader>
        <ScrollArea className="h-[calc(100%-60px)]">
          {loading ? (
            <div className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Loading...
              </div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {conversations.map(conv => (
                <button
                  key={conv.conversation_id}
                  onClick={() => handleSelect(conv.conversation_id)}
                  className={`w-full text-left p-3 rounded-lg hover:bg-secondary/50 transition-colors ${
                    conv.conversation_id === currentConversationId ? 'bg-primary/10 border border-primary/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground line-clamp-2">{conv.first_message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {conv.message_count} messages · {conv.last_at ? formatDistanceToNow(new Date(conv.last_at), { addSuffix: true }) : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
