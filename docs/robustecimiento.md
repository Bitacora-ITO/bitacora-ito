# Robustecimiento funcional · Bitácora ITO

**Fecha:** 27-11-2026 · **Objeto principal:** el registro de avance (pantalla «Registrar avance», la más usada por el inspector).
**Base:** propuesta del equipo «Reglas, mensajes y pruebas de rotura» (borrador del 27-11-2026, revisado con Marcela y Alejandra).

La versión probada es la de la rama `dev` con los pasos 1 a 7 aplicados. Este documento reúne las cuatro piezas del entregable: la operación principal, la lista de reglas, los mensajes y estados, y los intentos de rotura.

---

## 1. Operación principal sobre el registro de avance

| Operación | Dónde | Estado |
|---|---|---|
| Crear | «Guardar registro» | Ya existía; ahora valida largo de la descripción y máximo de fotos |
| Leer | Turno («N de M resueltos»), lista «Registrado hoy en esta área», borrador, PDF e historial | Ya existía |
| Actualizar | «Editar» en cada registro | Ya existía |
| Borrar | «Quitar» | **Nuevo: borrado lógico.** El registro y sus fotos pasan a la lista «Quitados de esta área», con la hora en que se quitaron, y se pueden **restaurar** mientras el reporte siga editable |

Lo quitado no aparece en el turno, en el conteo «N de M resueltos», en el PDF ni se sube a la nube. No se puede restaurar si el área ya salió del turno o quedó declarada «sin actividad»; en ese caso la app explica por qué.

**Decisión:** la marca de «quitado» se conserva en el teléfono. Conservarla también en la nube exige cambiar la sincronización y la consolidación del jefe de turno; queda pendiente (sección 5).

## 2. Reglas del registro de avance y las tres capas

Las reglas viven en un solo archivo, `src/lib/reglas.ts`, que usan el formulario y el guardado. La base de datos las repite en `supabase/migrations/0003_reglas_registro.sql`.

| Campo | Regla | Mensaje exacto | Navegador | Al guardar (app) | Base de datos |
|---|---|---|---|---|---|
| Fotografía | Obligatoria si hubo trabajos | «Toma al menos 1 fotografía del avance.» | ✅ | ✅ | — |
| Fotografía | Máximo 10 por registro (las alertas no tienen tope) | «Puedes adjuntar hasta 10 fotos por registro.»; el botón muestra «10 de 10 fotos» antes de abrir la cámara | ✅ | ✅ | ✅ (trigger) |
| Fotografía | Solo JPEG, PNG o WEBP, hasta 10 MB | — | — | — | ✅ (bucket `fotos`) |
| Empresa | Obligatoria | «Elige la empresa.» | ✅ | ✅ | ✅ |
| Descripción | Obligatoria si hubo trabajos | «Dicta o escribe qué se avanzó.» | ✅ | ✅ | ✅ (CHECK) |
| Descripción | De 5 a 500 caracteres, sin contar espacios al inicio y al final; contador «N/500» | «Escribe al menos 5 caracteres.» / «Máximo 500 caracteres (llevas N).» | ✅ | ✅ | ✅ (CHECK) |
| ¿Hoy NO hubo trabajos? | Con «sí», no lleva descripción ni fotos | (pide confirmar si ya hay avance escrito) | ✅ | ✅ | ✅ (CHECK) |
| Ubicación GPS | Las dos coordenadas o ninguna; latitud −90 a 90, longitud −180 a 180 | «Sin GPS: activa la ubicación (se guarda igual)» | Precargada | Precargada | ✅ (CHECK) |
| Hora del registro | No más de 10 minutos en el futuro (tolerancia para un reloj adelantado); se valida la hora del registro, no la de sincronización | «La hora del registro está en el futuro. Revisa la fecha y hora del teléfono.» | Automática | Automática | ✅ (trigger) |

**Capa servidor.** Hoy el teléfono guarda los registros directo en Supabase y Vercel solo envía el correo. Un paso intermedio en Vercel solo protege si además se cierran las escrituras directas a la base, que hoy están abiertas para la maqueta. Por eso la regla queda en la base de datos, que aplica a todos, incluso a quien se salta la app, y la capa servidor queda pendiente para la semana 10 (quién puede escribir qué).

**Prueba de la base de datos.** La migración 0003 se probó en un Postgres con el esquema real del proyecto (migraciones 0001 y 0002):

| Caso | Resultado |
|---|---|
| Descripción vacía, de 3 o de 501 caracteres | Rechazada |
| Descripción de 500 caracteres con tildes | Aceptada |
| «Sin actividad» sin texto / con texto | Aceptada / Rechazada |
| GPS con una sola coordenada, latitud 95 o longitud 200 | Rechazado |
| Hora 5 minutos adelantada / 1 hora en el futuro / de ayer (registro sin señal) | Aceptada / Rechazada / Aceptada |
| Foto número 11 en un registro | Rechazada: «Puedes adjuntar hasta 10 fotos por registro.» |
| Volver a subir una foto que ya existe (sincronización) | Aceptada |
| Ejecutar la migración dos veces | Sin error |

## 3. Mensajes y estados

**Pantalla Turno (la más usada):**

| Estado | Qué ve el inspector |
|---|---|
| Cargando | «Cargando el turno…» con ícono girando |
| Vacío | «Primer día del contrato. Aún no hay áreas…» + «Agregar primera área» |
| Con datos | Áreas con su estado y «N de M resueltos» |
| Error | **Nuevo:** «No se pudo cargar el turno» + «Intenta de nuevo. Si el problema sigue, cierra la app y vuelve a abrirla.» + botón «Reintentar». Antes mostraba un texto técnico sin salida |

