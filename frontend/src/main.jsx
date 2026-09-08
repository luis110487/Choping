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
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(null),
    [cart, setCart] = useState(() =>
      JSON.parse(localStorage.getItem("choping-cart") || "[]"),
    ),
    [cartOpen, setCartOpen] = useState(false),
    [loginOpen, setLoginOpen] = useState(false);
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
      !query ||
      `${p.name} ${p.category} ${p.store}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
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
    <>
      <header>
        <div className="nav">
          <a className="logo" href="#" onClick={() => setStore(null)}>
            <img src={`${API}/static/img/choping-logo.png`} alt="Choping" />
          </a>
          <nav>
            <button className="nav-link" onClick={() => setStore(null)}>
              Tiendas
            </button>
            {store && (
              <button className="nav-link" onClick={() => setStore(null)}>
                Todos los productos
              </button>
            )}
            <button className="nav-link" onClick={() => setLoginOpen(true)}>
              Login
            </button>
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
      <section className="shop-hero">
        <small>{store ? "TIENDA" : "DIRECTORIO DE TIENDAS"}</small>
        <h1>{store ? store.name : "Encuentra una tienda para comenzar"}</h1>
        <p>
          {store
            ? "Explora los productos disponibles de esta tienda."
            : "Conoce nuestros vendedores y entra a cada tienda para ver su catálogo."}
        </p>
        <form className="product-search" onSubmit={(e) => e.preventDefault()}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              store ? "Buscar en esta tienda" : "Buscar productos o tiendas"
            }
          />
          <button>Buscar</button>
        </form>
      </section>
      {!store ? (
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
        <main>
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
        <CartModal cart={cart} total={total} close={() => setCartOpen(false)} />
      )}
      {loginOpen && <LoginModal close={() => setLoginOpen(false)} />}
      <footer>
        Desarrollado por{" "}
        <a href="https://www.techdatasync.com">www.techdatasync.com</a>
      </footer>
    </>
  );
}
function ProductModal({ product, add, close }) {
  const [q, setQ] = useState(1),
    images = product.images || [product.image, product.image, product.image];
  return (
    <div className="overlay">
      <section className="product-modal">
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <div className="modal-body">
          <div className="modal-gallery">
            <img src={`${API}/static/img/${images[0]}`} alt={product.name} />
            <div className="modal-thumbnails">
              {images.map((x, i) => (
                <img
                  key={i}
                  src={`${API}/static/img/${x}`}
                  alt={`Vista ${i + 1}`}
                />
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
function CartModal({ cart, total, close }) {
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
                <div>
                  <strong>{p.name}</strong>
                  <span>{p.quantity} unidad(es)</span>
                </div>
                <b>{money(p.price * p.quantity)}</b>
              </div>
            ))
          ) : (
            <p>Tu carrito está vacío.</p>
          )}
          <div className="cart-modal-total">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <a className="btn cart-checkout" href={`${API}/checkout`}>
            Comprar
          </a>
        </div>
      </section>
    </div>
  );
}
function LoginModal({ close }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [message, setMessage] = useState("");
  const submit = async (e) => { e.preventDefault(); const response = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); const data = await response.json(); setMessage(response.ok ? `Bienvenido, ${data.user.name}` : data.error); };
  return <div className="overlay"><section className="cart-modal"><button className="modal-close" onClick={close}>×</button><form className="cart-modal-content" onSubmit={submit}><small>ACCESO UNICO</small><h2>Iniciar sesión</h2><label>Correo electrónico<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>{message && <p>{message}</p>}<button className="btn cart-checkout">Ingresar</button></form></section></div>;
}
createRoot(document.getElementById("root")).render(<App />);
