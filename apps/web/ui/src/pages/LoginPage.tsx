import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";

import ExtensionConnection from "@/auth/ExtensionConnection";
import { useAuth } from "@/auth/useAuth";
import AuthPageLayout, { AuthPrivacyConsent } from "@/components/custom/AuthPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const { login, status } = useAuth();
  const location = useLocation();
  const extensionId = new URLSearchParams(location.search).get("extensionId");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreed || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sign in failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "authenticated" && extensionId) {
    return <ExtensionConnection extensionId={extensionId} key={extensionId} />;
  }

  return (
    <AuthPageLayout title="Welcome to Quiescent" description="Sign in or create an account to save articles and continue reading.">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="login-email">Email address</label>
          <Input
            autoComplete="email"
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

        <AuthPrivacyConsent agreed={agreed} onChange={setAgreed} />

        {error && <p className="auth-error" role="alert">{error}</p>}

        <Button className="auth-submit" disabled={!agreed || submitting} size="lg" type="submit">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="auth-switch">
        New to Quiescent? <Link to={{ pathname: "/signup", search: location.search }} state={location.state}>Create an account</Link>
      </p>
    </AuthPageLayout>
  );
}
