import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, Loader2, ArrowRight, TrendingUp, Users, Zap } from 'lucide-react';

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
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success('Check your email to confirm your account.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left — brand */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-14 bg-card border-r border-border">
        <div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5 mb-24">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-[15px] font-semibold text-foreground">DealFlow</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h1 className="text-[2.5rem] font-semibold text-foreground leading-[1.1] mb-4">
              Close more deals,<br />faster.
            </h1>
            <p className="text-muted-foreground text-[15px] max-w-md leading-relaxed">
              AI-powered pipeline management and market intelligence for DC commercial real estate brokers.
            </p>
          </motion.div>

          <div className="mt-16 space-y-4">
            {[
              { icon: TrendingUp, text: 'AI-generated outreach that converts' },
              { icon: Users, text: 'Full pipeline CRM with drag-and-drop' },
              { icon: Zap, text: 'Real-time market signals and news' },
            ].map((item, i) => (
              <motion.div
                key={item.text}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-3"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <item.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">{item.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="text-xs text-muted-foreground/50">
          Trusted by brokers at top DC firms
        </motion.p>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 items-center justify-center px-6 bg-background">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="w-full max-w-[340px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-12 justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-[15px] font-semibold text-foreground">DealFlow</span>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-1">
              {isForgot ? 'Reset password' : isLogin ? 'Sign in' : 'Create account'}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {isForgot
                ? 'We\'ll send you a reset link'
                : isLogin
                ? 'Enter your credentials to continue'
                : 'Get started with DealFlow'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && !isForgot && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs text-muted-foreground">Name</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Sarah Chen" required className="h-10" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@firm.com" required className="h-10" />
            </div>
            {!isForgot && (
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs text-muted-foreground">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-10" />
              </div>
            )}
            <Button type="submit" className="w-full h-10 mt-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isForgot ? 'Send reset link' : isLogin ? 'Continue' : 'Create account'}
              {!loading && <ArrowRight className="ml-1 h-3.5 w-3.5" />}
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-2 text-[12px]">
            {!isForgot && (
              <button type="button" onClick={() => setIsForgot(true)} className="text-muted-foreground hover:text-foreground transition-colors">
                Forgot password?
              </button>
            )}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setIsForgot(false); }} className="text-primary hover:text-primary/80 transition-colors font-medium">
              {isLogin ? 'Create an account' : 'Already have an account?'}
            </button>
            {isForgot && (
              <button type="button" onClick={() => setIsForgot(false)} className="text-primary hover:text-primary/80 transition-colors font-medium">
                Back to sign in
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
