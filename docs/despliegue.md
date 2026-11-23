# Despliegue publicado

La app se publica sola en Vercel cada vez que cambia el código en GitHub.

| Ambiente | Rama | Dirección | Para qué |
|---|---|---|---|
| **Producción** | `main` | **https://bitacora-ito.vercel.app** | Versión oficial. Abre desde cualquier navegador o teléfono, sin cuenta. |
| **Vista previa** | `dev` | https://bitacora-ito-git-dev-bitacora-ito.vercel.app | Probar cambios antes de pasarlos a `main`. No tiene claves de base de datos ni de correo, así que sirve para revisar pantallas, no para enviar. |

## Evidencia (revisado el 21-11-2026)

1. **La app abre fuera del equipo.** En https://bitacora-ito.vercel.app aparece la pantalla de ingreso con los 5 usuarios de prueba (3 inspectores, jefe de turno y administrador). Clave de la maqueta: `1234`.
2. **El servidor está configurado.** https://bitacora-ito.vercel.app/api/salud responde `"ok": true` en `production`: correo, Supabase y PDF listos, y 2 destinatarios autorizados. Esta página no muestra las claves, solo si están cargadas.
3. **El flujo completo funciona.** El video muestra al inspector registrando, firmando y enviando, y el correo que llega con el PDF.
4. **La vista previa de dev también abre sin cuenta.** Se quitó la protección de Vercel el 21-11-2026; como dev no tiene claves, no expone datos ni envía correos.

## Cómo llega un cambio a producción

1. Se sube el cambio a la rama `dev`. Vercel arma la vista previa.
2. Se revisa la vista previa.
3. Se abre un pull request de `dev` a `main` y se acepta. Vercel publica la nueva versión en producción en 1 o 2 minutos.
