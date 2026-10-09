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
└── frontend/               Ionic React
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

## Levantar el proyecto

### Opción A: todo en Docker

```
docker compose up -d --build
docker compose logs -f backend
```

Levanta MySQL, aplica las migraciones y deja la API en
http://localhost:3000.

### Opción B: desarrollo diario (recomendada)

Solo la base de datos en Docker; Nest corre en tu máquina con recarga automática.

```
docker compose up -d mysql
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Si el backend estaba corriendo en Docker, detenlo antes:
`docker compose stop backend` (ambos usan el puerto 3000).

## Puertos

| Servicio | Desde tu PC | Dentro de Docker |
|----------|-------------|------------------|
| MySQL    | localhost:3307 | mysql:3306 |
| API      | localhost:3000 | 3000 |

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