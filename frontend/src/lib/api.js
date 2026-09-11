const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:5000")
  .replace(/\/$/, "")
  .replace(/\/api$/, "");
const money = (n) => "$" + Number(n).toLocaleString("es-CO");
const productImageUrl = (image) =>
  image && /^(https?:)?\/\//i.test(image) ? image : `${API}/static/img/${image || "products/pc-gamer.png"}`;

const storeMediaUrl = (value) =>
  !value ? "" : /^(https?:)?\/\//i.test(value) ? value : `${API}/static/img/${value}`;

export { API, money, productImageUrl, storeMediaUrl };
