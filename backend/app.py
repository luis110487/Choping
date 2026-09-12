import os
import json
import re
from datetime import datetime, timezone
from uuid import uuid4
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
from colombia import valid_location

IS_PRODUCTION = os.environ.get('FLASK_ENV', 'production') == 'production' and bool(os.environ.get('RENDER'))

def required_in_production(name, development_default):
    """Return an environment value, refusing unsafe defaults in production.

    Render sets RENDER=true, so a missing SECRET_KEY or FRONTEND_ORIGIN stops
    the deploy instead of silently shipping a shared signing key or open CORS.
    """
    value = os.environ.get(name, '').strip()
    if value:
        return value
    if IS_PRODUCTION:
        raise RuntimeError(f'{name} es obligatorio en produccion.')
    return development_default

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.config['SECRET_KEY'] = required_in_production('SECRET_KEY', 'dev-only-change-me')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///encuentra.db').replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024
app.config['PRODUCT_UPLOAD_FOLDER'] = os.path.join(app.static_folder, 'img', 'uploads')
db = SQLAlchemy(app)
def allowed_origins():
    """Accept a comma-separated list, so preview deployments and a custom
    domain can coexist with the main Vercel URL."""
    raw = required_in_production('FRONTEND_ORIGIN', '*')
    origins = [origin.strip().rstrip('/') for origin in raw.split(',') if origin.strip()]
    return origins or '*'

CORS(app, origins=allowed_origins())

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text)
    image = db.Column(db.String(255))
    store = db.Column(db.String(120), nullable=False, default='Tienda Choping')
    rating = db.Column(db.Float, default=0)

class LocalUser(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='cliente')
    phone = db.Column(db.String(40))
    store_name = db.Column(db.String(120))
    active = db.Column(db.Boolean, nullable=False, default=True)

class StoreTheme(db.Model):
    """Storefront palette chosen by a store owner.

    Kept in its own table so it works both on the Postgres catalog and on the
    local SQLite fallback, without touching the `stores` schema owned by Supabase.
    """
    id = db.Column(db.Integer, primary_key=True)
    store_name = db.Column(db.String(120), nullable=False, unique=True, index=True)
    preset = db.Column(db.String(32), nullable=False, default='ocean')
    colors = db.Column(db.Text, nullable=False, default='{}')
    fonts = db.Column(db.Text, nullable=False, default='{}')
    media = db.Column(db.Text, nullable=False, default='{}')

    @staticmethod
    def _load(raw):
        try:
            value = json.loads(raw or '{}')
        except ValueError:
            return {}
        return value if isinstance(value, dict) else {}

    def as_dict(self):
        return {'preset': self.preset, 'colors': self._load(self.colors), 'fonts': self._load(self.fonts)}

    def media_dict(self):
        media = self._load(self.media)
        banners = media.get('banners')
        return {
            'logo': media.get('logo') or '',
            'banners': [url for url in banners if isinstance(url, str)] if isinstance(banners, list) else [],
        }

def ensure_store_theme_schema():
    """Add columns introduced after the table already shipped.

    create_all() only creates missing tables, so an existing deployment keeps
    its old shape until the column is added explicitly.
    """
    try:
        columns = {column['name'] for column in db.inspect(db.engine).get_columns('store_theme')}
    except Exception:
        return
    for column in ('fonts', 'media'):
        if column in columns:
            continue
        try:
            db.session.execute(text(f"alter table store_theme add column {column} text not null default '{{}}'"))
            db.session.commit()
        except Exception:
            db.session.rollback()

STORE_THEME_PRESETS = {'ocean', 'sunset', 'forest', 'mono'}
STORE_THEME_COLOR_KEYS = {'background', 'surface', 'heading', 'accent', 'price', 'priceOld', 'icon'}
class PlatformTheme(db.Model):
    """Look of the public directory, shared by every visitor.

    A single row: the platform has one directory, unlike stores which each
    carry their own palette.
    """
    id = db.Column(db.Integer, primary_key=True)
    background = db.Column(db.String(9), nullable=False, default='')
    fonts = db.Column(db.Text, nullable=False, default='{}')

    def as_dict(self):
        try:
            fonts = json.loads(self.fonts or '{}')
        except ValueError:
            fonts = {}
        return {
            'background': self.background or '',
            'fonts': fonts if isinstance(fonts, dict) else {},
        }

DEFAULT_PLATFORM_THEME = {'background': '', 'fonts': {}}

class ProductCategory(db.Model):
    """Categories a store can assign to its products.

    Separate from the store categories: a hardware store sells tools, paint
    and fasteners, so the product list has to grow on its own. It lives in the
    database because it used to live in localStorage, where a category created
    by one person existed only in that browser.
    """
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(60), nullable=False, unique=True)
    icon = db.Column(db.String(8), nullable=False, default='')

SEED_PRODUCT_CATEGORIES = [
    ('Tecnologia', '\U0001F4BB'), ('Celulares', '\U0001F4F1'), ('Computadores', '\U0001F5A5'),
    ('Audio', '\U0001F3A7'), ('Videojuegos', '\U0001F3AE'), ('Electrodomesticos', '\u26A1'),
    ('Hogar', '\u2302'), ('Muebles', '\U0001F6CB'), ('Decoracion', '\U0001F5BC'),
    ('Cocina', '\U0001F373'), ('Jardin', '\U0001F33F'), ('Ferreteria', '\u2692'),
    ('Herramientas', '\U0001F527'), ('Construccion', '\U0001F9F1'), ('Moda', '\U0001F455'),
    ('Calzado', '\U0001F45F'), ('Belleza', '\u2728'), ('Peluqueria', '\u2702'),
    ('Drogueria', '\u271A'), ('Salud', '\u2665'), ('Bebe', '\U0001F37C'),
    ('Juguetes', '\U0001F9F8'), ('Mascotas', '\U0001F43E'), ('Deportes', '\u26BD'),
    ('Movilidad', '\U0001F6B2'), ('Automotriz', '\U0001F697'), ('Alimentos', '\U0001F6D2'),
    ('Papeleria', '\U0001F4DA'), ('Oficina', '\U0001F4BC'),
]


def seed_product_categories():
    try:
        if ProductCategory.query.first():
            return
        for name, icon in SEED_PRODUCT_CATEGORIES:
            db.session.add(ProductCategory(name=name, icon=icon))
        db.session.commit()
    except Exception:
        db.session.rollback()


STORE_THEME_FONT_SLOTS = {'heading', 'body'}
# Whitelisted so a store can never inject arbitrary CSS through the font name.
STORE_THEME_FONTS = {'sistema', 'moderna', 'editorial', 'amable', 'legible', 'tecnica'}
DEFAULT_STORE_THEME = {'preset': 'ocean', 'colors': {}, 'fonts': {}}
DEFAULT_STORE_MEDIA = {'logo': '', 'banners': []}
MAX_STORE_BANNERS = 5
HEX_COLOR = re.compile(r'^#[0-9a-fA-F]{6}$')

def parse_store_theme(payload):
    """Validate an incoming palette, returning (theme, error)."""
    if not isinstance(payload, dict):
        return None, 'El tema enviado no es valido.'
    preset = str(payload.get('preset') or 'ocean').strip().lower()
    if preset not in STORE_THEME_PRESETS:
        return None, 'La plantilla seleccionada no existe.'
    raw_colors = payload.get('colors') or {}
    if not isinstance(raw_colors, dict):
        return None, 'Los colores enviados no son validos.'
    colors = {}
    for key, value in raw_colors.items():
        if key not in STORE_THEME_COLOR_KEYS:
            return None, f'El color "{key}" no se puede personalizar.'
        if not isinstance(value, str) or not HEX_COLOR.match(value.strip()):
            return None, f'El color de "{key}" debe estar en formato #rrggbb.'
        colors[key] = value.strip().lower()
    raw_fonts = payload.get('fonts') or {}
    if not isinstance(raw_fonts, dict):
        return None, 'Las tipografias enviadas no son validas.'
    fonts = {}
    for slot, value in raw_fonts.items():
        if slot not in STORE_THEME_FONT_SLOTS:
            return None, f'La tipografia "{slot}" no se puede personalizar.'
        name = str(value or '').strip().lower()
        if name not in STORE_THEME_FONTS:
            return None, f'La tipografia "{value}" no esta disponible.'
        fonts[slot] = name
    return {'preset': preset, 'colors': colors, 'fonts': fonts}, None

def store_themes_by_name():
    try:
        return {row.store_name.lower(): (row.as_dict(), row.media_dict()) for row in StoreTheme.query.all()}
    except Exception:
        db.session.rollback()
        return {}

def apply_store_themes(catalog):
    """Attach each store's saved palette and media, falling back to defaults."""
    saved = store_themes_by_name()
    for store in catalog:
        theme, media = saved.get((store.get('name') or '').lower(), (DEFAULT_STORE_THEME, DEFAULT_STORE_MEDIA))
        store['theme'] = theme
        store['media'] = media
    return apply_ratings(catalog)

