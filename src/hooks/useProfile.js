import { useState, useEffect } from "react";
import { zimrent } from "@/api/zimrentClient";
import { useAuth } from "@/lib/AuthContext";

// Loads the current user's Profile entity (rental role, verification, trust).
// The Profile is separate from the built-in User; created during onboarding.
export function useProfile() {
  const { user, isAuthenticated, authChecked } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || !user) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const profile = await zimrent.profiles.me();
        if (active) {
          setProfile(profile);
          setLoading(false);
        }
      } catch (e) {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user, isAuthenticated, authChecked]);

  const refresh = async () => {
    if (!user) return;
    try {
      const profile = await zimrent.profiles.me();
      setProfile(profile);
    } catch (e) { /* ignore */ }
  };

  return { profile, loading, refresh, isAdmin: user?.role === "admin" };
}