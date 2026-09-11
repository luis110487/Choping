import React, { useState } from "react";
import { API, money, productImageUrl } from "../lib/api";
import { configuredCategories } from "../lib/catalog";
import { StoreThemeStudio } from "./StoreThemeStudio";

function StoreAdminPanel({ store, theme, setTheme, media, setMedia, createProduct, viewStore, close }) {
  const [tab, setTab] = useState("home");
  const [addingProduct, setAddingProduct] = useState(false);
  const [productDraft, setProductDraft] = useState({ name: "", category: store?.category || configuredCategories()[0], price: "", original_price: "", stock: "1", description: "", story: "", image: "" });
  const [productMessage, setProductMessage] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const products = store?.products || [];
  const categoryOptions = [...new Set([...configuredCategories(), store?.category].filter(Boolean))];
  const registeredClients = JSON.parse(localStorage.getItem("choping-registered-users") || "[]")
    .filter((account) => account.role === "cliente" && account.store_name?.toLowerCase() === store?.name?.toLowerCase());
  const maskedEmail = (email = "") => {
    const [name, domain] = email.split("@");
    return name && domain ? `${name.slice(0, 2)}***@${domain}` : "Contacto protegido";
  };
  const maskedPhone = (phone = "") => phone.length > 4 ? `${"*".repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}` : "Contacto protegido";
  const confirmedOrders = JSON.parse(localStorage.getItem("choping-orders") || "[]");
  const totalPurchases = confirmedOrders.reduce(
    (total, order) => total + Number(order.quantity || order.items?.reduce((subtotal, item) => subtotal + Number(item.quantity || 1), 0) || 0),
    0,
  );
  const averageRating = products.length
    ? (products.reduce((total, product) => total + Number(product.rating || 0), 0) / products.length).toFixed(1)
    : "0.0";
  const productCategories = new Set(products.map((product) => product.category)).size;
  const showProductForm = () => { setAddingProduct(true); setProductMessage(""); };
  const uploadProductImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProductMessage("Selecciona una imagen válida.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProductMessage("La imagen no puede superar 5 MB.");
      return;
    }
    setUploadingImage(true);
    setProductMessage("");
    try {
      const body = new FormData();
      body.append("image", file);
      const response = await fetch(`${API}/api/store/product-images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("choping-auth-token") || ""}` },
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible cargar la imagen.");
      setProductDraft((current) => ({ ...current, image: result.image }));
    } catch (error) {
      setProductMessage(error.message || "No fue posible cargar la imagen.");
    } finally {
      setUploadingImage(false);
    }
  };
  const saveProduct = async (event) => {
    event.preventDefault();
    try {
      await createProduct(productDraft);
      setProductDraft({ name: "", category: store?.category || configuredCategories()[0], price: "", original_price: "", stock: "1", description: "", story: "", image: "" });
      setAddingProduct(false);
      setProductMessage("Producto creado y publicado en tu catálogo.");
    } catch (error) {
      setProductMessage(error.message || "No fue posible crear el producto.");
    }
  };
  return (
    <div className="overlay store-admin-overlay">
      <section className="store-admin-panel">
        <aside className="store-admin-sidebar">
          <div className="store-admin-brand"><strong>CHOPING</strong><span>Mi tienda</span></div>
          <button className="store-admin-preview" onClick={viewStore}>↗ <span>Ver mi tienda</span></button>
          <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}>⌂ <span>Inicio</span></button>
          <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>◇ <span>Productos</span></button>
          <button className={tab === "store" ? "active" : ""} onClick={() => setTab("store")}>▣ <span>Mi tienda</span></button>
          <button className={tab === "clients" ? "active" : ""} onClick={() => setTab("clients")}>♙ <span>Clientes</span></button>
          <button onClick={() => setTab("home")}>◌ <span>Consultas</span></button>
          <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>⚙ <span>Configuración</span></button>
          <div className="store-admin-sidebar-footer"><button onClick={close}>↩ <span>Cerrar panel</span></button></div>
        </aside>
        <div className="store-admin-main">
          <button className="modal-close" onClick={close}>×</button>
          <header className="store-admin-header"><div><small>MI TIENDA</small><h1>¡Hola!</h1><p>Gestiona {store?.name || "tu tienda"} desde un solo lugar.</p></div><div className="store-admin-account"><span>{store?.name?.slice(0, 1) || "T"}</span><strong>{store?.name || "Mi tienda"}</strong></div></header>
          {tab === "home" && <div className="store-admin-content"><div className="store-admin-stats store-admin-metrics"><div><strong>{products.length}</strong><span>Productos publicados</span></div><div><strong>{totalPurchases}</strong><span>Compras confirmadas</span></div><div><strong>{averageRating}</strong><span>Calificación promedio</span></div><div><strong>{productCategories}</strong><span>Categorías activas</span></div></div><div className="store-admin-columns"><section className="store-admin-table"><div className="store-admin-title"><h2>Mis productos</h2><button className="btn" onClick={() => { setTab("products"); showProductForm(); }}>＋ Agregar producto</button></div>{products.length ? products.map((product) => <div className="store-product-row" key={product.id}><img src={productImageUrl(product.image)} alt="" /><div><strong>{product.name}</strong><small>{money(product.price)}</small></div><span>Activo</span><button aria-label={`Editar ${product.name}`} onClick={() => setTab("products")}>✎</button></div>) : <p>Aún no tienes productos publicados.</p>}</section><aside className="store-admin-info"><h2>Mi tienda</h2><div className="store-admin-store-card"><div className="store-mark"><span>{store?.name?.slice(0, 1) || "T"}</span></div><div><strong>{store?.name}</strong><span>{store?.city || "Colombia"}</span></div></div><button className="btn" onClick={() => setTab("store")}>✎ Editar mi tienda</button></aside></div></div>}
          {tab === "products" && (
            <div className="store-admin-content">
              <div className="store-admin-title">
                <div><h2>Productos de {store?.name}</h2><p>Administra el catálogo y revisa los productos publicados.</p></div>
                <button className="btn" onClick={showProductForm}>＋ Agregar producto</button>
              </div>
              {addingProduct && (
                <form className="store-product-form" onSubmit={saveProduct}>
                  <label>Nombre del producto<input value={productDraft.name} onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })} required /></label>
                  <label>Categoría<select value={productDraft.category} onChange={(event) => setProductDraft({ ...productDraft, category: event.target.value })} required>{categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                  <label>Precio<input type="number" min="1" value={productDraft.price} onChange={(event) => setProductDraft({ ...productDraft, price: event.target.value })} required /></label>
                  <label>Precio anterior (tachado)<input type="number" min="1" value={productDraft.original_price} onChange={(event) => setProductDraft({ ...productDraft, original_price: event.target.value })} placeholder="Opcional" /></label>
                  <label>Stock disponible<input type="number" min="0" step="1" value={productDraft.stock} onChange={(event) => setProductDraft({ ...productDraft, stock: event.target.value })} required /></label>
                  <label>URL de la imagen<input type="url" value={/^(https?:)?\/\//i.test(productDraft.image) ? productDraft.image : ""} onChange={(event) => setProductDraft({ ...productDraft, image: event.target.value })} placeholder="https://ejemplo.com/producto.jpg" /></label>
                  <label className="store-product-image-drop store-product-wide" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); uploadProductImage(event.dataTransfer.files[0]); }}>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => uploadProductImage(event.target.files[0])} />
                    <strong>{uploadingImage ? "Cargando imagen..." : "Arrastra una imagen aquí o selecciónala"}</strong>
                    <span>PNG, JPG, WEBP o GIF. Máximo 5 MB.</span>
                  </label>
                  {productDraft.image && <img className="store-product-preview store-product-wide" src={productImageUrl(productDraft.image)} alt="Vista previa del producto" />}
                  <label className="store-product-wide">Descripción<textarea value={productDraft.description} onChange={(event) => setProductDraft({ ...productDraft, description: event.target.value })} required /></label>
                  <label className="store-product-wide">Historia del producto<textarea value={productDraft.story} onChange={(event) => setProductDraft({ ...productDraft, story: event.target.value })} /></label>
                  <div className="store-product-form-actions"><button className="btn" disabled={uploadingImage}>{uploadingImage ? "Cargando imagen..." : "Guardar producto"}</button><button type="button" onClick={() => setAddingProduct(false)}>Cancelar</button></div>
                </form>
              )}
              {productMessage && <p className="store-product-message">{productMessage}</p>}
              <div className="store-admin-list">
                {products.length ? products.map((product) => <div className="store-product-row" key={product.id}><img src={productImageUrl(product.image)} alt="" /><div><strong>{product.name}</strong><small>{product.category} · {money(product.price)}</small></div><span>Activo</span><button aria-label={`Editar ${product.name}`}>✎</button><button aria-label={`Eliminar ${product.name}`}>⌫</button></div>) : <div className="store-admin-empty"><strong>No hay productos aún</strong><span>Agrega el primer producto de tu catálogo.</span></div>}
              </div>
            </div>
          )}
          {tab === "clients" && <div className="store-admin-content"><h2>Clientes de {store?.name}</h2><p>Clientes vinculados a esta tienda. Los datos de contacto se muestran protegidos.</p><div className="store-admin-list">{registeredClients.length ? registeredClients.map((client) => <div className="store-client-row" key={client.email}><span className="store-client-avatar">{(client.name || client.email).slice(0, 1).toUpperCase()}</span><div><strong>{client.name || "Cliente"}</strong><small>{maskedEmail(client.email)}</small></div><span>{maskedPhone(client.phone)}</span></div>) : <div className="store-admin-empty"><strong>Aún no hay clientes vinculados</strong><span>Los clientes asociados a esta tienda aparecerán aquí.</span></div>}</div></div>}
          {tab === "store" && <div className="store-admin-content"><h2>Información de mi tienda</h2><p>Consulta y actualiza la información visible para tus clientes.</p><div className="store-edit-grid"><label>Nombre de la tienda<input defaultValue={store?.name || ""} /></label><label>Categoría<input defaultValue={store?.category || ""} /></label><label>Ciudad<input defaultValue={store?.city || ""} /></label><label>Descripción<textarea defaultValue={store?.description || ""} /></label></div><button className="btn">Guardar información</button></div>}
          {tab === "settings" && <StoreThemeStudio store={store} theme={theme} setTheme={setTheme} media={media} setMedia={setMedia} />}
        </div>
      </section>
    </div>
  );
}

export { StoreAdminPanel };
