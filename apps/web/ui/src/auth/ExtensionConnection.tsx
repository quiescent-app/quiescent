import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { connectExtension } from "./connectExtension";

export default function ExtensionConnection({ extensionId }: { extensionId: string }) {
  const [state, setState] = useState<"connecting" | "connected" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setState("connecting");
    setError(null);
    try {
      await connectExtension(extensionId);
      setState("connected");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect the extension.");
      setState("error");
    }
  }

  useEffect(() => {
    let active = true;
    void connectExtension(extensionId).then(() => {
      if (active) setState("connected");
    }).catch((cause: unknown) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "Could not connect the extension.");
      setState("error");
    });
    return () => { active = false; };
  }, [extensionId]);

  return (
    <main className="landing extension-connection">
      <section className="auth-panel extension-connection-panel" aria-live="polite">
        <h1>{state === "connected" ? "Extension connected" : "Connect your extension"}</h1>
        <p>{state === "connected" ? "You can return to the extension and save this article." : state === "connecting" ? "Connecting your extension…" : error}</p>
        {state === "error" && <Button onClick={() => void connect()} type="button">Try again</Button>}
        <p><Link to="/library">Go to your library</Link></p>
      </section>
    </main>
  );
}
