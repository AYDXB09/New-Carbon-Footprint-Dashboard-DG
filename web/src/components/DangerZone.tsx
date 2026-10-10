import { useState } from "react";
import { supabase } from "../lib/supabase";
import "./DangerZone.css";

// Self-service account deletion, backed by the delete_own_account() RPC in
// supabase/migrations/0012_delete_own_account.sql. That migration is written
// but NOT yet applied to the live project (see its header) — until it is,
// confirming here fails with a "function not found" error, shown below rather
// than swallowed. Type-DELETE-to-confirm mirrors blueprep-sat / football-journal.
export default function DangerZone() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("delete_own_account");
    if (rpcError) {
      setError(rpcError.message || "Something went wrong — nothing was deleted.");
      setBusy(false);
      return;
    }
    // The server-side user is gone, so there is nothing for a global sign-out
    // to revoke; clear this browser's session only. The auth listener then
    // sends the user to /login.
    await supabase.auth.signOut({ scope: "local" });
  }

  return (
    <section className="danger" aria-labelledby="danger-title">
      <h2 id="danger-title">Danger zone</h2>
      <p>
        Permanently delete your account and every school where you are the only member — its
        contacts, meters, readings and reports. A school that other people also belong to stays for
        them; only your own access is removed. This is immediate and cannot be undone.
      </p>
      {!open ? (
        <button className="danger-btn ghost" onClick={() => setOpen(true)}>
          Delete my account…
        </button>
      ) : (
        <div className="danger-confirm">
          <label htmlFor="danger-confirm-input">
            Type <b>DELETE</b> to confirm
          </label>
          <input
            id="danger-confirm-input"
            type="text"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
          <div className="danger-actions">
            <button className="danger-btn" disabled={text !== "DELETE" || busy} onClick={() => void handleDelete()}>
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              className="danger-btn ghost"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setText("");
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
          {error && <p className="danger-error">{error}</p>}
        </div>
      )}
    </section>
  );
}