DEMO_PRODUCTS = [
    {'name': 'Combo PC Gamer TUF', 'category': 'Tecnologia', 'price': 3850000, 'description': 'Computador gamer completo para jugar, estudiar y crear contenido.', 'image': 'products/pc-gamer.png', 'store': 'Tech Zone', 'rating': 4.8},
    {'name': 'Licuadora Ninja Pro', 'category': 'Hogar', 'price': 420000, 'description': 'Potencia para jugos, smoothies y preparaciones diarias.', 'image': 'products/licuadora-ninja.png', 'store': 'Casa Viva', 'rating': 4.7},
    {'name': 'Lavadora semiautomatica 16 kg', 'category': 'Electrodomesticos', 'price': 780000, 'description': 'Gran capacidad y manejo practico para hogares familiares.', 'image': 'products/lavadora.png', 'store': 'Casa Viva', 'rating': 4.5},
    {'name': 'Redmi Note 5G', 'category': 'Celulares', 'price': 1150000, 'description': 'Pantalla amplia, camara multiple y bateria para todo el dia.', 'image': 'products/redmi.png', 'store': 'Tech Zone', 'rating': 4.9},
    {'name': 'Moto electrica urbana', 'category': 'Movilidad', 'price': 4600000, 'description': 'Movilidad urbana con bajo consumo y manejo sencillo.', 'image': 'products/moto-electrica.png', 'store': 'EcoRuedas', 'rating': 4.6},
    {'name': 'Aspiradora compacta', 'category': 'Hogar', 'price': 295000, 'description': 'Limpieza practica para espacios pequenos y medianos.', 'image': 'products/licuadora-ninja.png', 'store': 'Casa Viva', 'rating': 4.6},
    {'name': 'Teclado mecanico RGB', 'category': 'Tecnologia', 'price': 185000, 'description': 'Teclado mecanico iluminado para setups de trabajo y juego.', 'image': 'products/pc-gamer.png', 'store': 'Tech Zone', 'rating': 4.7},
    {'name': 'Casco urbano certificado', 'category': 'Movilidad', 'price': 210000, 'description': 'Proteccion comoda y ligera para recorridos urbanos.', 'image': 'products/moto-electrica.png', 'store': 'EcoRuedas', 'rating': 4.8},
    {'name': 'Bicicleta electrica urbana', 'category': 'Movilidad', 'price': 2800000, 'description': 'Bicicleta electrica ligera para recorridos diarios por la ciudad.', 'image': 'products/moto-electrica.png', 'store': 'EcoRuedas', 'rating': 4.7},
]
# Every product needs a stable id: the cart matches lines by it, so products
# without one collapse into a single line and bill the wrong item.
for position, product in enumerate(DEMO_PRODUCTS, start=1):
    product.update({'id': position})
    product.update({'story': f"Seleccionado para quienes buscan una compra practica en {product['category'].lower()}.", 'review': 'Excelente calidad, compra recomendada por la comunidad Choping.', 'likes': 120, 'purchases': 24, 'stock': 12, 'original_price': None, 'images': [product['image'], product['image'], product['image']]})

@app.get('/api/health')
def health():
    supabase_url, supabase_key = supabase_auth_credentials()
    return jsonify({
        'status': 'ok',
        'database': 'configured' if os.environ.get('DATABASE_URL') else 'sqlite-local',
        'supabase_auth_configured': bool(supabase_url and supabase_key),
    })

@app.get('/api/products')
def products():
    query = request.args.get('q', '').strip().lower()
    catalog = database_catalog()
    if catalog is not None:
        all_products = [p for store in catalog for p in store['products']]
        return jsonify([p for p in all_products if not query or query in f"{p['name']} {p['category']} {p['description']} {p['store']}".lower()])
    result = [p for p in DEMO_PRODUCTS if not query or query in f"{p['name']} {p['category']} {p['description']} {p['store']}".lower()]
    return jsonify(result)

def database_catalog(include_pending=False):
    if not os.environ.get('DATABASE_URL'):
        return None
    try:
        ensure_product_schema()
        has_status = store_status_available()
        status_column = ', active' if has_status else ''
        public_filter = 'where approved is true' + (' and active is true' if has_status else '')
        store_query = '''
            select id, name, owner_name, category, city, description, rating, approved{status_column}
            from stores
            {store_filter}
            order by created_at asc, id asc
        '''.format(status_column=status_column, store_filter='' if include_pending else public_filter)
        store_rows = db.session.execute(text(store_query)).mappings().all()
        product_query = '''
            select p.id, p.store_id, p.name, p.category, p.description, p.story,
                   p.price, p.original_price, p.stock, p.image, p.rating, p.review, p.likes, p.purchases
            from products p
            join stores s on s.id = p.store_id
            {store_filter}
            order by p.created_at asc, p.id asc
        '''.format(store_filter='' if include_pending else public_filter.replace('where ', 'where s.').replace(' and active', ' and s.active'))
        product_rows = db.session.execute(text(product_query)).mappings().all()
        image_rows = db.session.execute(text('''
            select product_id, image_url, position
            from product_images
            order by product_id, position
        ''')).mappings().all()
        images_by_product = {}
        for image in image_rows:
            images_by_product.setdefault(image['product_id'], []).append(image['image_url'])
        stores_by_id = {}
        result = []
        for row in store_rows:
            store = {
                'id': row['id'],
                'name': row['name'],
                'owner_name': row['owner_name'],
                'category': row['category'],
                'city': row['city'],
                'description': row['description'],
                'rating': float(row['rating'] or 0),
                # Normalized: SQLite yields 0/1 and NULL is possible, so identity
                # checks against False are not reliable downstream.
                'approved': bool(row['approved']) if 'approved' in row else True,
                'active': bool(row['active']) if 'active' in row else True,
                'products': [],
            }
            stores_by_id[row['id']] = store
            result.append(store)
        for row in product_rows:
            store = stores_by_id.get(row['store_id'])
            if not store:
                continue
            product_images = images_by_product.get(row['id'], [])
            image = row['image'] or (product_images[0] if product_images else '')
            store['products'].append({
                'id': row['id'],
                'name': row['name'],
                'category': row['category'],
                'description': row['description'] or '',
                'story': row['story'] or '',
                'price': float(row['price'] or 0),
                'original_price': float(row['original_price']) if row['original_price'] is not None else None,
                'stock': row['stock'] if row['stock'] is not None else 0,
                'image': image,
                'images': product_images or ([image] * 3 if image else []),
                'rating': float(row['rating'] or 0),
                'review': row['review'] or '',
                'likes': row['likes'] or 0,
                'purchases': row['purchases'] or 0,
                'store': store['name'],
            })
        return result
    except Exception:
        db.session.rollback()
        return None

STORE_STATUS_COLUMN = {'checked': False, 'present': False}


def ensure_local_user_status_column():
    """Add `active` to an existing local_user table."""
    ensure_column('local_user', 'active', 'boolean not null default true')


def table_columns(table):
    try:
        return {column['name'] for column in db.inspect(db.engine).get_columns(table)}
    except Exception:
        return set()


def ensure_column(table, column, definition):
    """Add a column when it is missing, on any engine.

    `add column if not exists` is Postgres only: SQLite rejects it, so the
    column has to be checked first and added plainly.
    """
    if column in table_columns(table):
        return True
    try:
        db.session.execute(text(f'alter table {table} add column {column} {definition}'))
        db.session.commit()
    except Exception:
        db.session.rollback()
    return column in table_columns(table)


def store_status_available():
    """Whether `stores.active` exists, adding it on first use.

    Cached because the catalog query is built from it on every request, and a
    missing column would otherwise break the whole catalog.
    """
    if STORE_STATUS_COLUMN['checked']:
        return STORE_STATUS_COLUMN['present']
    STORE_STATUS_COLUMN['checked'] = True
    if not os.environ.get('DATABASE_URL'):
        return False
    STORE_STATUS_COLUMN['present'] = ensure_column('stores', 'active', 'boolean not null default true')
    return STORE_STATUS_COLUMN['present']


def ensure_store_department_column():
    """Add `department` to an existing stores table.

    Non fatal: without the column the app keeps working with the city alone.
    """
    if not os.environ.get('DATABASE_URL'):
        return False
    return ensure_column('stores', 'department', 'text')


def ensure_store_workspace(name, owner_name, category, city, description, department=''):
    """Create the private workspace used by a store administrator.

    New stores remain pending, so only the owner and platform administrators
    can work on them before approval.
    """
    if not os.environ.get('DATABASE_URL'):
        return True, None
    try:
        existing = db.session.execute(
            text('select id from stores where lower(name) = lower(:name) limit 1'),
            {'name': name},
        ).mappings().first()
        if existing:
            return True, None
        columns = 'name, owner_name, category, city, description, approved'
        values = ':name, :owner_name, :category, :city, :description, false'
        params = {
            'name': name,
            'owner_name': owner_name,
            'category': category,
            'city': city,
            'description': description,
        }
        if department and ensure_store_department_column():
            columns += ', department'
            values += ', :department'
            params['department'] = department
        db.session.execute(text(f'insert into stores ({columns}) values ({values})'), params)
        db.session.commit()
        return True, None
    except Exception:
        db.session.rollback()
        return False, 'No fue posible preparar el espacio de trabajo de la tienda.'

def ensure_product_schema():
    if not os.environ.get('DATABASE_URL'):
        return False
    try:
        db.session.execute(text('alter table public.products add column if not exists stock integer not null default 10 check (stock >= 0)'))
        db.session.execute(text('alter table public.products add column if not exists original_price numeric(14,2) check (original_price is null or original_price >= 0)'))
        db.session.commit()
        return True
    except Exception:
        db.session.rollback()
        return False

