import React, { useEffect, useRef } from "react";
import { isPlatformAdmin } from "../lib/accounts";

/**
 * Account menu anchored to the header avatar.
 *
 * The detailed views (orders, stores, reviews) stay in ClientProfile: a
 * dropdown is for navigating, not for listing purchases.
 */
function ProfileMenu({ user, pendingReviews, openAccount, openAdmin, openStoreAdmin, editProfile, changePassword, logout, close }) {
  const panel = useRef(null);

  useEffect(() => {
    const onPointer = (event) => {
      if (panel.current && !panel.current.contains(event.target)) close();
    };
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    // Deferred: the click that opened the menu is still bubbling.
    const timer = setTimeout(() => document.addEventListener("mousedown", onPointer), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [close]);

  const run = (action) => () => {
    close();
    action?.();
  };

  return (
    <div className="profile-menu" ref={panel} role="menu" aria-label="Mi cuenta">
      <div className="profile-menu-head">
        <span className="profile-menu-avatar">{(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}</span>
        <div className="profile-menu-identity">
          <strong>{user?.name || "Usuario"}</strong>
          <small>{user?.email}</small>
        </div>
      </div>
      <div className="profile-menu-items">
        <button role="menuitem" onClick={run(() => openAccount("orders"))}>
          <span aria-hidden="true">▣</span>Mis pedidos
        </button>
        <button role="menuitem" onClick={run(() => openAccount("stores"))}>
          <span aria-hidden="true">▤</span>Tiendas
        </button>
        <button role="menuitem" onClick={run(() => openAccount("reviews"))}>
          <span aria-hidden="true">★</span>Reseñar productos
          {pendingReviews > 0 && <em className="profile-menu-badge">{pendingReviews}</em>}
        </button>
      </div>
      {(isPlatformAdmin(user) || (user?.role === "tienda" && user?.store_name)) && (
        <div className="profile-menu-items">
          {isPlatformAdmin(user) && (
            <button role="menuitem" onClick={run(openAdmin)}>
              <span aria-hidden="true">⚙</span>Panel administrativo
            </button>
          )}
          {user?.role === "tienda" && user?.store_name && (
            <button role="menuitem" onClick={run(openStoreAdmin)}>
              <span aria-hidden="true">▣</span>Panel de mi tienda
            </button>
          )}
        </div>
      )}
      <div className="profile-menu-items">
        <button role="menuitem" onClick={run(editProfile)}>
          <span aria-hidden="true">✎</span>Editar información
        </button>
        <button role="menuitem" onClick={run(changePassword)}>
          <span aria-hidden="true">✷</span>Cambiar contraseña
        </button>
      </div>
      <div className="profile-menu-items">
        <button role="menuitem" className="profile-menu-logout" onClick={run(logout)}>
          <span aria-hidden="true">↩</span>Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export { ProfileMenu };
