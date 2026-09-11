import React, { useEffect, useState } from "react";
import { API, money } from "../lib/api";
import { configuredCategoryEntries } from "../lib/catalog";

function AdminBannerPanel({ stores, banner, setBanner, directoryBanner, setDirectoryBanner, close, authToken }) {
  const defaultImages = [
    "/banner-home-1.png",
    "/banner-home-2.png",
    "/banner-home-3.png",
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
      configuredCategoryEntries(),
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
  const saveUser = async (event) => {
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
    if (!authToken) {
      setUserMessage("Tu sesión de administrador expiró. Cierra sesión e ingresa nuevamente.");
      return;
    }
    const account = { name, email, role: newUserRole, store_name: newUserRole === "tienda" ? newUserStore : "" };
    const response = await fetch(`${API}/api/admin/users${editingUser ? `/${encodeURIComponent(editingUser)}` : ""}`, {
      method: editingUser ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ ...account, password: newUserPassword }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setUserMessage(result.error || "No fue posible guardar el usuario.");
      return;
    }
    const savedAccount = result.user;
    const next = editingUser
      ? managedUsers.map((user) => user.email === editingUser ? { ...user, ...savedAccount } : user)
      : [...managedUsers, savedAccount];
    setManagedUsers(next);
    localStorage.setItem("choping-registered-users", JSON.stringify(next));
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserRole("cliente");
    setNewUserStore("");
    setEditingUser(null);
    setUserMessage(result.warning || (editingUser ? "Usuario actualizado correctamente." : "Usuario creado correctamente."));
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

export { AdminBannerPanel };
