# Deploy Vercel + Firebase (Users Web)

## 1. SPA: evitar 404 al recargar rutas

Este repo incluye `vercel.json` con rewrite a `index.html`. Tras redeploy:

- `https://web-users-guardian.vercel.app/communities` (y cualquier ruta React) no debe devolver 404 al F5.

Si el proyecto en Vercel ya existía, haz un nuevo deploy para que tome `vercel.json`.

## 2. Autorizar el dominio en Firebase (Google Auth + cliente)

Sin esto, Google login falla con `auth/unauthorized-domain`.

### Firebase Console

1. Abre el proyecto Firebase del app.
2. **Authentication → Settings → Authorized domains**.
3. **Add domain**: `web-users-guardian.vercel.app`  
   (sin `https://`, sin `/login`).
4. Guarda. Dominios típicos que deben quedar:
   - `localhost`
   - `*.firebaseapp.com` / el de tu proyecto
   - `web-users-guardian.vercel.app`

Firestore, Auth y Storage no filtran por dominio de hosting: con el usuario autenticado y las Security Rules, el resto de Firebase ya funciona desde ese origen.

### Google Cloud (OAuth Web client)

Si tras autorizar el dominio Google sigue fallando (`redirect_uri_mismatch` / popup):

1. [Google Cloud Console](https://console.cloud.google.com/) → mismo proyecto que Firebase.
2. **APIs & Services → Credentials → OAuth 2.0 Client IDs** (cliente Web de Firebase).
3. **Authorized JavaScript origins** — agrega:
   - `https://web-users-guardian.vercel.app`
   - `http://localhost:5173` (dev Vite, si aplica)
4. **Authorized redirect URIs** — agrega (por si usas redirect/handler):
   - `https://<TU_PROJECT_ID>.firebaseapp.com/__/auth/handler`
   - (opcional) `https://web-users-guardian.vercel.app/__/auth/handler` solo si configuras proxy/`authDomain` custom

Este panel usa **popup** (`signInWithPopup`); en la mayoría de casos basta **Authorized domains** + **JavaScript origins**.

## 3. Variables de entorno en Vercel

Project → Settings → Environment Variables (Production):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN` → normalmente `<projectId>.firebaseapp.com` (no hace falta cambiarlo al dominio de Vercel para popup)
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Redeploy después de cambiar env o `vercel.json`.

## 4. Checklist rápido

- [ ] `vercel.json` desplegado
- [ ] F5 en `/communities`, `/reports`, `/alerts` → app (no 404)
- [ ] Dominio en Firebase Authorized domains
- [ ] Origen JS en Google OAuth (si hace falta)
- [ ] Env `VITE_*` en Vercel
- [ ] Login Google en `https://web-users-guardian.vercel.app/login`
