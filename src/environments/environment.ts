export const environment = {
    production: true,
    // URL base del backend. Por defecto same-origin: el frontend y la API se
    // sirven bajo el mismo host y un reverse proxy enruta `/api/*` al backend
    // (p. ej. Nginx: `location /api/ { proxy_pass http://backend; }`).
    // Si la API vive en otro origen (subdominio, otro host), reemplazar por la
    // URL absoluta del deploy, p. ej. 'https://api.dusck.com/api'.
    // NOTA (deuda): el render en servidor (SSR) de rutas publicas con `:id`
    // necesita una URL ABSOLUTA para resolver fetch en Node; ver
    // app.routes.server.ts (las listas publicas se sirven CSR por eso).
    apiUrl: '/api'
};
