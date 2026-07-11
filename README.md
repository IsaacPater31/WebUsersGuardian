# Users Web (panel web)

Aplicación web pensada como **panel de control y administración** (comunidades, operadores, etc.), alineada en el futuro con la lógica del ecosistema móvil Guardian.  
Este README es breve a propósito; el alcance y el detalle de producto se irán definiendo en el repo.

## Producción (Vercel + Firebase)

Ver **[DEPLOY.md](./DEPLOY.md)** para:

- Rewrite SPA (`vercel.json`) — sin 404 al recargar `/communities`, etc.
- Autorizar `web-users-guardian.vercel.app` en Firebase / Google OAuth
- Variables `VITE_FIREBASE_*` en Vercel

