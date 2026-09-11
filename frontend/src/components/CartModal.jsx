import React, { useState } from "react";
import { money, productImageUrl } from "../lib/api";

function CartModal({ cart, setCart, setPurchased, total, close }) {
  const [notice, setNotice] = useState(false);
  return (
    <div className="overlay">
      <section className="cart-modal">
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <div className="cart-modal-content">
          <small>CARRITO</small>
          <h2>Productos seleccionados</h2>
          {cart.length ? (
            cart.map((p) => (
              <div className="cart-item" key={p.id}>
                <img src={productImageUrl(p.image)} alt="" />
                <div className="cart-item-info">
                  <strong>{p.name}</strong>
                  <b>{money(p.price)}</b>
                  <div className="cart-quantity">
                    <button
                      onClick={() =>
                        setCart(
                          cart.map((item) =>
                            item.id === p.id
                              ? {
                                  ...item,
                                  quantity: Math.max(1, item.quantity - 1),
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      −
                    </button>
                    <strong>{p.quantity}</strong>
                    <button
                      onClick={() =>
                        setCart(
                          cart.map((item) =>
                            item.id === p.id
                              ? { ...item, quantity: item.quantity + 1 }
                              : item,
                          ),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  className="cart-remove"
                  aria-label={`Eliminar ${p.name}`}
                  onClick={() =>
                    setCart(cart.filter((item) => item.id !== p.id))
                  }
                >
                  ♜
                </button>
              </div>
            ))
          ) : (
            <p>Tu carrito está vacío.</p>
          )}
          <div className="cart-modal-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <button
            className="btn cart-checkout"
            onClick={() => {
              setPurchased(cart);
              localStorage.setItem("choping-purchased", JSON.stringify(cart));
              setNotice(true);
            }}
          >
            Comprar
          </button>
        </div>
      </section>
      {notice && (
        <div className="overlay notice-overlay">
          <section className="cart-modal notice-modal">
            <div className="cart-modal-content">
              <small>CHOPING</small>
              <h2>Próximamente</h2>
              <p>El módulo de pagos estará disponible próximamente.</p>
              <button
                className="btn cart-checkout"
                onClick={() => setNotice(false)}
              >
                Aceptar
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export { CartModal };
