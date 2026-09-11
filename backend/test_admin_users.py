import os
import unittest
from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch
from werkzeug.security import generate_password_hash

os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['SECRET_KEY'] = 'test-secret-key'
os.environ['SUPERADMIN_PASSWORD'] = 'test-superadmin-password'
os.environ['SUPABASE_URL'] = 'https://example.supabase.co'
os.environ['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key'

from app import LocalUser, access_token_for, app, db, visible_pending_catalog


class AdminUserProvisioningTests(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        db.drop_all()
        db.create_all()
        self.client = app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    @patch('app.sync_profile_role', return_value=True)
    @patch('app.urlopen')
    def test_superadmin_can_create_store_account(self, mock_urlopen, _mock_profile_sync):
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"id":"supabase-user-id","email":"casaviva@gmail.com"}'
        mock_urlopen.return_value.__enter__.return_value = mock_response

        login = self.client.post('/api/auth/login', json={
            'email': 'luis.gamarra@techdatasync.com',
            'password': 'test-superadmin-password',
        })
        token = login.get_json()['access_token']

        response = self.client.post(
            '/api/admin/users',
            headers={'Authorization': f'Bearer {token}'},
            json={
                'name': 'Casa Viva',
                'email': 'casaviva@gmail.com',
                'password': 'Casa123',
                'role': 'tienda',
                'store_name': 'Casa Viva',
            },
        )

        self.assertEqual(response.status_code, 201)
        account = LocalUser.query.filter_by(email='casaviva@gmail.com').first()
        self.assertIsNotNone(account)
        self.assertEqual(account.role, 'tienda')
        self.assertEqual(account.store_name, 'Casa Viva')
        self.assertTrue(mock_urlopen.called)

    @patch('app.sync_profile_role', return_value=True)
    @patch('app.urlopen')
    def test_superadmin_migrates_legacy_local_store_account(self, mock_urlopen, _mock_profile_sync):
        db.session.add(LocalUser(
            name='Casa Viva antiguo',
            email='casaviva@gmail.com',
            password_hash='old-hash',
            role='tienda',
            store_name='Casa Viva',
        ))
        db.session.commit()
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"id":"supabase-user-id","email":"casaviva@gmail.com"}'
        mock_urlopen.return_value.__enter__.return_value = mock_response
        login = self.client.post('/api/auth/login', json={
            'email': 'luis.gamarra@techdatasync.com',
            'password': 'test-superadmin-password',
        })

        response = self.client.post(
            '/api/admin/users',
            headers={'Authorization': f"Bearer {login.get_json()['access_token']}"},
            json={
                'name': 'Casa Viva',
                'email': 'casaviva@gmail.com',
                'password': 'Casa123',
                'role': 'tienda',
                'store_name': 'Casa Viva',
            },
        )

        self.assertEqual(response.status_code, 201)
        account = LocalUser.query.filter_by(email='casaviva@gmail.com').first()
        self.assertEqual(account.name, 'Casa Viva')
        self.assertTrue(mock_urlopen.called)

    @patch('app.sync_profile_role', return_value=True)
    @patch('app.auth_user_id_by_email', return_value='existing-supabase-user-id', create=True)
    @patch('app.create_supabase_user', return_value=(None, 'User already registered'))
    def test_superadmin_completes_role_for_existing_auth_account(self, _mock_create, _mock_user_id, _mock_profile_sync):
        login = self.client.post('/api/auth/login', json={
            'email': 'luis.gamarra@techdatasync.com',
            'password': 'test-superadmin-password',
        })
        response = self.client.post(
            '/api/admin/users',
            headers={'Authorization': f"Bearer {login.get_json()['access_token']}"},
            json={
                'name': 'Movil Store',
                'email': 'movilstore@gmail.com',
                'password': 'Casa123',
                'role': 'tienda',
                'store_name': 'Movil Store',
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(LocalUser.query.filter_by(email='movilstore@gmail.com').first().role, 'tienda')

    @patch('app.sync_profile_role', return_value=True)
    @patch('app.auth_user_id_by_email', return_value='existing-supabase-user-id')
    def test_editing_user_syncs_its_profile_role(self, mock_user_id, mock_profile_sync):
        db.session.add(LocalUser(
            name='Casa Viva',
            email='casaviva@gmail.com',
            password_hash='old-hash',
            role='cliente',
        ))
        db.session.commit()
        login = self.client.post('/api/auth/login', json={
            'email': 'luis.gamarra@techdatasync.com',
            'password': 'test-superadmin-password',
        })
        response = self.client.put(
            '/api/admin/users/casaviva@gmail.com',
            headers={'Authorization': f"Bearer {login.get_json()['access_token']}"},
            json={'name': 'Casa Viva', 'role': 'tienda', 'store_name': 'Casa Viva'},
        )

        self.assertEqual(response.status_code, 200)
        mock_user_id.assert_called_once_with('casaviva@gmail.com')
        mock_profile_sync.assert_called_once_with('existing-supabase-user-id', 'tienda')

    @patch('app.sync_profile_role', return_value=False)
    @patch('app.urlopen')
    def test_store_account_is_saved_when_profile_sync_needs_attention(self, mock_urlopen, _mock_profile_sync):
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"id":"supabase-user-id","email":"casaviva@gmail.com"}'
        mock_urlopen.return_value.__enter__.return_value = mock_response
        login = self.client.post('/api/auth/login', json={
            'email': 'luis.gamarra@techdatasync.com',
            'password': 'test-superadmin-password',
        })
        response = self.client.post(
            '/api/admin/users',
            headers={'Authorization': f"Bearer {login.get_json()['access_token']}"},
            json={
                'name': 'Casa Viva',
                'email': 'casaviva@gmail.com',
                'password': 'Casa123',
                'role': 'tienda',
                'store_name': 'Casa Viva',
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.get_json().get('warning'))
        self.assertIsNotNone(LocalUser.query.filter_by(email='casaviva@gmail.com').first())

    @patch('app.sync_profile_role', return_value=True)
    @patch('app.urlopen')
    def test_public_registration_creates_auth_identity_and_session(self, mock_urlopen, _mock_profile_sync):
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"id":"new-supabase-user-id","email":"cliente@gmail.com"}'
        mock_urlopen.return_value.__enter__.return_value = mock_response

        response = self.client.post('/api/auth/register', json={
            'name': 'Cliente nuevo',
            'email': 'cliente@gmail.com',
            'password': 'Clave123',
            'role': 'cliente',
            'phone': '3001234567',
        })

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.get_json().get('access_token'))
        self.assertTrue(mock_urlopen.called)
        self.assertIsNotNone(LocalUser.query.filter_by(email='cliente@gmail.com').first())

    @patch('app.sync_profile_role', return_value=True)
    @patch('app.ensure_store_workspace', return_value=(True, None), create=True)
    @patch('app.urlopen')
    def test_store_registration_creates_its_store_workspace(self, mock_urlopen, mock_workspace, _mock_profile_sync):
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"id":"new-store-user-id","email":"tienda@gmail.com"}'
        mock_urlopen.return_value.__enter__.return_value = mock_response

        response = self.client.post('/api/auth/register', json={
            'name': 'Responsable TDS',
            'email': 'tienda@gmail.com',
            'password': 'Clave123',
            'role': 'tienda',
            'store_name': 'TDS',
            'category': 'Tecnologia',
            'city': 'Barranquilla',
            'description': 'Software',
        })

        self.assertEqual(response.status_code, 201)
        mock_workspace.assert_called_once_with('TDS', 'Responsable TDS', 'Tecnologia', 'Barranquilla', 'Software')

    @patch('app.create_catalog_product', create=True)
    def test_store_user_can_create_a_product_for_its_own_store(self, mock_create_product):
        db.session.add(LocalUser(
            name='Casa Viva',
            email='casaviva@gmail.com',
            password_hash=generate_password_hash('Clave123'),
            role='tienda',
            store_name='Casa Viva',
        ))
        db.session.commit()
        mock_create_product.return_value = ({
            'id': 101,
            'name': 'Mesa auxiliar',
            'category': 'Hogar',
            'price': 180000,
            'description': 'Mesa de madera',
            'image': 'products/licuadora-ninja.png',
            'store': 'Casa Viva',
            'rating': 0,
            'images': ['products/licuadora-ninja.png'],
        }, None)
        login = self.client.post('/api/auth/login', json={
            'email': 'casaviva@gmail.com',
            'password': 'Clave123',
        })
        response = self.client.post(
            '/api/store/products',
            headers={'Authorization': f"Bearer {login.get_json()['access_token']}"},
            json={
                'name': 'Mesa auxiliar',
                'category': 'Hogar',
                'price': 180000,
                'original_price': 220000,
                'stock': 8,
                'description': 'Mesa de madera',
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()['product']['store'], 'Casa Viva')
        self.assertEqual(mock_create_product.call_args.args[1]['stock'], 8)
        self.assertEqual(mock_create_product.call_args.args[1]['original_price'], 220000)

    def store_session(self, store_name='Casa Viva', email='casaviva@gmail.com'):
        db.session.add(LocalUser(
            name=store_name,
            email=email,
            password_hash=generate_password_hash('Clave123'),
            role='tienda',
            store_name=store_name,
        ))
        db.session.commit()
        login = self.client.post('/api/auth/login', json={'email': email, 'password': 'Clave123'})
        return {'Authorization': f"Bearer {login.get_json()['access_token']}"}

    @patch('app.supabase_storage_request', return_value=(b'{}', None))
    def test_store_user_can_upload_a_product_image(self, storage):
        headers = self.store_session()
        response = self.client.post(
            '/api/store/product-images',
            headers=headers,
            data={'image': (BytesIO(b'image-content'), 'producto.png')},
            content_type='multipart/form-data',
        )
        self.assertEqual(response.status_code, 201)
        # Product images must land in object storage, not on the ephemeral disk.
        self.assertTrue(
            response.get_json()['image'].startswith(
                'https://example.supabase.co/storage/v1/object/public/store-media/Casa_Viva/'
            )
        )

    def test_product_image_falls_back_to_disk_without_storage_credentials(self):
        headers = self.store_session()
        with TemporaryDirectory() as upload_folder:
            previous_folder = app.config['PRODUCT_UPLOAD_FOLDER']
            app.config['PRODUCT_UPLOAD_FOLDER'] = upload_folder
            try:
                with patch.dict(os.environ, {'SUPABASE_URL': ''}):
                    response = self.client.post(
                        '/api/store/product-images',
                        headers=headers,
                        data={'image': (BytesIO(b'image-content'), 'producto.png')},
                        content_type='multipart/form-data',
                    )
            finally:
                app.config['PRODUCT_UPLOAD_FOLDER'] = previous_folder
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.get_json()['image'].startswith('uploads/stores/'))

    @patch('app.supabase_storage_request', return_value=(b'{}', None))
    def test_store_banner_upload_and_removal(self, storage):
        headers = self.store_session()
        upload = self.client.post(
            '/api/store/media',
            headers=headers,
            data={'slot': 'banner', 'image': (BytesIO(b'image-content'), 'banner.png')},
            content_type='multipart/form-data',
        )
        self.assertEqual(upload.status_code, 201)
        banners = upload.get_json()['media']['banners']
        self.assertEqual(len(banners), 1)

        catalog = self.client.get('/api/stores?include_pending=true').get_json()
        casa_viva = next((store for store in catalog if store['name'] == 'Casa Viva'), None)
        if casa_viva:
            self.assertEqual(casa_viva['media']['banners'], banners)

        removal = self.client.delete('/api/store/media', headers=headers, json={'url': banners[0]})
        self.assertEqual(removal.status_code, 200)
        self.assertEqual(removal.get_json()['media']['banners'], [])

    @patch('app.supabase_storage_request', return_value=(b'{}', None))
    def test_store_cannot_remove_media_it_does_not_own(self, storage):
        headers = self.store_session()
        response = self.client.delete(
            '/api/store/media', headers=headers, json={'url': 'uploads/stores/otra_tienda.png'}
        )
        self.assertEqual(response.status_code, 404)

    def test_theme_rejects_fonts_outside_the_whitelist(self):
        headers = self.store_session()
        rejected = self.client.put('/api/store/theme', headers=headers, json={
            'theme': {'preset': 'ocean', 'fonts': {'heading': 'Comic Sans; background:url(evil)'}},
        })
        self.assertEqual(rejected.status_code, 400)

        accepted = self.client.put('/api/store/theme', headers=headers, json={
            'theme': {
                'preset': 'sunset',
                'colors': {'heading': '#B5179E'},
                'fonts': {'heading': 'editorial', 'body': 'legible'},
            },
        })
        self.assertEqual(accepted.status_code, 200)
        theme = accepted.get_json()['theme']
        self.assertEqual(theme['fonts'], {'heading': 'editorial', 'body': 'legible'})
        self.assertEqual(theme['colors']['heading'], '#b5179e')

    def test_store_cannot_theme_another_store(self):
        headers = self.store_session()
        response = self.client.put('/api/store/theme', headers=headers, json={
            'store': 'Tech Zone',
            'theme': {'preset': 'forest'},
        })
        self.assertEqual(response.status_code, 403)

    def test_catalog_products_always_carry_a_unique_id(self):
        """The cart matches lines by id; duplicates or None bill the wrong item."""
        catalog = self.client.get('/api/stores').get_json()
        ids = [product.get('id') for store in catalog for product in store['products']]
        self.assertTrue(ids, 'el catalogo no devolvio productos')
        self.assertNotIn(None, ids)
        self.assertEqual(len(ids), len(set(ids)))

    def test_catalog_stores_always_carry_an_id(self):
        catalog = self.client.get('/api/stores').get_json()
        ids = [store.get('id') for store in catalog]
        self.assertNotIn(None, ids)
        self.assertEqual(len(ids), len(set(ids)))

    def test_only_staff_can_approve_a_store(self):
        headers = self.store_session()
        rejected = self.client.put('/api/admin/stores/Casa%20Viva/approval', headers=headers, json={'approved': True})
        self.assertEqual(rejected.status_code, 403)

        anonymous = self.client.put('/api/admin/stores/Casa%20Viva/approval', json={'approved': True})
        self.assertEqual(anonymous.status_code, 403)

    def test_approval_requires_an_explicit_boolean(self):
        headers = {'Authorization': f"Bearer {access_token_for({'email': 'a@b.c', 'role': 'superadmin', 'name': 'A'})}"}
        response = self.client.put('/api/admin/stores/Casa%20Viva/approval', headers=headers, json={'approved': 'si'})
        self.assertEqual(response.status_code, 400)

    def test_pending_stores_are_not_public(self):
        """A pending store must not leak to anonymous callers asking for it."""
        catalog = self.client.get('/api/stores?include_pending=true').get_json()
        self.assertTrue(all(store.get('approved') is not False for store in catalog))

    def test_pending_filter_treats_any_falsy_flag_as_pending(self):
        """SQLite yields 0 and NULL is possible, so `is not False` let pending
        stores leak to anonymous callers."""
        catalog = [
            {'name': 'Aprobada bool', 'approved': True},
            {'name': 'Aprobada entero', 'approved': 1},
            {'name': 'Pendiente bool', 'approved': False},
            {'name': 'Pendiente entero', 'approved': 0},
            {'name': 'Pendiente nulo', 'approved': None},
        ]
        with patch('app.database_catalog', return_value=catalog):
            anonymous, _ = visible_pending_catalog(None)
            self.assertEqual([s['name'] for s in anonymous], ['Aprobada bool', 'Aprobada entero'])

            owner, _ = visible_pending_catalog({'role': 'tienda', 'store_name': 'Pendiente entero'})
            self.assertIn('Pendiente entero', [s['name'] for s in owner])
            self.assertNotIn('Pendiente bool', [s['name'] for s in owner])

            staff, _ = visible_pending_catalog({'role': 'superadmin'})
            self.assertEqual(len(staff), 5)

    def test_platform_theme_is_public_to_read_and_staff_only_to_write(self):
        default = self.client.get('/api/platform/theme')
        self.assertEqual(default.status_code, 200)
        self.assertEqual(default.get_json(), {'background': '', 'fonts': {}})

        headers = self.store_session()
        self.assertEqual(
            self.client.put('/api/platform/theme', headers=headers, json={'theme': {'background': '#000000'}}).status_code,
            403,
        )
        self.assertEqual(
            self.client.put('/api/platform/theme', json={'theme': {'background': '#000000'}}).status_code,
            403,
        )

        admin = {'Authorization': f"Bearer {access_token_for({'email': 'a@b.c', 'role': 'superadmin', 'name': 'A'})}"}
        saved = self.client.put('/api/platform/theme', headers=admin, json={
            'theme': {'background': '#FFF4E6', 'fonts': {'heading': 'editorial'}},
        })
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.get_json()['theme'], {'background': '#fff4e6', 'fonts': {'heading': 'editorial'}})
        self.assertEqual(self.client.get('/api/platform/theme').get_json()['background'], '#fff4e6')

    def test_platform_theme_rejects_invalid_values(self):
        admin = {'Authorization': f"Bearer {access_token_for({'email': 'a@b.c', 'role': 'superadmin', 'name': 'A'})}"}
        for payload in (
            {'background': 'red'},
            {'fonts': {'heading': 'url(evil)'}},
            {'fonts': {'footer': 'editorial'}},
        ):
            response = self.client.put('/api/platform/theme', headers=admin, json={'theme': payload})
            self.assertEqual(response.status_code, 400, payload)

    def test_deactivated_user_cannot_sign_in(self):
        headers = self.store_session(store_name='Casa Viva', email='casaviva@gmail.com')
        admin = {'Authorization': f"Bearer {access_token_for({'email': 'a@b.c', 'role': 'superadmin', 'name': 'A'})}"}

        off = self.client.put('/api/admin/users/casaviva@gmail.com/status', headers=admin, json={'active': False})
        self.assertEqual(off.status_code, 200)
        self.assertFalse(off.get_json()['user']['active'])

        denied = self.client.post('/api/auth/login', json={'email': 'casaviva@gmail.com', 'password': 'Clave123'})
        self.assertEqual(denied.status_code, 403)

        # An already issued token must stop working too, not last eight hours.
        self.assertEqual(self.client.get('/api/auth/session', headers=headers).status_code, 403)

        on = self.client.put('/api/admin/users/casaviva@gmail.com/status', headers=admin, json={'active': True})
        self.assertEqual(on.status_code, 200)
        self.assertEqual(
            self.client.post('/api/auth/login', json={'email': 'casaviva@gmail.com', 'password': 'Clave123'}).status_code,
            200,
        )

    def test_user_status_guards(self):
        self.store_session(store_name='Casa Viva', email='casaviva@gmail.com')
        admin_headers = {'Authorization': f"Bearer {access_token_for({'email': 'a@b.c', 'role': 'superadmin', 'name': 'A'})}"}

        self.assertEqual(
            self.client.put('/api/admin/users/a@b.c/status', headers=admin_headers, json={'active': False}).status_code,
            400,  # nadie puede desactivarse a si mismo
        )
        self.assertEqual(
            self.client.put('/api/admin/users/nadie@x.c/status', headers=admin_headers, json={'active': False}).status_code,
            404,
        )
        self.assertEqual(
            self.client.put('/api/admin/users/casaviva@gmail.com/status', headers=admin_headers, json={'active': 'si'}).status_code,
            400,
        )
        self.assertEqual(
            self.client.put('/api/admin/users/casaviva@gmail.com/status', json={'active': False}).status_code,
            403,
        )

    def test_session_endpoint_rejects_a_bad_token(self):
        self.assertEqual(self.client.get('/api/auth/session').status_code, 401)
        self.assertEqual(
            self.client.get('/api/auth/session', headers={'Authorization': 'Bearer roto'}).status_code,
            401,
        )
        headers = self.store_session(store_name='Casa Viva', email='casaviva@gmail.com')
        ok = self.client.get('/api/auth/session', headers=headers)
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.get_json()['user']['email'], 'casaviva@gmail.com')

    def test_inactive_store_is_hidden_from_the_public_catalog(self):
        catalog = [
            {'name': 'Activa', 'approved': True, 'active': True},
            {'name': 'Suspendida', 'approved': True, 'active': False},
        ]
        with patch('app.database_catalog', return_value=catalog):
            anonymous, _ = visible_pending_catalog(None)
            self.assertEqual([s['name'] for s in anonymous], ['Activa'])

            owner, _ = visible_pending_catalog({'role': 'tienda', 'store_name': 'Suspendida'})
            self.assertIn('Suspendida', [s['name'] for s in owner])

            staff, _ = visible_pending_catalog({'role': 'superadmin'})
            self.assertEqual(len(staff), 2)


if __name__ == '__main__':
    unittest.main()
