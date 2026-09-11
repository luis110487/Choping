import React, { useState } from "react";
import { API } from "../lib/api";

function PasswordModal({ close }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (next.length < 8) return setError("La nueva contraseña debe tener al menos 8 caracteres.");
    if (next !== confirm) return setError("La confirmación no coincide con la nueva contraseña.");
    const authToken = localStorage.getItem("choping-auth-token");
    if (!authToken) return setError("Tu sesión expiró. Inicia sesión nuevamente.");
    setSaving(true);
    try {
      const response = await fetch(`${API}/api/auth/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ current, password: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) setError(data.error || "No fue posible actualizar la contraseña.");
      else {
        setMessage("Contraseña actualizada correctamente.");
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch {
      setError("No fue posible conectar con el servidor.");
    }
    setSaving(false);
  };

  return (
    <div className="overlay review-overlay">
      <section className="cart-modal review-modal">
        <form className="cart-modal-content" onSubmit={save}>
          <small>SEGURIDAD</small>
          <h2>Cambiar contraseña</h2>
          <label>
            Contraseña actual
            <input
              type="password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            Nueva contraseña
            <input
              type="password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Confirmar contraseña
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          {error && <p className="store-media-error">{error}</p>}
          {message && <p className="password-ok">{message}</p>}
          <button className="btn cart-checkout" disabled={saving}>
            {saving ? "Guardando…" : "Guardar contraseña"}
          </button>
          <button type="button" className="nav-link" onClick={close}>
            {message ? "Cerrar" : "Cancelar"}
          </button>
        </form>
      </section>
    </div>
  );
}

export { PasswordModal };
