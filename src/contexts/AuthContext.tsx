import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AuthUser as User } from "@/integrations/supabase/client";

export type UserRole = "admin" | "team_leader" | "normal_user";

interface Profile {
  display_name: string;
  assigned_wallet: string | null;
  must_change_password: boolean;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: UserRole;
  wallet: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole>("normal_user");
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string) => {
    const [profileRes, roleRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, assigned_wallet, must_change_password, is_active")
        .eq("user_id", userId)
        .single(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data as Profile);
    }

    if (roleRes.data?.role === "admin") setRole("admin");
    else if (roleRes.data?.role === "team_user") setRole("team_leader");
    else setRole("normal_user");

    setIsLoading(false);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setUser(null);
          setProfile(null);
          setRole("normal_user");
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signIn = async (email: string, password: string) => {
    if (!email.endsWith("@csb.com")) {
      return { error: "Only @csb.com emails are allowed" };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await fetchUserData(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        wallet: profile?.assigned_wallet ?? null,
        isLoading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
