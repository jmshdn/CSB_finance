import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useActivityLogs, logActivity } from "@/hooks/useActivityLogs";
import { AlertCircle, Loader2, Shield, Activity, LogOut } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import AdminMonthControls from "@/components/AdminMonthControls";

export default function SettingsPage() {
  const { signOut, role } = useAuth();
  const navigate = useNavigate();
  const { data: activityLogs = [], isLoading: logsLoading } = useActivityLogs();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your security and view activity</p>
      </div>

      <Tabs defaultValue="security" className="space-y-4">
        <TabsList>
          <TabsTrigger value="security" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Change Password
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Activity Log
          </TabsTrigger>
          {role === "admin" && (
            <TabsTrigger value="month-manager" className="gap-1.5">
              Month Manager
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Log</CardTitle>
              <CardDescription>Recent account activity</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : activityLogs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No activity yet</p>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Action</TableHead>
                        <TableHead className="text-xs">Details</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs font-medium">{log.action}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{log.details || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateTime(log.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {role === "admin" && (
          <TabsContent value="month-manager">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Month Manager</CardTitle>
                <CardDescription>Create, close, or unlock month periods.</CardDescription>
              </CardHeader>
              <CardContent>
                <AdminMonthControls />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function SecurityTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPw.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPw !== confirmPw) {
      setError("Passwords do not match");
      return;
    }
    if (newPw === "123") {
      setError("Cannot use default password");
      return;
    }

    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: currentPw,
    });
    if (signInError) {
      setError("Current password is incorrect");
      setSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPw });
    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    if (user) {
      await logActivity(user.id, "Password changed", "Password updated from settings");
    }

    toast({ title: "Password changed successfully" });
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change Password</CardTitle>
        <CardDescription>Update your password. Requires current password verification.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleChangePassword} className="max-w-sm space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Current Password</Label>
            <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">New Password</Label>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min 6 characters" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confirm New Password</Label>
            <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
          </div>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