def create_catalog_product(store_name, data):
    try:
        ensure_product_schema()
        store_row = db.session.execute(
            text('select id from stores where lower(name) = lower(:name) limit 1'),
            {'name': store_name},
        ).mappings().first()
        if not store_row:
            return None, 'No encontramos la tienda asociada a tu cuenta.'
        image = data.get('image', '').strip() or 'products/pc-gamer.png'
        product_row = db.session.execute(
            text('''
                insert into products (store_id, name, category, description, story, price, original_price, stock, image, rating, review, likes, purchases)
                values (:store_id, :name, :category, :description, :story, :price, :original_price, :stock, :image, 0, '', 0, 0)
                returning id
            '''),
            {
                'store_id': store_row['id'],
                'name': data['name'],
                'category': data['category'],
                'description': data.get('description', ''),
                'story': data.get('story', ''),
                'price': data['price'],
                'original_price': data.get('original_price'),
                'stock': data['stock'],
                'image': image,
            },
        ).mappings().first()
        db.session.commit()
        return {
            'id': product_row['id'],
            'name': data['name'],
            'category': data['category'],
            'description': data.get('description', ''),
            'story': data.get('story', ''),
            'price': data['price'],
            'original_price': data.get('original_price'),
            'stock': data['stock'],
            'image': image,
            'images': [image],
            'rating': 0,
            'review': '',
            'likes': 0,
            'purchases': 0,
            'store': store_name,
        }, None
    except Exception:
        db.session.rollback()
        return None, 'No fue posible guardar el producto.'

STORE_MEDIA_BUCKET = os.environ.get('SUPABASE_STORAGE_BUCKET', 'store-media').strip() or 'store-media'
IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}

def validate_image_upload(uploaded):
    if not uploaded or not uploaded.filename:
        return None, 'Selecciona una imagen para cargar.'
    extension = uploaded.filename.rsplit('.', 1)[-1].lower() if '.' in uploaded.filename else ''
    if extension not in IMAGE_EXTENSIONS or not (uploaded.mimetype or '').startswith('image/'):
        return None, 'Usa una imagen PNG, JPG, WEBP o GIF.'
    if not secure_filename(uploaded.filename):
        return None, 'El nombre del archivo no es valido.'
    return extension, None

def supabase_storage_request(method, path, data=None, headers=None):
    supabase_url = os.environ.get('SUPABASE_URL', '').strip().rstrip('/')
    service_key = supabase_service_key()
    if not supabase_url or not service_key:
        return None, 'storage-not-configured'
    storage_request = Request(
        f'{supabase_url}/storage/v1/{path}',
        data=data,
        headers={'Authorization': f'Bearer {service_key}', **(headers or {})},
        method=method,
    )
    try:
        with urlopen(storage_request, timeout=20) as response:
            return response.read(), None
    except HTTPError as error:
        return None, f'{error.code}: {error.read()[:200].decode("utf-8", "replace")}'
    except (URLError, TimeoutError) as error:
        return None, str(error)

def ensure_media_bucket():
    """Create the public bucket on first use so a fresh project just works."""
    payload = json.dumps({'name': STORE_MEDIA_BUCKET, 'id': STORE_MEDIA_BUCKET, 'public': True}).encode('utf-8')
    _, error = supabase_storage_request('POST', 'bucket', payload, {'Content-Type': 'application/json'})
    # A 409 means the bucket already exists, which is the normal case.
    return error is None or '409' in (error or '')

def upload_store_media(store_name, uploaded, extension):
    """Store the image in Supabase Storage, or on local disk during development."""
    key = f'{secure_filename(store_name) or "tienda"}/{uuid4().hex}.{extension}'
    supabase_url = os.environ.get('SUPABASE_URL', '').strip().rstrip('/')
    if supabase_url and supabase_service_key():
        ensure_media_bucket()
        _, error = supabase_storage_request(
            'POST',
            f'object/{STORE_MEDIA_BUCKET}/{key}',
            uploaded.read(),
            {'Content-Type': uploaded.mimetype or 'image/png', 'x-upsert': 'true'},
        )
        if error:
            return None, 'No fue posible cargar la imagen en el almacenamiento.'
        return f'{supabase_url}/storage/v1/object/public/{STORE_MEDIA_BUCKET}/{key}', None
    try:
        folder = os.path.join(app.config['PRODUCT_UPLOAD_FOLDER'], 'stores')
        os.makedirs(folder, exist_ok=True)
        local_name = key.replace('/', '_')
        uploaded.save(os.path.join(folder, local_name))
    except OSError:
        return None, 'No fue posible cargar la imagen. Intenta nuevamente.'
    return f'uploads/stores/{local_name}', None

def delete_store_media(url):
    marker = f'/storage/v1/object/public/{STORE_MEDIA_BUCKET}/'
    if marker not in (url or ''):
        return
    supabase_storage_request('DELETE', f'object/{STORE_MEDIA_BUCKET}/{url.split(marker, 1)[1]}')

def store_for_actor(actor, requested_store):
    """Resolve which store the caller may edit, returning (name, error, status)."""
    if not actor:
        return None, 'Inicia sesion para personalizar la tienda.', 401
    requested = (requested_store or '').strip()
    if actor.get('role') == 'tienda':
        own = (actor.get('store_name') or '').strip()
        if not own:
            return None, 'Tu cuenta no tiene una tienda asignada.', 403
        if requested and requested.lower() != own.lower():
            return None, 'Solo puedes personalizar tu propia tienda.', 403
        return own, None, 200
    if actor.get('role') in {'admin', 'superadmin'}:
        if not requested:
            return None, 'Indica la tienda que quieres personalizar.', 400
        return requested, None, 200
    return None, 'No tienes permisos para personalizar tiendas.', 403

def store_theme_record(store_name):
    record = StoreTheme.query.filter(db.func.lower(StoreTheme.store_name) == store_name.lower()).first()
    if not record:
        record = StoreTheme(store_name=store_name)
        db.session.add(record)
    return record

@app.post('/api/store/media')
def upload_store_media_endpoint():
    store_name, error, status = store_for_actor(authenticated_session(), request.form.get('store'))
    if error:
        return jsonify({'error': error}), status
    slot = (request.form.get('slot') or 'banner').strip().lower()
    if slot not in {'logo', 'banner'}:
        return jsonify({'error': 'El destino de la imagen no es valido.'}), 400
    extension, error = validate_image_upload(request.files.get('image'))
    if error:
        return jsonify({'error': error}), 400
    record = store_theme_record(store_name)
    media = record.media_dict()
    if slot == 'banner' and len(media['banners']) >= MAX_STORE_BANNERS:
        return jsonify({'error': f'Puedes tener hasta {MAX_STORE_BANNERS} banners.'}), 400
    url, error = upload_store_media(store_name, request.files['image'], extension)
    if error:
        return jsonify({'error': error}), 502
    previous_logo = media['logo']
    if slot == 'logo':
        media['logo'] = url
    else:
        media['banners'].append(url)
    try:
        record.media = json.dumps(media)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible guardar la imagen.'}), 500
    if slot == 'logo' and previous_logo:
        delete_store_media(previous_logo)
    return jsonify({'store': store_name, 'media': media}), 201

@app.delete('/api/store/media')
def delete_store_media_endpoint():
    data = request.get_json(silent=True) or {}
    store_name, error, status = store_for_actor(authenticated_session(), data.get('store'))
    if error:
        return jsonify({'error': error}), status
    target = (data.get('url') or '').strip()
    if not target:
        return jsonify({'error': 'Indica la imagen que quieres eliminar.'}), 400
    record = store_theme_record(store_name)
    media = record.media_dict()
    if target == media['logo']:
        media['logo'] = ''
    elif target in media['banners']:
        media['banners'] = [url for url in media['banners'] if url != target]
    else:
        return jsonify({'error': 'Esa imagen no pertenece a tu tienda.'}), 404
    try:
        record.media = json.dumps(media)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible eliminar la imagen.'}), 500
    delete_store_media(target)
    return jsonify({'store': store_name, 'media': media})

@app.put('/api/store/theme')
def save_store_theme():
    data = request.get_json(silent=True) or {}
    store_name, error, status = store_for_actor(authenticated_session(), data.get('store'))
    if error:
        return jsonify({'error': error}), status
    theme, error = parse_store_theme(data.get('theme') if isinstance(data.get('theme'), dict) else data)
    if error:
        return jsonify({'error': error}), 400
    try:
        record = store_theme_record(store_name)
        record.preset = theme['preset']
        record.colors = json.dumps(theme['colors'])
        record.fonts = json.dumps(theme['fonts'])
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible guardar la personalizacion.'}), 500
    return jsonify({'store': store_name, 'theme': theme})

@app.post('/api/store/product-images')
def upload_store_product_image():
    actor = authenticated_session()
    if not actor or actor.get('role') != 'tienda':
        return jsonify({'error': 'Solo la cuenta administradora de la tienda puede cargar imágenes.'}), 403
    extension, error = validate_image_upload(request.files.get('image'))
    if error:
        return jsonify({'error': error}), 400
    # Same persistent storage as the store banners: Render wipes its disk on
    # every deploy, so anything saved locally disappears with the next build.
    image, error = upload_store_media(actor.get('store_name') or 'productos', request.files['image'], extension)
    if error:
        return jsonify({'error': error}), 502
    return jsonify({'image': image}), 201

