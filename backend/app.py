import os
import json
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

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-only-change-me')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///encuentra.db').replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024
app.config['PRODUCT_UPLOAD_FOLDER'] = os.path.join(app.static_folder, 'img', 'uploads')
db = SQLAlchemy(app)
CORS(app, origins=os.environ.get('FRONTEND_ORIGIN', '*'))

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text)
    image = db.Column(db.String(255))
    store = db.Column(db.String(120), nullable=False, default='Tienda Choping')
    rating = db.Column(db.Float, default=4.5)

class LocalUser(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='cliente')
    phone = db.Column(db.String(40))
    store_name = db.Column(db.String(120))

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
for product in DEMO_PRODUCTS:
    product.update({'story': f"Seleccionado para quienes buscan una compra practica en {product['category'].lower()}.", 'review': 'Excelente calidad, compra recomendada por la comunidad Choping.', 'likes': 120, 'purchases': 24, 'images': [product['image'], product['image'], product['image']]})

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
        store_query = '''
            select id, name, owner_name, category, city, description, rating, approved
            from stores
            {store_filter}
            order by created_at asc, id asc
        '''.format(store_filter='' if include_pending else 'where approved is true')
        store_rows = db.session.execute(text(store_query)).mappings().all()
        product_query = '''
            select p.id, p.store_id, p.name, p.category, p.description, p.story,
                   p.price, p.image, p.rating, p.review, p.likes, p.purchases
            from products p
            join stores s on s.id = p.store_id
            {store_filter}
            order by p.created_at asc, p.id asc
        '''.format(store_filter='' if include_pending else 'where s.approved is true')
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
                'approved': row['approved'] if 'approved' in row else True,
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

def ensure_store_workspace(name, owner_name, category, city, description):
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
        db.session.execute(
            text('''
                insert into stores (name, owner_name, category, city, description, approved)
                values (:name, :owner_name, :category, :city, :description, false)
            '''),
            {
                'name': name,
                'owner_name': owner_name,
                'category': category,
                'city': city,
                'description': description,
            },
        )
        db.session.commit()
        return True, None
    except Exception:
        db.session.rollback()
        return False, 'No fue posible preparar el espacio de trabajo de la tienda.'

def create_catalog_product(store_name, data):
    try:
        store_row = db.session.execute(
            text('select id from stores where lower(name) = lower(:name) limit 1'),
            {'name': store_name},
        ).mappings().first()
        if not store_row:
            return None, 'No encontramos la tienda asociada a tu cuenta.'
        image = data.get('image', '').strip() or 'products/pc-gamer.png'
        product_row = db.session.execute(
            text('''
                insert into products (store_id, name, category, description, story, price, image, rating, review, likes, purchases)
                values (:store_id, :name, :category, :description, :story, :price, :image, 0, '', 0, 0)
                returning id
            '''),
            {
                'store_id': store_row['id'],
                'name': data['name'],
                'category': data['category'],
                'description': data.get('description', ''),
                'story': data.get('story', ''),
                'price': data['price'],
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

@app.post('/api/store/product-images')
def upload_store_product_image():
    actor = authenticated_session()
    if not actor or actor.get('role') != 'tienda':
        return jsonify({'error': 'Solo la cuenta administradora de la tienda puede cargar imágenes.'}), 403
    uploaded_image = request.files.get('image')
    if not uploaded_image or not uploaded_image.filename:
        return jsonify({'error': 'Selecciona una imagen para cargar.'}), 400
    extension = uploaded_image.filename.rsplit('.', 1)[-1].lower() if '.' in uploaded_image.filename else ''
    if extension not in {'png', 'jpg', 'jpeg', 'webp', 'gif'} or not (uploaded_image.mimetype or '').startswith('image/'):
        return jsonify({'error': 'Usa una imagen PNG, JPG, WEBP o GIF.'}), 400
    filename = secure_filename(uploaded_image.filename)
    if not filename:
        return jsonify({'error': 'El nombre del archivo no es válido.'}), 400
    relative_path = f'uploads/{uuid4().hex}.{extension}'
    try:
        os.makedirs(app.config['PRODUCT_UPLOAD_FOLDER'], exist_ok=True)
        uploaded_image.save(os.path.join(app.config['PRODUCT_UPLOAD_FOLDER'], relative_path.split('/', 1)[1]))
    except OSError:
        return jsonify({'error': 'No fue posible cargar la imagen. Intenta nuevamente.'}), 500
    return jsonify({'image': relative_path}), 201

@app.get('/api/stores')
def stores():
    catalog = database_catalog(request.args.get('include_pending') == 'true')
    if catalog is not None:
        return jsonify(catalog)
    result=[]
    for p in DEMO_PRODUCTS:
        store=next((s for s in result if s['name']==p['store']),None)
        if not store:
            store={'name':p['store'],'rating':4.8,'category':p['category'],'products':[]}; result.append(store)
        store['products'].append(p)
    return jsonify(result)

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

@app.post('/api/auth/login')
def login():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    if not email or not data.get('password'):
        return jsonify({'error': 'Correo y contraseña son obligatorios'}), 400
    configured_superadmin = os.environ.get('SUPERADMIN_EMAIL', '').strip().lower()
    superadmin_emails = {
        'luis.gamarra@techdatasync.com',
        'luis.gamarra@techdatasaync.com',
        'luis.gamarra@techdatasyn.com',
    }
    if configured_superadmin:
        superadmin_emails.add(configured_superadmin)
    if configured_superadmin in {
        'luis.gamarra@techdatasync.com',
        'luis.gamarra@techdatasaync.com',
    }:
        superadmin_emails.update({
            'luis.gamarra@techdatasync.com',
            'luis.gamarra@techdatasaync.com',
            'luis.gamarra@techdatasyn.com',
        })
    account = LocalUser.query.filter_by(email=email).first()
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

@app.post('/api/store/products')
def create_store_product():
    actor = authenticated_session()
    if not actor or actor.get('role') != 'tienda':
        return jsonify({'error': 'Solo la cuenta administradora de la tienda puede crear productos.'}), 403
    data = request.get_json(silent=True) or {}
    name = data.get('name', '').strip()
    category = data.get('category', '').strip()
    description = data.get('description', '').strip()
    if not name or not category:
        return jsonify({'error': 'Nombre y categoría son obligatorios.'}), 400
    try:
        price = float(data.get('price', 0))
    except (TypeError, ValueError):
        price = 0
    if price <= 0:
        return jsonify({'error': 'Indica un precio mayor a cero.'}), 400
    product, error = create_catalog_product(actor.get('store_name', ''), {
        'name': name,
        'category': category,
        'description': description,
        'story': data.get('story', '').strip(),
        'price': price,
        'image': data.get('image', '').strip(),
    })
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
    response = {'user': {'name': account.name, 'email': account.email, 'role': account.role, 'store_name': account.store_name}}
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
    if role == 'tienda':
        workspace_ready, workspace_error = ensure_store_workspace(
            data['store_name'].strip(),
            name,
            data['category'].strip(),
            data['city'].strip(),
            data['description'].strip(),
        )
        if not workspace_ready:
            return jsonify({'error': workspace_error}), 500
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
