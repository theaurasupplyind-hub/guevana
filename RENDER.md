# DHUB API en Render

## Servicio

Crear un Web Service desde el repositorio `guevana` usando el `render.yaml` de la raiz.

- Build: `npm ci --omit=dev`
- Start: `node electron/run-server.cjs`
- Health check: `/healthz`
- Plan inicial: `Free`
- Auto Deploy: desactivado; publica manualmente desde el dashboard cuando quieras actualizar el backend.

Render inyecta `PORT`; el servidor escucha en `0.0.0.0` automaticamente.

## Token

Define `AUTH_TOKEN` en Render para proteger las rutas. Las peticiones de la app deben enviar:

```text
X-Auth-Token: <valor>
```

`/healthz` queda publico para UptimeRobot.

## UptimeRobot

Configura un monitor HTTP(S) contra:

```text
https://<servicio>.onrender.com/healthz
```

Un intervalo de 5 minutos evita el sleep habitual del plan Free mientras el monitor este activo.

## Escritorio

La aplicacion Electron no usa este servicio: continua arrancando su backend local en `127.0.0.1:3001`.

## Limitacion

El servicio Node no tiene `BrowserWindow`. Los scrapers que requieren captura Electron, como algunos embeds de PelisXD, pueden no resolver streams en Render. PelisPlus, zonaaps, jkanime y sus resolvers HTTP siguen disponibles.
