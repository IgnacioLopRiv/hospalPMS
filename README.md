## CONFIGURACION BACKEND

## Requisitos

- Docker Desktop (abierto y con el motor corriendo)
- Node.js 20 o superior
- Git

> En Windows con Git Bash, si `docker` falla con "bad interpreter",
> usa `docker.exe` o PowerShell.

## Estructura

```
hospalPMS/
├── docker-compose.yml
├── .env.example            variables de Docker
├── backend/                API NestJS + Prisma
└── frontend/               Ionic + Angular (Standalone Components)
```

## Primera vez

Desde la raíz del proyecto:

```
cp .env.example .env
cp backend/.env.example backend/.env
```

Valores por defecto de desarrollo:

- Raíz `.env`: `DB_ROOT_PASSWORD`, `DB_NAME`, `DB_USER`, `DB_PASS`
- `backend/.env`: `DATABASE_URL` apuntando a `localhost:3307`

### Obligatorio: definir `JWT_SECRET`

`JWT_SECRET` viene vacío en ambos `.env.example`. **Sin él no se puede iniciar
sesión**: con Docker, `docker compose up` falla al arrancar; en local, el login
responde error 500.

Genera un secreto (mínimo 32 caracteres):

```
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

y pégalo en **ambos** archivos:

- `.env` (raíz) → `JWT_SECRET=<el valor generado>`
- `backend/.env` → `JWT_SECRET=<el valor generado>`

`POS_ENCRYPTION_KEY` es opcional para iniciar sesión (solo se usa al configurar
terminales de pago).

## Levantar el proyecto

### Opción A: desarrollo diario (recomendada)

Solo la base de datos en Docker; Nest corre en tu máquina con recarga automática.

```
docker compose up -d mysql
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

Si el backend estaba corriendo en Docker, detenlo antes:
`docker compose stop backend` (ambos usan el puerto 3000).

### Opción B: todo en Docker

```
docker compose up -d --build
docker compose logs -f backend
```

Levanta MySQL, aplica las migraciones y deja la API en
http://localhost:3000.

El contenedor **no** carga los datos iniciales (no incluye `ts-node`). Una vez
que el backend esté arriba, ejecuta el seed desde tu máquina:

```
cd backend
npm install
npx prisma db seed
```

### Datos iniciales (seed)

`npx prisma db seed` crea el hostal, una sede, las características base y el
**usuario administrador**. Sin este paso la base no tiene usuarios y no se
puede iniciar sesión. Se puede ejecutar varias veces sin duplicar datos.

## Levantar el frontend

En otra terminal:

```
cd frontend
npm install
npm start
```

Abre http://localhost:4200. El frontend apunta a la API en
`http://localhost:3000` (`frontend/src/environments/environment.ts`).

> El contenedor `frontend` de Docker (puerto 8080) no está en la lista de
> orígenes CORS del backend (`backend/src/main.ts`), por lo que el login falla
> desde ahí. Usa `npm start` (4200) para probar.

## Iniciar sesión

| Email | Contraseña | Rol |
|-------|------------|-----|
| `admintest@gmail.com` | `Admin123` | ADMINISTRADOR |

Credenciales solo para desarrollo local.

### Si no puedes ingresar

- **"El correo no está registrado":** falta ejecutar `npx prisma db seed`.
- **Error 500 al iniciar sesión:** `JWT_SECRET` está vacío en `backend/.env`
  (o en `.env` si usas Docker). Defínelo y reinicia el backend.
- **`Define JWT_SECRET en .env` al hacer `docker compose up`:** falta el valor en
  el `.env` de la raíz.
- **Error de red / CORS en el navegador:** abre el frontend en
  http://localhost:4200 y verifica que la API responda en http://localhost:3000.

## Puertos

| Servicio | Desde tu PC | Dentro de Docker |
|----------|-------------|------------------|
| MySQL    | localhost:3307 | mysql:3306 |
| API      | localhost:3000 | 3000 |
| Frontend | localhost:4200 (`npm start`) / localhost:8080 (Docker) | 80 |
| Mailpit  | localhost:8025 (web) / 1025 (SMTP) | 1025 |

Si el 3307 o el 3000 están ocupados, cambia el mapeo en `docker-compose.yml`
y el puerto en `backend/.env`.

## Base de datos y migraciones

El modelo vive en `backend/prisma/schema.prisma`.

- Cambiar el modelo y crear la migración:
  `npx prisma migrate dev --name descripcion_del_cambio`
- Aplicar migraciones recibidas por git: `npx prisma migrate deploy`
- Ver los datos en el navegador: `npx prisma studio`
- Siempre subir a git la carpeta `backend/prisma/migrations/`.
- Avisar al equipo antes de modificar el schema, para evitar migraciones en conflicto.

Cada integrante tiene su propia base de datos local; los datos no se comparten.

## Comandos útiles

```
docker compose ps                    estado de los contenedores
docker compose logs -f mysql         logs de la base de datos
docker compose down                  apagar (conserva los datos)
docker compose down -v               apagar y borrar los datos
```

Tras `down -v`, repetir los pasos de "Levantar el proyecto".

## Problemas comunes

- **Puerto ocupado:** cambiar el puerto del lado izquierdo en `docker-compose.yml`.
- **`P1001: Can't reach database server`:** MySQL no está `healthy` o el puerto
  de `backend/.env` no coincide. Revisar con `docker compose ps`.
- **`P2021: table does not exist`:** falta aplicar migraciones (`npx prisma migrate deploy`).
- **Cambios en el schema no se reflejan en el código:** ejecutar `npx prisma generate`.
- **Nunca subir los archivos `.env` a git;** solo los `.env.example`.