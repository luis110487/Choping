import os
import unittest
from unittest.mock import MagicMock, patch

os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['SECRET_KEY'] = 'test-secret-key'
os.environ['SUPERADMIN_PASSWORD'] = 'test-superadmin-password'
os.environ['SUPABASE_URL'] = 'https://example.supabase.co'
os.environ['SUPABASE_SERVICE_ROLE_KEY'] = 'test-service-role-key'

from app import LocalUser, app, db


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


if __name__ == '__main__':
    unittest.main()
