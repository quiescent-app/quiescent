import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { connectExtension } from "@/auth/connectExtension";
import { useAuth } from "@/auth/useAuth";

export default function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const extensionId = params.get("extensionId");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const connecting = useRef(false);
  useEffect(() => {
    if (status !== "authenticated" || !extensionId || connected || connecting.current) return;
    connecting.current = true;
    void connectExtension(extensionId).then(() => setConnected(true)).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Connection failed."));
  }, [status, extensionId, connected]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
      await login(String(values.get("email")), String(values.get("password")));
      if (!extensionId) navigate("/library");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign in failed."); }
  }
  if (connected) return <main><h1>Extension connected</h1><p>You can return to Quiescent and save articles.</p></main>;
  return <main><h1>Sign in</h1>{status !== "authenticated" && <form onSubmit={(event) => void submit(event)}><label>Email <input name="email" type="email" required /></label><label>Password <input name="password" type="password" required /></label><button>Sign in</button></form>}{status === "authenticated" && extensionId && !error && <p>Connecting extension...</p>}{error && <p role="alert">{error}</p>}<Link to={`/signup${extensionId ? `?extensionId=${extensionId}` : ""}`}>Create account</Link></main>;
}
