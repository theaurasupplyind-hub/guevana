# DHUB Mobile

Cliente Android Expo para el backend de DHUB.

## Desarrollo en LAN

1. Arranca el backend en el PC:

```bash
node electron/run-server.cjs
```

2. Copia `.env.example` a `.env` y cambia `EXPO_PUBLIC_API_URL` por la IP LAN del PC, por ejemplo `http://192.168.1.100:3001`.
3. Instala dependencias y arranca Expo:

```bash
cd mobile
npm install
npx expo start
```

El telefono y el PC deben estar en la misma red.

## Render

Cuando el backend este desplegado, cambia la variable a la URL HTTPS de Render:

```text
EXPO_PUBLIC_API_URL=https://<servicio>.onrender.com
EXPO_PUBLIC_API_TOKEN=<AUTH_TOKEN-si-se-configuro>
```

## APK

Requiere EAS CLI y una cuenta Expo:

```bash
cd mobile
npx eas login
npx eas build -p android --profile preview
```

Para el build remoto, configura también en `expo.dev` → proyecto `dhub` → Environment Variables:

- `EXPO_PUBLIC_API_URL` = `https://guevana.onrender.com` (ya configurada en EAS)
- `EXPO_PUBLIC_API_TOKEN` = el mismo valor de `AUTH_TOKEN` de Render, como variable `sensitive`

El archivo `.env` local sirve para desarrollo, pero no debe contenerse en git ni usarse como único origen para el build cloud.

El perfil `preview` genera un APK para distribucion directa.
