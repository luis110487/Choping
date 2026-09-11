import React, { useState } from "react";
import { money, productImageUrl } from "../lib/api";
import { Stars } from "./Stars";

function ProductModal({ product, add, close }) {
  const [q, setQ] = useState(1),
    [imageIndex, setImageIndex] = useState(0),
    images = product.images || [product.image, product.image, product.image];
  return (
    <div className="overlay">
      <section className="product-modal">
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <div className="modal-body">
          <div className="modal-gallery">
            <div className="product-image-slider">
              <button
                className="image-arrow previous"
                onClick={() =>
                  setImageIndex(
                    (imageIndex + images.length - 1) % images.length,
                  )
                }
              >
                ‹
              </button>
              <img
                src={productImageUrl(images[imageIndex])}
                alt={product.name}
              />
              <button
                className="image-arrow next"
                onClick={() => setImageIndex((imageIndex + 1) % images.length)}
              >
                ›
              </button>
            </div>
            <div className="modal-thumbnails">
              {images.map((x, i) => (
                <button
                  key={i}
                  className={imageIndex === i ? "active" : ""}
                  onClick={() => setImageIndex(i)}
                >
                  <img
                    src={productImageUrl(x)}
                    alt={`Vista ${i + 1}`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="modal-info">
            <small>{product.category}</small>
            <h2>{product.name}</h2>
            <Stars value={product.rating} count={product.reviews_count} />
            <p>{product.description}</p>
            <div className="modal-product-pricing">
              {Number(product.original_price) > Number(product.price) && <del>{money(product.original_price)}</del>}
              <strong>{money(product.price)}</strong>
              <span className={Number(product.stock) <= 0 ? "stock-out" : "stock-available"}>{Number(product.stock) <= 0 ? "Agotado" : `${product.stock} disponibles`}</span>
            </div>
            <p>
              Vendido por <b>{product.store}</b>
            </p>
            <h3>Historia del producto</h3>
            <p>{product.story}</p>
            <div className="modal-buy">
              <div className="quantity-control">
                <button onClick={() => setQ(Math.max(1, q - 1))}>−</button>
                <input readOnly value={q} />
                <button onClick={() => setQ(Math.min(Number(product.stock ?? q), q + 1))} disabled={Number(product.stock) <= q}>+</button>
              </div>
              <button className="btn" disabled={Number(product.stock) <= 0} onClick={() => add(product, q)}>
                {Number(product.stock) <= 0 ? "Producto agotado" : "Agregar al carrito"}
              </button>
            </div>
            <section className="modal-review">
              <h3>Reseña</h3>
              <p>{product.review}</p>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

export { ProductModal };
