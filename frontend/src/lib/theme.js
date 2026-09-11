const STORE_PRESETS = [
  { id: "ocean", name: "Ocean", detail: "Azul, limpia y tecnologica",
    palette: { background: "#eef7ff", surface: "#fbfdff", heading: "#063f9f", accent: "#08bdf2", price: "#063f9f", priceOld: "#8b97a9", icon: "#e83d73" } },
  { id: "sunset", name: "Sunset", detail: "Calida y comercial",
    palette: { background: "#fff5eb", surface: "#fff8f1", heading: "#e85d04", accent: "#f48c06", price: "#bf3b00", priceOld: "#b2917a", icon: "#d00000" } },
  { id: "forest", name: "Forest", detail: "Natural y confiable",
    palette: { background: "#eef9f1", surface: "#f4fbf6", heading: "#26734d", accent: "#40916c", price: "#1b5e3a", priceOld: "#8aa895", icon: "#e07a1f" } },
  { id: "mono", name: "Minimal", detail: "Elegante y sobria",
    palette: { background: "#f1f1f1", surface: "#f7f7f7", heading: "#252525", accent: "#555555", price: "#111111", priceOld: "#9a9a9a", icon: "#252525" } },
];
const STORE_COLOR_FIELDS = [
  { key: "background", label: "Fondo de la tienda", hint: "Color base detras del catalogo" },
  { key: "surface", label: "Fondo de las tarjetas", hint: "Superficie de cada producto" },
  { key: "heading", label: "Titulos", hint: "Nombre de los productos y encabezados" },
  { key: "accent", label: "Acento y botones", hint: "Bordes activos y llamados a la accion" },
  { key: "price", label: "Precio", hint: "Precio vigente de venta" },
  { key: "priceOld", label: "Precio tachado", hint: "Precio anterior en ofertas" },
  { key: "icon", label: "Iconos y etiquetas", hint: "Estrellas y sello de oferta" },
];
const STORE_FONTS = [
  { id: "sistema", name: "Sistema", detail: "Neutra y rapida", stack: "system-ui, 'Segoe UI', Roboto, sans-serif" },
  { id: "moderna", name: "Moderna", detail: "Geometrica y actual", stack: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { id: "editorial", name: "Editorial", detail: "Serif con caracter", stack: "Georgia, 'Times New Roman', serif" },
  { id: "amable", name: "Amable", detail: "Redonda y cercana", stack: "'Comic Sans MS', 'Segoe UI', sans-serif" },
  { id: "legible", name: "Legible", detail: "Amplia y clara", stack: "Verdana, Geneva, sans-serif" },
  { id: "tecnica", name: "Tecnica", detail: "Monoespaciada", stack: "ui-monospace, Consolas, 'Courier New', monospace" },
];
const STORE_FONT_SLOTS = [
  { key: "heading", label: "Titulos", hint: "Nombre de la tienda y de los productos" },
  { key: "body", label: "Textos", hint: "Descripciones, precios y botones" },
];
const DEFAULT_FONTS = { heading: "sistema", body: "sistema" };
const fontStack = (id) => (STORE_FONTS.find((item) => item.id === id) || STORE_FONTS[0]).stack;
const DEFAULT_PRESET = "ocean";

/** Accept both the legacy string theme and the richer customizable object. */
function normalizeTheme(value) {
  if (typeof value === "string") return { preset: value || DEFAULT_PRESET, colors: {}, fonts: {} };
  if (!value || typeof value !== "object") return { preset: DEFAULT_PRESET, colors: {}, fonts: {} };
  return { preset: value.preset || DEFAULT_PRESET, colors: value.colors || {}, fonts: value.fonts || {} };
}

/** Effective typography: the platform default with the owner's choices on top. */
function themeFonts(value) {
  return { ...DEFAULT_FONTS, ...normalizeTheme(value).fonts };
}

function presetPalette(preset) {
  return (STORE_PRESETS.find((item) => item.id === preset) || STORE_PRESETS[0]).palette;
}

/** Effective palette: the preset defaults with the owner's overrides on top. */
function themePalette(value) {
  const theme = normalizeTheme(value);
  return { ...presetPalette(theme.preset), ...theme.colors };
}

function themeClassName(value) {
  return `theme-${normalizeTheme(value).preset}`;
}

/** Only the owner's overrides become inline vars, so presets stay in the CSS. */
function themeStyleVars(value) {
  const theme = normalizeTheme(value);
  const vars = {};
  for (const { key } of STORE_COLOR_FIELDS) {
    const color = theme.colors[key];
    if (color) vars[`--store-${key === "priceOld" ? "price-old" : key}`] = color;
  }
  const fonts = themeFonts(value);
  vars["--store-font-heading"] = fontStack(fonts.heading);
  vars["--store-font-body"] = fontStack(fonts.body);
  return vars;
}


const DEFAULT_PLATFORM_BACKGROUND = "#f2f7ff";
const DEFAULT_PLATFORM_THEME = { background: "", fonts: {} };

/** Directory look: the platform default with the admin's choices on top. */
function platformStyleVars(theme) {
  const fonts = { ...DEFAULT_FONTS, ...(theme?.fonts || {}) };
  return {
    "--page-background": theme?.background || DEFAULT_PLATFORM_BACKGROUND,
    "--page-font-heading": fontStack(fonts.heading),
    "--page-font-body": fontStack(fonts.body),
  };
}

export { DEFAULT_FONTS, DEFAULT_PLATFORM_BACKGROUND, DEFAULT_PLATFORM_THEME, DEFAULT_PRESET, STORE_COLOR_FIELDS, STORE_FONTS, STORE_FONT_SLOTS, STORE_PRESETS, fontStack, normalizeTheme, platformStyleVars, presetPalette, themeClassName, themeFonts, themePalette, themeStyleVars };