def visible_pending_catalog(actor):
    """Pending stores are not public: only staff, or the owner of that store.

    Returns (catalog, None) or (None, None) when the database is unavailable.
    """
    catalog = database_catalog(True)
    if catalog is None:
        return None, None
    if actor and actor.get('role') in {'admin', 'superadmin'}:
        return catalog, None
    own = (actor or {}).get('store_name', '').strip().lower() if actor else ''
    def visible(store):
        mine = own and store.get('name', '').lower() == own
        if not store.get('active', True):
            # A suspended store is not public, and its owner sees it only to
            # know it is suspended.
            return bool(mine)
        return store.get('approved', True) or bool(mine)
    return [store for store in catalog if visible(store)], None


def parse_platform_theme(payload):
    """Validate the directory look, returning (theme, error)."""
    if not isinstance(payload, dict):
        return None, 'El tema enviado no es valido.'
    background = str(payload.get('background') or '').strip().lower()
    if background and not HEX_COLOR.match(background):
        return None, 'El fondo debe estar en formato #rrggbb.'
    raw_fonts = payload.get('fonts') or {}
    if not isinstance(raw_fonts, dict):
        return None, 'Las tipografias enviadas no son validas.'
    fonts = {}
    for slot, value in raw_fonts.items():
        if slot not in STORE_THEME_FONT_SLOTS:
            return None, f'La tipografia "{slot}" no se puede personalizar.'
        name = str(value or '').strip().lower()
        if name not in STORE_THEME_FONTS:
            return None, f'La tipografia "{value}" no esta disponible.'
        fonts[slot] = name
    return {'background': background, 'fonts': fonts}, None


def platform_theme_record():
    record = PlatformTheme.query.first()
    if not record:
        record = PlatformTheme(id=1)
        db.session.add(record)
    return record


@app.get('/api/platform/theme')
def read_platform_theme():
    # Public: visitors need the directory styling before signing in.
    try:
        record = PlatformTheme.query.first()
    except Exception:
        db.session.rollback()
        return jsonify(DEFAULT_PLATFORM_THEME)
    return jsonify(record.as_dict() if record else DEFAULT_PLATFORM_THEME)


@app.put('/api/platform/theme')
def save_platform_theme():
    if not authenticated_actor():
        return jsonify({'error': 'Solo un administrador puede personalizar el directorio.'}), 403
    data = request.get_json(silent=True) or {}
    theme, error = parse_platform_theme(data.get('theme') if isinstance(data.get('theme'), dict) else data)
    if error:
        return jsonify({'error': error}), 400
    try:
        record = platform_theme_record()
        record.background = theme['background']
        record.fonts = json.dumps(theme['fonts'])
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible guardar la personalizacion.'}), 500
    return jsonify({'theme': theme})


@app.put('/api/admin/stores/<path:name>/status')
def set_store_status(name):
    """Suspend or reactivate a store.

    Separate from approval on purpose: a store that was approved and later
    suspended must not fall back to "pending" when it is reactivated.
    """
    actor = authenticated_actor()
    if not actor:
        return jsonify({'error': 'Solo un administrador puede desactivar tiendas.'}), 403
    data = request.get_json(silent=True) or {}
    if not isinstance(data.get('active'), bool):
        return jsonify({'error': 'Indica si la tienda queda activa o no.'}), 400
    if not os.environ.get('DATABASE_URL'):
        return jsonify({'error': 'Esta accion requiere la base de datos configurada.'}), 503
    if not store_status_available():
        return jsonify({'error': 'No fue posible preparar el estado de la tienda.'}), 500
    try:
        result = db.session.execute(
            text('update stores set active = :active where lower(name) = lower(:name)'),
            {'active': data['active'], 'name': name},
        )
        if not result.rowcount:
            db.session.rollback()
            return jsonify({'error': 'No encontramos esa tienda.'}), 404
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible actualizar la tienda.'}), 500
    return jsonify({'store': name, 'active': data['active']})


@app.get('/api/admin/users')
def list_admin_users():
    """Real user list for the admin panel.

    The panel used to read it from the browser's localStorage, so it only
    ever showed accounts created from that same browser.
    """
    if not authenticated_actor():
        return jsonify({'error': 'Solo un administrador puede ver los usuarios.'}), 403
    try:
        accounts = LocalUser.query.order_by(LocalUser.id.asc()).all()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible consultar los usuarios.'}), 500
    return jsonify({'users': [{
        'name': account.name,
        'email': account.email,
        'role': account.role,
        'store_name': account.store_name or '',
        'phone': account.phone or '',
        'active': account.active,
    } for account in accounts]})


@app.put('/api/admin/users/<path:email>/status')
def set_user_status(email):
    actor = authenticated_actor()
    if not actor:
        return jsonify({'error': 'Solo un administrador puede desactivar usuarios.'}), 403
    data = request.get_json(silent=True) or {}
    if not isinstance(data.get('active'), bool):
        return jsonify({'error': 'Indica si la cuenta queda activa o no.'}), 400
    target = email.strip().lower()
    if target == (actor.get('email') or '').strip().lower():
        return jsonify({'error': 'No puedes desactivar tu propia cuenta.'}), 400
    account = LocalUser.query.filter_by(email=target).first()
    if not account:
        return jsonify({'error': 'No encontramos ese usuario.'}), 404
    if account.role == 'superadmin' and actor.get('role') != 'superadmin':
        return jsonify({'error': 'Solo un superadmin puede desactivar a otro superadmin.'}), 403
    try:
        account.active = data['active']
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible actualizar la cuenta.'}), 500
    return jsonify({'user': {'email': account.email, 'name': account.name, 'active': account.active}})


@app.put('/api/admin/stores/<path:name>/approval')
def set_store_approval(name):
    actor = authenticated_actor()
    if not actor:
        return jsonify({'error': 'Solo un administrador puede aprobar tiendas.'}), 403
    data = request.get_json(silent=True) or {}
    if not isinstance(data.get('approved'), bool):
        return jsonify({'error': 'Indica si la tienda queda aprobada o no.'}), 400
    if not os.environ.get('DATABASE_URL'):
        return jsonify({'error': 'La aprobacion requiere la base de datos configurada.'}), 503
    try:
        result = db.session.execute(
            text('update stores set approved = :approved where lower(name) = lower(:name)'),
            {'approved': data['approved'], 'name': name},
        )
        if not result.rowcount:
            db.session.rollback()
            return jsonify({'error': 'No encontramos esa tienda.'}), 404
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible actualizar la tienda.'}), 500
    return jsonify({'store': name, 'approved': data['approved']})


@app.get('/api/stores')
def stores():
    if request.args.get('include_pending') == 'true':
        catalog, _ = visible_pending_catalog(authenticated_session())
    else:
        catalog = database_catalog(False)
    if catalog is not None:
        return jsonify(apply_store_themes(catalog))
    result=[]
    for p in DEMO_PRODUCTS:
        store=next((s for s in result if s['name']==p['store']),None)
        if not store:
            store={'id':len(result)+1,'name':p['store'],'rating':4.8,'category':p['category'],'products':[]}; result.append(store)
        store['products'].append(p)
    return jsonify(apply_store_themes(result))

VALID_ROLES = {'cliente', 'tienda', 'admin', 'superadmin'}

def profile_role(email):
    if not os.environ.get('DATABASE_URL'):
        return None
    try:
        try:
            row = db.session.execute(
                text('select role from public.profiles where lower(email) = :email limit 1'),
                {'email': email},
            ).mappings().first()
        except Exception:
            db.session.rollback()
            row = db.session.execute(
                text('''
                    select p.role
                    from public.profiles p
                    join auth.users u on u.id = p.id
                    where lower(u.email) = :email
                    limit 1
                '''),
                {'email': email},
            ).mappings().first()
        role = row['role'] if row else None
        return role if role in VALID_ROLES else None
    except Exception:
        db.session.rollback()
        return None

def supabase_auth_credentials():
    supabase_url = os.environ.get('SUPABASE_URL', '').strip().rstrip('/')
    supabase_key = (
        os.environ.get('SUPABASE_ANON_KEY', '').strip()
        or os.environ.get('SUPABASE_PUBLISHABLE_KEY', '').strip()
        or os.environ.get('SUPABASE_KEY', '').strip()
    )
    if not supabase_url:
        database_url = os.environ.get('DATABASE_URL', '')
        database_user = urlparse(database_url.replace('postgres://', 'postgresql://', 1)).username or ''
        if database_user.startswith('postgres.'):
            project_ref = database_user.split('.', 1)[1]
            supabase_url = f'https://{project_ref}.supabase.co'
    return supabase_url, supabase_key

def supabase_service_key():
    return (
        os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()
        or os.environ.get('SUPABASE_SECRET_KEY', '').strip()
    )

def ensure_profile_schema():
    try:
        db.session.execute(text('''
            create table if not exists public.profiles (
                id uuid primary key references auth.users(id) on delete cascade,
                role text not null default 'cliente'
            )
        '''))
        db.session.execute(text("alter table public.profiles add column if not exists role text not null default 'cliente'"))
        db.session.commit()
        return True
    except Exception:
        db.session.rollback()
        return False

