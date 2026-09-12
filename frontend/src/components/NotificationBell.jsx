import React, { useCallback, useEffect, useRef, useState } from "react";
import { API } from "../lib/api";

const CUANDO = (iso) => {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const minutos = Math.round((Date.now() - fecha.getTime()) / 60000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return fecha.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};

/**
 * Campana de avisos. El servidor decide que le toca a cada quien segun su
 * rol, asi que aqui no hay filtro por tipo de usuario.
 */
function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panel = useRef(null);

  const load = useCallback(async () => {
    const authToken = localStorage.getItem("choping-auth-token");
    if (!authToken) return;
    try {
      const response = await fetch(`${API}/api/notifications`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnread(Number(data.unread) || 0);
    } catch {
      /* sin conexion: se reintenta en el proximo ciclo */
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const fuera = (event) => {
      if (panel.current && !panel.current.contains(event.target)) setOpen(false);
    };
    const escape = (event) => event.key === "Escape" && setOpen(false);
    // Diferido: el clic que abre todavia se esta propagando.
    const timer = setTimeout(() => document.addEventListener("mousedown", fuera), 0);
    document.addEventListener("keydown", escape);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const marcarLeidos = async () => {
    const authToken = localStorage.getItem("choping-auth-token");
    if (!authToken) return;
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnread(0);
    try {
      await fetch(`${API}/api/notifications/read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({}),
      });
    } catch {
      load();
    }
  };

  return (
    <div className="bell-anchor" ref={panel}>
      <button
        type="button"
        className="bell-button"
        aria-label={unread ? `Avisos, ${unread} sin leer` : "Avisos"}
        aria-expanded={open}
        title="Avisos"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && <em className="bell-badge">{unread > 9 ? "9+" : unread}</em>}
      </button>
      {open && (
        <div className="bell-panel" role="menu">
          <div className="bell-head">
            <strong>Avisos</strong>
            {unread > 0 && (
              <button type="button" className="nav-link" onClick={marcarLeidos}>
                Marcar como leídos
              </button>
            )}
          </div>
          {items.length ? (
            <ul className="bell-list">
              {items.map((item) => (
                <li key={item.id} className={item.read ? "" : "sin-leer"}>
                  <strong>{item.title}</strong>
                  {item.body && <small>{item.body}</small>}
                  <span className="bell-when">{CUANDO(item.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bell-empty">No tienes avisos por ahora.</p>
          )}
        </div>
      )}
    </div>
  );
}

export { NotificationBell };
