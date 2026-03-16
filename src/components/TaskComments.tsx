import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';

type Comment = {
  id: string;
  taskId: string;
  userId: string;
  authorName: string;
  authorInitials: string;
  content: string;
  createdAt: string;
};

type DbRow = {
  id: string;
  task_id: string;
  user_id: string;
  author_name: string;
  author_initials: string;
  content: string;
  created_at: string;
};

interface Props {
  taskId: string;
}

const TaskComments = ({ taskId }: Props) => {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (data) {
      setComments((data as unknown as DbRow[]).map(r => ({
        id: r.id,
        taskId: r.task_id,
        userId: r.user_id,
        authorName: r.author_name,
        authorInitials: r.author_initials,
        content: r.content,
        createdAt: r.created_at,
      })));
    }
  }, [taskId]);

  useEffect(() => {
    if (!expanded) return;
    fetchComments();

    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` }, () => {
        fetchComments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [expanded, fetchComments, taskId]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    await supabase.from('task_comments').insert({
      task_id: taskId,
      user_id: user.id,
      author_name: profile?.full_name || 'Anonymous',
      author_initials: profile?.avatar_initials || 'AN',
      content: newComment.trim(),
    } as any);
    setNewComment('');
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    await supabase.from('task_comments').delete().eq('id', commentId);
  };

  return (
    <div className="mt-1" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
      >
        <MessageSquare className="h-2.5 w-2.5" />
        {expanded ? 'Hide' : comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Comment'}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2 rounded-lg border border-border bg-secondary/20 p-2.5">
              {comments.length === 0 && (
                <p className="text-[10px] text-muted-foreground/60 text-center py-2">No comments yet</p>
              )}

              {comments.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-start gap-2 group"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[8px] font-bold text-primary mt-0.5">
                    {c.authorInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-foreground">{c.authorName}</span>
                      <span className="text-[9px] text-muted-foreground/50">
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground/80">{c.content}</p>
                  </div>
                  {c.userId === user?.id && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground/30 hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                </motion.div>
              ))}

              {/* Input */}
              <div className="flex items-center gap-1.5 pt-1">
                <Input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                  placeholder="Add a comment..."
                  className="h-7 text-[11px] border-border bg-card"
                  disabled={submitting}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || submitting}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  <Send className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaskComments;
