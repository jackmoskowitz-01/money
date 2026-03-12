import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Building2, Loader2, TrendingUp, Users, Zap, BarChart3 } from 'lucide-react';

const features = [
  { icon: Building2, label: 'Live Building Intel', desc: 'Real-time DC office market data' },
  { icon: TrendingUp, label: 'AI Outreach', desc: 'Context-aware email generation' },
  { icon: Users, label: 'Pipeline CRM', desc: 'Drag-and-drop deal tracking' },
  { icon: Zap, label: 'News Signals', desc: 'Perplexity-powered market news' },
];

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success('Password reset email sent. Check your inbox.');
        setIsForgot(false);
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success('Check your email to confirm your account before signing in.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-card via-background to-card border-r border-border">
        <div>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 mb-16"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-foreground">DealFlow</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-4xl font-display font-bold tracking-tight text-foreground mb-4 leading-tight">
              The DC broker's<br />
              <span className="text-primary">unfair advantage.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
              AI-powered market intelligence, pipeline management, and outreach — purpose-built for Washington DC commercial real estate.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-12 grid grid-cols-2 gap-4"
          >
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="rounded-xl border border-border bg-card/50 p-4"
              >
                <f.icon className="h-5 w-5 text-primary mb-2" />
                <p className="text-sm font-semibold text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center gap-3"
        >
          <div className="flex -space-x-2">
            {['JM', 'SC', 'RT'].map(initials => (
              <div key={initials} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-[10px] font-semibold text-primary">
                {initials}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Trusted by DC's top brokers</p>
        </motion.div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-foreground">DealFlow</span>
          </div>

          <Card className="border-border bg-card shadow-xl shadow-black/20">
            <CardHeader className="text-center pb-2">
              <CardTitle className="font-display text-2xl">
                {isForgot ? 'Reset Password' : isLogin ? 'Welcome back' : 'Get started'}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {isForgot
                  ? 'Enter your email to receive a reset link'
                  : isLogin
                  ? 'Sign in to your brokerage dashboard'
                  : 'Create your broker account'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && !isForgot && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Sarah Chen"
                      required
                      className="h-11"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="broker@firm.com"
                    required
                    className="h-11"
                  />
                </div>
                {!isForgot && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="h-11"
                    />
                  </div>
                )}
                <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isForgot ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'}
                </Button>
              </form>

              <div className="mt-5 space-y-2 text-center text-sm">
                {!isForgot && (
                  <button
                    type="button"
                    onClick={() => setIsForgot(true)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => { setIsLogin(!isLogin); setIsForgot(false); }}
                    className="text-primary hover:underline"
                  >
                    {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                  </button>
                </div>
                {isForgot && (
                  <button
                    type="button"
                    onClick={() => setIsForgot(false)}
                    className="text-primary hover:underline"
                  >
                    Back to sign in
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
