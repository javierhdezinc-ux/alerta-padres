# P2 — Desarrollo real v1

## Base protegida

- `app.html` permanece sin modificaciones.
- `app-dev.html` es una envoltura ligera que reutiliza `app.html` sin copiarlo ni modificarlo y añade la capa real de desarrollo.
- `app.html` y `app-13.html` eran idénticos al iniciar este trabajo.

## Conexión implementada

`app-dev.html` incorpora una entrada separada **CANAL REAL · DESARROLLO**. Esta capa:

1. autentica con Supabase Auth;
2. recupera la membresía y escuela del usuario;
3. recupera una conversación autorizada por RLS;
4. lee y escribe mensajes en el backend;
5. registra lectura en `message_reads`;
6. escucha nuevos mensajes por Realtime;
7. mantiene intacto el demo original basado en `localStorage`.

## Seguridad

- Solo se usa la clave pública/publishable en el navegador.
- No se incorpora ninguna clave secreta o `service_role`.
- La autorización efectiva depende de las políticas RLS ya existentes.
- No se han cargado datos personales ni cuentas reales.
- La base de datos de desarrollo tenía RLS activo en todas las tablas y el asesor de seguridad no reportó hallazgos al revisar el 26-sep-2026.
- La migración `20260926185036_least_privilege_and_read_receipts` eliminó privilegios anónimos y redujo los permisos autenticados a las operaciones indispensables.
- El remitente y Dirección pueden consultar confirmaciones de lectura; un tercero no autorizado no puede hacerlo.

## Verificaciones ejecutadas

- `node --check real-channel.js`: aprobado.
- Prueba anónima contra `schools`: HTTP 200 con lista vacía, sin fuga de filas.
- Asesor de seguridad después de la migración: cero hallazgos.
- Revisión de permisos después de la migración: solo privilegios mínimos declarados.
- Revisión visual automatizada: pendiente; el navegador de Playwright no pudo descargarse en este entorno.

## Pendiente para la prueba entre dos dispositivos

- Crear cuentas de prueba controladas: Dirección, Padre autorizado y Usuario no autorizado.
- Asociarlas a una escuela, alumno y conversación ficticios.
- Probar envío, recepción, apertura y rechazo de acceso desde dispositivos distintos.
- Guardar evidencia de cada paso.

## Criterio de avance

No publicar ni sustituir `app.html` hasta que la prueba de dos dispositivos y el acceso no autorizado estén aprobados.
