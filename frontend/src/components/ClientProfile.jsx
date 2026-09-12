import React, { useEffect, useState } from "react";
import { money } from "../lib/api";
import { isPlatformAdmin } from "../lib/accounts";
import { PasswordModal } from "./PasswordModal";
import { StoreReviewModal } from "./StoreReviewModal";
import { ReviewModal } from "./ReviewModal";
import { EditProfileModal } from "./EditProfileModal";

const SECCIONES = [
  { id: "orders", icono: "▣", titulo: "Mis pedidos", detalle: "Consulta el estado de tus compras" },
  { id: "stores", icono: "▤", titulo: "Tiendas", detalle: "Tus tiendas favoritas y seguidas" },
  { id: "reviews", icono: "★", titulo: "Reseñar productos", detalle: "Comparte tu opinión y ayuda a otros" },
];

function ClientProfile({ user, setUser, purchased, openAdmin, openStoreAdmin, store, logout, close, section = "" }) {
  const [reviewProduct, setReviewProduct] = useState(null);
  const [reviewStore, setReviewStore] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // Se muestra una seccion a la vez: antes se apilaban todas y los accesos
  // solo hacian scroll, asi que elegir una no cambiaba lo que se veia.
  const [activa, setActiva] = useState(
    SECCIONES.some((item) => item.id === section) ? section : "orders",
  );

  const stores = [...new Set(purchased.map((product) => product.store))];
  const reviews = JSON.parse(localStorage.getItem("choping-reviews") || "{}");
  const storeReviews = JSON.parse(localStorage.getItem("choping-store-reviews") || "{}");
  const dismissed = JSON.parse(localStorage.getItem("choping-dismissed-reviews") || "{}");
  const pendingProducts = purchased.filter(
    (product) => !reviews[product.id] && !dismissed[`product-${product.id}`],
  );
  const pendingStores = stores.filter(
    (name) => !storeReviews[name] && !dismissed[`store-${name}`],
  );
  const dismiss = (key) => {
    const next = { ...dismissed, [key]: true };
    localStorage.setItem("choping-dismissed-reviews", JSON.stringify(next));
    setRefresh(refresh + 1);
  };

  useEffect(() => {
    if (section === "edit") setEditOpen(true);
    else if (section === "password") setPasswordOpen(true);
    else if (SECCIONES.some((item) => item.id === section)) setActiva(section);
  }, [section]);

  return (
    <div className="overlay">
      <section className="cart-modal client-profile">
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <div className="cart-modal-content">
          <small>MI CUENTA</small>
          <h2>Mi cuenta</h2>
          <div className="profile-identity">
            <div className="profile-avatar">
              {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <strong>{user?.name || "Usuario"}</strong>
            <span>{user?.email}</span>
          </div>
          <div className="account-status">
            <strong>Cuenta activa</strong>
            <span>Tu sesión está protegida</span>
          </div>

          <div className="profile-shortcuts" role="tablist">
            {SECCIONES.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={activa === item.id}
                className={activa === item.id ? "activa" : ""}
                onClick={() => setActiva(item.id)}
              >
                <strong>{item.icono}</strong>
                <b>{item.titulo}</b>
                <span>{item.detalle}</span>
                {item.id === "reviews" && pendingProducts.length + pendingStores.length > 0 && (
                  <em className="profile-pending">{pendingProducts.length + pendingStores.length}</em>
                )}
              </button>
            ))}
          </div>

          <div className="profile-section">
            {activa === "orders" && (
              <>
                <h3>Mis pedidos</h3>
                {purchased.length ? (
                  purchased.map((product) => (
                    <div className="profile-order" key={product.id}>
                      <strong>{product.name}</strong>
                      <span>{product.quantity} unidad(es) · Comprado</span>
                      <b>{money(product.price * product.quantity)}</b>
                    </div>
                  ))
                ) : (
                  <p>Aún no tienes productos comprados.</p>
                )}
              </>
            )}

            {activa === "stores" && (
              <>
                <h3>Tiendas</h3>
                {stores.length ? (
                  <div className="profile-stores">
                    {stores.map((name) => (
                      <div className="profile-store-review" key={name}>
                        <span>{name}</span>
                        {pendingStores.includes(name) && (
                          <button
                            className="review-stars"
                            onClick={() => setReviewStore(name)}
                            aria-label={`Reseñar ${name}`}
                          >
                            ☆ ☆ ☆ ☆ ☆
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>Todavía no has comprado en ninguna tienda.</p>
                )}
              </>
            )}

            {activa === "reviews" && (
              <>
                <h3>Reseñar productos</h3>
                {pendingProducts.length ? (
                  pendingProducts.map((product) => (
                    <div className="profile-review" key={product.id}>
                      <span>{product.name}</span>
                      <button
                        className="review-stars"
                        onClick={() => setReviewProduct(product)}
                        aria-label={`Reseñar ${product.name}`}
                      >
                        ☆ ☆ ☆ ☆ ☆
                      </button>
                    </div>
                  ))
                ) : (
                  <p>
                    {purchased.length
                      ? "Ya gestionaste las reseñas de tus productos comprados."
                      : "Cuando compres algo podrás reseñarlo aquí."}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="profile-actions">
            {isPlatformAdmin(user) && (
              <button className="btn profile-admin-button" onClick={openAdmin}>
                ⚙ Panel administrativo
              </button>
            )}
            {user?.role === "tienda" && user?.store_name && (
              <button className="btn profile-admin-button" onClick={openStoreAdmin}>
                ▣ Panel administrativo de mi tienda
              </button>
            )}
            <button className="btn profile-password-button" onClick={() => setEditOpen(true)}>
              Editar información
            </button>
            <button className="btn profile-password-button" onClick={() => setPasswordOpen(true)}>
              Cambiar contraseña
            </button>
            <button className="profile-logout-button" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        </div>
      </section>
      {reviewProduct && (
        <ReviewModal
          product={reviewProduct}
          close={() => {
            dismiss(`product-${reviewProduct.id}`);
            setReviewProduct(null);
          }}
          onSaved={() => {
            setReviewProduct(null);
            setRefresh(refresh + 1);
          }}
        />
      )}
      {passwordOpen && <PasswordModal close={() => setPasswordOpen(false)} />}
      {reviewStore && (
        <StoreReviewModal
          store={reviewStore}
          close={() => {
            dismiss(`store-${reviewStore}`);
            setReviewStore(null);
          }}
          onSaved={() => {
            setReviewStore(null);
            setRefresh(refresh + 1);
          }}
        />
      )}
      {editOpen && <EditProfileModal user={user} setUser={setUser} close={() => setEditOpen(false)} />}
    </div>
  );
}

export { ClientProfile };
