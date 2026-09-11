import React, { useState } from "react";
import { money, productImageUrl } from "../lib/api";
import { STORE_COLOR_FIELDS, STORE_FONTS, STORE_FONT_SLOTS, STORE_PRESETS, fontStack, normalizeTheme, themeFonts, themePalette } from "../lib/theme";
import { StoreMediaManager } from "./StoreMediaManager";

function StoreThemeStudio({ store, theme, setTheme, media, setMedia }) {
  const [status, setStatus] = useState("");
  const [statusError, setStatusError] = useState("");
  const onStatus = (next, message = "") => {
    setStatus(next);
    setStatusError(message);
  };
  const save = (value) => setTheme(value, { onStatus });
  const palette = themePalette(theme);
  const fonts = themeFonts(theme);
  const overrides = normalizeTheme(theme).colors;
  const sample = (store?.products || [])[0];
  const previewProduct = {
    name: sample?.name || "Producto de ejemplo",
    category: sample?.category || store?.category || "Categoria",
    price: Number(sample?.price) || 189000,
    original_price: Number(sample?.original_price) || Number(sample?.price) * 1.25 || 249000,
    image: sample?.image,
  };
  const current = normalizeTheme(theme);
  const applyPreset = (preset) => save({ ...current, preset, colors: {} });
  const setColor = (key, color) => save({ ...current, colors: { ...overrides, [key]: color } });
  const resetColor = (key) => {
    const next = { ...overrides };
    delete next[key];
    save({ ...current, colors: next });
  };
  const resetAll = () => save({ ...current, colors: {} });
  const setFont = (slot, id) => save({ ...current, fonts: { ...fonts, [slot]: id } });
  return (
    <div className="store-admin-content theme-studio">
      <small>PERSONALIZACIÓN</small>
      <h2>Diseña tu tienda</h2>
      <p>Empieza con una plantilla y ajusta cada color a la identidad de tu marca.</p>
      <div className="theme-options">
        {STORE_PRESETS.map((item) => (
          <button
            key={item.id}
            className={`theme-option ${normalizeTheme(theme).preset === item.id ? "selected" : ""}`}
            onClick={() => applyPreset(item.id)}
          >
            <span
              className="theme-preview"
              style={{ background: `linear-gradient(135deg, ${item.palette.heading} 0 42%, ${item.palette.background} 42%)` }}
            />
            <strong>{item.name}</strong>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>
      <div className="theme-studio-grid">
        <div className="theme-color-list">
          <div className="theme-color-head">
            <h3>Paleta de la tienda</h3>
            <span className="theme-save-state">
              {status === "saving" && <em>Guardando…</em>}
              {status === "saved" && <em className="ok">Guardado en tu tienda</em>}
              {status === "error" && <em className="bad">{statusError}</em>}
            </span>
            {Object.keys(overrides).length > 0 && (
              <button type="button" className="nav-link" onClick={resetAll}>
                Restaurar plantilla
              </button>
            )}
          </div>
          {STORE_COLOR_FIELDS.map((field) => (
            <label className="theme-color-row" key={field.key}>
              <input
                type="color"
                value={palette[field.key]}
                onChange={(event) => setColor(field.key, event.target.value)}
                aria-label={field.label}
              />
              <span className="theme-color-copy">
                <strong>{field.label}</strong>
                <small>{field.hint}</small>
              </span>
              <span className="theme-color-value">{palette[field.key]}</span>
              {overrides[field.key] && (
                <button type="button" className="theme-color-reset" onClick={() => resetColor(field.key)} title="Volver al color de la plantilla">
                  ↺
                </button>
              )}
            </label>
          ))}
        </div>
        <aside className="theme-live-preview" style={{ background: palette.background }}>
          <span className="theme-preview-label" style={{ color: palette.heading }}>
            Vista previa en vivo
          </span>
          <article className="product-card theme-preview-card" style={{ background: palette.surface, borderColor: palette.accent, fontFamily: fontStack(fonts.body) }}>
            <div className="product-photo">
              <img src={productImageUrl(previewProduct.image)} alt={previewProduct.name} />
              <span className="product-sale-badge" style={{ background: palette.icon }}>Oferta</span>
            </div>
            <div className="product-info">
              <small>{previewProduct.category}</small>
              <h2 style={{ color: palette.heading, fontFamily: fontStack(fonts.heading) }}>{previewProduct.name}</h2>
              <span className="stars" style={{ color: palette.icon }}>★★★★★</span>
              <div className="product-price-stack">
                <del style={{ color: palette.priceOld }}>{money(previewProduct.original_price)}</del>
                <strong style={{ color: palette.price }}>{money(previewProduct.price)}</strong>
              </div>
              <button className="btn add-cart" style={{ background: palette.accent }}>Añadir al carrito</button>
            </div>
          </article>
        </aside>
      </div>
      <h3>Tipografía</h3>
      <div className="theme-font-grid">
        {STORE_FONT_SLOTS.map((slot) => (
          <div className="theme-font-slot" key={slot.key}>
            <strong>{slot.label}</strong>
            <small>{slot.hint}</small>
            <div className="theme-font-options">
              {STORE_FONTS.map((font) => (
                <button
                  key={font.id}
                  className={`theme-font-option ${fonts[slot.key] === font.id ? "selected" : ""}`}
                  style={{ fontFamily: font.stack }}
                  onClick={() => setFont(slot.key, font.id)}
                >
                  <span className="theme-font-sample">Aa</span>
                  <span className="theme-font-name">{font.name}</span>
                  <small>{font.detail}</small>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <h3>Contenido de la tienda</h3>
      <StoreMediaManager store={store} media={media} setMedia={setMedia} />
      <p className="form-hint">Los cambios visuales se aplican inmediatamente a tu perfil.</p>
    </div>
  );
}

export { StoreThemeStudio };
