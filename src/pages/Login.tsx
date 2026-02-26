import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";

export default function Login() {
  const { signIn, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && !isLoading) {
      navigate("/", { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fullEmail = email.includes("@") ? email : `${email}@csb.com`;

    if (!fullEmail.endsWith("@csb.com")) {
      setError("Only @csb.com emails are allowed");
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await signIn(fullEmail, password);
    setSubmitting(false);

    if (signInError) {
      setError(signInError);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Animated rainbow gradient background */}
      {/* Breathing rainbow background layers */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0 animate-[breathe1_10s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(ellipse at 20% 30%, hsl(340 90% 60% / 0.35), transparent 55%)" }}
        />
        <div
          className="absolute inset-0 animate-[breathe2_13s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(ellipse at 80% 20%, hsl(280 80% 60% / 0.35), transparent 55%)" }}
        />
        <div
          className="absolute inset-0 animate-[breathe3_11s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(ellipse at 70% 80%, hsl(220 90% 60% / 0.35), transparent 55%)" }}
        />
        <div
          className="absolute inset-0 animate-[breathe4_14s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(ellipse at 10% 80%, hsl(170 80% 55% / 0.35), transparent 55%)" }}
        />
        <div
          className="absolute inset-0 animate-[breathe5_15s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(ellipse at 50% 50%, hsl(30 90% 58% / 0.3), transparent 50%)" }}
        />
        <div
          className="absolute inset-0 animate-[breathe6_16s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(ellipse at 90% 50%, hsl(55 80% 55% / 0.28), transparent 50%)" }}
        />
        <div
          className="absolute inset-0 animate-[breathe7_17s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(ellipse at 40% 10%, hsl(150 85% 50% / 0.3), transparent 50%)" }}
        />
      </div>

      {/* Card with entrance animation */}
      <Card className="w-full max-w-sm animate-[loginCardEntry_0.6s_cubic-bezier(0.16,1,0.3,1)_both] border-border/50 bg-card/80 shadow-xl backdrop-blur-xl">
        <CardHeader className="text-center space-y-1">
          {/* Logo-inspired gradient text */}
          <CardTitle
            className="text-xl font-bold tracking-tight bg-clip-text text-transparent animate-[shimmer_8s_linear_infinite]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, hsl(340 80% 55%), hsl(280 70% 55%), hsl(220 80% 55%), hsl(170 70% 55%), hsl(30 80% 55%), hsl(340 80% 55%))",
              backgroundSize: "300% 100%",
            }}
          >
            CSB Finance
          </CardTitle>
          <p className="text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: "0.2s", animationFillMode: "both" }}>
            Sign in to your account
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive animate-fade-in">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-1.5 animate-fade-in" style={{ animationDelay: "0.15s", animationFillMode: "both" }}>
              <Label htmlFor="email" className="text-xs">Email</Label>
              <div className="flex items-center rounded-md ring-offset-background transition-shadow duration-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                <Input
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.name"
                  className="rounded-r-none border-r-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoFocus
                />
                <span className="flex h-10 items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
                  @csb.com
                </span>
              </div>
            </div>

            <div className="space-y-1.5 animate-fade-in" style={{ animationDelay: "0.25s", animationFillMode: "both" }}>
              <Label htmlFor="password" className="text-xs">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="transition-shadow duration-300 focus:shadow-[0_0_0_2px_hsl(280_70%_55%_/_0.15)]"
              />
            </div>

            <div className="animate-fade-in" style={{ animationDelay: "0.35s", animationFillMode: "both" }}>
              <Button
                type="submit"
                className="w-full relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <style>{`
        @keyframes breathe1 {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.85; }
        }
        @keyframes breathe2 {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.2; }
        }
        @keyframes breathe3 {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.9; }
        }
        @keyframes breathe4 {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 0.25; }
        }
        @keyframes breathe5 {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.75; }
        }
        @keyframes breathe6 {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 0.2; }
        }
        @keyframes breathe7 {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.8; }
        }
        @keyframes loginCardEntry {
          from { opacity: 0; transform: translateY(30px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </div>
  );
}
