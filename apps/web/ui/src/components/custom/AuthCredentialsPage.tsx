import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";

import ExtensionConnection from "@/auth/ExtensionConnection";
import { useAuth } from "@/auth/useAuth";
import AuthPageLayout, { AuthPrivacyConsent } from "@/components/custom/AuthPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const pageCopy = {
  login: {
    title: "Welcome to Quiescent",
    description: "Sign in or create an account to save articles and continue reading.",
    submit: "Sign in",
    submitting: "Signing in…",
    error: "Sign in failed. Try again.",
    alternatePrompt: "New to Quiescent?",
    alternatePath: "/signup",
    alternateAction: "Create an account",
  },
  signup: {
    title: "Make room to read",
    description: "Create an account to keep your reading in one place.",
    submit: "Create account",
    submitting: "Creating account…",
    error: "Account creation failed. Try again.",
    alternatePrompt: "Already have an account?",
    alternatePath: "/signin",
    alternateAction: "Sign in",
  },
};

export default function AuthCredentialsPage({ mode }: { mode: keyof typeof pageCopy }) {
  const { login, signUp, status } = useAuth();
  const creatingAccount = mode === "signup";
  const copy = pageCopy[mode];
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
      const submitCredentials = creatingAccount ? signUp : login;
      await submitCredentials({ email, password });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "authenticated" && extensionId) {
    return <ExtensionConnection extensionId={extensionId} key={extensionId} />;
  }

  return (
    <AuthPageLayout title={copy.title} description={copy.description}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthPrivacyConsent agreed={agreed} onChange={setAgreed} />

        <div className="auth-field">
          <label htmlFor={`${mode}-email`}>Email address</label>
          <Input
            autoComplete="email"
            id={`${mode}-email`}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </div>

        <div className="auth-field">
          <label htmlFor={`${mode}-password`}>Password</label>
          <Input
            aria-describedby={creatingAccount ? "signup-password-hint" : undefined}
            autoComplete={creatingAccount ? "new-password" : "current-password"}
            id={`${mode}-password`}
            minLength={creatingAccount ? 8 : undefined}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {creatingAccount && <span className="auth-hint" id="signup-password-hint">Use at least 8 characters.</span>}
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <Button className="auth-submit" disabled={!agreed || submitting} size="lg" type="submit">
          {submitting ? copy.submitting : copy.submit}
        </Button>
      </form>

      <p className="auth-switch">
        {copy.alternatePrompt}{" "}
        <Link to={{ pathname: copy.alternatePath, search: location.search }} state={location.state}>{copy.alternateAction}</Link>
      </p>
    </AuthPageLayout>
  );
}