def sync_profile_role(user_id, role):
    if not ensure_profile_schema():
        return False
    try:
        db.session.execute(
            text('''
                insert into public.profiles (id, role)
                values (:user_id, :role)
                on conflict (id) do update set role = excluded.role
            '''),
            {'user_id': user_id, 'role': role},
        )
        db.session.commit()
        return True
    except Exception:
        db.session.rollback()
        return False

def auth_user_id_by_email(email):
    try:
        row = db.session.execute(
            text('select id from auth.users where lower(email) = :email limit 1'),
            {'email': email},
        ).mappings().first()
        return str(row['id']) if row else None
    except Exception:
        db.session.rollback()
        return None

def create_supabase_user(email, password, name, role, store_name=''):
    supabase_url, _ = supabase_auth_credentials()
    service_key = supabase_service_key()
    if not supabase_url or not service_key:
        return None, 'Falta configurar la clave de servicio de Supabase en Render.'
    payload = json.dumps({
        'email': email,
        'password': password,
        'email_confirm': True,
        'user_metadata': {
            'name': name,
            'store_name': store_name,
            'role': role,
        },
    }).encode('utf-8')
    admin_request = Request(
        f'{supabase_url}/auth/v1/admin/users',
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'apikey': service_key,
            'Authorization': f'Bearer {service_key}',
        },
        method='POST',
    )
    try:
        with urlopen(admin_request, timeout=12) as response:
            return json.loads(response.read().decode('utf-8')), None
    except HTTPError as error:
        try:
            detail = json.loads(error.read().decode('utf-8')).get('msg') or 'No fue posible crear el usuario.'
        except (ValueError, UnicodeDecodeError):
            detail = 'No fue posible crear el usuario.'
        return None, detail
    except (URLError, TimeoutError, ValueError):
        return None, 'No fue posible conectar con Supabase.'

def access_token_for(user):
    return URLSafeTimedSerializer(app.config['SECRET_KEY'], salt='choping-auth').dumps({
        'email': user['email'],
        'role': user['role'],
        'name': user.get('name', ''),
        'store_name': user.get('store_name', ''),
    })

def authenticated_session():
    authorization = request.headers.get('Authorization', '')
    if not authorization.startswith('Bearer '):
        return None
    try:
        actor = URLSafeTimedSerializer(app.config['SECRET_KEY'], salt='choping-auth').loads(
            authorization.removeprefix('Bearer '),
            max_age=60 * 60 * 8,
        )
    except (BadSignature, SignatureExpired):
        return None
    return actor if actor.get('role') in VALID_ROLES else None

def authenticated_actor():
    actor = authenticated_session()
    return actor if actor and actor.get('role') in {'admin', 'superadmin'} else None

def login_response(user):
    return jsonify({'user': user, 'access_token': access_token_for(user)})

def supabase_password_login(email, password):
    """Authenticate users already managed by Supabase Auth.

    LocalUser remains the source for accounts created by this API, while this
    fallback lets existing Supabase users (including store owners) use the
    same login form during the migration.
    """
    supabase_url, supabase_key = supabase_auth_credentials()
    if not supabase_url or not supabase_key:
        return None
    payload = json.dumps({'email': email, 'password': password}).encode('utf-8')
    auth_request = Request(
        f'{supabase_url}/auth/v1/token?grant_type=password',
        data=payload,
        headers={
            'Content-Type': 'application/json',
            'apikey': supabase_key,
        },
        method='POST',
    )
    try:
        with urlopen(auth_request, timeout=8) as response:
            auth_user = json.loads(response.read().decode('utf-8')).get('user') or {}
    except (HTTPError, URLError, TimeoutError, ValueError):
        return None
    role = profile_role(email) or 'cliente'
    metadata = auth_user.get('user_metadata') or {}
    return {
        'email': auth_user.get('email', email),
        'name': metadata.get('name') or metadata.get('full_name') or email.split('@')[0],
        'role': role,
        'phone': metadata.get('phone', ''),
        'store_name': metadata.get('store_name', ''),
    }

@app.put('/api/auth/password')
def change_password():
    """Change the password of the signed in account.

    Until now the interface only wrote a flag in localStorage and told the
    user it had worked, so nobody's password ever changed.
    """
    actor = authenticated_session()
    if not actor:
        return jsonify({'error': 'Tu sesion expiro. Inicia sesion nuevamente.'}), 401
    data = request.get_json(silent=True) or {}
    current = data.get('current', '')
    new_password = data.get('password', '')
    if len(new_password) < 8:
        return jsonify({'error': 'La nueva contraseña debe tener al menos 8 caracteres.'}), 400
    if new_password == current:
        return jsonify({'error': 'La nueva contraseña debe ser distinta de la actual.'}), 400
    account = LocalUser.query.filter_by(email=(actor.get('email') or '').strip().lower()).first()
    if not account:
        return jsonify({
            'error': 'Esta cuenta se administra desde Supabase; cambia la contraseña desde alli.',
        }), 400
    if not account.active:
        return jsonify({'error': 'Esta cuenta esta desactivada. Contacta al administrador.'}), 403
    if not check_password_hash(account.password_hash, current):
        return jsonify({'error': 'La contraseña actual no es correcta.'}), 403
    try:
        account.password_hash = generate_password_hash(new_password)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible actualizar la contraseña.'}), 500
    return jsonify({'ok': True})


@app.put('/api/store/profile')
def update_store_profile():
    """Store owners edit their own visible information."""
    data = request.get_json(silent=True) or {}
    store_name, error, status = store_for_actor(authenticated_session(), data.get('store'))
    if error:
        return jsonify({'error': error}), status
    category = (data.get('category') or '').strip()
    city = (data.get('city') or '').strip()
    description = (data.get('description') or '').strip()
    department = (data.get('department') or '').strip()
    if not category or len(category) > 60:
        return jsonify({'error': 'Selecciona una categoria valida.'}), 400
    if not city or len(city) > 80:
        return jsonify({'error': 'Indica la ciudad de la tienda.'}), 400
    if len(description) > 600:
        return jsonify({'error': 'La descripcion no puede superar 600 caracteres.'}), 400
    if department and not valid_location(department, city):
        return jsonify({'error': 'La ciudad no pertenece al departamento seleccionado.'}), 400
    if not os.environ.get('DATABASE_URL'):
        return jsonify({'error': 'Esta accion requiere la base de datos configurada.'}), 503
    columns = 'category = :category, city = :city, description = :description'
    params = {'category': category, 'city': city, 'description': description, 'name': store_name}
    if department and ensure_store_department_column():
        columns += ', department = :department'
        params['department'] = department
    try:
        result = db.session.execute(
            text(f'update stores set {columns} where lower(name) = lower(:name)'), params
        )
        if not result.rowcount:
            db.session.rollback()
            return jsonify({'error': 'No encontramos esa tienda.'}), 404
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible guardar la informacion.'}), 500
    return jsonify({'store': {
        'name': store_name,
        'category': category,
        'city': city,
        'description': description,
        'department': department,
    }})


@app.get('/api/product-categories')
def list_product_categories():
    # Public: buyers filter by category and store owners pick one.
    try:
        rows = ProductCategory.query.order_by(ProductCategory.name.asc()).all()
    except Exception:
        db.session.rollback()
        return jsonify({'categories': []})
    return jsonify({'categories': [{'name': row.name, 'icon': row.icon or ''} for row in rows]})


@app.post('/api/product-categories')
def create_product_category():
    """Let a store add a category when the list falls short."""
    actor = authenticated_session()
    if not actor or actor.get('role') not in {'tienda', 'admin', 'superadmin'}:
        return jsonify({'error': 'Inicia sesion como tienda o administrador para crear categorias.'}), 403
    data = request.get_json(silent=True) or {}
    name = ' '.join((data.get('name') or '').split())
    icon = (data.get('icon') or '').strip()[:8]
    if len(name) < 2 or len(name) > 60:
        return jsonify({'error': 'El nombre debe tener entre 2 y 60 caracteres.'}), 400
    existing = ProductCategory.query.filter(db.func.lower(ProductCategory.name) == name.lower()).first()
    if existing:
        return jsonify({'error': f'La categoria "{existing.name}" ya existe.'}), 409
    try:
        category = ProductCategory(name=name, icon=icon)
        db.session.add(category)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible crear la categoria.'}), 500
    return jsonify({'category': {'name': category.name, 'icon': category.icon or ''}}), 201


class Review(db.Model):
    """Una calificacion de una persona sobre un producto o una tienda.

    La nota que se muestra sale del promedio de estas filas, no de una columna
    fija: antes todo nacia en 4.5 y las reseñas reales no cambiaban nada.
    """
    id = db.Column(db.Integer, primary_key=True)
    target_type = db.Column(db.String(10), nullable=False)
    target_key = db.Column(db.String(120), nullable=False)
    user_email = db.Column(db.String(255), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text, nullable=False, default='')
    __table_args__ = (
        db.UniqueConstraint('target_type', 'target_key', 'user_email', name='uq_review_por_persona'),
    )


REVIEW_TARGETS = {'product', 'store'}


def review_key(target_type, target):
    """Clave estable: los productos por id, las tiendas por nombre normalizado."""
    value = str(target or '').strip()
    return value if target_type == 'product' else value.lower()


def review_summary(target_type):
    """Promedio y conteo por objetivo, en una sola consulta."""
    try:
        rows = db.session.query(
            Review.target_key,
            db.func.avg(Review.rating),
            db.func.count(Review.id),
        ).filter(Review.target_type == target_type).group_by(Review.target_key).all()
    except Exception:
        db.session.rollback()
        return {}
    return {key: (round(float(average), 1), int(total)) for key, average, total in rows}


