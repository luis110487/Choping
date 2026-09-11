import React from "react";

/**
 * Estrellas llenas segun la nota, con el conteo de reseñas.
 *
 * Sin reseñas se dice, no se pinta un cero: una nota de 0 se leeria como
 * "malo" cuando en realidad nadie ha calificado todavia.
 */
const Stars = ({ value, count }) => {
  const score = Number(value) || 0;
  const total = Number(count) || 0;
  if (!total) return <span className="stars stars-empty">Sin reseñas</span>;
  return (
    <span className="stars" title={`${score} de 5 · ${total} reseña${total === 1 ? "" : "s"}`}>
      <span className="stars-track" aria-hidden="true">
        <span className="stars-fill" style={{ width: `${(score / 5) * 100}%` }}>
          ★★★★★
        </span>
        ★★★★★
      </span>
      <b>{score}</b>
      <small>({total})</small>
    </span>
  );
};

export { Stars };
