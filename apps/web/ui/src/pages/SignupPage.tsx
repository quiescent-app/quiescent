import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
export default function SignupPage() {
  const { signup } = useAuth(); const navigate = useNavigate(); const [params] = useSearchParams(); const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const email = String(f.get("email")); const password = String(f.get("password")); if (password !== String(f.get("confirm"))) { setError("Passwords do not match."); return; } try { await signup(email, password); navigate(params.get("extensionId") ? `/login?extensionId=${params.get("extensionId")}` : "/library"); } catch (x) { setError(x instanceof Error ? x.message : "Sign up failed"); } }
  return <main><h1>Create account</h1><form onSubmit={(e) => void submit(e)}><label>Email <input name="email" type="email" required /></label><label>Password <input name="password" type="password" minLength={8} required /></label><label>Confirm password <input name="confirm" type="password" minLength={8} required /></label><button>Create account</button></form>{error && <p role="alert">{error}</p>}<Link to={params.get("extensionId") ? `/login?extensionId=${params.get("extensionId")}` : "/login"}>Sign in</Link></main>;
}
