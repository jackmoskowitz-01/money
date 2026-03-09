import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, CheckCircle, Send } from 'lucide-react';
import { scoopPosts, type ScoopPost } from '@/data/mockData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

const ScoopBoard = () => {
  const [posts, setPosts] = useState<ScoopPost[]>(scoopPosts);
  const [newPost, setNewPost] = useState('');
  const [newTags, setNewTags] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = () => {
    if (!newPost.trim()) return;
    const post: ScoopPost = {
      id: `s${Date.now()}`,
      author: 'You',
      authorAvatar: 'YO',
      content: newPost,
      tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
      timestamp: new Date().toISOString(),
      likes: 0,
      comments: 0,
      verified: false,
    };
    setPosts([post, ...posts]);
    setNewPost('');
    setNewTags('');
    setShowForm(false);
  };

  const handleLike = (id: string) => {
    setPosts(posts.map(p => p.id === id ? { ...p, likes: p.likes + 1 } : p));
  };

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Scoop Board</h1>
              <p className="mt-1 text-muted-foreground">
                Broker intel — share what you're hearing in the market
              </p>
            </div>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="mr-2 h-4 w-4" /> Post Scoop
            </Button>
          </div>

          {/* New Post Form */}
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <Card className="mb-6 border-primary/30 bg-card p-4">
                <Textarea
                  placeholder="What are you hearing in the market?"
                  value={newPost}
                  onChange={e => setNewPost(e.target.value)}
                  className="mb-3 min-h-[80px] border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground"
                />
                <Input
                  placeholder="Tags (comma separated): e.g. Deloitte, RFP, East End"
                  value={newTags}
                  onChange={e => setNewTags(e.target.value)}
                  className="mb-3 border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setShowForm(false)} className="text-muted-foreground">
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} className="bg-primary text-primary-foreground">
                    Share Scoop
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Posts */}
          <div className="space-y-4">
            {posts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="border-border bg-card p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-display text-sm font-bold text-foreground">
                      {post.authorAvatar}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{post.author}</span>
                        {post.verified && (
                          <CheckCircle className="h-3.5 w-3.5 text-primary" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{timeAgo(post.timestamp)}</span>
                    </div>
                  </div>

                  <p className="mb-3 text-sm leading-relaxed text-foreground/90">{post.content}</p>

                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {post.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="bg-secondary/50 text-[11px] text-muted-foreground">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 border-t border-border pt-3">
                    <button
                      onClick={() => handleLike(post.id)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
                    >
                      <Heart className="h-3.5 w-3.5" /> {post.likes}
                    </button>
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                      <MessageCircle className="h-3.5 w-3.5" /> {post.comments}
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ScoopBoard;
