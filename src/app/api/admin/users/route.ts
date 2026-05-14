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
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role } // Optionnel: utile pour les triggers
    });

    if (createError) throw createError;

    // 2. Vérifier si un profile a été créé par un trigger SQL
    // S'il n'y a pas de trigger, on le crée manuellement ici
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", newUser.user.id)
      .single();

    if (!existingProfile) {
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
        // Nettoyage si échec de la création du profil
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        throw profileError;
      }
    } else {
      // Si le profil existe (via trigger), on s'assure que le rôle est correct
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ role })
        .eq("id", newUser.user.id);
      
      if (updateError) throw updateError;
    }

    return NextResponse.json({ success: true, user: newUser.user });
  } catch (err: any) {
    console.error("[API-ADMIN-USERS] Erreur:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
