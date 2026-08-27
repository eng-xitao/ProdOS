import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const [impersonation, setImpersonation] = useState(null);

  async function loadProfileAndCompany(userId) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    setProfile(profileData ?? null);

    // A empresa "ativa" pode ser a própria, ou — se for equipe da
    // plataforma com uma personificação ativa (suporte a cliente) —
    // a empresa personificada. current_company_id() já resolve isso.
    const { data: activeCompanyId } = await supabase.rpc("current_company_id");

    if (activeCompanyId) {
      const { data: companyData } = await supabase
        .from("companies")
        .select("*, plans:plan_id (name, price, features, addon_prices)")
        .eq("id", activeCompanyId)
        .single();
      setCompany(companyData ?? null);
    } else {
      setCompany(null);
    }

    if (profileData?.platform_role) {
      const { data: activeImpersonation } = await supabase
        .from("platform_impersonations")
        .select("id, company_id, companies:company_id (name)")
        .eq("staff_profile_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setImpersonation(activeImpersonation ?? null);
    } else {
      setImpersonation(null);
    }
  }

  async function stopImpersonating() {
    if (impersonation) {
      await supabase.from("platform_impersonations").delete().eq("id", impersonation.id);
    }
    if (session?.user) await loadProfileAndCompany(session.user.id);
  }

  useEffect(() => {
    let initialCheckDone = false;

    // onAuthStateChange já dispara sozinho com a sessão atual assim
    // que o listener é registrado (evento INITIAL_SESSION) — não
    // precisamos chamar getSession() por fora também. Ter os dois
    // rodando em paralelo foi o que causava a corrida (um terminando
    // antes do outro, liberando a tela cedo demais).
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      // Renovação automática de token (ex: voltou pra aba depois de um
      // tempo fora) não precisa recarregar perfil/empresa — já temos
      // esse dado, e recarregar aqui é o que causava o piscar/delay.
      if (event === "TOKEN_REFRESHED") {
        if (!initialCheckDone) {
          initialCheckDone = true;
          setLoading(false);
        }
        return;
      }

      if (session?.user) {
        setProfileLoading(true);
        await loadProfileAndCompany(session.user.id);
        setProfileLoading(false);
      } else {
        setProfile(null);
        setCompany(null);
        setProfileLoading(false);
      }
      if (!initialCheckDone) {
        initialCheckDone = true;
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signUp({ email, password, fullName, companyName, segment, cnpj, address, productKey }) {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName, company_name: companyName, segment, cnpj, product_key: productKey || "prodos",
          logradouro: address?.logradouro, numero: address?.numero, bairro: address?.bairro,
          municipio: address?.municipio, uf: address?.uf, cep: address?.cep,
        },
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
    const { data: activeCompanyId } = await supabase.rpc("current_company_id");
    if (!activeCompanyId) return;
    const { data: companyData } = await supabase
      .from("companies")
      .select("*, plans:plan_id (name, price, features, addon_prices)")
      .eq("id", activeCompanyId)
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
      value={{ session, profile, company, loading, profileLoading, signUp, signIn, signOut, refreshCompany, requestPasswordReset, updatePassword, impersonation, stopImpersonating }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
