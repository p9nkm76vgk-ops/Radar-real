# PriceRadar — subir a GitHub y publicar con GitHub Pages

**Estado real:** beta de seguimiento MANUAL en IndexedDB. No hay proveedores automáticos, autenticación en servidor, sincronización, Web Push ni backend desplegado. Publicar esta edición no añade ninguna de esas capacidades.

## Pasos desde un ordenador (recomendado)

1. En GitHub, crea un repositorio llamado `PriceRadar`. Puedes dejarlo sin README inicial; el paquete ya lo incluye.
2. Extrae el ZIP de GitHub Ready en una carpeta. **La raíz del repositorio debe contener `index.html`, `src/` y `.github/workflows/pages.yml`** (no metas todo dentro de otra carpeta `priceradar-app`).
3. Abre Terminal en esa carpeta y ejecuta:

```bash
git init -b main
git add .
git commit -m "PriceRadar beta manual: PWA y despliegue Pages"
git remote add origin https://github.com/TU_USUARIO/PriceRadar.git
git push -u origin main
```

Cambia `TU_USUARIO` por tu cuenta. Para hacer push es necesario iniciar sesión en GitHub con el método admitido por Git / gestor de credenciales. No introduzcas contraseñas ni tokens dentro del código.

4. Abre tu repositorio en GitHub → **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. En **Actions** comprueba que el workflow **PriceRadar · Test y despliegue Pages** está habilitado. Si la publicación no se ejecutó después de activar Pages, entra al workflow y pulsa **Run workflow** en `main` (o haz un nuevo commit en `main`).
6. Cuando el job **Publicar GitHub Pages** finalice correctamente, abre `https://TU_USUARIO.github.io/PriceRadar/`. Si elegiste otro nombre de repo, cambia ese segmento de URL.
7. En iPhone, abre el sitio HTTPS desde Safari y pulsa **Compartir → Añadir a pantalla de inicio**. Los datos quedan guardados solo en ese navegador y ese origen.

## Sin usar terminal

También puedes crear el repositorio en GitHub y usar **Add file → Upload files**, subiendo **el contenido extraído** a la raíz del repositorio, incluida la carpeta oculta `.github` con `workflows/pages.yml`. Revisa que este fichero aparezca exactamente en `.github/workflows/pages.yml`: si falta, **no habrá despliegue automático**. En algunos dispositivos o navegadores la carga de carpetas ocultas es limitada; el método con Git es más fiable.

## Qué pasa al actualizar el repositorio

Un `git push` a `main` ejecuta comprobación sintáctica, 16 pruebas unitarias, construcción estática y verificación de recursos. Solo si pasan se sube el artefacto de Pages y se despliega. Las pull requests solo comprueban, **no publican**. No hay comando de push automático desde la app: el desarrollador publica cambios mediante Git.

No hay bundler ni instalación de dependencias. Para probar localmente desde una terminal:

```bash
npm run check
npm test
npm run build
npm run verify:dist
python3 -m http.server 4173
```

## Datos persistentes y privacidad

La instalación en GitHub Pages **no almacena información en GitHub** ni permite sincronizar dispositivos: la app usa IndexedDB de cada navegador. Al actualizar el código con el mismo origen URL, los datos suelen persistir; pueden perderse al limpiar datos del navegador, cambiar de URL o dispositivo. Haz una exportación JSON de la app antes de cambios grandes. Evita renombrar el repositorio si quieres conservar el mismo origen PWA y almacenamiento.

**Importante:** GitHub Pages es un sitio publicado; cualquier persona con acceso a la URL puede abrir la aplicación y utilizar su almacenamiento local independiente. No publiques aquí información personal, credenciales, claves de servicio ni archivos JSON de tus productos. La app no tiene login. En repositorios privados, comprueba las condiciones de disponibilidad de GitHub Pages según tu plan: un repositorio privado no equivale a un sitio Pages con acceso restringido.

## Cómo funciona el workflow

- `.github/workflows/pages.yml`: CI en pull requests y cada push a `main`, CD a Pages solo desde `main`.
- `scripts/build.mjs`: copia únicamente la app pública a `dist/`, excluyendo pruebas, SQL y documentación.
- `scripts/verify-dist.mjs`: comprueba recursos PWA y URLs relativas para despliegue en subruta.
- `.nojekyll`: desactiva el procesado Jekyll innecesario.

Si Actions muestra un error de permisos, comprueba **Settings → Actions → General**, que Actions esté habilitado, y **Settings → Pages → Source = GitHub Actions**. Consulta el error concreto antes de cambiar permisos. El workflow usa permisos mínimos para el job de despliegue (`pages: write`, `id-token: write`).

Referencias oficiales: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site y https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
