import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import Sidebar from "../../components/Sidebar";
import "../../components/Shell.css";
import "./Login.css";

export default function Login() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return null;
  if (session) return <Navigate to="/profile" replace />;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/profile" },
    });
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="shell">
      <Sidebar variant="marketing" />
      <main className="login-main">
      <div className="login-card">
        {sent ? (
          <>
            <h1>Check your email</h1>
            <p>
              We sent a sign-in link to <b>{email}</b>. Open it on this device to continue.
            </p>
          </>
        ) : (
          <>
            <h1>Sign in</h1>
            <p>No password — we'll email you a one-time link.</p>
            <form onSubmit={handleSend}>
              <input
                type="email"
                required
                placeholder="you@yourschool.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={sending}>
                {sending ? "Sending…" : "Send sign-in link"}
              </button>
            </form>
            {error && <p className="login-error mono">{error}</p>}
          </>
        )}
      </div>
      </main>
    </div>
  );
}