def apply_ratings(catalog):
    """Reemplaza la nota de cada tienda y producto por la real."""
    stores = review_summary('store')
    products = review_summary('product')
    for store in catalog:
        average, total = stores.get(review_key('store', store.get('name')), (0.0, 0))
        store['rating'] = average
        store['reviews_count'] = total
        for product in store.get('products', []):
            average, total = products.get(review_key('product', product.get('id')), (0.0, 0))
            product['rating'] = average
            product['reviews_count'] = total
    return catalog


@app.get('/api/reviews')
def list_reviews():
    target_type = (request.args.get('type') or '').strip().lower()
    if target_type not in REVIEW_TARGETS:
        return jsonify({'error': 'Indica si la reseña es de producto o de tienda.'}), 400
    key = review_key(target_type, request.args.get('target'))
    if not key:
        return jsonify({'error': 'Indica el producto o la tienda.'}), 400
    try:
        rows = (Review.query
                .filter_by(target_type=target_type, target_key=key)
                .order_by(Review.id.desc()).all())
    except Exception:
        db.session.rollback()
        return jsonify({'reviews': [], 'rating': 0, 'count': 0})
    total = len(rows)
    average = round(sum(row.rating for row in rows) / total, 1) if total else 0
    return jsonify({
        'rating': average,
        'count': total,
        'reviews': [{
            'rating': row.rating,
            'comment': row.comment or '',
            'author': (row.user_email or '').split('@')[0],
        } for row in rows],
    })


@app.post('/api/reviews')
def save_review():
    """Una persona, una reseña por objetivo: volver a enviarla la actualiza."""
    actor = authenticated_session()
    if not actor:
        return jsonify({'error': 'Inicia sesion para dejar una reseña.'}), 401
    data = request.get_json(silent=True) or {}
    target_type = (data.get('type') or '').strip().lower()
    if target_type not in REVIEW_TARGETS:
        return jsonify({'error': 'Indica si la reseña es de producto o de tienda.'}), 400
    key = review_key(target_type, data.get('target'))
    if not key:
        return jsonify({'error': 'Indica el producto o la tienda.'}), 400
    try:
        rating = int(data.get('rating', 0))
    except (TypeError, ValueError):
        rating = 0
    if rating < 1 or rating > 5:
        return jsonify({'error': 'La calificacion debe estar entre 1 y 5 estrellas.'}), 400
    comment = (data.get('comment') or '').strip()[:600]
    email = (actor.get('email') or '').strip().lower()
    try:
        review = Review.query.filter_by(
            target_type=target_type, target_key=key, user_email=email,
        ).first()
        if not review:
            review = Review(target_type=target_type, target_key=key, user_email=email)
            db.session.add(review)
        review.rating = rating
        review.comment = comment
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible guardar la reseña.'}), 500
    summary = review_summary(target_type).get(key, (0.0, 0))
    return jsonify({'rating': summary[0], 'count': summary[1]}), 201


class Notification(db.Model):
    """Aviso dirigido a un destinatario dentro de la aplicacion.

    `audience` dice a quien va y `target` a cual: la tienda por nombre, el
    cliente por correo. Para los administradores es una bandeja compartida,
    porque un aviso como "hay una tienda por aprobar" deja de ser pendiente
    para todo el equipo cuando alguien lo atiende.
    """
    id = db.Column(db.Integer, primary_key=True)
    audience = db.Column(db.String(10), nullable=False)
    target = db.Column(db.String(255), nullable=False, default='')
    kind = db.Column(db.String(40), nullable=False)
    title = db.Column(db.String(160), nullable=False)
    body = db.Column(db.String(400), nullable=False, default='')
    read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))


NOTIFICATION_AUDIENCES = {'admin', 'store', 'client'}


def notify(audience, kind, title, body='', target=''):
    """Registra un aviso. Nunca interrumpe la accion que lo origina."""
    if audience not in NOTIFICATION_AUDIENCES:
        return None
    try:
        aviso = Notification(
            audience=audience,
            target=(target or '').strip().lower(),
            kind=kind,
            title=title[:160],
            body=(body or '')[:400],
        )
        db.session.add(aviso)
        db.session.commit()
        return aviso
    except Exception:
        db.session.rollback()
        return None


def notification_scope(actor):
    """(audience, target) que le corresponde ver a quien pregunta."""
    role = (actor or {}).get('role')
    if role in {'admin', 'superadmin'}:
        return 'admin', None
    if role == 'tienda':
        return 'store', (actor.get('store_name') or '').strip().lower()
    return 'client', (actor.get('email') or '').strip().lower()


