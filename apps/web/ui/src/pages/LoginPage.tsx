import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
// import { Link, useLocation, useNavigate } from "react-router-dom";
// import { useEffect, useRef } from 'react';

// import { useAuth } from "@/auth/useAuth";
// import ExtensionConnection from "@/auth/ExtensionConnection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

// type ReturnLocation = { pathname?: string; search?: string; hash?: string };

export default function LoginPage() {
  // const { login, status } = useAuth();
  // const navigate = useNavigate();
  // const location = useLocation();
  // const returnTo = (location.state as { from?: ReturnLocation } | null)?.from;
  // const extensionId = new URLSearchParams(location.search).get("extensionId");
  const [agreed, setAgreed] = useState(false);
  const [email, setEmail] = useState("");
  // const [password, setPassword] = useState("");
  // const [error, setError] = useState<string | null>(null);
  // const [submitting, setSubmitting] = useState(false);

{/* handleSumbit for sending email & password user typed */}
{/* 
  // async function handleSubmit(event: FormEvent<HTMLFormElement>) {
  //   event.preventDefault();
  //   setError(null);
  //   setSubmitting(true);
  //   try {
  //     await login({ email, password });
  //     const destination = returnTo?.pathname
  //       ? returnTo.pathname + (returnTo.search ?? "") + (returnTo.hash ?? "")
  //       : "/library";
  //     if (!extensionId) navigate(destination, { replace: true });
  //   } catch (submitError) {
  //     setError(submitError instanceof Error ? submitError.message : "Sign in failed. Try again.");
  //   } finally {
  //     setSubmitting(false);
  //   }
  // }
*/}
{/* 
  if (status === "authenticated" && extensionId) {
    return <ExtensionConnection extensionId={extensionId} key={extensionId} />;
  }
*/}
  return (
    <main className="auth-shell signin-shell">
      <div className="auth-frame">
        <div className="auth-brand signin-brand" aria-label="Quiescent">
          <img className="auth-brand-mark signin-brand-mark" src="/quiescent-logo.png" alt="" />
          <span>Quiescent</span>
        </div>

        <section className="auth-panel signin-panel" aria-labelledby="login-title">
          <div className="auth-heading signin-heading">
            <h1 id="login-title">Sign in to Quiescent</h1>
            <p>New here? Signing in creates your account.</p>
          </div>

          <div className="signin-collects">
            <p>Quiescent collects:</p>
            <ul>
              <li>Your name, email and profile photo</li>
              <li>The text, title and link of articles you save</li>
              <li>Where you stopped reading</li>
              <li>How you use Quiescent, to improve it</li>
            </ul>
            <p>The extension only reads a page when you click the Q. We never sell your data.</p>
          </div>

          <div className="signin-agree">
            <input
              checked={agreed}
              id="login-agree"
              onChange={(event) => setAgreed(event.target.checked)}
              type="checkbox"
            />
            <label htmlFor="login-agree">
              I've read and agree to the <Link to="/privacypolicy">Privacy Policy</Link>
            </label>
          </div>

          <Button className="signin-google" disabled={!agreed} type="button">
            <img alt="" src="/Google.png" />
            Continue with Google
          </Button>

          <div className="signin-divider">
            <Separator aria-hidden="true" className="flex-1" />
            <span>or</span>
            <Separator aria-hidden="true" className="flex-1" />
          </div>

          <form className="auth-form signin-form">
            <div className="auth-field">
              <label htmlFor="login-email">Email</label>
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

            <Button className="signin-send" disabled={!agreed} type="submit" variant="outline">
              Send link
            </Button>
          </form>
{/*

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

            New to Quiescent? <Link to={{ pathname: "/signup", search: location.search }}>Create an account</Link>
          </p>*/}
        </section>
      </div>
    </main>
  );
}
