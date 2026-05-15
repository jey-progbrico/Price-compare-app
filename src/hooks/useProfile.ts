"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "admin" | "adherant" | "manager" | "utilisateur";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  created_at: string;
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;
        setProfile(data);
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [supabase]);

  const isAdmin = profile?.role === "admin";
  const isAdherant = profile?.role === "adherant";
  const isManager = profile?.role === "manager";
  const isStandardUser = profile?.role === "utilisateur";

  return {
    profile,
    isAdmin,
    isAdherant,
    isManager,
    isStandardUser,
    loading,
    error,
    refresh: async () => {
       setLoading(true);
       // Simple refresh logic could be added here
    }
  };
}
