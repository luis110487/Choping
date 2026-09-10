import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:5000")
  .replace(/\/$/, "")
  .replace(/\/api$/, "");
const money = (n) => "$" + Number(n).toLocaleString("es-CO");
const SUPERADMIN_EMAILS = new Set([
  "luis.gamarra@techdatasync.com",
  "luis.gamarra@techdatasaync.com",
  "luis.gamarra@techdatasyn.com",
]);
const isPlatformAdmin = (account) =>
  account &&
  (["admin", "superadmin"].includes(account.role) ||
    SUPERADMIN_EMAILS.has((account.email || "").trim().toLowerCase()));
const normalizeAccount = (account) =>
  account && isPlatformAdmin(account)
    ? { ...account, role: "superadmin" }
    : account;
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
    [purchased, setPurchased] = useState(() =>
      JSON.parse(localStorage.getItem("choping-purchased") || "[]"),
    ),
    [loginOpen, setLoginOpen] = useState(false),
    [banner, setBanner] = useState(() =>
      Number(localStorage.getItem("choping-banner") || 0),
    ),
    [directoryBanner, setDirectoryBanner] = useState(() =>
      Number(localStorage.getItem("choping-directory-banner") || 0),
    ),
    [adminOpen, setAdminOpen] = useState(false),
    [user, setUser] = useState(() => normalizeAccount(JSON.parse(localStorage.getItem("choping-user") || "null"))),
    [profileOpen, setProfileOpen] = useState(() => localStorage.getItem("choping-profile-open") === "true"),
    [storeAdminOpen, setStoreAdminOpen] = useState(false),
    [storeThemes, setStoreThemes] = useState(() =>
      JSON.parse(
        localStorage.getItem("choping-store-themes") ||
          '{"Tech Zone":"ocean","Casa Viva":"sunset","EcoRuedas":"forest"}',
      ),
    );
  useEffect(() => {
    fetch(`${API}/api/stores`)
      .then((r) => r.json())
      .then((data) => setStores(Array.isArray(data) ? data : []));
  }, []);
  useEffect(() => {
    if (user?.role !== "tienda" || store || !user.store_name) return;
    const assignedStore = stores.find(
      (item) => item.name.toLowerCase() === user.store_name.toLowerCase(),
    );
    if (assignedStore) {
      setStore(assignedStore);
      setStoreAdminOpen(true);
    }
  }, [stores, user, store]);
  useEffect(
    () => localStorage.setItem("choping-cart", JSON.stringify(cart)),
    [cart],
  );
  const products = (
    store ? store.products : stores.flatMap((s) => s.products)
  ).filter(
    (p) =>
      (!query ||
        `${p.name} ${p.category} ${p.store}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!categoryFilter || p.category === categoryFilter),
  );
  const categories = store
    ? [...new Set(store.products.map((p) => p.category))]
    : [];
  const storeCategoryFilters = [
    ["", "Todas", "▦"],
    ["Tecnologia", "Tecnología", "⌁"],
    ["Ferreteria", "Ferreterías", "⚒"],
    ["Drogueria", "Droguerías", "+"],
    ["Peluqueria", "Peluquerías", "✂"],
  ];
  const visibleStores = stores.filter((s) => {
    const text =
      `${s.name} ${s.category} ${s.products.map((p) => `${p.name} ${p.category}`).join(" ")}`.toLowerCase();
    return (
      (!query || text.includes(query.toLowerCase())) &&
      (!categoryFilter || s.category.toLowerCase() === categoryFilter.toLowerCase())
    );
  });
  const featuredStoreNames = ["Tech Zone", "Casa Viva"];
  const featuredStores = visibleStores.filter(
    (s) => s.featured || featuredStoreNames.includes(s.name),
  );
  const otherStores = visibleStores.filter(
    (s) => !s.featured && !featuredStoreNames.includes(s.name),
  );
  const renderStoreCards = (items, featured = false) =>
    items.map((s) => (
      <article
        className={`store-card${featured ? " featured-store-card" : ""}`}
        key={s.name}
        onClick={() => {
          setStore(s);
          setQuery("");
          setCategoryFilter("");
        }}
      >
        <div className="store-mark">{s.name.slice(0, 1)}</div>
        <div>
          {featured && <span className="featured-label">Destacada</span>}
          <small>{s.category}</small>
          <h2>{s.name}</h2>
          <Stars value={s.rating} />
          <p>{s.products.length} productos disponibles</p>
          <button className="btn">Ver tienda</button>
        </div>
      </article>
    ));
  const add = (p, q = 1) =>
    setCart((c) => {
      const x = c.find((i) => i.id === p.id);
      return x
        ? c.map((i) => (i.id === p.id ? { ...i, quantity: i.quantity + q } : i))
        : [...c, { ...p, quantity: q }];
    });
  const total = cart.reduce((s, p) => s + p.price * p.quantity, 0);
  const logout = () => {
    setUser(null);
    localStorage.removeItem("choping-user");
    localStorage.removeItem("choping-profile-open");
    setProfileOpen(false);
    setAdminOpen(false);
    setStoreAdminOpen(false);
  };
  const userInitial = (user?.name || user?.email || "U").slice(0, 1).toUpperCase();
  const openStoreDashboard = () => {
    const assignedStore = stores.find(
      (item) => item.name.toLowerCase() === user?.store_name?.toLowerCase(),
    );
    if (!assignedStore) return;
    setStore(assignedStore);
    setProfileOpen(false);
    setStoreAdminOpen(true);
  };
  return (
    <div
      className={
        store
          ? `store-app theme-${storeThemes[store.name] || "ocean"}`
          : "store-app"
      }
    >
      <header>
        <div className="nav">
          <a className="logo" href="#" onClick={() => setStore(null)}>
            <img src={`${API}/static/img/choping-logo.png`} alt="Choping" />
          </a>
          <form
            className="header-search"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                store ? "Buscar en esta tienda" : "Buscar productos o tiendas"
              }
              aria-label="Buscar productos o tiendas"
            />
            {store && (
              <select
                className="category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filtrar por categoria"
              >
                <option value="">Todas las categorias</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            )}
            <button type="submit">Buscar</button>
          </form>
          {!store && !showAllProducts && (
            <div className="store-category-filters" aria-label="Filtrar tiendas por categoria">
              {storeCategoryFilters.map(([value, label, icon]) => (
                <button
                  key={value || "all"}
                  className={categoryFilter === value ? "active" : ""}
                  onClick={() => setCategoryFilter(value)}
                  type="button"
                  title={`Filtrar por ${label.toLowerCase()}`}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          )}
          <nav>
            <button
              className="nav-link"
              onClick={() => {
                setStore(null);
                setShowAllProducts(false);
                setQuery("");
              }}
            >
              Tiendas
            </button>
            {!user && (
              <button className="nav-link" onClick={() => setLoginOpen(true)}>
                Login
              </button>
            )}
            {user && (
              <button
                className="user-avatar-button"
                onClick={() => {
                  setProfileOpen(true);
                  localStorage.setItem("choping-profile-open", "true");
                }}
                aria-label="Abrir mi perfil"
                title="Mi perfil"
              >
                {userInitial}
              </button>
            )}
            {isPlatformAdmin(user) && (
              <button className="nav-link" onClick={() => setAdminOpen(true)}>
                Panel administrativo
              </button>
            )}
            {user?.role === "tienda" && user?.store_name && (
              <button
                className="nav-link"
                onClick={openStoreDashboard}
              >
                Panel de tienda
              </button>
            )}
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
      <section className="banner-section" aria-label="Banners destacados">
        <BannerSlider
          storeName={store?.name}
          banner={banner}
          setBanner={(value) => {
            setBanner(value);
            localStorage.setItem("choping-banner", String(value));
          }}
        />
      </section>
      {!store && !showAllProducts ? (
        <main>
          {featuredStores.length > 0 && (
            <section className="store-directory-section">
              <div className="store-section-heading">
                <small>SELECCIÓN CHOPING</small>
                <h1>Tiendas destacadas</h1>
                <p>Descubre tiendas recomendadas y sus productos más populares.</p>
              </div>
              <div className="store-grid">{renderStoreCards(featuredStores, true)}</div>
            </section>
          )}
          {(
            <section className="directory-inline-banner" aria-label="Banners de tiendas">
              <BannerSlider
                storeName={null}
                banner={directoryBanner}
                storageKey="choping-directory-banners"
                setBanner={(value) => {
                  setDirectoryBanner(value);
                  localStorage.setItem("choping-directory-banner", String(value));
                }}
              />
            </section>
          )}
          {otherStores.length > 0 && (
            <section className="store-directory-section other-stores-section">
              <div className="store-section-heading">
                <small>DIRECTORIO DE TIENDAS</small>
                <h2>Más tiendas para explorar</h2>
              </div>
              <div className="store-grid">{renderStoreCards(otherStores)}</div>
            </section>
          )}
          {!visibleStores.length && (
            <p className="empty-products">No encontramos tiendas con esa búsqueda.</p>
          )}
        </main>
      ) : (
        <main
          className={`store-profile theme-${storeThemes[store.name] || "ocean"}`}
        >
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
        <CartModal
          cart={cart}
          setCart={setCart}
          setPurchased={setPurchased}
          total={total}
          close={() => setCartOpen(false)}
        />
      )}
      {loginOpen && (
        <LoginModal
          close={() => setLoginOpen(false)}
          currentStore={store?.name || ""}
          onLogin={(nextUser) => {
            const registeredAccount = JSON.parse(localStorage.getItem("choping-registered-users") || "[]")
              .find((account) => account.email === nextUser.email);
            const normalizedUser = normalizeAccount({ ...nextUser, ...registeredAccount });
            setUser(normalizedUser);
            localStorage.setItem("choping-user", JSON.stringify(normalizedUser));
            setLoginOpen(false);
            if (normalizedUser.role === "tienda") {
              const assignedStore = stores.find(
                (item) => item.name.toLowerCase() === normalizedUser.store_name?.toLowerCase(),
              );
              if (assignedStore) {
                setStore(assignedStore);
                setStoreAdminOpen(true);
              }
            }
          }}
        />
      )}
      {profileOpen && (
        <ClientProfile
          user={user}
          setUser={setUser}
          purchased={purchased}
          openAdmin={() => { setProfileOpen(false); setAdminOpen(true); }}
          openStoreAdmin={openStoreDashboard}
          store={store}
          logout={logout}
          close={() => { setProfileOpen(false); localStorage.setItem("choping-profile-open", "false"); }}
        />
      )}
      {adminOpen && (
        <AdminBannerPanel
          stores={stores}
          banner={banner}
          directoryBanner={directoryBanner}
          setBanner={(value) => {
            setBanner(value);
            localStorage.setItem("choping-banner", String(value));
          }}
          setDirectoryBanner={(value) => {
            setDirectoryBanner(value);
            localStorage.setItem("choping-directory-banner", String(value));
          }}
          close={() => setAdminOpen(false)}
        />
      )}
      {storeAdminOpen && (
        <StoreAdminPanel
          store={store}
          theme={storeThemes[store.name] || "ocean"}
          setTheme={(value) => {
            const next = { ...storeThemes, [store.name]: value };
            setStoreThemes(next);
            localStorage.setItem("choping-store-themes", JSON.stringify(next));
          }}
          close={() => setStoreAdminOpen(false)}
        />
      )}
      <footer>
        Desarrollado por{" "}
        <a href="https://www.techdatasync.com">www.techdatasync.com</a>
      </footer>
    </div>
  );
}
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
                src={`${API}/static/img/${images[imageIndex]}`}
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
                  className={imageIndex === i ? "active" : ""}
                  onClick={() => setImageIndex(i)}
                >
                  <img
                    key={i}
                    src={`${API}/static/img/${x}`}
                    alt={`Vista ${i + 1}`}
                  />
                </button>
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
                <img src={`${API}/static/img/${p.image}`} alt="" />
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
function BannerSlider({ storeName, banner, setBanner, storageKey = "choping-home-banners" }) {
  const defaultImages =
    storeName === "EcoRuedas"
      ? [
          "/ecorruedas-banner.png",
          "/ecorruedas-banner.png",
          "/ecorruedas-banner.png",
        ]
      : storeName === "Casa Viva"
        ? [
            "/casaviva-banner-1.png",
            "/casaviva-banner-2.png",
            "/casaviva-banner-1.png",
          ]
        : storeName === "Tech Zone"
          ? [
              "/techzone-banner.png",
              "/techzone-banner.png",
              "/techzone-banner.png",
            ]
          : ["/banner-home-1.png", "/banner-home-2.png", "/banner-home-3.png"];
  const images = storeName
    ? defaultImages
    : JSON.parse(localStorage.getItem(storageKey) || "null") || defaultImages;
  useEffect(() => {
    const timer = setInterval(
      () => setBanner((banner + 1) % images.length),
      6000,
    );
    return () => clearInterval(timer);
  }, [banner, setBanner]);
  return (
    <section className={`banner-slider ${storeName ? "store-banner" : "home-banner"}`}>
      <img
        className="banner-image"
        src={images[banner]}
        alt={`Banner ${banner + 1}`}
      />
      <button
        className="banner-control previous"
        onClick={() => setBanner((banner + 2) % 3)}
      >
        ‹
      </button>
      <button
        className="banner-control next"
        onClick={() => setBanner((banner + 1) % 3)}
      >
        ›
      </button>
      <div className="banner-dots">
        {images.map((_, i) => (
          <button
            key={i}
            className={i === banner ? "active" : ""}
            aria-label={`Mostrar banner ${i + 1}`}
            onClick={() => setBanner(i)}
          />
        ))}
      </div>
    </section>
  );
}
function AdminBannerPanel({ stores, banner, setBanner, directoryBanner, setDirectoryBanner, close }) {
  const defaultImages = [
    "/banner-home-1.png",
    "/banner-home-2.png",
    "/banner-home-3.png",
  ];
  const defaultCategories = [
    { id: "tecnologia", name: "Tecnologia", icon: "💻" },
    { id: "hogar", name: "Hogar", icon: "⌂" },
    { id: "movilidad", name: "Movilidad", icon: "🚲" },
    { id: "moda", name: "Moda", icon: "✦" },
  ];
  const directoryDefaultImages = [
    "/banner-home-2.png",
    "/banner-home-3.png",
    "/banner-home-1.png",
  ];
  const [images, setImages] = useState(() =>
    JSON.parse(localStorage.getItem("choping-home-banners") || "null") || defaultImages,
  );
  const [directoryImages, setDirectoryImages] = useState(() =>
    JSON.parse(localStorage.getItem("choping-directory-banners") || "null") || directoryDefaultImages,
  );
  const [tab, setTab] = useState("summary"),
    [managedStores, setManagedStores] = useState(stores),
    [approved, setApproved] = useState(() =>
      JSON.parse(localStorage.getItem("choping-approved-stores") || "[]"),
    ),
    [categories, setCategories] = useState(() =>
      JSON.parse(localStorage.getItem("choping-categories") || "null") || defaultCategories,
    ),
    [categoryName, setCategoryName] = useState(""),
    [categoryIcon, setCategoryIcon] = useState("▦"),
    [editingCategory, setEditingCategory] = useState(null),
    [categoryMessage, setCategoryMessage] = useState(""),
    [managedUsers, setManagedUsers] = useState(() =>
      JSON.parse(localStorage.getItem("choping-registered-users") || "[]"),
    ),
    [newUserName, setNewUserName] = useState(""),
    [newUserEmail, setNewUserEmail] = useState(""),
    [newUserPassword, setNewUserPassword] = useState(""),
    [newUserRole, setNewUserRole] = useState("cliente"),
    [newUserStore, setNewUserStore] = useState(""),
    [editingUser, setEditingUser] = useState(null),
    [userMessage, setUserMessage] = useState("");
  useEffect(() => {
    fetch(`${API}/api/stores?include_pending=true`)
      .then((response) => response.json())
      .then((data) => Array.isArray(data) && setManagedStores(data))
      .catch(() => setManagedStores(stores));
  }, [stores]);
  const changeApproval = (name, value) => {
    const next = value
      ? [...new Set([...approved, name])]
      : approved.filter((item) => item !== name);
    setApproved(next);
    localStorage.setItem("choping-approved-stores", JSON.stringify(next));
  };
  const changeBannerImage = (index, file, directory = false) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const current = directory ? directoryImages : images;
      const next = [...current];
      next[index] = reader.result;
      if (directory) {
        setDirectoryImages(next);
        localStorage.setItem("choping-directory-banners", JSON.stringify(next));
      } else {
        setImages(next);
        localStorage.setItem("choping-home-banners", JSON.stringify(next));
      }
    };
    reader.readAsDataURL(file);
  };
  const saveCategory = (event) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    const duplicate = categories.some(
      (category) => category.name.toLowerCase() === name.toLowerCase() && category.id !== editingCategory,
    );
    if (duplicate) {
      setCategoryMessage("Ya existe una categoría con ese nombre.");
      return;
    }
    const next = editingCategory
      ? categories.map((category) =>
          category.id === editingCategory ? { ...category, name, icon: categoryIcon } : category,
        )
      : [...categories, { id: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`, name, icon: categoryIcon }];
    setCategories(next);
    localStorage.setItem("choping-categories", JSON.stringify(next));
    setCategoryName("");
    setCategoryIcon("▦");
    setEditingCategory(null);
    setCategoryMessage(editingCategory ? "Categoría actualizada." : "Categoría creada.");
  };
  const editCategory = (category) => {
    setEditingCategory(category.id);
    setCategoryName(category.name);
    setCategoryIcon(category.icon);
    setCategoryMessage("");
  };
  const changeCategoryIcon = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCategoryIcon(reader.result);
    reader.readAsDataURL(file);
  };
  const removeCategory = (id) => {
    const next = categories.filter((category) => category.id !== id);
    setCategories(next);
    localStorage.setItem("choping-categories", JSON.stringify(next));
    if (editingCategory === id) {
      setEditingCategory(null);
      setCategoryName("");
      setCategoryIcon("▦");
    }
  };
  const saveUser = (event) => {
    event.preventDefault();
    const name = newUserName.trim();
    const email = newUserEmail.trim().toLowerCase();
    if (!name || !email || (!editingUser && newUserPassword.length < 6) || (editingUser && newUserPassword && newUserPassword.length < 6)) {
      setUserMessage(editingUser ? "La nueva contraseña debe tener al menos 6 caracteres." : "La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newUserRole === "tienda" && !newUserStore) {
      setUserMessage("Selecciona la tienda que tendrá asignada este usuario.");
      return;
    }
    if (managedUsers.some((user) => user.email === email && user.email !== editingUser)) {
      setUserMessage("Ya existe un usuario con ese correo.");
      return;
    }
    const account = { name, email, role: newUserRole, store_name: newUserRole === "tienda" ? newUserStore : "" };
    const next = editingUser
      ? managedUsers.map((user) => user.email === editingUser ? { ...user, ...account } : user)
      : [...managedUsers, account];
    setManagedUsers(next);
    localStorage.setItem("choping-registered-users", JSON.stringify(next));
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserRole("cliente");
    setNewUserStore("");
    setEditingUser(null);
    setUserMessage(editingUser ? "Usuario actualizado correctamente." : "Usuario creado correctamente.");
  };
  const editUser = (account) => {
    setEditingUser(account.email);
    setNewUserName(account.name || "");
    setNewUserEmail(account.email || "");
    setNewUserPassword("");
    setNewUserRole(account.role || "cliente");
    setNewUserStore(account.store_name || "");
    setUserMessage("");
  };
  const platformUsers = JSON.parse(localStorage.getItem("choping-registered-users") || "[]");
  const totalProducts = stores.reduce((total, item) => total + item.products.length, 0);
  const confirmedOrders = JSON.parse(localStorage.getItem("choping-orders") || "[]");
  const totalPurchases = confirmedOrders.reduce(
    (total, order) => total + Number(order.quantity || order.items?.reduce((subtotal, item) => subtotal + Number(item.quantity || 1), 0) || 0),
    0,
  );
  const approvedStores = managedStores.filter((item) => item.approved !== false).length;
  const pendingStores = managedStores.filter((item) => item.approved === false).length;
  const approvalProgress = managedStores.length ? Math.round((approvedStores / managedStores.length) * 100) : 0;
  return (
    <div className="overlay admin-overlay">
      <section className="admin-dashboard-panel">
        <aside className="admin-sidebar">
          <div className="admin-brand"><img src={`${API}/static/img/choping-logo.png`} alt="Choping" /><span>Administración global</span></div>
          <button className="admin-back-button" onClick={close}>← <span>Ir a tiendas</span></button>
          <button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>⌂ <span>Dashboard</span></button>
          <small>GESTIÓN GENERAL</small>
          <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>♙ <span>Usuarios</span></button>
          <button className={tab === "stores" ? "active" : ""} onClick={() => setTab("stores")}>▣ <span>Tiendas</span></button>
          <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>◇ <span>Productos</span></button>
          <button className={tab === "categories" ? "active" : ""} onClick={() => setTab("categories")}>▦ <span>Categorías</span></button>
          <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>⚑ <span>Solicitudes</span></button>
          <small>CONFIGURACIÓN</small>
          <button onClick={() => setTab("summary")}>⚙ <span>Roles y permisos</span></button>
          <button className={tab === "banners" || tab === "directory-banners" ? "active" : ""} onClick={() => setTab("banners")}>▤ <span>Publicidad / Banners</span></button>
          <div className="admin-sidebar-footer">Sesión de superadministrador</div>
        </aside>
        <div className="admin-main">
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <header className="admin-dashboard-header">
          <div><small>CONTROL DE PLATAFORMA</small><h1>Hola, Super Administrador</h1><p>Gestiona tiendas, productos, contenido y permisos desde un solo lugar.</p></div>
          <span className="admin-date">Panel general</span>
        </header>
        <div className="cart-modal-content">
          <small>PANEL ADMINISTRADOR</small>
          <div className="admin-tabs">
            <button
              className={tab === "summary" ? "selected" : ""}
              onClick={() => setTab("summary")}
            >
              Resumen
            </button>
            <button
              className={tab === "banners" ? "selected" : ""}
              onClick={() => setTab("banners")}
            >
              Banners superiores
            </button>
            <button
              className={tab === "directory-banners" ? "selected" : ""}
              onClick={() => setTab("directory-banners")}
            >
              Banners del directorio
            </button>
            <button
              className={tab === "stores" ? "selected" : ""}
              onClick={() => setTab("stores")}
            >
              Aprobación de tiendas
            </button>
            <button
              className={tab === "users" ? "selected" : ""}
              onClick={() => setTab("users")}
            >
              Usuarios
            </button>
            <button
              className={tab === "requests" ? "selected" : ""}
              onClick={() => setTab("requests")}
            >
              Solicitudes
            </button>
            <button
              className={tab === "products" ? "selected" : ""}
              onClick={() => setTab("products")}
            >
              Productos
            </button>
            <button
              className={tab === "categories" ? "selected" : ""}
              onClick={() => setTab("categories")}
            >
              Categorías
            </button>
          </div>
          {tab === "summary" ? (
            <>
              <h2>Dashboard de la plataforma</h2>
              <p>Consulta el progreso general de Choping en tiempo real.</p>
              <div className="admin-summary-grid">
                <div><strong>{stores.length}</strong><span>Tiendas registradas</span></div>
                <div><strong>{approvedStores}</strong><span>Tiendas activas</span></div>
                <div><strong>{totalProducts}</strong><span>Productos publicados</span></div>
                <div><strong>{platformUsers.length}</strong><span>Usuarios registrados</span></div>
                <div><strong>{totalPurchases}</strong><span>Compras confirmadas</span></div>
                <div><strong>{pendingStores}</strong><span>Solicitudes pendientes</span></div>
              </div>
              <div className="admin-progress-panel"><div className="admin-progress-heading"><h3>Progreso de la plataforma</h3><strong>{approvalProgress}%</strong></div><p>Aprobación de tiendas registradas</p><div className="admin-progress-track"><span style={{ width: `${approvalProgress}%` }} /></div><div className="admin-progress-legend"><span><i className="progress-dot active" />{approvedStores} activas</span><span><i className="progress-dot pending" />{pendingStores} pendientes</span></div></div>
              <div className="admin-overview-columns"><section className="admin-overview-card"><h3>Actividad del catálogo</h3><div><span>Tiendas con productos</span><strong>{stores.filter((item) => item.products.length > 0).length} / {stores.length}</strong></div><div><span>Promedio de productos por tienda</span><strong>{stores.length ? (totalProducts / stores.length).toFixed(1) : "0.0"}</strong></div><div><span>Compras confirmadas</span><strong>{totalPurchases}</strong></div></section><section className="admin-overview-card"><h3>Distribución de usuarios</h3><div><span>Clientes</span><strong>{platformUsers.filter((item) => item.role === "cliente").length}</strong></div><div><span>Tiendas</span><strong>{platformUsers.filter((item) => item.role === "tienda").length}</strong></div><div><span>Administradores</span><strong>{platformUsers.filter((item) => ["admin", "superadmin"].includes(item.role)).length}</strong></div></section></div>
              <div className="admin-roles">
                <h3>Roles del sistema</h3>
                <p><b>Superadmin:</b> configuración global y control administrativo.</p>
                <p><b>Admin:</b> banners, tiendas y productos.</p>
                <p><b>Tienda:</b> catálogo, categorías y personalización de su tienda.</p>
                <p><b>Cliente:</b> compras, pedidos y reseñas verificadas.</p>
              </div>
            </>
          ) : tab === "users" ? (
            <>
              <h2>Usuarios y roles</h2>
              <p>Crea cuentas y define qué puede administrar cada usuario.</p>
              <form className="admin-user-form" onSubmit={saveUser}>
                <label>Nombre completo<input value={newUserName} onChange={(event) => setNewUserName(event.target.value)} required /></label>
                <label>Correo electrónico<input type="email" value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} required /></label>
                <label>Contraseña{editingUser && <small className="admin-field-hint">Déjala vacía para conservarla</small>}<input type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} minLength="6" required={!editingUser} /></label>
                <label>Rol<select value={newUserRole} onChange={(event) => { setNewUserRole(event.target.value); setNewUserStore(""); }}><option value="cliente">Cliente</option><option value="tienda">Tienda</option><option value="admin">Administrador</option><option value="superadmin">Superadmin</option></select></label>
                {newUserRole === "tienda" && <label>Tienda asignada<select value={newUserStore} onChange={(event) => setNewUserStore(event.target.value)} required><option value="">Selecciona una tienda</option>{stores.map((store) => <option key={store.name} value={store.name}>{store.name} · {store.city || "Colombia"}</option>)}</select></label>}
                <div className="admin-user-actions"><button className="btn" type="submit">{editingUser ? "Guardar cambios" : "Crear usuario"}</button>{editingUser && <button className="nav-link" type="button" onClick={() => { setEditingUser(null); setNewUserName(""); setNewUserEmail(""); setNewUserPassword(""); setNewUserRole("cliente"); setNewUserStore(""); }}>Cancelar</button>}</div>
              </form>
              {userMessage && <p className="admin-category-message">{userMessage}</p>}
              <div className="admin-user-list">
                {managedUsers.length ? managedUsers.map((account) => <div className="admin-user-row" key={account.email}><span className="admin-user-avatar">{(account.name || account.email).slice(0, 1).toUpperCase()}</span><div><strong>{account.name || "Usuario"}</strong><small>{account.email}</small></div><span className={`admin-role-badge role-${account.role}`}>{account.role}</span>{account.role === "tienda" && <small>{account.store_name || "Sin tienda asignada"}</small>}<button className="admin-user-edit" type="button" onClick={() => editUser(account)}>Editar</button></div>) : <div className="store-admin-empty"><strong>Aún no hay usuarios creados</strong><span>Los usuarios nuevos aparecerán aquí.</span></div>}
              </div>
            </>
          ) : tab === "categories" ? (
            <>
              <h2>Gestión de categorías</h2>
              <p>Crea y organiza las categorías que se mostrarán en tiendas y productos.</p>
              <form className="admin-category-form" onSubmit={saveCategory}>
                <label>
                  Nombre de la categoría
                  <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ej. Ferretería" required />
                </label>
                <label>
                  Icono
                  <select value={categoryIcon.startsWith("data:image/") ? "custom" : categoryIcon} onChange={(event) => event.target.value !== "custom" && setCategoryIcon(event.target.value)}>
                    <option value="▦">▦ General</option>
                    <option value="💻">💻 Tecnología</option>
                    <option value="⌂">⌂ Hogar</option>
                    <option value="🚲">🚲 Movilidad</option>
                    <option value="✦">✦ Moda</option>
                    <option value="⚒">⚒ Ferretería</option>
                    <option value="✚">✚ Salud</option>
                    <option value="♢">♢ Servicios</option>
                    {categoryIcon.startsWith("data:image/") && <option value="custom">Imagen personalizada</option>}
                  </select>
                </label>
                <label className="admin-category-icon-upload">
                  Icono personalizado
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => changeCategoryIcon(event.target.files?.[0])} />
                  <span>{categoryIcon.startsWith("data:image/") ? "Icono cargado. Puedes reemplazarlo." : "Sube PNG, JPG, WEBP o SVG"}</span>
                </label>
                <div className="admin-category-actions">
                  <button className="btn" type="submit">{editingCategory ? "Guardar cambios" : "Crear categoría"}</button>
                  {editingCategory && <button className="nav-link" type="button" onClick={() => { setEditingCategory(null); setCategoryName(""); setCategoryIcon("▦"); }}>Cancelar</button>}
                </div>
              </form>
              {categoryMessage && <p className="admin-category-message">{categoryMessage}</p>}
              <div className="admin-category-list">
                {categories.map((category) => (
                  <div className="admin-category-row" key={category.id}>
                    <span className="admin-category-icon" aria-hidden="true">{category.icon.startsWith("data:image/") ? <img src={category.icon} alt="" /> : category.icon}</span>
                    <strong>{category.name}</strong>
                    <button type="button" onClick={() => editCategory(category)}>Editar</button>
                    <button className="delete" type="button" onClick={() => removeCategory(category.id)}>Eliminar</button>
                  </div>
                ))}
              </div>
            </>
          ) : tab === "banners" || tab === "directory-banners" ? (
            <>
              <h2>{tab === "directory-banners" ? "Banners entre tiendas" : "Banners superiores"}</h2>
              <p>
                {tab === "directory-banners"
                  ? "Configura los tres banners independientes que aparecen entre las tiendas destacadas y el directorio."
                  : "Configura los tres banners que aparecen en la parte superior."}
              </p>
              <div className="admin-banner-options">
                {(tab === "directory-banners" ? directoryImages : images).map((image, i) => (
                  <div className={`admin-banner-card ${(tab === "directory-banners" ? directoryBanner : banner) === i ? "selected" : ""}`} key={`${tab}-banner-${i}`}>
                    <img src={image} alt={`Banner ${i + 1}`} />
                    <button onClick={() => (tab === "directory-banners" ? setDirectoryBanner(i) : setBanner(i))}><strong>Banner {i + 1}</strong><span>{(tab === "directory-banners" ? directoryBanner : banner) === i ? "Activo" : "Seleccionar"}</span></button>
                    <label className="admin-banner-upload">Cambiar imagen<input type="file" accept="image/*" onChange={(e) => changeBannerImage(i, e.target.files?.[0], tab === "directory-banners")} /></label>
                  </div>
                ))}
              </div>
            </>
          ) : tab === "stores" || tab === "requests" ? (
            <>
              <h2>{tab === "requests" ? "Solicitudes de tiendas" : "Gestión de tiendas"}</h2>
              <p>{tab === "requests" ? "Revisa y aprueba las tiendas que quieren aparecer en el directorio." : "Consulta el estado de todas las tiendas registradas."}</p>
              <div className="admin-store-list">
                {managedStores.filter((store) => tab !== "requests" || store.approved === false).map((store) => (
                  <div className="admin-store-row" key={store.name}>
                    <div>
                      <strong>{store.name}</strong>
                      <small>
                        {store.category} · {store.products.length} productos
                      </small>
                    </div>
                    <button
                      className={
                        store.approved !== false && (approved.length === 0 || approved.includes(store.name)) ? "approved" : ""
                      }
                      onClick={() =>
                        changeApproval(
                          store.name,
                          !(store.approved !== false && (approved.length === 0 || approved.includes(store.name))),
                        )
                      }
                    >
                      {store.approved !== false && (approved.length === 0 || approved.includes(store.name)) ? "Aprobada" : "Aprobar"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2>Productos publicados</h2>
              <p>Consulta el catálogo agrupado por tienda.</p>
              <div className="admin-store-list">
                {stores.flatMap((store) => store.products.map((product) => (
                  <div className="admin-store-row" key={`${store.name}-${product.id}`}>
                    <div>
                      <strong>{product.name}</strong>
                      <small>{store.name} · {product.category} · {money(product.price)}</small>
                    </div>
                    <span className="admin-product-status">Publicado</span>
                  </div>
                )))}
              </div>
            </>
          )}
        </div>
        </div>
      </section>
    </div>
  );
}
function StoreAdminPanel({ store, theme, setTheme, close }) {
  const themes = [
    { id: "ocean", name: "Ocean", detail: "Azul, limpia y tecnológica" },
    { id: "sunset", name: "Sunset", detail: "Cálida y comercial" },
    { id: "forest", name: "Forest", detail: "Natural y confiable" },
    { id: "mono", name: "Minimal", detail: "Elegante y sobria" },
  ];
  const [tab, setTab] = useState("home");
  const products = store?.products || [];
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
  return (
    <div className="overlay store-admin-overlay">
      <section className="store-admin-panel">
        <aside className="store-admin-sidebar">
          <div className="store-admin-brand"><strong>CHOPING</strong><span>Mi tienda</span></div>
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
          {tab === "home" && <div className="store-admin-content"><div className="store-admin-stats store-admin-metrics"><div><strong>{products.length}</strong><span>Productos publicados</span></div><div><strong>{totalPurchases}</strong><span>Compras confirmadas</span></div><div><strong>{averageRating}</strong><span>Calificación promedio</span></div><div><strong>{productCategories}</strong><span>Categorías activas</span></div></div><div className="store-admin-columns"><section className="store-admin-table"><div className="store-admin-title"><h2>Mis productos</h2><button className="btn" onClick={() => setTab("products")}>＋ Agregar producto</button></div>{products.length ? products.map((product) => <div className="store-product-row" key={product.id}><img src={`${API}/static/img/${product.image}`} alt="" /><div><strong>{product.name}</strong><small>{money(product.price)}</small></div><span>Activo</span><button aria-label={`Editar ${product.name}`} onClick={() => setTab("products")}>✎</button></div>) : <p>Aún no tienes productos publicados.</p>}</section><aside className="store-admin-info"><h2>Mi tienda</h2><div className="store-admin-store-card"><div className="store-mark"><span>{store?.name?.slice(0, 1) || "T"}</span></div><div><strong>{store?.name}</strong><span>{store?.city || "Colombia"}</span></div></div><button className="btn" onClick={() => setTab("store")}>✎ Editar mi tienda</button></aside></div></div>}
          {tab === "products" && <div className="store-admin-content"><h2>Productos de {store?.name}</h2><p>Administra el catálogo y revisa los productos publicados.</p><div className="store-admin-list">{products.map((product) => <div className="store-product-row" key={product.id}><img src={`${API}/static/img/${product.image}`} alt="" /><div><strong>{product.name}</strong><small>{product.category} · {money(product.price)}</small></div><span>Activo</span><button aria-label={`Editar ${product.name}`}>✎</button><button aria-label={`Eliminar ${product.name}`}>⌫</button></div>)}</div></div>}
          {tab === "clients" && <div className="store-admin-content"><h2>Clientes de {store?.name}</h2><p>Clientes vinculados a esta tienda. Los datos de contacto se muestran protegidos.</p><div className="store-admin-list">{registeredClients.length ? registeredClients.map((client) => <div className="store-client-row" key={client.email}><span className="store-client-avatar">{(client.name || client.email).slice(0, 1).toUpperCase()}</span><div><strong>{client.name || "Cliente"}</strong><small>{maskedEmail(client.email)}</small></div><span>{maskedPhone(client.phone)}</span></div>) : <div className="store-admin-empty"><strong>Aún no hay clientes vinculados</strong><span>Los clientes asociados a esta tienda aparecerán aquí.</span></div>}</div></div>}
          {tab === "store" && <div className="store-admin-content"><h2>Información de mi tienda</h2><p>Consulta y actualiza la información visible para tus clientes.</p><div className="store-edit-grid"><label>Nombre de la tienda<input defaultValue={store?.name || ""} /></label><label>Categoría<input defaultValue={store?.category || ""} /></label><label>Ciudad<input defaultValue={store?.city || ""} /></label><label>Descripción<textarea defaultValue={store?.description || ""} /></label></div><button className="btn">Guardar información</button></div>}
          {tab === "settings" && <div className="store-admin-content"><small>PERSONALIZACIÓN</small><h2>Diseña tu perfil</h2><p>Elige una plantilla para organizar tu tienda.</p><div className="theme-options">{themes.map((item) => <button key={item.id} className={`theme-option theme-${item.id} ${theme === item.id ? "selected" : ""}`} onClick={() => setTheme(item.id)}><span className="theme-preview" /><strong>{item.name}</strong><small>{item.detail}</small></button>)}</div><h3>Contenido de la tienda</h3><label>Logo de la tienda<input type="file" accept="image/*" /></label><label>Banners superiores (hasta 3)<input type="file" accept="image/*" multiple /></label><p className="form-hint">Los cambios visuales se aplican inmediatamente a tu perfil.</p></div>}
        </div>
      </section>
    </div>
  );
}
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
function PasswordModal({ close }) { const [current, setCurrent] = useState(""), [next, setNext] = useState(""), [confirm, setConfirm] = useState(""), [message, setMessage] = useState(""); const save = (e) => { e.preventDefault(); if (next.length < 8 || next !== confirm) return setMessage("La nueva contraseña debe tener 8 caracteres y coincidir."); localStorage.setItem("choping-password-updated", "true"); setMessage("Contraseña actualizada correctamente."); }; return <div className="overlay review-overlay"><section className="cart-modal review-modal"><form className="cart-modal-content" onSubmit={save}><small>SEGURIDAD</small><h2>Cambiar contraseña</h2><label>Contraseña actual<input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></label><label>Nueva contraseña<input type="password" value={next} onChange={(e) => setNext(e.target.value)} required /></label><label>Confirmar contraseña<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></label>{message && <p>{message}</p>}<button className="btn cart-checkout">Guardar contraseña</button><button type="button" className="nav-link" onClick={close}>Cancelar</button></form></section></div>; }
function StoreReviewModal({ store, close }) { const [rating, setRating] = useState(0), [comment, setComment] = useState(""); const save = () => { const reviews = JSON.parse(localStorage.getItem("choping-store-reviews") || "{}"); reviews[store] = { rating, comment, store }; localStorage.setItem("choping-store-reviews", JSON.stringify(reviews)); close(); }; return <div className="overlay review-overlay"><section className="cart-modal review-modal"><div className="cart-modal-content"><small>RESEÑA DE LA TIENDA</small><h2>{store}</h2><div className="rating-picker">{[1,2,3,4,5].map((value) => <button key={value} className={value <= rating ? "chosen" : ""} onClick={() => setRating(value)}>★</button>)}</div><label>Comentario<textarea value={comment} onChange={(e) => setComment(e.target.value)} required /></label><button className="btn cart-checkout" disabled={!rating} onClick={save}>Guardar reseña</button><button className="nav-link" onClick={close}>Cancelar</button></div></section></div>; }
function ReviewModal({ product, close, onSaved }) {
  const [rating, setRating] = useState(0),
    [comment, setComment] = useState("");
  const save = () => {
    const reviews = JSON.parse(localStorage.getItem("choping-reviews") || "{}");
    reviews[product.id] = { rating, comment, product: product.name };
    localStorage.setItem("choping-reviews", JSON.stringify(reviews));
    onSaved();
  };
  return (
    <div className="overlay review-overlay">
      <section className="cart-modal review-modal">
        <div className="cart-modal-content">
          <small>RESEÑA DEL PRODUCTO</small>
          <h2>{product.name}</h2>
          <div className="rating-picker">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                className={value <= rating ? "chosen" : ""}
                onClick={() => setRating(value)}
              >
                ★
              </button>
            ))}
          </div>
          <label>
            Comentario
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
            />
          </label>
          <button
            className="btn cart-checkout"
            disabled={!rating}
            onClick={save}
          >
            Guardar reseña
          </button>
          <button className="nav-link" onClick={close}>
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}
function LoginModal({ close, onLogin, currentStore = "" }) {
  const [register, setRegister] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("cliente"),
    [phone, setPhone] = useState(""),
    [storeName, setStoreName] = useState(currentStore),
    [category, setCategory] = useState(""),
    [city, setCity] = useState(""),
    [description, setDescription] = useState(""),
    [message, setMessage] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    const endpoint = register ? "register" : "login";
    const body = register
      ? {
          name,
          email,
          password,
          role,
          phone,
          store_name: storeName,
          category,
          city,
          description,
        }
      : { email, password };
    const response = await fetch(`${API}/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (response.ok && register) {
      const registeredUsers = JSON.parse(localStorage.getItem("choping-registered-users") || "[]");
      const nextUser = { ...data.user, phone, store_name: storeName };
      localStorage.setItem("choping-registered-users", JSON.stringify([
        ...registeredUsers.filter((item) => item.email !== nextUser.email),
        nextUser,
      ]));
    }
    if (response.ok && !register) onLogin(data.user);
    setMessage(
      response.ok
        ? data.message || `Bienvenido, ${data.user.name}`
        : data.error,
    );
  };
  return (
    <div className="overlay">
      <section className="cart-modal login-modal">
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <form className="cart-modal-content" onSubmit={submit}>
          <small>ACCESO UNICO</small>
          <h2>{register ? "Crear usuario" : "Iniciar sesión"}</h2>
          {register && (
            <>
              <label>
                Tipo de registro
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="cliente">Cliente</option>
                  <option value="tienda">Tienda</option>
                </select>
              </label>
              <label>
                {role === "tienda"
                  ? "Nombre del responsable"
                  : "Nombre completo"}
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              {role === "cliente" ? (
                <label>
                  Teléfono
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </label>
              ) : (
                <>
                  <label>
                    Nombre de la tienda
                    <input
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Categoría
                    <input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Ciudad
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Descripción
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                    />
                  </label>
                </>
              )}
            </>
          )}
          <label>
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {message && <p>{message}</p>}
          <button className="btn cart-checkout">
            {register ? "Crear usuario" : "Ingresar"}
          </button>
          <button
            type="button"
            className="nav-link"
            onClick={() => {
              setRegister(!register);
              setMessage("");
            }}
          >
            {register ? "Ya tengo una cuenta" : "Crear usuario nuevo"}
          </button>
        </form>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
function EditProfileModal({ user, setUser, close }) { const [name, setName] = useState(user?.name || ""), [email, setEmail] = useState(user?.email || ""); const save = (e) => { e.preventDefault(); const next = { ...user, name, email }; setUser(next); localStorage.setItem("choping-user", JSON.stringify(next)); close(); }; return <div className="overlay review-overlay"><section className="cart-modal review-modal"><form className="cart-modal-content" onSubmit={save}><small>MI PERFIL</small><h2>Editar información</h2><label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Correo electrónico<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><button className="btn cart-checkout">Guardar cambios</button><button type="button" className="nav-link" onClick={close}>Cancelar</button></form></section></div>; }
