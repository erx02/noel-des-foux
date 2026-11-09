import { useState, type FormEvent } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabaseConfigError } from "../lib/supabase";

export function LoginPage() {
  const { signIn, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await signIn(email, password);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand-mark" aria-hidden="true">❄</div>
        <p className="eyebrow">La hotte de la famille</p>
        <h1 id="login-title">La liste au Papa Noël des Foux</h1>
        <p className="muted">
          Connecte-toi pour retrouver les idées de cadeaux de tes proches.
        </p>
        {supabaseConfigError ? (
          <div className="notice notice-error" role="alert">
            La connexion n’est pas encore configurée. Renseigne
            {" "}VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans le fichier .env.local.
          </div>
        ) : (
          <form className="stack-form" onSubmit={handleSubmit}>
            <label>
              Adresse e-mail
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearAuthError();
                }}
              />
            </label>
            <label>
              Mot de passe
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearAuthError();
                }}
              />
            </label>
            {authError && <p className="form-error" role="alert">{authError}</p>}
            <button className="button button-primary button-wide" disabled={busy}>
              {busy ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        )}
        <p className="login-footnote">
          L’accès se fait sur invitation. Demande à l’administrateur de ta famille
          de créer ton compte.
        </p>
      </section>
    </main>
  );
}
