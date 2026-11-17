# Informe de aceptación de la edición local manual — 17/11/2026

**Alcance real:** beta manual offline. Matriz PR-01…PR-20 del pliego NO superada como conjunto, por lo que no se considera PriceRadar P0 de producción.

| ID | Estado de esta entrega | Evidencia / bloqueo |
|---|---|---|
| PR-01 | Implementado, E2E pendiente | Estado vacío y alta manual. La modalidad URL automatizada se explica como no disponible. |
| PR-02 | Implementado en arquitectura local, E2E pendiente | No hay código para fetch a URLs de usuarios ni servidor de extracción. |
| PR-03 | Implementado, E2E pendiente | Dos observaciones se persisten y se enumeran con fecha y fuente manual. |
| PR-04 | Pendiente | No hay proveedor externo y las variantes se crean manualmente. |
| PR-05 | Cubierto por test unitario | Comparador devuelve `null` para total sin envío, no declara mejor total. |
| PR-06 | No aplicable / pendiente | No existen proveedores externos, ni polling. |
| PR-07 | Cubierto por test unitario, E2E pendiente | Regla objetivo pasa de falso a verdadero y genera evento interno al añadir una muestra. |
| PR-08 | Parcial | IndexedDB guarda evento y notificación en una transacción local; no existe worker paralelo. |
| PR-09 | Cubierto por test unitario | El estado de condición evita alertas repetidas. |
| PR-10 | Cubierto por test unitario | Cobertura insuficiente: mediana de 30 días no declarada fiable; no aparece «mínimo histórico». |
| PR-11 | Parcial | URLs HTTPS públicas validadas y abiertas con `rel=noopener`; no hay resolución HTTP remota. Revisar estrategia de URL canónica en backend. |
| PR-12 | Pendiente | No hay usuarios ni RLS desplegada; el SQL cloud es borrador. |
| PR-13 | Pendiente | No existe Web Push; in-app sigue disponible. |
| PR-14 | Pendiente | No existen conectores que revocar. |
| PR-15 | Pendiente | No hay solicitudes a proveedores ni rate limit. |
| PR-16 | Parcial | Exportación JSON/CSV, importación JSON y borrado local. No hay cuentas ni backend. |
| PR-17 | Parcial, sin prueba física | Manifest + service worker; Web Push iOS pendiente. |
| PR-18 | Parcial | CSS desde 320 px, teclas focus-visible, reduce-motion y tabla para gráficos; auditoría WCAG y lectores de pantalla pendientes. |
| PR-19 | Cumple por diseño local | No hay fixtures como tienda real. |
| PR-20 | No cumple | Ningún proveedor real aprobado/integrado. |

## Pruebas ejecutadas

- `npm test` (Node.js): 16/16 tests unitarios superados de moneda, totales conocidos, comparabilidad, target, caída absoluta, caída porcentual, deduplicación de alertas, stock, mínimo observado, cobertura, URL y escape HTML/CSV.
- `npm run check`: sintaxis ECMAScript de los tres módulos superada.
- No se pudieron ejecutar pruebas funcionales Playwright con navegación al servidor local en este entorno por bloqueo del navegador (`ERR_BLOCKED_BY_ADMINISTRATOR`). Esa limitación no es una prueba exitosa, y se requiere ejecutar E2E real antes de producción.
- El esquema Supabase adjunto no se ejecutó ni se sometió a asesores de seguridad de Supabase porque no había un proyecto dedicado autorizado.

## Principales defectos / límites abiertos

1. Sin cuentas, autenticación, acceso remoto, sincronización, recuperación cloud o RLS en ejecución.
2. Sin fuentes de precios comerciales aprobadas. No se monitoriza nada automáticamente.
3. Email/Web Push, reportes automáticos y la mayoría de variantes de alertas P0 no están operativos.
4. No hay tests E2E completados ni auditoría WCAG 2.2 AA; faltan pruebas iOS/Android reales.
5. Gráficos y datos de fecha dependen de la configuración temporal del dispositivo en alta de muestra, aunque la presentación usa Europe/Madrid.
6. La deduplicación de observaciones manuales repetidas no equivale a idempotencia de workers comerciales.
7. Copias JSON locales pueden contener datos manipulados si se editan externamente: valida origen antes de restaurar; no importar archivos ajenos.