def send_email(to_addresses, subject, lines):
    """Envia por Resend a cualquier destinatario.

    Sin credenciales no hace nada: es una via secundaria, no puede tumbar la
    accion que la origina.
    """
    api_key = os.environ.get('RESEND_API_KEY', '').strip()
    from_address = os.environ.get('ALERT_EMAIL_FROM', '').strip()
    destinos = [address.strip() for address in to_addresses if address and address.strip()]
    if not api_key or not from_address or not destinos:
        faltan = [
            nombre for nombre, valor in (
                ('RESEND_API_KEY', api_key),
                ('ALERT_EMAIL_FROM', from_address),
                ('destinatario', destinos),
            ) if not valor
        ]
        app.logger.warning('Correo no enviado, falta: %s', ', '.join(faltan))
        return False, 'email-not-configured'
    cuerpo = ''.join(f'<p>{line}</p>' for line in lines)
    payload = json.dumps({
        'from': from_address,
        'to': destinos,
        'subject': subject,
        'html': f'<div style="font-family:system-ui,sans-serif;color:#18345f;line-height:1.5">{cuerpo}</div>',
    }).encode('utf-8')
    request_to_resend = Request(
        'https://api.resend.com/emails',
        data=payload,
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urlopen(request_to_resend, timeout=10) as response:
            cuerpo_respuesta = response.read()
        # Resend devuelve un id: aceptar no es entregar, y ese id es lo que
        # permite ver en su panel si el mensaje se entrego o reboto.
        try:
            mensaje_id = json.loads(cuerpo_respuesta.decode('utf-8')).get('id', '')
        except ValueError:
            mensaje_id = ''
        app.logger.info('Correo aceptado por Resend (id %s): %s', mensaje_id or 'sin id', subject)
        return True, mensaje_id
    except HTTPError as error:
        detalle = f'{error.code}: {error.read()[:300].decode("utf-8", "replace")}'
    except (URLError, TimeoutError) as error:
        detalle = str(error)
    app.logger.error('Correo rechazado por Resend: %s', detalle)
    return False, detalle


def send_alert_email(subject, lines):
    """Avisa al administrador configurado en ALERT_EMAIL_TO."""
    to_address = os.environ.get('ALERT_EMAIL_TO', '').strip()
    if not to_address:
        app.logger.warning('Alerta por correo no enviada, falta: ALERT_EMAIL_TO')
        return False, 'email-not-configured'
    return send_email(to_address.split(','), subject, lines)


def reset_serializer():
    return URLSafeTimedSerializer(app.config['SECRET_KEY'], salt='choping-password-reset')


def password_reset_token(account):
    """Firma el correo junto a una huella de la contrasena actual.

    Asi el enlace deja de servir en cuanto la contrasena cambia: se usa una
    sola vez sin necesidad de guardar nada.
    """
    huella = account.password_hash[-12:]
    return reset_serializer().dumps({'email': account.email, 'huella': huella})


def account_from_reset_token(token, max_age=3600):
    try:
        datos = reset_serializer().loads(token, max_age=max_age)
    except SignatureExpired:
        return None, 'El enlace expiro. Solicita uno nuevo.'
    except BadSignature:
        return None, 'El enlace no es valido. Solicita uno nuevo.'
    account = LocalUser.query.filter_by(email=(datos.get('email') or '').strip().lower()).first()
    if not account:
        return None, 'El enlace no es valido. Solicita uno nuevo.'
    if account.password_hash[-12:] != datos.get('huella'):
        return None, 'Este enlace ya se uso. Solicita uno nuevo.'
    if not account.active:
        return None, 'Esta cuenta esta desactivada. Contacta al administrador.'
    return account, None


@app.post('/api/auth/password/forgot')
def forgot_password():
    """Envia el enlace de restauracion.

    Responde siempre lo mismo: decir si el correo existe permitiria averiguar
    quien tiene cuenta probando direcciones.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    respuesta = {'message': 'Si el correo esta registrado, enviamos el enlace para restaurar la contrasena.'}
    if not email:
        return jsonify({'error': 'Indica tu correo electronico.'}), 400
    account = LocalUser.query.filter_by(email=email).first()
    if not account or not account.active:
        app.logger.info('Restauracion solicitada para un correo sin cuenta activa')
        return jsonify(respuesta)
    origen = os.environ.get('FRONTEND_ORIGIN', '').split(',')[0].strip().rstrip('/') or ''
    enlace = f"{origen}/?reset={password_reset_token(account)}"
    send_email(
        [account.email],
        'Choping: restaura tu contrasena',
        [
            f'Hola {account.name or ""},',
            'Recibimos una solicitud para restaurar la contrasena de tu cuenta en Choping.',
            f'<a href="{enlace}" style="display:inline-block;padding:12px 20px;'
            'background:#075ee8;color:#fff;border-radius:10px;text-decoration:none;'
            'font-weight:600">Crear una contrasena nueva</a>',
            'El enlace vence en una hora y solo se puede usar una vez.',
            'Si no fuiste tu, ignora este mensaje: tu contrasena no cambia.',
        ],
    )
    return jsonify(respuesta)


@app.post('/api/auth/password/reset')
def reset_password():
    data = request.get_json(silent=True) or {}
    nueva = data.get('password', '')
    if len(nueva) < 8:
        return jsonify({'error': 'La nueva contrasena debe tener al menos 8 caracteres.'}), 400
    account, error = account_from_reset_token((data.get('token') or '').strip())
    if error:
        return jsonify({'error': error}), 400
    try:
        account.password_hash = generate_password_hash(nueva)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible actualizar la contrasena.'}), 500
    return jsonify({'ok': True, 'email': account.email})


@app.get('/api/admin/alerts/status')
def alerts_status():
    """Dice si el correo esta configurado, sin exponer la clave."""
    if not authenticated_actor():
        return jsonify({'error': 'Solo un administrador puede consultar esto.'}), 403
    api_key = os.environ.get('RESEND_API_KEY', '').strip()
    to_address = os.environ.get('ALERT_EMAIL_TO', '').strip()
    from_address = os.environ.get('ALERT_EMAIL_FROM', '').strip()
    return jsonify({
        'configurado': bool(api_key and to_address and from_address),
        'RESEND_API_KEY': 'definida' if api_key else 'falta',
        'ALERT_EMAIL_TO': to_address or 'falta',
        'ALERT_EMAIL_FROM': from_address or 'falta',
    })


@app.post('/api/admin/alerts/test')
def alerts_test():
    """Envia un correo de prueba y devuelve el resultado real de Resend."""
    if not authenticated_actor():
        return jsonify({'error': 'Solo un administrador puede enviar la prueba.'}), 403
    destino = os.environ.get('ALERT_EMAIL_TO', '').strip()
    remitente = os.environ.get('ALERT_EMAIL_FROM', '').strip()
    enviado, detalle = send_alert_email(
        'Choping: prueba de alertas',
        [
            'Este es un correo de prueba enviado desde el panel administrativo.',
            'Si lo recibiste, las alertas por correo estan funcionando.',
        ],
    )
    if enviado:
        return jsonify({
            'enviado': True,
            'id': detalle or '',
            'de': remitente,
            'para': destino,
        })
    return jsonify({'enviado': False, 'detalle': detalle}), 502


@app.get('/api/notifications')
def list_notifications():
    actor = authenticated_session()
    if not actor:
        return jsonify({'error': 'Inicia sesion para ver tus avisos.'}), 401
    audience, target = notification_scope(actor)
    try:
        query = Notification.query.filter_by(audience=audience)
        if target is not None:
            query = query.filter_by(target=target)
        rows = query.order_by(Notification.id.desc()).limit(30).all()
    except Exception:
        db.session.rollback()
        return jsonify({'notifications': [], 'unread': 0})
    return jsonify({
        'unread': sum(1 for row in rows if not row.read),
        'notifications': [{
            'id': row.id,
            'kind': row.kind,
            'title': row.title,
            'body': row.body or '',
            'read': bool(row.read),
            'created_at': row.created_at.isoformat() if row.created_at else '',
        } for row in rows],
    })


@app.put('/api/notifications/read')
def mark_notifications_read():
    actor = authenticated_session()
    if not actor:
        return jsonify({'error': 'Inicia sesion para ver tus avisos.'}), 401
    audience, target = notification_scope(actor)
    data = request.get_json(silent=True) or {}
    wanted = data.get('id')
    try:
        query = Notification.query.filter_by(audience=audience)
        if target is not None:
            query = query.filter_by(target=target)
        if wanted is not None:
            query = query.filter_by(id=wanted)
        for row in query.all():
            row.read = True
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible actualizar los avisos.'}), 500
    return jsonify({'ok': True})


@app.get('/api/auth/session')
def read_session():
    """Confirm a stored token still works.

    The token is stateless and lasts eight hours, so without this the
    interface kept showing a signed in user whose every action failed with a
    confusing permissions error. It also makes a deactivation take effect on
    the next load instead of waiting for the token to expire.
    """
    actor = authenticated_session()
    if not actor:
        return jsonify({'error': 'Tu sesion expiro. Inicia sesion nuevamente.'}), 401
    account = LocalUser.query.filter_by(email=(actor.get('email') or '').strip().lower()).first()
    if account and not account.active:
        return jsonify({'error': 'Esta cuenta esta desactivada. Contacta al administrador.'}), 403
    user = {
        'email': actor.get('email', ''),
        'name': account.name if account else actor.get('name', ''),
        'role': account.role if account else actor.get('role', 'cliente'),
        'store_name': account.store_name if account else actor.get('store_name', ''),
    }
    return jsonify({'user': user})


@app.post('/api/auth/login')
def login():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    if not email or not data.get('password'):
        return jsonify({'error': 'Correo y contraseña son obligatorios'}), 400
    # Solo el dominio correcto. Las variantes mal escritas que habia aqui
    # (techdatasaync, techdatasyn) no pertenecen a nadie: cualquiera que las
    # registrara obtenia superadministrador.
    configured_superadmin = os.environ.get('SUPERADMIN_EMAIL', '').strip().lower()
    superadmin_emails = {'luis.gamarra@techdatasync.com'}
    if configured_superadmin:
        superadmin_emails.add(configured_superadmin)
    account = LocalUser.query.filter_by(email=email).first()
    if account and not account.active:
        return jsonify({'error': 'Esta cuenta está desactivada. Contacta al administrador.'}), 403
    if account and check_password_hash(account.password_hash, data['password']):
        if account.role == 'tienda' and account.store_name:
            ensure_store_workspace(
                account.store_name,
                account.name,
                'Sin categoria',
                'Colombia',
                'Tienda pendiente de configuración.',
            )
        return login_response({'email': account.email, 'name': account.name, 'role': account.role, 'phone': account.phone, 'store_name': account.store_name})
    supabase_user = supabase_password_login(email, data['password'])
    if supabase_user:
        if supabase_user['role'] == 'tienda' and supabase_user['store_name']:
            ensure_store_workspace(
                supabase_user['store_name'],
                supabase_user['name'],
                'Sin categoria',
                'Colombia',
                'Tienda pendiente de configuración.',
            )
        return login_response(supabase_user)
    configured_admin = os.environ.get('ADMIN_EMAIL', '').strip().lower()
    configured_store = os.environ.get('STORE_EMAIL', '').strip().lower()
    configured_accounts = [
        (superadmin_emails, os.environ.get('SUPERADMIN_PASSWORD'), 'superadmin'),
        ({configured_admin}, os.environ.get('ADMIN_PASSWORD'), 'admin'),
        ({configured_store}, os.environ.get('STORE_PASSWORD'), 'tienda'),
    ]
    for emails, expected_password, role in configured_accounts:
        if email in emails and expected_password and data['password'] == expected_password:
            return login_response({'email': email, 'name': email.split('@')[0], 'role': role})
    return jsonify({'error': 'Correo o contraseña incorrectos'}), 401

def parse_product_payload(data):
    """Validate a product, returning (fields, error). Shared by create and edit."""
    name = data.get('name', '').strip()
    category = data.get('category', '').strip()
    if not name or not category:
        return None, 'Nombre y categoría son obligatorios.'
    try:
        price = float(data.get('price', 0))
    except (TypeError, ValueError):
        price = 0
    if price <= 0:
        return None, 'Indica un precio mayor a cero.'
    try:
        stock = int(data.get('stock', 0))
    except (TypeError, ValueError):
        stock = -1
    if stock < 0:
        return None, 'El stock debe ser cero o un número mayor.'
    original_price_value = data.get('original_price')
    if original_price_value in (None, ''):
        original_price = None
    else:
        try:
            original_price = float(original_price_value)
        except (TypeError, ValueError):
            return None, 'El precio anterior no es válido.'
        if original_price <= price:
            return None, 'El precio anterior debe ser mayor que el precio actual.'
    return {
        'name': name,
        'category': category,
        'description': data.get('description', '').strip(),
        'story': data.get('story', '').strip(),
        'price': price,
        'original_price': original_price,
        'stock': stock,
        'image': data.get('image', '').strip(),
    }, None


def owned_product(actor, product_id):
    """Find a product the caller may edit, returning (row, error, status)."""
    if not os.environ.get('DATABASE_URL'):
        return None, 'Esta accion requiere la base de datos configurada.', 503
    query = (
        'select p.id, s.name as store_name from products p '
        'join stores s on s.id = p.store_id where p.id = :id'
    )
    try:
        row = db.session.execute(text(query), {'id': product_id}).mappings().first()
    except Exception:
        db.session.rollback()
        return None, 'No fue posible consultar el producto.', 500
    if not row:
        return None, 'No encontramos ese producto.', 404
    if actor.get('role') in {'admin', 'superadmin'}:
        return row, None, 200
    own = (actor.get('store_name') or '').strip().lower()
    if row['store_name'].lower() != own:
        return None, 'Solo puedes modificar productos de tu tienda.', 403
    return row, None, 200


@app.put('/api/store/products/<int:product_id>')
def update_store_product(product_id):
    actor = authenticated_session()
    if not actor or actor.get('role') not in {'tienda', 'admin', 'superadmin'}:
        return jsonify({'error': 'Solo la cuenta administradora de la tienda puede modificar productos.'}), 403
    fields, error = parse_product_payload(request.get_json(silent=True) or {})
    if error:
        return jsonify({'error': error}), 400
    row, error, status = owned_product(actor, product_id)
    if error:
        return jsonify({'error': error}), status
    update = (
        'update products set name = :name, category = :category, '
        'description = :description, story = :story, price = :price, '
        'original_price = :original_price, stock = :stock, image = :image '
        'where id = :id'
    )
    try:
        ensure_product_schema()
        db.session.execute(text(update), {**fields, 'id': product_id})
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible guardar los cambios.'}), 500
    return jsonify({'product': {**fields, 'id': product_id, 'store': row['store_name']}})


@app.delete('/api/store/products/<int:product_id>')
def delete_store_product(product_id):
    actor = authenticated_session()
    if not actor or actor.get('role') not in {'tienda', 'admin', 'superadmin'}:
        return jsonify({'error': 'Solo la cuenta administradora de la tienda puede eliminar productos.'}), 403
    row, error, status = owned_product(actor, product_id)
    if error:
        return jsonify({'error': error}), status
    try:
        db.session.execute(text('delete from product_images where product_id = :id'), {'id': product_id})
        db.session.execute(text('delete from products where id = :id'), {'id': product_id})
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'No fue posible eliminar el producto.'}), 500
    return jsonify({'deleted': product_id})


@app.post('/api/store/products')
def create_store_product():
    actor = authenticated_session()
    if not actor or actor.get('role') != 'tienda':
        return jsonify({'error': 'Solo la cuenta administradora de la tienda puede crear productos.'}), 403
    fields, error = parse_product_payload(request.get_json(silent=True) or {})
    if error:
        return jsonify({'error': error}), 400
    product, error = create_catalog_product(actor.get('store_name', ''), fields)
    if error:
        return jsonify({'error': error}), 404 if 'tienda' in error.lower() else 500
    return jsonify({'product': product}), 201

@app.post('/api/admin/users')
def create_admin_user():
    actor = authenticated_actor()
    if not actor:
        return jsonify({'error': 'Tu sesión de administrador expiró. Inicia sesión nuevamente.'}), 401
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role = data.get('role', 'cliente')
    store_name = data.get('store_name', '').strip()
    if not name or not email or len(password) < 6:
        return jsonify({'error': 'Nombre, correo y contraseña de al menos 6 caracteres son obligatorios.'}), 400
    if role not in VALID_ROLES:
        return jsonify({'error': 'Rol de usuario no válido.'}), 400
    if actor['role'] != 'superadmin' and role in {'admin', 'superadmin'}:
        return jsonify({'error': 'Solo un superadmin puede crear administradores.'}), 403
    if role == 'tienda' and not store_name:
        return jsonify({'error': 'Selecciona la tienda que administrará este usuario.'}), 400
    account = LocalUser.query.filter_by(email=email).first()
    supabase_user, error = create_supabase_user(email, password, name, role, store_name)
    if error:
        if 'registered' not in error.lower():
            return jsonify({'error': error}), 502
        existing_user_id = auth_user_id_by_email(email)
        if not existing_user_id:
            return jsonify({'error': error}), 409
        supabase_user = {'id': existing_user_id}
    profile_warning = None
    if not sync_profile_role(supabase_user['id'], role):
        profile_warning = 'La cuenta se creó; el rol se administrará desde Choping mientras se revisa la tabla profiles.'
    if account:
        account.name = name
        account.password_hash = generate_password_hash(password)
        account.role = role
        account.store_name = store_name
    else:
        account = LocalUser(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            role=role,
            store_name=store_name,
        )
        db.session.add(account)
    db.session.commit()
    response = {'user': {'name': name, 'email': email, 'role': role, 'store_name': store_name}}
    if profile_warning:
        response['warning'] = profile_warning
    return jsonify(response), 201

@app.put('/api/admin/users/<path:email>')
def update_admin_user(email):
    actor = authenticated_actor()
    if not actor:
        return jsonify({'error': 'Tu sesión de administrador expiró. Inicia sesión nuevamente.'}), 401
    account = LocalUser.query.filter_by(email=email.strip().lower()).first()
    if not account:
        return jsonify({'error': 'No encontramos ese usuario.'}), 404
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    role = data.get('role', account.role)
    store_name = data.get('store_name', '').strip()
    password = data.get('password', '')
    if not name or role not in VALID_ROLES:
        return jsonify({'error': 'Nombre y rol válidos son obligatorios.'}), 400
    if actor['role'] != 'superadmin' and role in {'admin', 'superadmin'}:
        return jsonify({'error': 'Solo un superadmin puede asignar ese rol.'}), 403
    if role == 'tienda' and not store_name:
        return jsonify({'error': 'Selecciona la tienda que administrará este usuario.'}), 400
    if password and len(password) < 6:
        return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres.'}), 400
    account.name = name
    account.role = role
    account.store_name = store_name if role == 'tienda' else ''
    if password:
        account.password_hash = generate_password_hash(password)
    auth_user_id = auth_user_id_by_email(account.email)
    profile_warning = None
    if auth_user_id and not sync_profile_role(auth_user_id, role):
        profile_warning = 'El rol quedó actualizado en Choping; no se pudo sincronizar profiles.'
    db.session.commit()
    response = {'user': {'name': account.name, 'email': account.email, 'role': account.role, 'store_name': account.store_name, 'active': account.active}}
    if profile_warning:
        response['warning'] = profile_warning
    return jsonify(response)

@app.post('/api/auth/register')
def register():
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role = data.get('role', 'cliente')
    if not name or not email or not password:
        return jsonify({'error': 'Nombre, correo y contraseña son obligatorios'}), 400
    if role not in ('cliente', 'tienda'):
        return jsonify({'error': 'Tipo de usuario no valido'}), 400
    if role == 'cliente' and not data.get('phone', '').strip():
        return jsonify({'error': 'El telefono es obligatorio para clientes'}), 400
    if role == 'tienda' and not all(data.get(field, '').strip() for field in ('store_name', 'category', 'city', 'description')):
        return jsonify({'error': 'Las tiendas deben indicar nombre, categoria, ciudad y descripcion'}), 400
    department = data.get('department', '').strip()
    if role == 'tienda' and department and not valid_location(department, data.get('city', '').strip()):
        return jsonify({'error': 'La ciudad no pertenece al departamento seleccionado.'}), 400
    if role == 'tienda':
        workspace_ready, workspace_error = ensure_store_workspace(
            data['store_name'].strip(),
            name,
            data['category'].strip(),
            data['city'].strip(),
            data['description'].strip(),
            department,
        )
        if not workspace_ready:
            return jsonify({'error': workspace_error}), 500
        # La tienda queda pendiente: hay que avisar a quien la aprueba. El
        # correo se intenta despues del registro y su fallo no lo tumba.
        tienda = data['store_name'].strip()
        ubicacion = ' · '.join(part for part in (data['city'].strip(), department) if part)
        notify(
            'admin',
            'store-pending',
            f'Nueva tienda por aprobar: {tienda}',
            f"{data['category'].strip()}{' · ' + ubicacion if ubicacion else ''} · Responsable: {name} ({email})",
        )
        send_alert_email(
            f'Choping: nueva tienda por aprobar ({tienda})',
            [
                f'La tienda <strong>{tienda}</strong> se registro y espera aprobacion.',
                f"Categoria: {data['category'].strip()}",
                f'Ubicacion: {ubicacion or "sin indicar"}',
                f'Responsable: {name} ({email})',
                'Apruebala desde el panel administrativo, en Solicitudes.',
            ],
        )
    account = LocalUser.query.filter_by(email=email).first()
    if account and not check_password_hash(account.password_hash, password):
        return jsonify({'error': 'Ya existe un usuario con ese correo. Inicia sesión o usa otra contraseña.'}), 409
    store_name = data.get('store_name', '').strip()
    supabase_user, error = create_supabase_user(email, password, name, role, store_name)
    if error:
        if 'registered' not in error.lower():
            return jsonify({'error': error}), 502
        existing_user_id = auth_user_id_by_email(email)
        if not existing_user_id:
            return jsonify({'error': error}), 409
        supabase_user = {'id': existing_user_id}
    profile_warning = None
    if not sync_profile_role(supabase_user['id'], role):
        profile_warning = 'La cuenta se creó; el perfil se terminará de sincronizar cuando se revise profiles.'
    if account:
        account.name = name
        account.role = role
        account.phone = data.get('phone', '').strip()
        account.store_name = store_name
    else:
        account = LocalUser(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            role=role,
            phone=data.get('phone', '').strip(),
            store_name=store_name,
        )
        db.session.add(account)
    db.session.commit()
    user = {'name': name, 'email': email, 'role': role, 'phone': account.phone, 'store_name': account.store_name}
    response = {'user': user, 'access_token': access_token_for(user), 'message': 'Usuario creado correctamente'}
    if profile_warning:
        response['warning'] = profile_warning
    return jsonify(response), 201

with app.app_context():
    db.create_all()
    ensure_store_theme_schema()
    ensure_local_user_status_column()
    seed_product_categories()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
