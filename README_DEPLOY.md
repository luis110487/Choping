# Despliegue separado de Choping

## Backend en Render

Crear un Web Service apuntando a la carpeta `backend`.

- Build: `pip install -r requirements.txt`
- Start: `gunicorn app:app`
- `DATABASE_URL`: copiar la cadena de conexión PostgreSQL de Supabase, preferiblemente la conexión pooled.
- `SECRET_KEY`: valor aleatorio. **Obligatorio**: sin el, el servicio no arranca en Render.
- `FRONTEND_ORIGIN`: URL final de Vercel, por ejemplo `https://choping-one.vercel.app`.
  **Obligatorio**: evita dejar CORS abierto a `*`. Admite varios origenes separados
  por coma para las preview de Vercel o un dominio propio.

Health check: `/api/health`

## Frontend en Vercel

Crear un proyecto apuntando a la carpeta `frontend`.

- Build: `npm run build`
- Output: `dist`
- `VITE_API_URL`: URL pública del backend de Render.

## Local

Backend:

```powershell
cd backend
pip install -r requirements.txt
python app.py
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

La app Flask original continúa en `encuentra_mvp_800k` como referencia y respaldo durante la migración.

## Imagenes de tienda

Logo y banners se guardan en Supabase Storage, en el bucket `store-media`,
que la API crea sola la primera vez si no existe. Para cambiarlo, define
`SUPABASE_STORAGE_BUCKET`. Sin `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
la API cae a disco local, valido solo en desarrollo: Render borra el disco
en cada despliegue.
