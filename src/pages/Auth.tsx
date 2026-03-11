import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Building2, Loader2 } from 'lucide-react';

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="font-display text-xl">
            {isForgot ? 'Reset Password' : isLogin ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {isForgot
              ? 'Enter your email to receive a reset link'
              : isLogin
              ? 'Sign in to your brokerage dashboard'
              : 'Set up your broker account'}
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
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isForgot ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-4 space-y-2 text-center text-sm">
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
    </div>
  );
};

export default Auth;
