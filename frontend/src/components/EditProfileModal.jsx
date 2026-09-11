import React, { useState } from "react";

function EditProfileModal({ user, setUser, close }) { const [name, setName] = useState(user?.name || ""), [email, setEmail] = useState(user?.email || ""); const save = (e) => { e.preventDefault(); const next = { ...user, name, email }; setUser(next); localStorage.setItem("choping-user", JSON.stringify(next)); close(); }; return <div className="overlay review-overlay"><section className="cart-modal review-modal"><form className="cart-modal-content" onSubmit={save}><small>MI PERFIL</small><h2>Editar información</h2><label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Correo electrónico<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><button className="btn cart-checkout">Guardar cambios</button><button type="button" className="nav-link" onClick={close}>Cancelar</button></form></section></div>; }

export { EditProfileModal };
