import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";

import ExtensionConnection from "@/auth/ExtensionConnection";
import { useAuth } from "@/auth/useAuth";
import AuthPageLayout, { AuthPrivacyConsent } from "@/components/custom/AuthPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const { signUp, status } = useAuth();
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
      await signUp({ email, password });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Account creation failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "authenticated" && extensionId) {
    return <ExtensionConnection extensionId={extensionId} key={extensionId} />;
  }

  return (
    <AuthPageLayout title="Make room to read" description="Create an account to keep your reading in one place.">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="signup-email">Email address</label>
          <Input
            autoComplete="email"
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

        <AuthPrivacyConsent agreed={agreed} onChange={setAgreed} />

        {error && <p className="auth-error" role="alert">{error}</p>}

        <Button className="auth-submit" disabled={!agreed || submitting} size="lg" type="submit">
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to={{ pathname: "/signin", search: location.search }} state={location.state}>Sign in</Link>
      </p>
    </AuthPageLayout>
  );
}
