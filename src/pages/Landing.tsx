import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Sparkles, BarChart3, Newspaper, Mail, Brain, Shield,
  Zap, TrendingUp, Building2, Users, Clock, CheckCircle2, Star,
  ChevronRight, MessageSquare, Target, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import dealflowLogo from '@/assets/dealflow-logo.jpg';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

const features = [
  {
    icon: Newspaper,
    title: 'News Intelligence',
    description: 'AI scans market news in real-time, auto-detects CRE signals like expansions, relocations, and funding rounds — then surfaces outreach-ready talking points.',
  },
  {
    icon: Mail,
    title: 'Smart Outreach',
    description: 'Generate hyper-personalized emails with AI that mirrors your writing style. A/B test variants, build multi-step sequences, and handle objections — all in one click.',
  },
  {
    icon: Brain,
    title: 'Deal Copilot',
    description: 'Your AI strategist that knows every deal, every prospect, every market trend. Ask it anything — from comp analysis to commission calculations.',
  },
  {
    icon: BarChart3,
    title: 'Email Intelligence',
    description: 'Track response rates by template, tone, and industry. AI filters spam, classifies sentiment, and suggests replies — so you focus on what converts.',
  },
  {
    icon: Target,
    title: 'Pipeline Management',
    description: 'Kanban-style deal tracking with drag-and-drop stages. Auto-log touchpoints, track velocity, and never let a deal go cold.',
  },
  {
    icon: Layers,
    title: 'Stacking Plans & Comps',
    description: 'Upload lease abstracts and stacking plans. AI extracts critical dates, tenant data, and flags upcoming expirations before your competition.',
  },
];

const testimonials = [
  {
    quote: "DealFlow changed how I prospect. I went from 50 cold emails a week to 50 targeted, research-backed outreach emails — and my response rate tripled.",
    name: "Sarah Chen",
    title: "Senior Broker, CBRE",
    metric: "3x response rate",
  },
  {
    quote: "The news intelligence feature alone pays for itself. I knew about a tenant's expansion plans before their own broker did. Closed a 40,000 SF deal from that signal.",
    name: "Marcus Williams",
    title: "Vice President, JLL",
    metric: "40,000 SF closed",
  },
  {
    quote: "I used to spend 2 hours prepping for each client meeting. Now the Copilot generates my research brief in 30 seconds. It's like having a junior analyst on demand.",
    name: "Rachel Torres",
    title: "Director, Cushman & Wakefield",
    metric: "2hrs → 30sec prep",
  },
];

const stats = [
  { value: '3x', label: 'Higher response rates' },
  { value: '10x', label: 'Faster market research' },
  { value: '85%', label: 'Less time on admin' },
  { value: '2.4x', label: 'More deals closed' },
];

export default function Landing() {
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <img src={dealflowLogo} alt="DealFlow" className="h-9 rounded-md" />
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Results</a>
            <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Demo</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-sm">Sign In</Button>
            </Link>
            <a href="#demo">
              <Button size="sm" className="text-sm">Book a Demo</Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground mb-8">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI-Powered CRE Intelligence
            </span>
          </motion.div>

          <motion.h1
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
            className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
          >
            Close more deals.
            <br />
            <span className="text-primary">Prospect smarter.</span>
          </motion.h1>

          <motion.p
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
            className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed mb-10"
          >
            DealFlow combines real-time market intelligence, AI-powered outreach, and deal
            management into one platform — built by brokers, for brokers.
          </motion.p>

          <motion.div
            initial="hidden" animate="visible" variants={fadeUp} custom={3}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a href="#demo">
              <Button size="lg" className="text-base px-8 h-12 gap-2">
                Book a Demo <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="#features">
              <Button variant="outline" size="lg" className="text-base px-8 h-12">
                See How It Works
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border bg-card/50">
        <div className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={i}
              className="text-center"
            >
              <p className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Everything you need to
              <span className="text-primary"> dominate your market</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Six AI-powered tools that replace your spreadsheets, research time, and guesswork.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial="hidden" whileInView="visible" viewport={{ once: true }}
                  variants={fadeUp} custom={i}
                >
                  <Card className="p-6 bg-card border-border h-full hover:border-primary/30 transition-colors group">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground">{feature.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 md:py-28 bg-card/30 border-y border-border">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              From signal to signed lease
            </h2>
            <p className="text-muted-foreground">Three steps. Zero busywork.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Detect', desc: 'AI monitors news, lease expirations, and market shifts — surfaces actionable signals before your competition sees them.', icon: Zap },
              { step: '02', title: 'Engage', desc: 'Generate research-backed, personalized outreach in your voice. Smart sequences nurture prospects automatically.', icon: Mail },
              { step: '03', title: 'Close', desc: 'Track every deal through your pipeline. The Copilot prepares meeting briefs, handles objections, and keeps deals moving.', icon: TrendingUp },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.step}
                  initial="hidden" whileInView="visible" viewport={{ once: true }}
                  variants={fadeUp} custom={i}
                  className="relative"
                >
                  <span className="text-6xl font-bold text-primary/10 absolute -top-2 -left-1">{item.step}</span>
                  <div className="pt-12">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="h-5 w-5 text-primary" />
                      <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
            className="text-center mb-16"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Brokers are closing more with DealFlow
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <Card className="p-6 bg-card border-border h-full flex flex-col">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed flex-1 mb-6">
                    "{t.quote}"
                  </p>
                  <div className="border-t border-border pt-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.title}</p>
                    </div>
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                      {t.metric}
                    </span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Form */}
      <section id="demo" className="py-20 md:py-32 bg-card/30 border-y border-border">
        <div className="mx-auto max-w-2xl px-6">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
            className="text-center mb-10"
          >
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              See DealFlow in action
            </h2>
            <p className="text-muted-foreground">
              Book a personalized demo and see how AI can transform your brokerage workflow.
            </p>
          </motion.div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">We'll be in touch!</h3>
              <p className="text-muted-foreground">Expect a response within 24 hours.</p>
            </motion.div>
          ) : (
            <motion.form
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={1}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  placeholder="Full name"
                  required
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  type="email"
                  placeholder="Work email"
                  required
                  value={formData.email}
                  onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Company / Brokerage"
                value={formData.company}
                onChange={e => setFormData(prev => ({ ...prev, company: e.target.value }))}
              />
              <Textarea
                placeholder="What are you looking to improve? (optional)"
                rows={4}
                value={formData.message}
                onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
              />
              <Button type="submit" size="lg" className="w-full h-12 text-base gap-2">
                Request a Demo <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                No credit card required · Free 14-day trial included
              </p>
            </motion.form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={dealflowLogo} alt="DealFlow" className="h-7 rounded opacity-70" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} DealFlow. Real Estate Intelligence.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Sign In
            </Link>
            <a href="#features" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#demo" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
