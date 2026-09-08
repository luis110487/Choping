import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:5000")
  .replace(/\/$/, "")
  .replace(/\/api$/, "");
const money = (n) => "$" + Number(n).toLocaleString("es-CO");
const Stars = ({ value }) => (
  <span className="stars">
    ★★★★★ <b>{value}</b>
  </span>
);
function App() {
  const [stores, setStores] = useState([]),
    [store, setStore] = useState(null),
    [showAllProducts, setShowAllProducts] = useState(false),
    [query, setQuery] = useState(""),
    [categoryFilter, setCategoryFilter] = useState(""),
    [selected, setSelected] = useState(null),
    [cart, setCart] = useState(() =>
      JSON.parse(localStorage.getItem("choping-cart") || "[]"),
    ),
    [cartOpen, setCartOpen] = useState(false),
    [loginOpen, setLoginOpen] = useState(false),
    [banner, setBanner] = useState(() => Number(localStorage.getItem("choping-banner") || 0)),
    [adminOpen, setAdminOpen] = useState(false),
    [user, setUser] = useState(null),
    [storeAdminOpen, setStoreAdminOpen] = useState(false),
    [storeThemes, setStoreThemes] = useState(() => JSON.parse(localStorage.getItem("choping-store-themes") || '{"Tech Zone":"ocean","Casa Viva":"sunset","EcoRuedas":"forest"}'));
  useEffect(() => {
    fetch(`${API}/api/stores`)
      .then((r) => r.json())
      .then(setStores);
  }, []);
  useEffect(
    () => localStorage.setItem("choping-cart", JSON.stringify(cart)),
    [cart],
  );
  const products = (
    store ? store.products : stores.flatMap((s) => s.products)
  ).filter(
    (p) =>
      (!query || `${p.name} ${p.category} ${p.store}`.toLowerCase().includes(query.toLowerCase())) && (!categoryFilter || p.category === categoryFilter),
  );
  const categories = store ? [...new Set(store.products.map((p) => p.category))] : [];
  const visibleStores = stores.filter((s) => {
    const text = `${s.name} ${s.category} ${s.products.map((p) => `${p.name} ${p.category}`).join(' ')}`.toLowerCase();
    return !query || text.includes(query.toLowerCase());
  });
  const add = (p, q = 1) =>
    setCart((c) => {
      const x = c.find((i) => i.id === p.id);
      return x
        ? c.map((i) => (i.id === p.id ? { ...i, quantity: i.quantity + q } : i))
        : [...c, { ...p, quantity: q }];
    });
  const total = cart.reduce((s, p) => s + p.price * p.quantity, 0);
  return (
    <div className={store ? `store-app theme-${storeThemes[store.name] || "ocean"}` : "store-app"}>
      <header>
        <div className="nav">
          <a className="logo" href="#" onClick={() => setStore(null)}>
            <img src={`${API}/static/img/choping-logo.png`} alt="Choping" />
          </a>
          <nav>
            <button className="nav-link" onClick={() => { setStore(null); setShowAllProducts(false); setQuery(""); }}>
              Tiendas
            </button>
            {!store && !showAllProducts && (
              <button className="nav-link" onClick={() => { setStore(null); setShowAllProducts(true); setQuery(""); setCategoryFilter(""); }}>
                Todos los productos
              </button>
            )}
            <button className="nav-link" onClick={() => setLoginOpen(true)}>
              Login
            </button>
            {user?.role === "admin" && <button className="nav-link" onClick={() => setAdminOpen(true)}>Panel administrativo</button>}
            {user?.role === "tienda" && store && <button className="nav-link" onClick={() => setStoreAdminOpen(true)}>Personalizar tienda</button>}
            <button className="nav-cart" onClick={() => setCartOpen(true)}>
              🛒 Carrito{" "}
              <small>
                {cart.reduce((s, p) => s + p.quantity, 0)} productos
              </small>
              <strong>{money(total)}</strong>
            </button>
          </nav>
        </div>
      </header>
      <BannerSlider storeName={store?.name} banner={banner} setBanner={(value) => { setBanner(value); localStorage.setItem("choping-banner", String(value)); }} />
      <section className="shop-hero">
        <small>{store ? "TIENDA" : showAllProducts ? "CATALOGO GLOBAL" : "DIRECTORIO DE TIENDAS"}</small>
        <h1>{store ? store.name : showAllProducts ? "Todos los productos" : "Encuentra una tienda para comenzar"}</h1>
        <p>
          {store
            ? "Explora los productos disponibles de esta tienda."
            : showAllProducts ? "Explora productos de todas las tiendas en un solo lugar." : "Conoce nuestros vendedores y entra a cada tienda para ver su catálogo."}
        </p>
        <form className="product-search" onSubmit={(e) => e.preventDefault()}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              store ? "Buscar en esta tienda" : "Buscar productos o tiendas"
            }
          />
          {store && <select className="category-filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filtrar por categoria"><option value="">Todas las categorias</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>}
          <button>Buscar</button>
        </form>
      </section>
      {!store && !showAllProducts ? (
        <main>
          <div className="store-grid">
            {visibleStores.map((s) => (
              <article
                className="store-card"
                key={s.name}
                onClick={() => {
                  setStore(s);
                  setQuery("");
                }}
              >
                <div className="store-mark">{s.name.slice(0, 1)}</div>
                <div>
                  <small>{s.category}</small>
                  <h2>{s.name}</h2>
                  <Stars value={s.rating} />
                  <p>{s.products.length} productos disponibles</p>
                  <button className="btn">Ver tienda</button>
                </div>
              </article>
            ))}
            {!visibleStores.length && <p className="empty-products">No encontramos tiendas con esa búsqueda.</p>}
          </div>
        </main>
      ) : (
        <main className={`store-profile theme-${storeThemes[store.name] || "ocean"}`}>
          <button className="back-link" onClick={() => setStore(null)}>
            ← Volver a tiendas
          </button>
          <div className="shop-grid">
            {products.map((p) => (
              <article
                className="product-card"
                key={p.id}
                onClick={() => setSelected(p)}
              >
                <div className="product-photo">
                  <img src={`${API}/static/img/${p.image}`} alt={p.name} />
                </div>
                <div className="product-info">
                  <small>{p.category}</small>
                  <h2>{p.name}</h2>
                  <Stars value={p.rating} />
                  <p>{p.description}</p>
                  <div className="product-meta">
                    <strong>{money(p.price)}</strong>
                    <span>{p.purchases || 0} compras</span>
                  </div>
                  <button
                    className="btn add-cart"
                    onClick={(e) => {
                      e.stopPropagation();
                      add(p);
                    }}
                  >
                    Agregar al carrito
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!products.length && (
            <p className="empty-products">
              No encontramos productos con esa búsqueda.
            </p>
          )}
        </main>
      )}
      {selected && (
        <ProductModal
          product={selected}
          add={add}
          close={() => setSelected(null)}
        />
      )}{" "}
      {cartOpen && (
        <CartModal cart={cart} setCart={setCart} total={total} close={() => setCartOpen(false)} />
      )}
      {loginOpen && <LoginModal close={() => setLoginOpen(false)} onLogin={(nextUser) => { setUser(nextUser); setLoginOpen(false); }} />}
      {adminOpen && <AdminBannerPanel stores={stores} banner={banner} setBanner={(value) => { setBanner(value); localStorage.setItem("choping-banner", String(value)); }} close={() => setAdminOpen(false)} />}
      {storeAdminOpen && <StoreCustomizer theme={storeThemes[store.name] || "ocean"} setTheme={(value) => { const next = { ...storeThemes, [store.name]: value }; setStoreThemes(next); localStorage.setItem("choping-store-themes", JSON.stringify(next)); }} close={() => setStoreAdminOpen(false)} />}
      <footer>
        Desarrollado por{" "}
        <a href="https://www.techdatasync.com">www.techdatasync.com</a>
      </footer>
    </div>
  );
}
function ProductModal({ product, add, close }) {
  const [q, setQ] = useState(1), [imageIndex, setImageIndex] = useState(0),
    images = product.images || [product.image, product.image, product.image];
  return (
    <div className="overlay">
      <section className="product-modal">
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <div className="modal-body">
          <div className="modal-gallery">
            <div className="product-image-slider"><button className="image-arrow previous" onClick={() => setImageIndex((imageIndex + images.length - 1) % images.length)}>‹</button><img src={`${API}/static/img/${images[imageIndex]}`} alt={product.name} /><button className="image-arrow next" onClick={() => setImageIndex((imageIndex + 1) % images.length)}>›</button></div>
            <div className="modal-thumbnails">
              {images.map((x, i) => (
                <button className={imageIndex === i ? "active" : ""} onClick={() => setImageIndex(i)}><img
                  key={i}
                  src={`${API}/static/img/${x}`}
                  alt={`Vista ${i + 1}`}
                /></button>
              ))}
            </div>
          </div>
          <div className="modal-info">
            <small>{product.category}</small>
            <h2>{product.name}</h2>
            <Stars value={product.rating} />
            <p>{product.description}</p>
            <p>
              Vendido por <b>{product.store}</b>
            </p>
            <h3>Historia del producto</h3>
            <p>{product.story}</p>
            <div className="modal-buy">
              <div className="quantity-control">
                <button onClick={() => setQ(Math.max(1, q - 1))}>−</button>
                <input readOnly value={q} />
                <button onClick={() => setQ(q + 1)}>+</button>
              </div>
              <button className="btn" onClick={() => add(product, q)}>
                Agregar al carrito
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
function CartModal({ cart, setCart, total, close }) {
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
                <img src={`${API}/static/img/${p.image}`} alt="" />
                <div className="cart-item-info">
                  <strong>{p.name}</strong>
                  <b>{money(p.price)}</b>
                  <div className="cart-quantity"><button onClick={() => setCart(cart.map((item) => item.id === p.id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))}>−</button><strong>{p.quantity}</strong><button onClick={() => setCart(cart.map((item) => item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item))}>+</button></div>
                </div>
                <button className="cart-remove" aria-label={`Eliminar ${p.name}`} onClick={() => setCart(cart.filter((item) => item.id !== p.id))}>♜</button>
              </div>
            ))
          ) : (
            <p>Tu carrito está vacío.</p>
          )}
          <div className="cart-modal-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <button className="btn cart-checkout" onClick={() => setNotice(true)}>
            Comprar
          </button>
        </div>
      </section>
      {notice && <div className="overlay notice-overlay"><section className="cart-modal notice-modal"><div className="cart-modal-content"><small>CHOPING</small><h2>Próximamente</h2><p>El módulo de pagos estará disponible próximamente.</p><button className="btn cart-checkout" onClick={() => setNotice(false)}>Aceptar</button></div></section></div>}
    </div>
  );
}
function BannerSlider({ storeName, banner, setBanner }) {
  const images = storeName === "EcoRuedas" ? ["/ecorruedas-banner.png", "/ecorruedas-banner.png", "/ecorruedas-banner.png"] : storeName === "Casa Viva" ? ["/casaviva-banner-1.png", "/casaviva-banner-2.png", "/casaviva-banner-1.png"] : storeName === "Tech Zone" ? ["/techzone-banner.png", "/techzone-banner.png", "/techzone-banner.png"] : ["/banner-home-1.png", "/banner-home-2.png", "/banner-home-3.png"];
  useEffect(() => { const timer = setInterval(() => setBanner((banner + 1) % images.length), 6000); return () => clearInterval(timer); }, [banner, setBanner]);
  return <section className="banner-slider"><img className="banner-image" src={images[banner]} alt={`Banner ${banner + 1}`} /><button className="banner-control previous" onClick={() => setBanner((banner + 2) % 3)}>‹</button><button className="banner-control next" onClick={() => setBanner((banner + 1) % 3)}>›</button><div className="banner-dots">{images.map((_, i) => <button key={i} className={i === banner ? "active" : ""} aria-label={`Mostrar banner ${i + 1}`} onClick={() => setBanner(i)} />)}</div></section>;
}
function AdminBannerPanel({ stores, banner, setBanner, close }) {
  const images = ["/banner-home-1.png", "/banner-home-2.png", "/banner-home-3.png"];
  const [tab, setTab] = useState("banners"), [approved, setApproved] = useState(() => JSON.parse(localStorage.getItem("choping-approved-stores") || "[]"));
  const changeApproval = (name, value) => { const next = value ? [...new Set([...approved, name])] : approved.filter((item) => item !== name); setApproved(next); localStorage.setItem("choping-approved-stores", JSON.stringify(next)); };
  return <div className="overlay"><section className="cart-modal admin-banner-panel"><button className="modal-close" onClick={close}>×</button><div className="cart-modal-content"><small>PANEL ADMINISTRADOR</small><div className="admin-tabs"><button className={tab === "banners" ? "selected" : ""} onClick={() => setTab("banners")}>Banners</button><button className={tab === "stores" ? "selected" : ""} onClick={() => setTab("stores")}>Aprobación de tiendas</button></div>{tab === "banners" ? <><h2>Banner principal</h2><p>Selecciona el banner que deseas mostrar primero en la vista de tiendas.</p><div className="admin-banner-options">{images.map((image, i) => <button className={banner === i ? "selected" : ""} key={image} onClick={() => setBanner(i)}><img src={image} alt={`Banner ${i + 1}`} /><strong>Banner {i + 1}</strong></button>)}</div></> : <><h2>Tiendas pendientes</h2><p>Aprueba las tiendas que pueden aparecer en el directorio.</p><div className="admin-store-list">{stores.map((store) => <div className="admin-store-row" key={store.name}><div><strong>{store.name}</strong><small>{store.category} · {store.products.length} productos</small></div><button className={approved.includes(store.name) ? "approved" : ""} onClick={() => changeApproval(store.name, !approved.includes(store.name))}>{approved.includes(store.name) ? "Aprobada" : "Aprobar"}</button></div>)}</div></>}</div></section></div>;
}
function StoreCustomizer({ theme, setTheme, close }) {
  const themes = [{ id: "ocean", name: "Ocean", detail: "Azul, limpia y tecnológica" }, { id: "sunset", name: "Sunset", detail: "Cálida y comercial" }, { id: "forest", name: "Forest", detail: "Natural y confiable" }, { id: "mono", name: "Minimal", detail: "Elegante y sobria" }];
  return <div className="overlay"><section className="cart-modal store-customizer"><button className="modal-close" onClick={close}>×</button><div className="cart-modal-content"><small>PANEL DE MI TIENDA</small><h2>Diseña tu perfil</h2><p>Elige una plantilla para organizar tu tienda.</p><div className="theme-options">{themes.map((item) => <button key={item.id} className={`theme-option theme-${item.id} ${theme === item.id ? "selected" : ""}`} onClick={() => setTheme(item.id)}><span className="theme-preview" /><strong>{item.name}</strong><small>{item.detail}</small></button>)}</div><h3>Contenido de la tienda</h3><label>Logo de la tienda<input type="file" accept="image/*" /></label><label>Banners superiores (hasta 3)<input type="file" accept="image/*" multiple /></label><p className="form-hint">Los cambios visuales se aplican inmediatamente a tu perfil.</p></div></section></div>;
}
function LoginModal({ close, onLogin }) {
  const [register, setRegister] = useState(false), [name, setName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [role, setRole] = useState("cliente"), [phone, setPhone] = useState(""), [storeName, setStoreName] = useState(""), [category, setCategory] = useState(""), [city, setCity] = useState(""), [description, setDescription] = useState(""), [message, setMessage] = useState("");
  const submit = async (e) => { e.preventDefault(); const endpoint = register ? "register" : "login"; const body = register ? { name, email, password, role, phone, store_name: storeName, category, city, description } : { email, password }; const response = await fetch(`${API}/api/auth/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); if (response.ok && !register) onLogin(data.user); setMessage(response.ok ? (data.message || `Bienvenido, ${data.user.name}`) : data.error); };
  return <div className="overlay"><section className="cart-modal login-modal"><button className="modal-close" onClick={close}>×</button><form className="cart-modal-content" onSubmit={submit}><small>ACCESO UNICO</small><h2>{register ? "Crear usuario" : "Iniciar sesión"}</h2>{register && <><label>Tipo de registro<select value={role} onChange={(e) => setRole(e.target.value)}><option value="cliente">Cliente</option><option value="tienda">Tienda</option></select></label><label>{role === "tienda" ? "Nombre del responsable" : "Nombre completo"}<input value={name} onChange={(e) => setName(e.target.value)} required /></label>{role === "cliente" ? <label>Teléfono<input value={phone} onChange={(e) => setPhone(e.target.value)} required /></label> : <><label>Nombre de la tienda<input value={storeName} onChange={(e) => setStoreName(e.target.value)} required /></label><label>Categoría<input value={category} onChange={(e) => setCategory(e.target.value)} required /></label><label>Ciudad<input value={city} onChange={(e) => setCity(e.target.value)} required /></label><label>Descripción<textarea value={description} onChange={(e) => setDescription(e.target.value)} required /></label></>}</>}<label>Correo electrónico<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>{message && <p>{message}</p>}<button className="btn cart-checkout">{register ? "Crear usuario" : "Ingresar"}</button><button type="button" className="nav-link" onClick={() => { setRegister(!register); setMessage(""); }}>{register ? "Ya tengo una cuenta" : "Crear usuario nuevo"}</button></form></section></div>;
}
createRoot(document.getElementById("root")).render(<App />);
