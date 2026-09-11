import React, { useState } from "react";
import { money } from "../lib/api";
import { isPlatformAdmin } from "../lib/accounts";
import { PasswordModal } from "./PasswordModal";
import { StoreReviewModal } from "./StoreReviewModal";
import { ReviewModal } from "./ReviewModal";
import { EditProfileModal } from "./EditProfileModal";

function ClientProfile({ user, setUser, purchased, openAdmin, openStoreAdmin, store, logout, close }) {
  const [reviewProduct, setReviewProduct] = useState(null), [reviewStore, setReviewStore] = useState(null), [passwordOpen, setPasswordOpen] = useState(false), [editOpen, setEditOpen] = useState(false), [refresh, setRefresh] = useState(0);
  const stores = [...new Set(purchased.map((product) => product.store))];
  const reviews = JSON.parse(localStorage.getItem("choping-reviews") || "{}");
  const storeReviews = JSON.parse(localStorage.getItem("choping-store-reviews") || "{}");
  const dismissed = JSON.parse(localStorage.getItem("choping-dismissed-reviews") || "{}");
  const pendingProducts = purchased.filter((product) => !reviews[product.id] && !dismissed[`product-${product.id}`]);
  const pendingStores = stores.filter((store) => !storeReviews[store] && !dismissed[`store-${store}`]);
  const dismiss = (key) => { const next = { ...dismissed, [key]: true }; localStorage.setItem("choping-dismissed-reviews", JSON.stringify(next)); setRefresh(refresh + 1); };
  return (
    <div className="overlay">
      <section className="cart-modal client-profile">
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <div className="cart-modal-content">
          <small>MI CUENTA</small>
          <h2>Mi cuenta</h2>
          <div className="profile-identity"><div className="profile-avatar">{(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}</div><strong>{user?.name || "Usuario"}</strong><span>{user?.email}</span></div>
          <div className="account-status"><strong>Cuenta activa</strong><span>Tu sesión está protegida</span></div>
          <div className="profile-shortcuts"><button onClick={() => document.querySelector('.profile-section')?.scrollIntoView({ behavior: 'smooth' })}><strong>▣</strong><b>Mis pedidos</b><span>Consulta el estado de tus compras ›</span></button><button onClick={() => document.querySelector('.profile-stores')?.scrollIntoView({ behavior: 'smooth' })}><strong>▤</strong><b>Tiendas</b><span>Tus tiendas favoritas y seguidas ›</span></button><button onClick={() => document.querySelector('.profile-review')?.scrollIntoView({ behavior: 'smooth' })}><strong>★</strong><b>Reseñar productos</b><span>Comparte tu opinión y ayuda a otros ›</span></button></div>
          {isPlatformAdmin(user) && <button className="btn profile-admin-button" onClick={openAdmin}>⚙ Panel administrativo</button>}
          {user?.role === "tienda" && user?.store_name && <button className="btn profile-admin-button" onClick={openStoreAdmin}>▣ Panel administrativo de mi tienda</button>}
          <button className="btn profile-password-button" onClick={() => setEditOpen(true)}>Editar información</button>
          {(pendingProducts.length > 0 || pendingStores.length > 0) && <div className="review-alert">Tienes reseñas pendientes de productos y tiendas que compraste.</div>}
          <button className="btn profile-password-button" onClick={() => setPasswordOpen(true)}>Cambiar contraseña</button>
          <button className="profile-logout-button" onClick={logout}>Cerrar sesión</button>
          <div className="profile-section">
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
          </div>
          {purchased.length > 0 && (
            <>
              <div className="profile-section">
                <h3>Tiendas</h3>
                <div className="profile-stores">
                  {stores.map((store) => (
                    <div className="profile-store-review" key={store}><span>{store}</span>{pendingStores.includes(store) && <button className="review-stars" onClick={() => setReviewStore(store)} aria-label={`Reseñar ${store}`}>☆ ☆ ☆ ☆ ☆</button>}</div>
                  ))}
                </div>
              </div>
              <div className="profile-section">
                <h3>Reseñar productos</h3>
                {pendingProducts.map((product) => (
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
                ))}{!pendingProducts.length && <p>Ya gestionaste las reseñas de tus productos comprados.</p>}
              </div>
            </>
          )}
        </div>
      </section>
      {reviewProduct && (
        <ReviewModal
          product={reviewProduct}
          close={() => { dismiss(`product-${reviewProduct.id}`); setReviewProduct(null); }}
          onSaved={() => { setReviewProduct(null); setRefresh(refresh + 1); }}
        />
      )}
      {passwordOpen && <PasswordModal close={() => setPasswordOpen(false)} />}
      {reviewStore && <StoreReviewModal store={reviewStore} close={() => { dismiss(`store-${reviewStore}`); setReviewStore(null); }} onSaved={() => { setReviewStore(null); setRefresh(refresh + 1); }} />}
      {editOpen && <EditProfileModal user={user} setUser={setUser} close={() => setEditOpen(false)} />}
    </div>
  );
}

export { ClientProfile };
