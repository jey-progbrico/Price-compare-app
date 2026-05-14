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
      user_metadata: { role }
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
      // On ne throw pas forcément ici, on tente quand même la suite ou le nettoyage
    }

    if (!existingProfile) {
      console.log("[API-ADMIN-USERS] Étape 4: Profil inexistant, création manuelle...");
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert([
          {
            id: newUser.user.id,
            email: email,
            role: role
          }
        ]);
      
      if (profileError) {
        console.error("[API-ADMIN-USERS] Erreur Étape 4 (insert profile):", profileError);
        // Nettoyage si échec de la création du profil
        console.log("[API-ADMIN-USERS] Nettoyage: suppression auth.user UID:", newUser.user.id);
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        throw profileError;
      }
      console.log("[API-ADMIN-USERS] Étape 4 Réussie (Insert manuel).");
    } else {
      console.log("[API-ADMIN-USERS] Étape 5: Profil existant (Trigger), mise à jour du rôle:", role);
      // Si le profil existe (via trigger), on s'assure que le rôle est correct
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ role })
        .eq("id", newUser.user.id);
      
      if (updateError) {
        console.error("[API-ADMIN-USERS] Erreur Étape 5 (update role):", updateError);
        throw updateError;
      }
      console.log("[API-ADMIN-USERS] Étape 5 Réussie (Update trigger profile).");
    }

    return NextResponse.json({ success: true, user: newUser.user });
  } catch (err: any) {
    console.error("[API-ADMIN-USERS] Erreur fatale capturée:", {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
      error_object: err
    });
    return NextResponse.json({ 
      error: err.message || "Erreur lors de la création",
      details: err.details,
      code: err.code
    }, { status: 500 });
  }
}
