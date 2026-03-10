import { useState } from 'react';
import { Heart, MessageCircle, CheckCircle, Shield, Building2, Users, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScoopCategoryBadge } from './ScoopCategoryBadge';
import { useScoopComments, type Scoop } from '@/hooks/useScoops';

interface Props {
  scoop: Scoop;
  isLiked: boolean;
  onLike: (id: string) => void;
  onVerify: (id: string, name: string) => void;
}

const ScoopCard = ({ scoop, isLiked, onLike, onVerify }: Props) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const { comments, loading: commentsLoading, addComment } = useScoopComments(showComments ? scoop.id : null);

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !commentAuthor.trim()) return;
    const avatar = commentAuthor.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const ok = await addComment(commentText.trim(), commentAuthor.trim(), avatar);
    if (ok) {
      setCommentText('');
    }
  };

  return (
    <Card className="border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-bold text-foreground">
          {scoop.author_avatar}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{scoop.author_name}</span>
            {scoop.verified && (
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
            )}
            <ScoopCategoryBadge category={scoop.category} />
          </div>
          <span className="text-xs text-muted-foreground">{timeAgo(scoop.created_at)}</span>
        </div>
      </div>

      {/* Content */}
      <p className="mb-3 text-sm leading-relaxed text-foreground/90">{scoop.content}</p>

      {/* Links */}
      {(scoop.linked_building_name || scoop.linked_tenant_name) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {scoop.linked_building_name && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-secondary/50 text-muted-foreground gap-1">
              <Building2 className="h-2.5 w-2.5" /> {scoop.linked_building_name}
            </Badge>
          )}
          {scoop.linked_tenant_name && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-secondary/50 text-muted-foreground gap-1">
              <Users className="h-2.5 w-2.5" /> {scoop.linked_tenant_name}
            </Badge>
          )}
        </div>
      )}

      {/* Tags */}
      {scoop.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {scoop.tags.map(tag => (
            <Badge key={tag} variant="outline" className="bg-secondary/50 text-[11px] text-muted-foreground">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 border-t border-border pt-3">
        <button
          onClick={() => onLike(scoop.id)}
          className={`flex items-center gap-1.5 text-xs transition-colors ${isLiked ? 'text-primary font-medium' : 'text-muted-foreground hover:text-primary'}`}
        >
          <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-primary' : ''}`} /> {scoop.likes_count}
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-1.5 text-xs transition-colors ${showComments ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <MessageCircle className="h-3.5 w-3.5" /> {scoop.comments_count}
          {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {!scoop.verified && (
          <button
            onClick={() => {
              const name = prompt('Your name to verify this scoop:');
              if (name?.trim()) onVerify(scoop.id, name.trim());
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-success ml-auto"
          >
            <Shield className="h-3.5 w-3.5" /> Verify
          </button>
        )}
        {scoop.verified && (
          <span className="flex items-center gap-1 text-[10px] text-primary ml-auto">
            <Shield className="h-3 w-3" /> Verified
          </span>
        )}
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-3 border-t border-border pt-3 space-y-3">
          {commentsLoading && <p className="text-xs text-muted-foreground">Loading comments…</p>}
          {comments.map(c => (
            <div key={c.id} className="flex gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-foreground">
                {c.author_avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{c.author_name}</span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                </div>
                <p className="text-xs text-foreground/80 mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}

          {/* Comment input */}
          <div className="flex gap-2">
            <Input
              placeholder="Your name"
              value={commentAuthor}
              onChange={e => setCommentAuthor(e.target.value)}
              className="border-border bg-secondary/50 text-xs h-8 w-28 shrink-0"
            />
            <Input
              placeholder="Add a comment…"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddComment()}
              className="border-border bg-secondary/50 text-xs h-8"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAddComment}
              disabled={!commentText.trim() || !commentAuthor.trim()}
              className="h-8 px-2"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default ScoopCard;
