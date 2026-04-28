import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Clock, Mail, User } from 'lucide-react';
import Markdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import dealflowLogo from '@/assets/dealflow-logo.jpg';
import { blogPosts, getPostBySlug } from '@/data/blogPosts';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' as const },
  }),
};

function readTime(content: string) {
  return Math.ceil(content.split(/\s+/).length / 200) + ' min read';
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = getPostBySlug(slug ?? '');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribed(true);
  };

  if (!post) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <Link to="/" className="flex items-center gap-3">
              <img src={dealflowLogo} alt="DealFlow" className="h-9 rounded-md" />
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Blog
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/#demo">
                <Button size="sm" className="text-sm">
                  Book a Demo
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        <div className="flex-1 flex items-center justify-center pt-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-foreground mb-4">Post Not Found</h1>
            <p className="text-muted-foreground mb-8">
              The blog post you're looking for doesn't exist.
            </p>
            <Link to="/blog">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Blog
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const relatedPosts = blogPosts
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={dealflowLogo} alt="DealFlow" className="h-9 rounded-md" />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Blog
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-sm">
                Sign In
              </Button>
            </Link>
            <Link to="/#demo">
              <Button size="sm" className="text-sm">
                Book a Demo
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Article */}
      <article className="pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="mx-auto max-w-3xl px-6">
          {/* Back link */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Blog
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
            <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-4">
              {post.category}
            </span>
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.15] mb-6">
              {post.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-10 pb-8 border-b border-border">
              <span>
                {new Date(post.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {post.author}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {readTime(post.content)}
              </span>
            </div>
          </motion.div>

          {/* Content */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
            <div className="prose prose-invert prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary prose-li:text-muted-foreground prose-blockquote:text-muted-foreground prose-blockquote:border-primary/50">
              <Markdown>{post.content}</Markdown>
            </div>
          </motion.div>
        </div>
      </article>

      {/* Related Posts */}
      <section className="py-16 md:py-20 border-t border-border">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-8">Related Posts</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedPosts.map((related, i) => (
              <motion.div
                key={related.slug}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <Link to={`/blog/${related.slug}`} className="block h-full">
                  <Card className="p-6 bg-card border-border h-full hover:border-primary/30 transition-colors group flex flex-col">
                    <div className="mb-3">
                      <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                        {related.category}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {related.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-2 mb-4">
                      {related.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{new Date(related.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {readTime(related.content)}
                      </span>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Email Capture CTA */}
      <section className="py-20 md:py-28 bg-card/30 border-y border-border">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground mb-6">
              <Mail className="h-3.5 w-3.5 text-primary" />
              Free Resource
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Get 7 Cold Email Templates for CRE Brokers
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Battle-tested email templates used by top-producing tenant rep brokers. Drop your email and we'll send them over instantly.
            </p>
          </motion.div>

          {subscribed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <p className="text-lg font-semibold text-foreground">Check your inbox!</p>
              <p className="text-sm text-muted-foreground mt-1">We just sent the templates to your email.</p>
            </motion.div>
          ) : (
            <motion.form
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={1}
              onSubmit={handleSubscribe}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <Input
                type="email"
                placeholder="Enter your work email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" className="gap-2 whitespace-nowrap">
                Send Templates <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={dealflowLogo} alt="DealFlow" className="h-7 rounded opacity-70" />
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} DealFlow. Real Estate Intelligence.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link to="/blog" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Blog
            </Link>
            <Link to="/#demo" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
