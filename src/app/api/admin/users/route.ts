import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Utilisation du service role pour les actions d'administration (auth.users)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 * Liste tous les profils utilisateurs (Admin seulement).
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Vérifier le rôle de l'appelant
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ results: profiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/users
 * Crée un nouvel utilisateur (Admin seulement).
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user: caller } } = await supabase.auth.getUser();

  if (!caller) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Vérifier le rôle de l'appelant
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, password, role } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    // Validation des rôles autorisés
    const validRoles = ["admin", "adherant", "manager", "utilisateur"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
    }

    // 1. Créer l'utilisateur dans auth.users via l'API Admin
    console.log("[API-ADMIN-USERS] Étape 1: Création auth.user pour:", email);
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, display_name: body.display_name }
    });

    if (createError) {
      console.error("[API-ADMIN-USERS] Erreur Étape 1 (auth.admin.createUser):", createError);
      throw createError;
    }
    console.log("[API-ADMIN-USERS] Étape 1 Réussie. UID:", newUser.user.id);

    // 2. Attendre un court instant pour laisser le trigger éventuel s'exécuter
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Vérifier si un profile a été créé par un trigger SQL
    console.log("[API-ADMIN-USERS] Étape 3: Vérification existence profil UID:", newUser.user.id);
    const { data: existingProfile, error: fetchProfileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", newUser.user.id)
      .maybeSingle();

    if (fetchProfileError) {
      console.error("[API-ADMIN-USERS] Erreur Étape 3 (check profile):", fetchProfileError);
    }

    if (!existingProfile) {
      console.log("[API-ADMIN-USERS] Étape 4: Profil inexistant, création manuelle...");
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert([
          {
            id: newUser.user.id,
            email: email,
            role: role,
            display_name: body.display_name || null
          }
        ]);
      
      if (profileError) {
        console.error("[API-ADMIN-USERS] Erreur Étape 4 (insert profile):", profileError);
        console.log("[API-ADMIN-USERS] Nettoyage: suppression auth.user UID:", newUser.user.id);
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        throw profileError;
      }
      console.log("[API-ADMIN-USERS] Étape 4 Réussie (Insert manuel).");
    } else {
      console.log("[API-ADMIN-USERS] Étape 5: Profil existant (Trigger), mise à jour du rôle/nom:", role);
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ role, display_name: body.display_name || existingProfile.display_name })
        .eq("id", newUser.user.id);
      
      if (updateError) {
        console.error("[API-ADMIN-USERS] Erreur Étape 5 (update profile):", updateError);
        throw updateError;
      }
      console.log("[API-ADMIN-USERS] Étape 5 Réussie (Update trigger profile).");
    }

    return NextResponse.json({ success: true, user: newUser.user });
  } catch (err: any) {
    console.error("[API-ADMIN-USERS] Erreur fatale capturée:", err);
    return NextResponse.json({ 
      error: err.message || "Erreur lors de la création",
      details: err.details,
      code: err.code
    }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users
 * Met à jour un utilisateur (Admin seulement).
 * Supporte : reset password, update role, update display_name.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user: caller } } = await supabase.auth.getUser();

  if (!caller) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, password, role, display_name } = body;

    if (!userId) {
      return NextResponse.json({ error: "ID utilisateur manquant" }, { status: 400 });
    }

    // 1. Mise à jour auth.users si password ou metadata changent
    if (password || role || display_name) {
      const updateData: any = {};
      if (password) {
        if (password.length < 6) throw new Error("Mot de passe trop court");
        updateData.password = password;
      }
      if (role || display_name) {
        updateData.user_metadata = {};
        if (role) updateData.user_metadata.role = role;
        if (display_name !== undefined) updateData.user_metadata.display_name = display_name;
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
      if (authError) throw authError;
    }

    // 2. Mise à jour de la table profiles
    const profileUpdate: any = {};
    if (role) profileUpdate.role = role;
    if (display_name !== undefined) profileUpdate.display_name = display_name;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", userId);
      
      if (profileError) throw profileError;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API-ADMIN-USERS] Erreur PATCH:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
