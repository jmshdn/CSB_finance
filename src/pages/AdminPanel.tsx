import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTeams } from "@/hooks/useTeams";
import { Loader2, UserCog, RefreshCw, Check } from "lucide-react";

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  assigned_wallet: string | null;
  must_change_password: boolean;
  is_active: boolean;
  role?: string;
}

type PendingChange = {
  type: "role" | "wallet" | "toggle_active" | "force_pw" | "reset_pw";
  userId: string;
  displayName: string;
  value?: string;
  currentActive?: boolean;
};

export default function AdminPanel() {
  const { role } = useAuth();
  const { toast } = useToast();
  const { data: teams = [] } = useTeams();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [applying, setApplying] = useState(false);

  // Pending changes keyed by `${userId}::${type}`
  const [pending, setPending] = useState<Map<string, PendingChange>>(new Map());

  const addPending = useCallback((change: PendingChange) => {
    setPending((prev) => {
      const next = new Map(prev);
      next.set(`${change.userId}::${change.type}`, change);
      return next;
    });
  }, []);

  const hasPending = pending.size > 0;

  const fetchUsers = async () => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const profiles = profilesRes.data ?? [];
    const roles = rolesRes.data ?? [];

    const merged = profiles.map((p: any) => ({
      ...p,
      role: roles.find((r: any) => r.user_id === p.user_id)?.role,
    }));

    setUsers(merged);
    setPending(new Map());
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getRoleLabel = (r?: string) => {
    if (r === "admin") return "Admin";
    if (r === "team_user") return "Team Leader";
    return "Normal User";
  };

  // Get effective value considering pending changes
  const getEffectiveRole = (u: UserProfile) => {
    const key = `${u.user_id}::role`;
    if (pending.has(key)) return pending.get(key)!.value!;
    return u.role === "admin" ? "admin" : u.role === "team_user" ? "team_leader" : "normal_user";
  };

  const getEffectiveWallet = (u: UserProfile) => {
    const key = `${u.user_id}::wallet`;
    if (pending.has(key)) return pending.get(key)!.value!;
    return u.assigned_wallet ?? "none";
  };

  const isChangedRole = (u: UserProfile) => pending.has(`${u.user_id}::role`);
  const isChangedWallet = (u: UserProfile) => pending.has(`${u.user_id}::wallet`);
  const hasPendingAction = (u: UserProfile, type: string) => pending.has(`${u.user_id}::${type}`);

  // Queue changes instead of applying immediately
  const handleRoleChange = (userId: string, displayName: string, newRole: string) => {
    addPending({ type: "role", userId, displayName, value: newRole });
  };

  const handleWalletChange = (userId: string, displayName: string, wallet: string) => {
    addPending({ type: "wallet", userId, displayName, value: wallet });
  };

  const handleToggleActive = (userId: string, displayName: string, isActive: boolean) => {
    addPending({ type: "toggle_active", userId, displayName, currentActive: isActive });
  };

  const handleForcePasswordChange = (userId: string, displayName: string) => {
    addPending({ type: "force_pw", userId, displayName });
  };

  const handleResetPassword = (userId: string, displayName: string) => {
    addPending({ type: "reset_pw", userId, displayName });
  };

  // Apply all pending changes
  const applyAll = async () => {
    setApplying(true);
    const errors: string[] = [];

    for (const [, change] of pending) {
      try {
        switch (change.type) {
          case "role": {
            await supabase.from("user_roles").delete().eq("user_id", change.userId);
            if (change.value !== "normal_user") {
              const dbRole = change.value === "team_leader" ? "team_user" : change.value;
              await supabase.from("user_roles").insert({ user_id: change.userId, role: dbRole as any });
            }
            break;
          }
          case "wallet": {
            const value = change.value === "none" ? null : change.value;
            await supabase.from("profiles").update({ assigned_wallet: value }).eq("user_id", change.userId);
            break;
          }
          case "toggle_active": {
            const newActive = !change.currentActive;
            await supabase.from("profiles").update({ is_active: newActive }).eq("user_id", change.userId);
            break;
          }
          case "force_pw": {
            await supabase.from("profiles").update({ must_change_password: true }).eq("user_id", change.userId);
            break;
          }
          case "reset_pw": {
            const { error } = await supabase.functions.invoke("admin-users", {
              body: { action: "reset-password", user_id: change.userId },
            });
            if (error) throw error;
            break;
          }
        }
      } catch (err: any) {
        errors.push(`${change.displayName} (${change.type}): ${err.message}`);
      }
    }

    setApplying(false);

    if (errors.length > 0) {
      toast({ title: "Some changes failed", description: errors.join("; "), variant: "destructive" });
    } else {
      toast({ title: "All changes applied", description: `${pending.size} change(s) saved successfully.` });
    }

    fetchUsers();
  };

  const handleSeedUsers = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "seed" },
      });
      if (error) throw error;
      toast({
        title: "Users seeded",
        description: `Processed ${data?.results?.length ?? 0} users`,
      });
      fetchUsers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  if (role !== "admin") {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Admin Panel</h2>
          <p className="text-sm text-muted-foreground">
            Manage users, roles, and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={handleSeedUsers} disabled={seeding}>
            {seeding ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserCog className="mr-1.5 h-3.5 w-3.5" />
            )}
            Seed Users
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Apply button bar */}
          {hasPending && (
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <p className="text-sm font-medium">
                {pending.size} pending change{pending.size > 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPending(new Map())}>
                  Discard
                </Button>
                <Button size="sm" onClick={applyAll} disabled={applying}>
                  {applying ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Apply Changes
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <span className="font-medium">{u.display_name}</span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={getEffectiveRole(u)}
                        onValueChange={(v) => handleRoleChange(u.user_id, u.display_name, v)}
                      >
                        <SelectTrigger
                          className={`h-8 w-32 text-xs ${isChangedRole(u) ? "ring-2 ring-primary/50" : ""}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="team_leader">Team Leader</SelectItem>
                          <SelectItem value="normal_user">Normal User</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={getEffectiveWallet(u)}
                        onValueChange={(v) => handleWalletChange(u.user_id, u.display_name, v)}
                      >
                        <SelectTrigger
                          className={`h-8 w-28 text-xs ${isChangedWallet(u) ? "ring-2 ring-primary/50" : ""}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {teams.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.is_active ? "default" : "destructive"}
                        className="text-[10px]"
                      >
                        {u.is_active ? "Active" : "Disabled"}
                      </Badge>
                      {hasPendingAction(u, "toggle_active") && (
                        <Badge variant="outline" className="ml-1 text-[10px] border-primary/50">
                          pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.must_change_password && (
                        <Badge variant="outline" className="text-[10px]">
                          Must change
                        </Badge>
                      )}
                      {(hasPendingAction(u, "force_pw") || hasPendingAction(u, "reset_pw")) && (
                        <Badge variant="outline" className="ml-1 text-[10px] border-primary/50">
                          pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleToggleActive(u.user_id, u.display_name, u.is_active)}
                        >
                          {u.is_active ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleForcePasswordChange(u.user_id, u.display_name)}
                        >
                          Force PW
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleResetPassword(u.user_id, u.display_name)}
                        >
                          Reset PW
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
