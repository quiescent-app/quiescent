import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
//import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "cn";
//import { useEffect, useRef } from 'react';
//import { useAuth } from "@/auth/useAuth";
// import ExtensionConnection from "@/auth/ExtensionConnection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { QuiescentLogo } from "@/components/custom/QuiescentLogo";
import { ThemeToggle } from "@/components/custom/ThemeToggle";
import { useAppearance } from "@/hooks/use-appearance";

//type ReturnLocation = { pathname?: string; search?: string; hash?: string };

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
  const { dark, toggle } = useAppearance();
//  const [password, setPassword] = useState("");
//  const [error, setError] = useState<string | null>(null);
//  const [submitting, setSubmitting] = useState(false);

  return (
    <div className={cn("q-theme signin-page", dark && "dark")}>
      <nav className="signin-nav" aria-label="Main">
        <Link aria-label="Quiescent home" className="signin-home" to="/">
          <QuiescentLogo className="signin-home-mark" dark={dark} />
          <span>Quiescent</span>
        </Link>
        <Link className="signin-back" to="/">Back to home</Link>
        <ThemeToggle dark={dark} onToggle={toggle} />
      </nav>

      <main className="signin-shell">
        <aside className="signin-intro" aria-label="About Quiescent">
          <div className="signin-intro-content">
            <h2 className="signin-intro-title">Read deeply in a noisy world.</h2>
            <p className="signin-intro-text">
              Save what’s worth reading, highlight what stays with you, and pick up where you left off.
            </p>

{/* Illustration of the reader, not real content */}
            <div className="signin-preview" aria-hidden="true">
              <div className="signin-preview-header">
                <span>Focused reader</span>
                <span>4 min read</span>
              </div>
              <div className="signin-preview-body">
                <h3>The pleasure of reading slowly</h3>
                <p>
                  Some ideas take time to settle. On a second pass, a sentence you barely noticed can change how
                  you understand the whole piece.
                </p>
                <p><mark>Give yourself time to stay with an idea.</mark></p>
              </div>
              <div className="signin-preview-footer">
                <span>Reading progress</span>
                <Progress className="signin-preview-progress" value={64} />
                <span className="signin-preview-percent">64%</span>
              </div>
              <div className="signin-preview-saved">✓ Saved to Read Later</div>
            </div>
          </div>
        </aside>

        <section className="signin-panel" aria-labelledby="login-title">
          <div className="signin-card">
            <h1 id="login-title">Welcome to Quiescent.</h1>
            <p className="signin-lead">Sign in or create an account to save articles and continue reading.</p>

            <div className="signin-agree">
              <input
                aria-describedby="login-agree-hint"
                checked={agreed}
                id="login-agree"
                onChange={(event) => setAgreed(event.target.checked)}
                type="checkbox"
              />
              <span>
                <label htmlFor="login-agree">I've read and agree to the </label>
                <Link to="/privacy">Privacy Policy</Link>
                <label htmlFor="login-agree">.</label>
              </span>
            </div>
            <p className="signin-hint" id="login-agree-hint">Please open the Privacy Policy before accepting.</p>
{/* "Continue with Google" based on web demo */}

            <Button className="signin-action signin-google" disabled={!agreed} type="button">
              <span className="signin-google-icon">
                <img alt="" src="/Google.png" />
              </span>
              Continue with Google
            </Button>

            <div className="signin-divider">
              <Separator aria-hidden="true" className="flex-1" />
              <span>or continue with email</span>
              <Separator aria-hidden="true" className="flex-1" />
            </div>

            <form className="signin-form" >
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

              <Button className="signin-action signin-send" disabled={!agreed} type="submit" variant="outline">
                Send sign-in link
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

            <Button className="auth-submit" disabled={!agreed || submitting} size="lg" type="submit">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="auth-switch">

            New to Quiescent? <Link to={{ pathname: "/signup", search: location.search }}>Create an account</Link>
          </p>*/}
{/* How the Quiescent collects your data part */}
{/*
          <details className="signin-details">
            <summary>How Quiescent uses your data</summary>
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
          </details>
*/}
          </div>
        </section>
      </main>
    </div>
  );
}
