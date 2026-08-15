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

El perfil `preview` genera un APK para distribucion directa.
