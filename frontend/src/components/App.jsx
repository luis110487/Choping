import React, { useEffect, useRef, useState } from "react";
import { API, money, productImageUrl, storeMediaUrl } from "../lib/api";
import { DEFAULT_PLATFORM_THEME, normalizeTheme, platformStyleVars, themeClassName, themeStyleVars } from "../lib/theme";
import { configuredCategoryEntries } from "../lib/catalog";
import { isPlatformAdmin, loadCurrentUser, normalizeAccount } from "../lib/accounts";
import { Stars } from "./Stars";
import { ProductModal } from "./ProductModal";
import { CartModal } from "./CartModal";
import { BannerSlider } from "./BannerSlider";
import { AdminBannerPanel } from "./AdminBannerPanel";
import { StoreAdminPanel } from "./StoreAdminPanel";
import { ClientProfile } from "./ClientProfile";
import { ProfileMenu } from "./ProfileMenu";
import { LoginModal } from "./LoginModal";

function App() {
  const [stores, setStores] = useState([]),
    [store, setStore] = useState(null),
    [showAllProducts, setShowAllProducts] = useState(false),
    [showAllStores, setShowAllStores] = useState(false),
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
    [user, setUser] = useState(loadCurrentUser),
    [profileOpen, setProfileOpen] = useState(() => localStorage.getItem("choping-profile-open") === "true"),
    [menuOpen, setMenuOpen] = useState(false),
    [accountSection, setAccountSection] = useState(""),
    [storeAdminOpen, setStoreAdminOpen] = useState(false),
    themeSaveTimer = useRef(0),
    [platformTheme, setPlatformTheme] = useState(DEFAULT_PLATFORM_THEME),
    [productCategories, setProductCategories] = useState([]),
    [storeThemes, setStoreThemes] = useState(() =>
      JSON.parse(
        localStorage.getItem("choping-store-themes") ||
          '{"Tech Zone":"ocean","Casa Viva":"sunset","EcoRuedas":"forest"}',
      ),
    );
  // Un token guardado puede estar caducado o pertenecer a una cuenta
  // desactivada: sin comprobarlo, la interfaz seguia mostrando la sesion y
  // cada accion fallaba con un error de permisos que confundia.
  useEffect(() => {
    const authToken = localStorage.getItem("choping-auth-token");
    if (!authToken) return;
    fetch(`${API}/api/auth/session`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          if (data?.user) {
            const refreshed = normalizeAccount(data.user);
            setUser(refreshed);
            localStorage.setItem("choping-user", JSON.stringify(refreshed));
          }
          return;
        }
        if (response.status === 401 || response.status === 403) logout();
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch(`${API}/api/product-categories`)
      .then((response) => response.json())
      .then((data) => Array.isArray(data?.categories) && setProductCategories(data.categories))
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch(`${API}/api/platform/theme`)
      .then((r) => r.json())
      .then((data) => data && typeof data === "object" && setPlatformTheme(data))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const staff = isPlatformAdmin(user) || user?.role === "admin" || user?.role === "superadmin";
    const includePending = user?.role === "tienda" || staff ? "?include_pending=true" : "";
    const authToken = localStorage.getItem("choping-auth-token");
    fetch(`${API}/api/stores${includePending}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setStores(list);
        // The backend is the source of truth for palettes; localStorage is only a cache.
        const saved = {};
        for (const item of list) if (item.theme) saved[item.name] = item.theme;
        if (Object.keys(saved).length) {
          setStoreThemes((current) => {
            const next = { ...current, ...saved };
            localStorage.setItem("choping-store-themes", JSON.stringify(next));
            return next;
          });
        }
      });
  }, [user?.role]);
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
  const categoryIcons = new Map(configuredCategoryEntries().map((category) => [category.name, category.icon]));
  const activeStoreCategories = [...new Set(stores.flatMap((item) => item.products.map((product) => product.category)).filter(Boolean))];
  const storeCategoryFilters = [["", "Todas", "▦"], ...activeStoreCategories.map((category) => [category, category, categoryIcons.get(category) || "▦"])];
  const visibleStores = stores.filter((s) => {
    const text =
      `${s.name} ${s.category} ${s.products.map((p) => `${p.name} ${p.category}`).join(" ")}`.toLowerCase();
    return (
      (!query || text.includes(query.toLowerCase())) &&
      (!categoryFilter || s.products.some((product) => product.category.toLowerCase() === categoryFilter.toLowerCase()))
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
    items.map((s) => {
      const catalogue = s.products || [];
      const preview = catalogue.slice(0, 3);
      // Portada: el banner propio de la tienda y, si no tiene, su primer producto.
      const cover = s.media?.banners?.[0] || catalogue[0]?.image || "";
      return (
        <article
          className={`store-card${featured ? " featured-store-card" : ""}${catalogue.length ? "" : " store-card-empty"}`}
          key={s.name}
          onClick={() => {
            setStore(s);
            setQuery("");
            setCategoryFilter("");
          }}
        >
          <div className="store-card-cover">
            {cover && (
              <img
                src={s.media?.banners?.[0] ? storeMediaUrl(cover) : productImageUrl(cover)}
                alt=""
                loading="lazy"
              />
            )}
          </div>
          <div className="store-card-body">
          <div className="store-card-head">
            {s.media?.logo ? (
              <img className="store-card-logo" src={storeMediaUrl(s.media.logo)} alt={`Logo de ${s.name}`} />
            ) : (
              <div className="store-mark">{s.name.slice(0, 1)}</div>
            )}
            <div className="store-card-title">
              <div className="store-card-chips">
                {featured && <span className="featured-label">Destacada</span>}
                {s.category && <span className="store-chip">{s.category}</span>}
              </div>
              <h2>{s.name}</h2>
              <div className="store-card-meta">
                <Stars value={s.rating} />
                <span>
                  {catalogue.length
                    ? `${catalogue.length} producto${catalogue.length === 1 ? "" : "s"}`
                    : "Sin productos aún"}
                </span>
              </div>
            </div>
          </div>
          {preview.length ? (
            <div
              className="store-card-preview"
              aria-hidden="true"
              style={{ gridTemplateColumns: `repeat(${preview.length}, 1fr)` }}
            >
              {preview.map((product) => (
                <img key={product.id} src={productImageUrl(product.image)} alt="" loading="lazy" />
              ))}
            </div>
          ) : (
            <p className="store-card-placeholder">Esta tienda todavía no publica productos.</p>
          )}
          <button className="btn store-card-cta">
            {catalogue.length ? "Ver tienda" : "Conocer la tienda"}
          </button>
          </div>
        </article>
      );
    });
  const add = (p, q = 1) =>
    setCart((c) => {
      const stock = Number(p.stock ?? Number.POSITIVE_INFINITY);
      if (stock <= 0) return c;
      const x = c.find((i) => i.id === p.id);
      return x
        ? c.map((i) => (i.id === p.id ? { ...i, quantity: Math.min(stock, i.quantity + q) } : i))
        : [...c, { ...p, quantity: Math.min(stock, q) }];
    });
  const total = cart.reduce((s, p) => s + p.price * p.quantity, 0);
  const logout = () => {
    setUser(null);
    setMenuOpen(false);
    localStorage.removeItem("choping-user");
    localStorage.removeItem("choping-auth-token");
    localStorage.removeItem("choping-profile-open");
    setProfileOpen(false);
    setAdminOpen(false);
    setStoreAdminOpen(false);
  };
  const userInitial = (user?.name || user?.email || "U").slice(0, 1).toUpperCase();
  const pendingReviewCount = (() => {
    const reviews = JSON.parse(localStorage.getItem("choping-reviews") || "{}");
    const dismissed = JSON.parse(localStorage.getItem("choping-dismissed-reviews") || "{}");
    return purchased.filter((product) => !reviews[product.id] && !dismissed[`product-${product.id}`]).length;
  })();
  const openStoreDashboard = () => {
    const assignedStore = stores.find(
      (item) => item.name.toLowerCase() === user?.store_name?.toLowerCase(),
    );
    if (!assignedStore) return;
    setStore(assignedStore);
    setProfileOpen(false);
    setStoreAdminOpen(true);
  };
  const createStoreProduct = async (draft) => {
    const authToken = localStorage.getItem("choping-auth-token");
    if (!authToken) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    const response = await fetch(`${API}/api/store/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(draft),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "No fue posible crear el producto.");
    const product = result.product;
    setStores((current) => current.map((item) =>
      item.name === product.store ? { ...item, products: [...item.products, product] } : item,
    ));
    setStore((current) =>
      current?.name === product.store ? { ...current, products: [...current.products, product] } : current,
    );
    return product;
  };
  const editStoreProduct = async (productId, draft) => {
    const authToken = localStorage.getItem("choping-auth-token");
    if (!authToken) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    const response = await fetch(`${API}/api/store/products/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify(draft),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No fue posible guardar los cambios.");
    const saved = data.product;
    const apply = (item) =>
      item.name === saved.store
        ? { ...item, products: item.products.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)) }
        : item;
    setStores((current) => current.map(apply));
    setStore((current) => (current ? apply(current) : current));
    return saved;
  };
  const removeStoreProduct = async (productId) => {
    const authToken = localStorage.getItem("choping-auth-token");
    if (!authToken) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    const response = await fetch(`${API}/api/store/products/${productId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No fue posible eliminar el producto.");
    const drop = (item) => ({ ...item, products: item.products.filter((p) => p.id !== productId) });
    setStores((current) => current.map(drop));
    setStore((current) => (current ? drop(current) : current));
  };
  const createProductCategory = async (name) => {
    const authToken = localStorage.getItem("choping-auth-token");
    if (!authToken) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    const response = await fetch(`${API}/api/product-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No fue posible crear la categoría.");
    const created = data.category;
    setProductCategories((current) =>
      [...current, created].sort((a, b) => a.name.localeCompare(b.name, "es")),
    );
    return created;
  };
  const updateStoreProfile = async (draft) => {
    const authToken = localStorage.getItem("choping-auth-token");
    if (!authToken) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
    const response = await fetch(`${API}/api/store/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ store: store?.name, ...draft }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No fue posible guardar la información.");
    const saved = data.store;
    setStores((current) =>
      current.map((item) => (item.name === saved.name ? { ...item, ...saved } : item)),
    );
    setStore((current) => (current?.name === saved.name ? { ...current, ...saved } : current));
    return saved;
  };
  /** Apply the palette locally at once; persist it after the picker settles. */
  const saveStoreTheme = (value, { onStatus } = {}) => {
    if (!store?.name) return;
    const storeName = store.name;
    const theme = normalizeTheme(value);
    setStoreThemes((current) => {
      const next = { ...current, [storeName]: theme };
      localStorage.setItem("choping-store-themes", JSON.stringify(next));
      return next;
    });
    onStatus?.("saving");
    clearTimeout(themeSaveTimer.current);
    themeSaveTimer.current = setTimeout(async () => {
      const authToken = localStorage.getItem("choping-auth-token");
      if (!authToken) return onStatus?.("error", "Tu sesión expiró. Inicia sesión nuevamente.");
      try {
        const response = await fetch(`${API}/api/store/theme`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ store: storeName, theme }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return onStatus?.("error", data.error || "No fue posible guardar la personalización.");
        setStores((current) =>
          current.map((item) => (item.name === storeName ? { ...item, theme: data.theme } : item)),
        );
        onStatus?.("saved");
      } catch {
        onStatus?.("error", "No fue posible conectar con el servidor.");
      }
    }, 500);
  };
  return (
    <div
      className={store ? `store-app ${themeClassName(storeThemes[store.name])}` : "store-app directory-app"}
      style={store ? themeStyleVars(storeThemes[store.name]) : platformStyleVars(platformTheme)}
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
              <div className="profile-menu-anchor">
                <button
                  className="user-avatar-button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-label="Abrir mi cuenta"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  title="Mi cuenta"
                >
                  {userInitial}
                </button>
                {menuOpen && (
                  <ProfileMenu
                    user={user}
                    pendingReviews={pendingReviewCount}
                    openAccount={(section) => {
                      setAccountSection(section);
                      setProfileOpen(true);
                      localStorage.setItem("choping-profile-open", "true");
                    }}
                    openAdmin={() => setAdminOpen(true)}
                    openStoreAdmin={openStoreDashboard}
                    editProfile={() => {
                      setAccountSection("edit");
                      setProfileOpen(true);
                    }}
                    changePassword={() => {
                      setAccountSection("password");
                      setProfileOpen(true);
                    }}
                    logout={logout}
                    close={() => setMenuOpen(false)}
                  />
                )}
              </div>
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
          storeBanners={store?.media?.banners}
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
              {!showAllStores && otherStores.length > 0 && (
                <div className="directory-more">
                  <button type="button" onClick={() => setShowAllStores(true)}>
                    Ver todas las tiendas ({visibleStores.length})
                  </button>
                </div>
              )}
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
          {otherStores.length > 0 && (showAllStores || !featuredStores.length) && (
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
        <main className={`store-profile ${themeClassName(storeThemes[store.name])}`}>
          <header className="store-identity">
            {store.media?.logo ? (
              <img className="store-identity-logo" src={storeMediaUrl(store.media.logo)} alt={`Logo de ${store.name}`} />
            ) : (
              <span className="store-identity-mark">{store.name?.slice(0, 1) || "T"}</span>
            )}
            <div className="store-identity-copy">
              <h1>{store.name}</h1>
              <p>
                {[store.category, store.city].filter(Boolean).join(" · ")}
                {store.description ? ` — ${store.description}` : ""}
              </p>
            </div>
            <Stars value={store.rating} />
          </header>
          <div className="shop-grid">
            {products.map((p) => (
              <article
                className="product-card"
                key={p.id}
                onClick={() => setSelected(p)}
              >
                <div className="product-photo">
                  <img src={productImageUrl(p.image)} alt={p.name} />
                  {Number(p.original_price) > Number(p.price) && <span className="product-sale-badge">Oferta</span>}
                </div>
                <div className="product-info">
                  <small>{p.category}</small>
                  <h2>{p.name}</h2>
                  <Stars value={p.rating} />
                  <p>{p.description}</p>
                  <div className="product-meta">
                    <div className="product-price-stack">
                      {Number(p.original_price) > Number(p.price) && <del>{money(p.original_price)}</del>}
                      <strong>{money(p.price)}</strong>
                    </div>
                    <span className={Number(p.stock) <= 0 ? "stock-out" : "stock-available"}>{Number(p.stock) <= 0 ? "Agotado" : `${p.stock} disponibles`}</span>
                  </div>
                  <button
                    className="btn add-cart"
                    disabled={Number(p.stock) <= 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      add(p);
                    }}
                  >
                    {Number(p.stock) <= 0 ? "Producto agotado" : "Agregar al carrito"}
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
          onLogin={(nextUser, accessToken) => {
            const registeredAccount = JSON.parse(localStorage.getItem("choping-registered-users") || "[]")
              .find((account) => account.email === nextUser.email);
            const normalizedUser = normalizeAccount({ ...nextUser, ...registeredAccount });
            setUser(normalizedUser);
            localStorage.setItem("choping-user", JSON.stringify(normalizedUser));
            if (accessToken) localStorage.setItem("choping-auth-token", accessToken);
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
          section={accountSection}
          user={user}
          setUser={setUser}
          purchased={purchased}
          openAdmin={() => { setProfileOpen(false); setAdminOpen(true); }}
          openStoreAdmin={openStoreDashboard}
          store={store}
          logout={logout}
          close={() => { setProfileOpen(false); setAccountSection(""); localStorage.setItem("choping-profile-open", "false"); }}
        />
      )}
      {adminOpen && (
        <AdminBannerPanel
          stores={stores}
          banner={banner}
          directoryBanner={directoryBanner}
          authToken={localStorage.getItem("choping-auth-token") || ""}
          platformTheme={platformTheme}
          setPlatformTheme={setPlatformTheme}
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
          user={user}
          updateStore={updateStoreProfile}
          productCategories={productCategories}
          createCategory={createProductCategory}
          editProduct={editStoreProduct}
          removeProduct={removeStoreProduct}
          theme={normalizeTheme(storeThemes[store.name])}
          media={store?.media || { logo: "", banners: [] }}
          setMedia={(media) => {
            setStores((current) => current.map((item) => (item.name === store.name ? { ...item, media } : item)));
            setStore((current) => (current?.name === store.name ? { ...current, media } : current));
          }}
          createProduct={createStoreProduct}
          setTheme={saveStoreTheme}
          viewStore={() => {
            setProfileOpen(false);
            setStoreAdminOpen(false);
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

export { App };
