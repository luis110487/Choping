import React, { useState } from "react";

function ReviewModal({ product, close, onSaved }) {
  const [rating, setRating] = useState(0),
    [comment, setComment] = useState("");
  const save = () => {
    const reviews = JSON.parse(localStorage.getItem("choping-reviews") || "{}");
    reviews[product.id] = { rating, comment, product: product.name };
    localStorage.setItem("choping-reviews", JSON.stringify(reviews));
    onSaved();
  };
  return (
    <div className="overlay review-overlay">
      <section className="cart-modal review-modal">
        <div className="cart-modal-content">
          <small>RESEÑA DEL PRODUCTO</small>
          <h2>{product.name}</h2>
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
            disabled={!rating}
            onClick={save}
          >
            Guardar reseña
          </button>
          <button className="nav-link" onClick={close}>
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}

export { ReviewModal };
