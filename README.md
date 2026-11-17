# PriceRadar — PWA manual para GitHub Pages (beta)

**Guía de GitHub Pages y despliegue continuo:** consulta [`GITHUB_DEPLOY.md`](GITHUB_DEPLOY.md).

**Estado:** beta manual funcional en navegador, sin cuentas, sincronización ni fuentes automáticas. **No es la plataforma P0 completa del pliego 1.0.** Ningún precio ni disponibilidad está comprobado por una tienda: son registros aportados por el usuario. No se crean ofertas ficticias, no hay catálogos comerciales simulados y ninguna URL aportada se consulta desde un servidor.

## Qué se entrega

PWA estática responsive que funciona con navegador moderno y sirve el mismo código en móvil y escritorio; alta de productos y variantes exactas, fuentes manuales por producto, registro de nuevas observaciones con envío/impuestos/stock, comparador por variante exacta, gráficos y tabla histórica, cobertura de 30 días, objetivos, alertas internas de transición al incorporar una observación, filtros, modo oscuro/claro, exportación de observaciones CSV, backup JSON y restauración local JSON. Los datos se guardan de verdad en IndexedDB del navegador (no son fixtures, no residen en servidores ni se sincronizan entre dispositivos).

### Puesta en marcha en un ordenador

1. Descomprime el archivo completo, sin separar los subdirectorios.
2. Abre un terminal dentro de `priceradar-app`.
3. Ejecuta `python3 -m http.server 4173` (o utiliza cualquier servidor estático HTTPS que respete los MIME types de `.js`, `.svg` y `.webmanifest`).
4. Abre `http://localhost:4173`. Empieza en **Seguimiento → Añadir producto → Seguimiento manual**.
5. Para ejecutar pruebas unitarias, instala Node.js 20+ y ejecuta `npm test`. **`npm run build` crea una distribución estática en `dist/` y `npm run verify:dist` comprueba recursos. No hay dependencias npm externas**, por lo que no se necesitan `npm install`, `node_modules` ni lockfiles.

En iPhone: publicar en un origen HTTPS y abrir en Safari → Compartir → Añadir a pantalla de inicio. La edición local **no habilita Web Push**; los avisos se generan y consultan dentro de la aplicación. En escritorio, la PWA se puede instalar desde el navegador compatible después de servirla en HTTPS o `localhost`.

### Publicación estática opcional

La automatización de GitHub Actions empaqueta únicamente los recursos públicos en `dist/`. Consulta `GITHUB_DEPLOY.md` antes de subir. También puedes servir estos archivos tal cual desde GitHub Pages, Netlify, Vercel Static o un hosting HTTPS. No son necesarios procesos de compilación ni una API. Usa `index.html` como documento inicial, conserva `src`, `assets`, `sw.js`, `styles.css` y `manifest.webmanifest`. Las rutas se resuelven con hashes para funcionar en hosts estáticos. Si usas un subdirectorio, las rutas a assets son relativas; `manifest.start_url` y `serviceWorker.register('./sw.js')` también lo son.

**Privacidad del hosting:** si quieres privacidad de acceso a la aplicación, usa un hosting con autenticación de acceso; la edición local por sí misma no implementa login. Una PWA estática publicada sin restricción es visible para cualquiera, aunque cada visitante tendrá su propia base de datos IndexedDB separada en su navegador. No subas archivos JSON de tus datos al repositorio público.

## Arquitectura

```text
index.html + styles.css + assets/*  -> interfaz, marca y diseño responsive
src/app.js                           -> router hash + render + interacciones
src/core.js                          -> dominio puro de precios, métricas y alertas
src/storage.js                       -> IndexedDB, transacciones y export/import
sw.js                                -> caché estática para uso sin conexión
tests/core.test.mjs                  -> tests Node de reglas, validación, comparabilidad
supabase/schema.manual.draft.sql     -> diseño SQL para una futura edición cloud;
                                         NO desplegado / NO integrado
```

Los registros se crean exclusivamente a partir de formularios manuales. No hay servicios externos, credenciales de tienda, API ni cookies de analítica. Las ofertas de fuentes diferentes se mantienen separadas. `totalCents` devuelve `null` si faltan coste de envío o confirmación de impuestos; el precio del artículo no se presenta entonces como precio final. Las métricas de cobertura se basan en fechas de muestras disponibles, sin proclamar un mínimo histórico real o referencia legal de rebajas.

### Alertas locales

- Se disparan exclusivamente al añadir **una nueva observación** con importe comparable y cuando la condición pasa de falsa a verdadera y se respeta el cooldown. Se guardan en `events` y `notifications` junto a la observación, en una transacción IndexedDB.
- Soportado: precio total <= objetivo, bajada absoluta respecto de la muestra anterior de la misma oferta, bajada relativa en porcentaje y persistencia de eventos en el centro de avisos. El motor puro incorpora también evaluación de restock y menor precio entre muestras, pendientes de configurar desde UI.
- La regla inicial de objetivo no provoca un aviso retrospectivo inmediatamente por el precio inicial de alta; solo se evalúa con próximas observaciones.
- Seguimientos en pausa no evalúan nuevas notificaciones. Los datos registrados con fecha antigua no generan avisos de precio actual.
- La deduplicación de eventos a nivel de datos se realiza con una clave `regla:observación` única, sin un worker de red. No hay garantías transaccionales de servidor entre varios dispositivos, ya que no existe sincronización cloud.

## Advertencias de protección de datos

La información queda en el navegador en IndexedDB. Puede desaparecer al limpiar almacenamiento del sitio, activar ciertos modos privados, desinstalar o cambiar de dispositivo. Exporta regularmente a JSON y usa **Restaurar JSON** para recuperarla. El borrado completo limpia las tablas del usuario, pero no garantiza el borrado forense del disco o de copias de seguridad del sistema. No representa una cuenta de usuario ni sustituye backup/restore del backend.

No guardes notas con contraseñas ni datos financieros sensibles. Los enlaces a comercios son únicamente referencias manuales: al pulsarlos abandonas PriceRadar y se aplica la política del destino. No hay accesos a bancos, pagos ni automatizaciones comerciales.

## Qué falta respecto al pliego de producción

La versión cloud requiere crear y conectar un proyecto Supabase **nuevo y dedicado**, Supabase Auth, migraciones y RLS validadas con varias identidades reales, APIs de aplicación y auditoría, worker de fuentes legalmente autorizadas con backoff/idempotencia y métricas, servicio email/Web Push, observabilidad, cobertura E2E Playwright, una matriz de aceptación PR-01…PR-20 ejecutada en staging y despliegue de producción. Ninguno de esos hitos se afirma completado. `supabase/schema.manual.draft.sql` es solo un borrador de transición para revisión; no puede considerarse migración de producción ni reemplazar las pruebas RLS.

**No existe proveedor automático integrado, ni una API comercial seleccionada o aprobada, ni credenciales comerciales.** Amazon permanece sin soporte automático. Nunca presentes esta edición como monitorización en segundo plano.

## Próximo paso técnico

Tras disponer de infraestructura propia, migrar primero el almacenamiento personal sin cambiar la semántica de observaciones. Establecer autenticación, RLS, restauración y migraciones en staging; después pruebas E2E completas; por último seleccionar una primera fuente autorizada con contrato/documentación y adaptador específico. Ver `docs/ROADMAP.md` y `docs/ACCEPTANCE.md`.
