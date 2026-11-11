import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import "./auth.css";

export default function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signUp({ email, password });
      navigate("/library", { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Account creation failed. Try again.");
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

        <section className="auth-panel" aria-labelledby="signup-title">
          <div className="auth-heading">
            <h1 id="signup-title">Make room to read</h1>
            <p>Create an account to keep your reading in one place.</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="signup-email">Email address</label>
              <Input
                autoComplete="email"
                autoFocus
                id="signup-email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="signup-password">Password</label>
              <Input
                autoComplete="new-password"
                id="signup-password"
                minLength={8}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              <span className="auth-hint">Use at least 8 characters.</span>
            </div>

            {error && <p className="auth-error" role="alert">{error}</p>}

            <Button className="auth-submit" disabled={submitting} size="lg" type="submit">
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