**Textos técnicos reemplazados por mensajes propios:**

| Dónde | Antes | Ahora |
|---|---|---|
| Cámara | «No se pudo abrir la cámara: (error técnico)» | «No se pudo abrir la cámara. Revisa el permiso de cámara e intenta de nuevo.» |
| Dictado | «No se pudo dictar: (error técnico)» | «No se pudo usar el dictado. Escribe la descripción.» y cambia solo a «Escribir» |
| Entregar la parte | El error técnico de la subida | «No se pudo subir a la nube. Tu parte quedó guardada en el teléfono.» |
| Registro inexistente | Abría un formulario vacío sin avisar | «Este registro no existe o fue quitado.» + «Volver al turno» |

El error técnico no se pierde: queda en la consola para quien programa.

## 4. Intentos de rotura

Se ejecutaron en la app con un navegador automático, en tamaño de teléfono (390 × 844). Los intentos 1 a 5 son los de la pauta; 6 a 8 son complementarios.

| N.º | Intento | Cómo se probó | Resultado | Captura |
|---|---|---|---|---|
| 1 | Campo obligatorio vacío | Guardar con foto y sin descripción | No guarda: «Falta 1 dato para guardar» y «Dicta o escribe qué se avanzó.» junto al campo | [01](robustecimiento/01-campo-vacio.png) |
| 2 | Enviar dos veces | Dos toques sobre «Guardar registro» en el mismo instante | **Encontró un error:** se guardaba dos veces (quedaban 2 registros iguales), porque el botón se desactivaba recién al volver a dibujar la pantalla. **Corregido** en Registrar avance y Nueva alerta: ahora se guarda una sola vez («Registrado hoy en esta área (1)») | [02](robustecimiento/02-enviar-dos-veces.png) |
| 3 | Texto larguísimo | Pegar 800 caracteres | No guarda: contador «800/500» en rojo y «Máximo 500 caracteres (llevas 800).» El texto pegado se conserva para recortarlo | [03](robustecimiento/03-texto-larguisimo.png) |
| 4 | Sin conexión | Guardar sin señal (el teléfono informa que no hay red y se bloquea el acceso a internet) | Antes de guardar avisa «Sin señal: se guarda y sincroniza después». Guarda en el teléfono; el Turno muestra «Por sincronizar» y «Sin señal · 2 registros se enviarán solos» | [04](robustecimiento/04-sin-conexion.png) |
| 5 | Registro que no existe | Abrir un enlace con un código inventado | «Este registro no existe o fue quitado.» + «Volver al turno». Antes abría un formulario vacío | [05](robustecimiento/05-registro-inexistente.png) |
| 6 | Foto vertical | PDF con una foto vertical de prueba (bordes y marcas arriba y abajo) | La foto se ve completa en el PDF, con fondo gris a los lados. Antes se cortaba arriba y abajo | [06](robustecimiento/06-foto-vertical-pdf.png) |
| 7 | Más fotos que el máximo | Intentar tomar 12 fotos | Al llegar a 10, el botón muestra «10 de 10 fotos» y se desactiva antes de abrir la cámara: «Llegaste al máximo de 10 fotos. Quita una para tomar otra.» | [07](robustecimiento/07-mas-de-10-fotos.png) |
| 8 | Descripción demasiado corta | Escribir 1 carácter | No guarda: «1/500» y «Escribe al menos 5 caracteres.» Con «¿Hoy NO hubo trabajos?» marcado no se exige | [08](robustecimiento/08-descripcion-corta.png) |

## 5. Pendientes

| Pendiente | Por qué | Cuándo |
|---|---|---|
| Capa servidor para los registros | Exige crear la ruta en Vercel, cambiar la sincronización y cerrar las escrituras directas a Supabase | Semana 10 (permisos) |
| Conservar lo quitado también en la nube | Exige una columna nueva y cambiar la sincronización y la consolidación del jefe de turno | Semana 10 |
| Clave de ingreso única (`1234`) y permisos abiertos de la maqueta | Cualquiera con la clave pública de la app puede leer y escribir la base | Semana 10, con Supabase Auth |
| Aplicar la migración 0003 en Supabase | Subirla a GitHub no la aplica: se ejecuta en el SQL Editor del proyecto | Al publicar esta versión |

## 6. Archivos modificados

| Paso | Archivos |
|---|---|
| 1 · Largo de la descripción | `src/lib/reglas.ts` (nuevo), `src/lib/repositorio.ts`, `src/components/CampoDescripcion.tsx`, `src/app/registrar/page.tsx` |
| 2 · Máximo 10 fotos | `src/components/SelectorFotos.tsx`, `src/lib/repositorio.ts`, `src/app/registrar/page.tsx` |
| 3 · Registro inexistente | `src/app/registrar/page.tsx` |
| 4 · Mensajes propios | `src/app/page.tsx`, `src/app/enviar/page.tsx`, `src/components/SelectorFotos.tsx`, `src/components/CampoDescripcion.tsx` |
| 5 · Foto vertical en el PDF | `src/lib/informe/componentes/DocumentoBitacora.tsx` |
| 6 · Borrado lógico | `src/lib/types.ts`, `src/lib/db.ts`, `src/lib/repositorio.ts`, `src/app/registrar/page.tsx` |
| 7 · Reglas en la base | `supabase/migrations/0003_reglas_registro.sql` (nuevo) |
| 8 · Doble toque | `src/app/registrar/page.tsx`, `src/app/alerta/page.tsx` |
