import { useState } from "react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiFetch<{ message: string; devResetUrl?: string }>(
        "/auth/forgot-password",
        { method: "POST", body: JSON.stringify({ email }) }
      );
      setDevResetUrl(data.devResetUrl ?? null);
      setSent(true);
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md bg-card border-white/5">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-serif">Forgot Password</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your email and we'll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-4 py-4">
              <div className="text-4xl">{devResetUrl ? "🔧" : "📧"}</div>

              {devResetUrl ? (
                /* Dev mode — email not configured, show link directly */
                <div className="space-y-3 text-left">
                  <p className="text-sm text-muted-foreground text-center">
                    Email not configured — dev mode active.
                  </p>
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-4 space-y-2">
                    <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
                      Dev reset link
                    </p>
                    <a
                      href={devResetUrl}
                      className="block text-xs text-amber-300 break-all hover:underline"
                    >
                      {devResetUrl}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      This link is also printed in the server console. Expires in 1 hour.
                    </p>
                  </div>
                  <Link href={devResetUrl}>
                    <Button className="w-full bg-amber-500/80 hover:bg-amber-500 text-black font-semibold">
                      Open Reset Page →
                    </Button>
                  </Link>
                </div>
              ) : (
                /* Production — email sent */
                <p className="text-sm text-muted-foreground">
                  If an account exists for{" "}
                  <strong className="text-foreground">{email}</strong>, a reset
                  link has been sent. Check your inbox.
                </p>
              )}

              <Link href="/login">
                <Button variant="outline" className="w-full border-white/10">
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background border-white/10 focus-visible:ring-primary"
                />
              </div>
              <Button type="submit" className="w-full mt-2" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
              <div className="text-center">
                <Link href="/login">
                  <span className="text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                    Back to Login
                  </span>
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
