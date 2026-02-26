import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    // For seed action: allow if no users exist yet (bootstrap), otherwise require admin
    const authHeader = req.headers.get("Authorization");
    
    if (action === "seed") {
      // Check if any auth users exist
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      const hasUsers = (existingUsers?.users?.length ?? 0) > 0;

      if (hasUsers) {
        // Users exist — require admin auth
        if (!authHeader) {
          return new Response(
            JSON.stringify({ error: "Admin auth required" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const token = authHeader.replace("Bearer ", "");
        const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
        if (!caller) {
          return new Response(
            JSON.stringify({ error: "Invalid token" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data: callerRole } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", caller.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!callerRole) {
          return new Response(
            JSON.stringify({ error: "Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      // If no users exist, allow seed without auth (bootstrap mode)
    } else {
      // All other actions require admin auth
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "No authorization header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
      if (!caller) {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: callerRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!callerRole) {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ===== SEED USERS =====
    if (action === "seed") {
      const { data: persons, error: personsError } = await supabaseAdmin
        .from("team_persons")
        .select("person_name, team");

      if (personsError) throw personsError;

      // Build person → non-CSB team mapping (first match)
      const personTeamMap: Record<string, string> = {};
      for (const p of persons!) {
        if (["Team", "Internal", "All"].includes(p.person_name)) continue;
        if (p.team !== "CSB" && !personTeamMap[p.person_name]) {
          personTeamMap[p.person_name] = p.team;
        }
      }

      const results: Array<Record<string, unknown>> = [];

      for (const [name, team] of Object.entries(personTeamMap)) {
        const email = `${name.toLowerCase()}@csb.com`;

        const { data: newUser, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password: "123",
            email_confirm: true,
            user_metadata: { display_name: name },
          });

        if (createError) {
          const msg = createError.message ?? "";
          if (msg.includes("already") || msg.includes("exists") || msg.includes("registered")) {
            results.push({ name, email, status: "already_exists" });
          } else {
            results.push({ name, email, status: "error", error: msg });
          }
          continue;
        }

        // Update profile with wallet assignment
        await supabaseAdmin
          .from("profiles")
          .update({
            assigned_wallet: team,
            must_change_password: true,
            is_active: true,
          })
          .eq("user_id", newUser.user.id);

        // JJS = admin role
        if (name === "JJS") {
          await supabaseAdmin.from("user_roles").insert({
            user_id: newUser.user.id,
            role: "admin",
          });
        }

        results.push({
          name,
          email,
          team,
          status: "created",
          role: name === "JJS" ? "admin" : "normal_user",
        });
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== CREATE SINGLE USER =====
    if (action === "create-user") {
      const { name, role: userRole, wallet } = body;
      if (!name) throw new Error("name required");
      const email = `${name.toLowerCase()}@csb.com`;

      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: "123",
          email_confirm: true,
          user_metadata: { display_name: name },
        });

      if (createError) throw createError;

      await supabaseAdmin
        .from("profiles")
        .update({
          assigned_wallet: wallet || null,
          must_change_password: true,
          is_active: true,
        })
        .eq("user_id", newUser.user.id);

      if (userRole === "admin") {
        await supabaseAdmin.from("user_roles").insert({
          user_id: newUser.user.id,
          role: "admin",
        });
      } else if (userRole === "team_user") {
        await supabaseAdmin.from("user_roles").insert({
          user_id: newUser.user.id,
          role: "team_user",
        });
      }

      return new Response(JSON.stringify({ success: true, email, role: userRole || "normal_user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== RESET PASSWORD =====
    if (action === "reset-password") {
      const { user_id } = body;
      if (!user_id) throw new Error("user_id required");

      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
        password: "123",
      });
      if (error) throw error;

      await supabaseAdmin
        .from("profiles")
        .update({ must_change_password: true })
        .eq("user_id", user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
