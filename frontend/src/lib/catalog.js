const CATEGORY_CATALOG = [
  { id: "tecnologia", name: "Tecnologia", icon: "💻" },
  { id: "celulares", name: "Celulares", icon: "📱" },
  { id: "computadores", name: "Computadores", icon: "🖥" },
  { id: "audio", name: "Audio", icon: "🎧" },
  { id: "videojuegos", name: "Videojuegos", icon: "🎮" },
  { id: "electrodomesticos", name: "Electrodomesticos", icon: "⚡" },
  { id: "hogar", name: "Hogar", icon: "⌂" },
  { id: "muebles", name: "Muebles", icon: "🛋" },
  { id: "decoracion", name: "Decoracion", icon: "🖼" },
  { id: "cocina", name: "Cocina", icon: "🍳" },
  { id: "jardin", name: "Jardin", icon: "🌿" },
  { id: "ferreteria", name: "Ferreteria", icon: "⚒" },
  { id: "herramientas", name: "Herramientas", icon: "🔧" },
  { id: "construccion", name: "Construccion", icon: "🧱" },
  { id: "moda", name: "Moda", icon: "👕" },
  { id: "calzado", name: "Calzado", icon: "👟" },
  { id: "belleza", name: "Belleza", icon: "✨" },
  { id: "peluqueria", name: "Peluqueria", icon: "✂" },
  { id: "drogueria", name: "Drogueria", icon: "✚" },
  { id: "salud", name: "Salud", icon: "♥" },
  { id: "bebe", name: "Bebe", icon: "🍼" },
  { id: "juguetes", name: "Juguetes", icon: "🧸" },
  { id: "mascotas", name: "Mascotas", icon: "🐾" },
  { id: "deportes", name: "Deportes", icon: "⚽" },
  { id: "movilidad", name: "Movilidad", icon: "🚲" },
  { id: "automotriz", name: "Automotriz", icon: "🚗" },
  { id: "alimentos", name: "Alimentos", icon: "🛒" },
  { id: "papeleria", name: "Papeleria", icon: "📚" },
  { id: "oficina", name: "Oficina", icon: "💼" },
];
const defaultProductCategories = CATEGORY_CATALOG.map((category) => category.name);
const configuredCategoryEntries = () => {
  try {
    const stored = JSON.parse(localStorage.getItem("choping-categories") || "null");
    const additions = Array.isArray(stored) ? stored : [];
    return [...CATEGORY_CATALOG, ...additions.filter((category) => !CATEGORY_CATALOG.some((item) => item.name.toLowerCase() === category.name?.toLowerCase()))];
  } catch {
    return CATEGORY_CATALOG;
  }
};
const configuredCategories = () => {
  return configuredCategoryEntries().map((category) => category.name);
};

export { CATEGORY_CATALOG, configuredCategories, configuredCategoryEntries, defaultProductCategories };
