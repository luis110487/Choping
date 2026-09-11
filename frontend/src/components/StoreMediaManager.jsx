import React, { useState } from "react";
import { API, storeMediaUrl } from "../lib/api";

function StoreMediaManager({ store, media, setMedia }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const banners = media?.banners || [];
  const logo = media?.logo || "";

  const send = async (slot, file) => {
    if (!file) return;
    setBusy(slot);
    setError("");
    const authToken = localStorage.getItem("choping-auth-token");
    if (!authToken) {
      setBusy("");
      return setError("Tu sesión expiró. Inicia sesión nuevamente.");
    }
    const body = new FormData();
    body.append("image", file);
    body.append("slot", slot);
    body.append("store", store?.name || "");
    try {
      const response = await fetch(`${API}/api/store/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) setError(data.error || "No fue posible cargar la imagen.");
      else setMedia(data.media);
    } catch {
      setError("No fue posible conectar con el servidor.");
    }
    setBusy("");
  };

  const remove = async (url) => {
    setBusy(url);
    setError("");
    const authToken = localStorage.getItem("choping-auth-token");
    try {
      const response = await fetch(`${API}/api/store/media`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ store: store?.name || "", url }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) setError(data.error || "No fue posible eliminar la imagen.");
      else setMedia(data.media);
    } catch {
      setError("No fue posible conectar con el servidor.");
    }
    setBusy("");
  };

  return (
    <div className="store-media">
      {error && <p className="store-media-error">{error}</p>}
      <div className="store-media-block">
        <div className="store-media-head">
          <strong>Logo de la tienda</strong>
          <small>Se muestra en tu perfil. Recomendado cuadrado y con fondo transparente.</small>
        </div>
        <div className="store-media-logo">
          {logo ? (
            <>
              <img src={storeMediaUrl(logo)} alt="Logo de la tienda" />
              <button type="button" className="nav-link" disabled={busy === logo} onClick={() => remove(logo)}>
                Quitar
              </button>
            </>
          ) : (
            <span className="store-media-empty">Sin logo</span>
          )}
          <label className="btn store-media-upload">
            {busy === "logo" ? "Cargando…" : logo ? "Reemplazar" : "Subir logo"}
            <input type="file" accept="image/*" disabled={busy === "logo"} onChange={(event) => { send("logo", event.target.files?.[0]); event.target.value = ""; }} />
          </label>
        </div>
      </div>
      <div className="store-media-block">
        <div className="store-media-head">
          <strong>Banners</strong>
          <small>Hasta 5, rotan automáticamente en tu tienda. Formato ancho, 1600×500 aprox.</small>
        </div>
        <div className="store-media-banners">
          {banners.map((url) => (
            <figure key={url}>
              <img src={storeMediaUrl(url)} alt="Banner de la tienda" />
              <button type="button" className="store-media-remove" disabled={busy === url} onClick={() => remove(url)} title="Eliminar banner">
                ×
              </button>
            </figure>
          ))}
          {banners.length < 5 && (
            <label className="store-media-add">
              {busy === "banner" ? "Cargando…" : "+ Agregar banner"}
              <input type="file" accept="image/*" disabled={busy === "banner"} onChange={(event) => { send("banner", event.target.files?.[0]); event.target.value = ""; }} />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

export { StoreMediaManager };
