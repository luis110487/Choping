import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-only-change-me')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///encuentra.db').replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
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
    return jsonify({'status': 'ok', 'database': 'configured' if os.environ.get('DATABASE_URL') else 'sqlite-local'})

@app.get('/api/products')
def products():
    query = request.args.get('q', '').strip().lower()
    result = [p for p in DEMO_PRODUCTS if not query or query in f"{p['name']} {p['category']} {p['description']} {p['store']}".lower()]
    return jsonify(result)

@app.get('/api/stores')
def stores():
    result=[]
    for p in DEMO_PRODUCTS:
        store=next((s for s in result if s['name']==p['store']),None)
        if not store:
            store={'name':p['store'],'rating':4.8,'category':p['category'],'products':[]}; result.append(store)
        store['products'].append(p)
    return jsonify(result)

@app.post('/api/auth/login')
def login():
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip().lower()
    if not email or not data.get('password'):
        return jsonify({'error': 'Correo y contraseña son obligatorios'}), 400
    role = 'admin' if email == os.environ.get('ADMIN_EMAIL') and data.get('password') == os.environ.get('ADMIN_PASSWORD') else ('tienda' if email == os.environ.get('STORE_EMAIL') else 'cliente')
    return jsonify({'user': {'email': email, 'name': email.split('@')[0], 'role': role}})

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
    return jsonify({'user': {'name': name, 'email': email, 'role': role}, 'message': 'Usuario creado correctamente'}), 201

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
