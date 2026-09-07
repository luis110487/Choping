# Despliegue separado de Choping

## Backend en Render

Crear un Web Service apuntando a la carpeta `backend`.

- Build: `pip install -r requirements.txt`
- Start: `gunicorn app:app`
- `DATABASE_URL`: copiar la cadena de conexión PostgreSQL de Supabase, preferiblemente la conexión pooled.
- `SECRET_KEY`: valor aleatorio.
- `FRONTEND_ORIGIN`: URL final de Vercel.

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
