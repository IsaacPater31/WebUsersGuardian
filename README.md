# Users Web (panel web)

Aplicación web pensada como **panel de control y administración** (comunidades, operadores, etc.), alineada en el futuro con la lógica del ecosistema móvil Guardian.  
Este README es breve a propósito; el alcance y el detalle de producto se irán definiendo en el repo.

## Requisitos

- Node.js LTS
- npm

## Arranque local

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
# Completa las variables en .env según tu entorno
npm run dev
```

## Scripts

| Comando | Uso |
|--------|-----|
| `npm run dev` | Desarrollo |
| `npm run build` | Build producción |
| `npm run preview` | Vista previa del build |
| `npm run lint` | ESLint |

## Git remoto

Tras crear el repositorio en tu hosting (GitHub, etc.):

```bash
git remote add origin <url-del-repo>
git branch -M main
git push -u origin main
```

**No subas** archivos `.env` con secretos; usa solo `.env.example` como plantilla.
