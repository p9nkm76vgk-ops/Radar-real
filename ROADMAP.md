# Hoja de ruta de la edición cloud (pendiente)

## M0 — Infraestructura segura

Crear repositorio privado o público para el código (nunca incluir credenciales, dumps personales ni archivos de backup), proyecto Supabase dedicado de staging y otro de producción, hosting Next.js con HTTPS, dominios, env separados y CI. Supabase CLI actual requiere seguir instrucciones propias de la versión: no aplicar el esquema draft sobre proyectos ajenos. Versionar y revisar migraciones, roles y RLS con tests entre usuarios distintos. Habilitar backups y probar restauración.

## M1 — Persistencia sincronizada y Auth

Migrar manual_products, fuentes, observaciones, colecciones y reglas a modelos autenticados; conservar variantes y datos de procedencia. Implementar email OTP/magic link con rate limiting, validación de sesiones del lado servidor y salida de sesión. Importación desde JSON local con validación del usuario y análisis de límites, idempotencia y revisión de conflictos. Proteger APIs y contenido con RLS y límites por usuario. Trigger o backend transaccional para crear eventos y notificaciones en la misma transacción que observaciones. Escribir tests E2E y RLS negativos.

## M2 — Fuentes reales con licencias

Identificar proveedor externo por acuerdo explícito, registrar base de autorización, retención, atribución, cuotas, condiciones de uso, resolución de URLs y región. Construir interfaz PriceProvider y adaptador, con allowlist y defensa SSRF (nunca fetch arbitrario). Desplegar cron con cola, leases, backoff, idempotencia por oferta/ventana y health status. Deshabilitar ante 403/429 repetidos, revocación o vencimiento. Usar fixtures solo en staging. Mantener segregados proveedores y registros manuales.

## M3 — Alertas y comparador multi-origen

Comparar por variante, condición, país, moneda, vendedores y costes; no confundir base con total. Notificaciones internas, email validado y push permitido; quiet hours Europe/Madrid; outbox idempotente. Histórico por fuente, métricas de cobertura y exportación respetando licencias. Procesos para revocación/caducidad de datos. Funciones de supervisión y coste por fuente.

## M4 — Aceptación y salida

Ejecutar 20 criterios PR-01…20 en staging con evidencia, automatizar ≥90 % del núcleo de reglas y todos los recorridos P0, QA en iPhone PWA, Android y escritorio, pruebas WCAG 2.2 AA, restauraciones y caída del proveedor. No activar mensaje comercial de rastreo automático hasta superar PR-20 con fuente autorizada y consultas de prueba. Preparar política de privacidad específica de producción y lista de encargados.
