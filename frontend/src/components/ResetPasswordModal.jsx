import React, { useState } from "react";
import { API } from "../lib/api";

/** Pantalla a la que llega quien abre el enlace del correo. */
function ResetPasswordModal({ token, close }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardar = async (event) => {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("La nueva contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("La confirmación no coincide.");
    setGuardando(true);
    try {
      const response = await fetch(`${API}/api/auth/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) setError(data.error || "No fue posible actualizar la contraseña.");
      else setListo(true);
    } catch {
      setError("No fue posible conectar con el servidor.");
    }
    setGuardando(false);
  };

  return (
    <div className="overlay review-overlay">
      <section className="cart-modal review-modal">
        <div className="cart-modal-content">
          <small>RESTAURAR CONTRASEÑA</small>
          {listo ? (
            <>
              <h2>Contraseña actualizada</h2>
              <p className="password-ok">Ya puedes iniciar sesión con tu contraseña nueva.</p>
              <button className="btn cart-checkout" onClick={close}>
                Ir a iniciar sesión
              </button>
            </>
          ) : (
            <form onSubmit={guardar}>
              <h2>Crea tu contraseña nueva</h2>
              <label>
                Nueva contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
              <button className="btn cart-checkout" disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar contraseña"}
              </button>
              <button type="button" className="nav-link" onClick={close}>
                Cancelar
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

export { ResetPasswordModal };
