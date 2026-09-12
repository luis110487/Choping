import React, { useState } from "react";
import { API } from "../lib/api";
import { configuredCategories } from "../lib/catalog";
import { DEPARTAMENTOS, municipiosDe } from "../lib/colombia";

function LoginModal({ close, onLogin, currentStore = "" }) {
  const [forgot, setForgot] = useState(false),
    [forgotEmail, setForgotEmail] = useState(""),
    [forgotMessage, setForgotMessage] = useState(""),
    [forgotSending, setForgotSending] = useState(false),
    [register, setRegister] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("cliente"),
    [phone, setPhone] = useState(""),
    [storeName, setStoreName] = useState(currentStore),
    [category, setCategory] = useState(""),
    [city, setCity] = useState(""),
    [department, setDepartment] = useState(""),
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
          department,
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
      onLogin(data.user, data.access_token);
      return;
    }
    if (response.ok && !register) onLogin(data.user, data.access_token);
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
        {forgot ? (
          <form
            className="cart-modal-content"
            onSubmit={async (event) => {
              event.preventDefault();
              setForgotSending(true);
              setForgotMessage("");
              try {
                const response = await fetch(`${API}/api/auth/password/forgot`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: forgotEmail }),
                });
                const data = await response.json().catch(() => ({}));
                setForgotMessage(data.message || data.error || "No fue posible enviar el enlace.");
              } catch {
                setForgotMessage("No fue posible conectar con el servidor.");
              }
              setForgotSending(false);
            }}
          >
            <small>ACCESO UNICO</small>
            <h2>Recuperar contraseña</h2>
            <p className="form-hint">
              Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.
              El enlace vence en una hora.
            </p>
            <label>
              Correo electrónico
              <input
                type="email"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                required
              />
            </label>
            {forgotMessage && <p className="password-ok">{forgotMessage}</p>}
            <div className="login-form-actions">
              <button className="btn cart-checkout" disabled={forgotSending}>
                {forgotSending ? "Enviando…" : "Enviar enlace"}
              </button>
              <button
                type="button"
                className="nav-link"
                onClick={() => { setForgot(false); setForgotMessage(""); }}
              >
                Volver a iniciar sesión
              </button>
            </div>
          </form>
        ) : (
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
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                    >
                      <option value="">Selecciona una categoría</option>
                      {configuredCategories().map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Departamento
                    <select
                      value={department}
                      onChange={(e) => {
                        setDepartment(e.target.value);
                        // The city belongs to the previous department.
                        setCity("");
                      }}
                      required
                    >
                      <option value="">Selecciona un departamento</option>
                      {DEPARTAMENTOS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Ciudad o municipio
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      disabled={!department}
                      required
                    >
                      <option value="">
                        {department ? "Selecciona una ciudad" : "Elige primero el departamento"}
                      </option>
                      {municipiosDe(department).map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
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
          <div className="login-form-actions">
            <button className="btn cart-checkout">
              {register ? "Crear usuario" : "Ingresar"}
            </button>
            {!register && (
              <button
                type="button"
                className="nav-link"
                onClick={() => {
                  setForgot(true);
                  setForgotEmail(email);
                  setForgotMessage("");
                  setMessage("");
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
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
          </div>
        </form>
        )}
      </section>
    </div>
  );
}

export { LoginModal };
