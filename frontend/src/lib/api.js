const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:5000")
  .replace(/\/$/, "")
  .replace(/\/api$/, "");
const money = (n) => "$" + Number(n).toLocaleString("es-CO");
const productImageUrl = (image) =>
  image && /^(https?:)?\/\//i.test(image) ? image : `${API}/static/img/${image || "products/pc-gamer.png"}`;

const storeMediaUrl = (value) =>
  !value ? "" : /^(https?:)?\/\//i.test(value) ? value : `${API}/static/img/${value}`;

/**
 * Sustituye una imagen que no carga por la de respaldo.
 *
 * Una ruta guardada puede dejar de resolver: una subida que fallo, una URL
 * externa que ya no existe o un archivo perdido. Sin esto el navegador pinta
 * el icono de imagen rota, que se ve peor que una foto generica.
 */
const onImageError = (event) => {
  const img = event.currentTarget;
  if (img.dataset.respaldo) return; // evita un bucle si el respaldo tampoco carga
  img.dataset.respaldo = "1";
  img.src = productImageUrl("");
};

export { API, money, onImageError, productImageUrl, storeMediaUrl };
