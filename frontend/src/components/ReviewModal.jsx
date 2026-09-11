import React, { useState } from "react";
import { API } from "../lib/api";

function ReviewModal({ product, close, onSaved }) {
  const [rating, setRating] = useState(0),
    [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setError("");
    const authToken = localStorage.getItem("choping-auth-token");
    if (!authToken) return setError("Inicia sesión para dejar una reseña.");
    setSaving(true);
    try {
      const response = await fetch(`${API}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ type: "product", target: product.id, rating, comment }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "No fue posible guardar la reseña.");
        setSaving(false);
        return;
      }
      // Se conserva en el navegador solo para no volver a pedirla.
      const reviews = JSON.parse(localStorage.getItem("choping-reviews") || "{}");
      reviews[product.id] = { rating, comment, product: product.name };
      localStorage.setItem("choping-reviews", JSON.stringify(reviews));
      onSaved(data);
    } catch {
      setError("No fue posible conectar con el servidor.");
    }
    setSaving(false);
  };
  return (
    <div className="overlay review-overlay">
      <section className="cart-modal review-modal">
        <div className="cart-modal-content">
          <small>RESEÑA DEL PRODUCTO</small>
          <h2>{product.name}</h2>
          {error && <p className="store-media-error">{error}</p>}
          <div className="rating-picker">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                className={value <= rating ? "chosen" : ""}
                onClick={() => setRating(value)}
              >
                ★
              </button>
            ))}
          </div>
          <label>
            Comentario
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
            />
          </label>
          <button
            className="btn cart-checkout"
            disabled={!rating || saving}
            onClick={save}
          >{saving ? "Guardando…" : "Guardar reseña"}</button>
          <button className="nav-link" onClick={close}>
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}

export { ReviewModal };
