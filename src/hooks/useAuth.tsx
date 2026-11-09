import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function safeAuthMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String(error.message).toLowerCase();
    if (message.includes("invalid login") || message.includes("invalid credentials")) {
      return "Adresse e-mail ou mot de passe incorrect.";
    }
  }
  return "Connexion impossible pour le moment. Réessaie plus tard.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setLoading(false);
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data: sessionData, error }) => {
        if (!active) return;
        if (error) setAuthError("Impossible de vérifier la session. Recharge la page.");
        setSession(sessionData.session);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setAuthError("Impossible de vérifier la session. Recharge la page.");
        setLoading(false);
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      authError,
      clearAuthError: () => setAuthError(null),
      signIn: async (email, password) => {
        if (!supabase) throw new Error("La connexion Supabase n’est pas configurée.");
        setAuthError(null);
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (error) setAuthError(safeAuthMessage(error));
        } catch (error) {
          setAuthError(safeAuthMessage(error));
        }
      },
      signOut: async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error("La déconnexion n’a pas abouti. Réessaie.");
      },
    }),
    [authError, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans AuthProvider.");
  return context;
}
