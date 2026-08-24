import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  async function loadProfileAndCompany(userId) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    setProfile(profileData ?? null);

    if (profileData?.company_id) {
      const { data: companyData } = await supabase
        .from("companies")
        .select("*, plans:plan_id (name, price, features)")
        .eq("id", profileData.company_id)
        .single();
      setCompany(companyData ?? null);
    } else {
      setCompany(null);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await loadProfileAndCompany(session.user.id);
      setLoading(false);
      setProfileLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        // Trava a tela até termos certeza do status de aprovação da
        // empresa — senão, por uma fração de segundo, a área privada
        // renderiza antes de saber se a empresa está bloqueada.
        setProfileLoading(true);
        await loadProfileAndCompany(session.user.id);
        setProfileLoading(false);
      } else {
        setProfile(null);
        setCompany(null);
        setProfileLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signUp({ email, password, fullName, companyName, segment }) {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, company_name: companyName, segment },
      },
    });
  }

  async function signIn({ email, password }) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshCompany() {
    if (!profile?.company_id) return;
    const { data: companyData } = await supabase
      .from("companies")
      .select("*, plans:plan_id (name, price, features)")
      .eq("id", profile.company_id)
      .single();
    setCompany(companyData ?? null);
  }

  async function requestPasswordReset(email) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-senha`,
    });
  }

  async function updatePassword(newPassword) {
    return supabase.auth.updateUser({ password: newPassword });
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, company, loading, profileLoading, signUp, signIn, signOut, refreshCompany, requestPasswordReset, updatePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
