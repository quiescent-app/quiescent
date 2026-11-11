import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ReturnLocation = { pathname?: string; search?: string; hash?: string };

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { from?: ReturnLocation } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      const destination = returnTo?.pathname 
        ? returnTo.pathname + (returnTo.search ?? "") + (returnTo.hash ?? "")
        : "/library";
      navigate(destination, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sign in failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-frame">
        <div className="auth-brand" aria-label="Quiescent">
          <img className="auth-brand-mark" src="/quiescent-logo.png" alt="" />
          <span>Quiescent</span>
        </div>

        <section className="auth-panel" aria-labelledby="login-title">
          <div className="auth-heading">
            <h1 id="login-title">Welcome back</h1>
            <p>Sign in to continue to your reading library.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="login-email">Email address</label>
              <Input
                autoComplete="email"
                autoFocus
                id="login-email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">Password</label>
              <Input
                autoComplete="current-password"
                id="login-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>

            {error && <p className="auth-error" role="alert">{error}</p>}

            <Button className="auth-submit" disabled={submitting} size="lg" type="submit">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="auth-switch">
            New to Quiescent? <Link to="/signup">Create an account</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
