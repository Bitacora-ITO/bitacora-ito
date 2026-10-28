# Análisis ético, de sostenibilidad e impacto preliminar

**Proyecto:** Bitácora - ITO
**Fecha:** 28 de octubre de 2026
**Base:** Apunte 4.1 del curso (Tabla 1), estructura de datos v2 ([01-estructura-datos.md](01-estructura-datos.md)), historias de usuario ([historias.md](historias.md)) y código de la aplicación en `src/`.
**Estado:** preliminar. Se revisa en cada entrega: al probar con inspectores, al implementar la seguridad y al pasar a piloto (semana 13).

---

## 0. La tercera pregunta

Hasta ahora el proyecto respondió *¿se entiende?* (prototipo navegable) y *¿funciona?* (flujo principal). Este documento responde **¿a quién deja fuera?** y deja por escrito, para que otra persona las pueda revisar, decisiones que hasta ahora eran implícitas.

Dos aclaraciones de partida:

1. **Bitácora - ITO automatiza la redacción, no el juicio.** El sistema arma el reporte con lo que el inspector registró, pero no decide qué se observa, qué es una alerta ni qué criticidad tiene. Toda alerta y su criticidad las indica el inspector, y el reporte solo se envía después de que él lo revisa en la vista previa y lo aprueba (reglas de negocio 5 y 9).
2. **Dónde interviene procesamiento automático.** Hoy son dos puntos: el **dictado por voz**, que transcribe el servicio de reconocimiento de voz del teléfono (idioma `es-CL`), y el **armado del reporte en PDF**, que sigue una plantilla fija con el formato del mandante. Ninguno de los dos usa un modelo de IA generativa. Si en el futuro se agrega uno (por ejemplo, para resumir el turno), este análisis debe actualizarse antes de activarlo.

---

## 1. Mapa de impacto y exclusión

### 1.1 Qué cambia para cada actor

| Actor | Qué deja de hacer | Cómo cambia su rol | Qué riesgo aparece |
|---|---|---|---|
| **Inspector técnico de terreno** (quien ejecuta) | Redactar el reporte en gabinete al final del turno, transcribir notas de libreta y ordenar fotos a mano | Pasa a **registrar en el momento** y a **revisar y aprobar** un borrador ya armado. Su trabajo de gabinete se vuelve revisión, no redacción | **Sesgo de automatización:** aprobar el PDF sin leerlo porque "lo armó el sistema". Pérdida de la práctica de redactar y de sintetizar el turno. Sensación de control por la ubicación y la hora de cada registro |
| **Jefatura de inspección** (quien supervisa) | Pedir el reporte por teléfono o correo y armar a mano el calendario de entregas | Configura el contrato (catálogo de áreas, empresas, destinatarios) y supervisa con el **historial** | Usar el historial y el GPS como herramienta de **vigilancia del desempeño** en vez de constancia del turno. Un catálogo de áreas desactualizado obliga al inspector a registrar en un área equivocada |
| **Mandante minero** (quien recibe) | Esperar el reporte hasta el día siguiente y reclamar por la demora | Recibe el reporte el mismo día, con fotos ubicadas y hora de captura | Confiar en exceso en un reporte "con apariencia digital" y revisar menos lo que dice |
| **Empresas contratistas y laboratorios** (TECNASIC, GEOINYECTA, IDIEM, OOCC) | Nada; no usan la aplicación | Aparecen nombradas en registros y alertas, y sus trabajadores pueden salir en las fotografías | **Quedan fuera:** son evaluadas en un documento que no ven ni pueden comentar antes del envío |
| **Trabajadores de faena** fotografiados | Nada; no usan la aplicación | Su imagen queda en el anexo fotográfico del reporte | **Quedan fuera:** no saben que su imagen se guarda ni quién la ve |

### 1.2 Trabajo nuevo que la automatización crea

Automatizar redistribuye tareas, no elimina el rol. Estas tareas nuevas deben tener un responsable con tiempo asignado:

| Trabajo nuevo | Responsable propuesto | Cómo se sostiene |
|---|---|---|
| Revisar el PDF antes de aprobar | Inspector | La aprobación solo se da desde la vista previa (regla 9). Se propone medir el tiempo entre generación y aprobación: si es casi cero de forma sistemática, es una señal de aprobación sin revisión |
| Mantener el catálogo de áreas y empresas del contrato | Jefatura de inspección | Revisión semanal del catálogo; dar de baja áreas terminadas (`vigente = false`) |
| Corregir dictados mal transcritos | Inspector | Botón «Repetir dictado» y edición manual del texto (HU-02) |
| Atender reclamos del mandante o de un contratista sobre el contenido de un reporte | Jefatura de inspección | Un reporte enviado no se edita; la corrección genera un nuevo envío con trazabilidad (regla 7) |
| Formar a inspectores que no usan habitualmente el teléfono para trabajar | Empresa de inspección | Inducción breve en el piloto y manual de uso |

### 1.3 Quién queda fuera

| Quién | Por qué queda fuera | Qué hacemos |
|---|---|---|
| Inspector **sin señal** en terreno | Faenas mineras con cobertura parcial | La app funciona sin conexión: guarda en el teléfono y sincroniza después, conservando la hora original del registro (regla 6) |
| Inspector con **dificultad para dictar** (ruido de faena, mascarilla, acento, dificultad del habla) | El reconocimiento de voz falla más con ruido y con ciertas formas de hablar | Siempre existe la opción **Escribir**; el dictado nunca es obligatorio |
| Inspector con **poca familiaridad digital** o mayor edad | El canal supone costumbre de usar el teléfono | Flujo de 5 pantallas, botones grandes (44 px) y prueba con usuarios reales en el MVP (semana 12) |
| Inspector **con guantes o con sol directo** sobre la pantalla | Condiciones de terreno | Objetivos táctiles de 44 px y alto contraste (ver §3.2) |
| Inspector del **turno noche** | El prototipo se diseñó mirando el turno día | Validar el flujo en turno noche durante el piloto |
| Contratistas y trabajadores fotografiados | No son usuarios del sistema | Ver §2: aviso en faena, foto enfocada en la obra y no en las personas |

---

## 2. Ficha de tratamiento de datos personales

Base legal de referencia: **Ley 21.719** de protección de datos personales, que rige desde el **1 de diciembre de 2026**, y los derechos ARCOP (acceso, rectificación, cancelación, oposición y portabilidad). Criterio aplicado: **privacidad desde el diseño**: un campo que no se creó no necesita protegerse. Esta ficha acompaña a la [estructura de datos](01-estructura-datos.md).

### 2.1 Campos con datos personales

| Entidad.campo | Dato personal | Finalidad | Quién lo ve | Cuánto se conserva | ¿Es el mínimo necesario? |
|---|---|---|---|---|---|
| `usuario.nombre` | Nombre del inspector | Firmar el reporte («Elaborado por») | Inspector, jefatura, mandante (en el PDF) | Mientras dure el contrato, más el plazo de conservación del reporte | Sí: el formato del mandante lo exige |
| `usuario.correo` | Correo laboral | Iniciar sesión y recibir copia del envío | Inspector, administrador | Mientras la cuenta esté activa; se elimina al dar de baja la cuenta | Sí. Debe ser correo laboral, no personal |
| `usuario.rol` | Cargo en el sistema | Dar permisos | Administrador | Igual que la cuenta | Sí |
| `rol_turno` (`fecha_inicio`, días de trabajo y descanso) | Jornada laboral del inspector | Distinguir día de descanso de informe no entregado en el historial | Inspector y jefatura | Mientras dure el contrato | Sí. **No** se usa para evaluar desempeño individual |
| `registro.latitud` / `longitud` | Ubicación del inspector en un momento | Demostrar que la observación se levantó en el frente | Inspector, jefatura; en el PDF solo si el mandante lo exige | Igual que el reporte | Parcial: se captura **solo al guardar un registro**, nunca en segundo plano ni como seguimiento continuo |
| `fotografia.latitud` / `longitud` | Ubicación al tomar la foto | Ubicar la evidencia en la obra | Igual que el registro | Igual que el reporte | Igual que el anterior |
| `registro.registrado_en`, `sincronizado_en` | Hora de trabajo del inspector | Probar que el registro se hizo en terreno aunque no hubiera señal | Inspector, jefatura | Igual que el reporte | Sí |
| `fotografia.url` (imagen) | Puede mostrar rostros de trabajadores de faena | Evidencia del avance o de la alerta | Inspector, jefatura, mandante | Igual que el reporte | Se instruye fotografiar la obra, no a las personas |
| `registro.descripcion`, `alerta.descripcion` | Puede nombrar a personas de contratistas | Describir la actividad o la alerta | Inspector, jefatura, mandante | Igual que el reporte | Se instruye nombrar a la **empresa**, no a la persona |
| `alerta.empresa_id` | Atribuye una observación a una empresa | Identificar quién ejecuta | Inspector, jefatura, mandante | Igual que el reporte | Sí (dato de empresa, no personal) |
| `envio.enviado_por`, `reporte.aprobado_por`, `hora_aprobacion` | Quién aprobó y envió, y cuándo | Trazabilidad de la decisión humana (supervisión) | Jefatura, administrador | Igual que el reporte | Sí: es la evidencia de supervisión humana |
| Audio del dictado | Voz del inspector | Transcribir la descripción | **No se guarda en la app**: solo se conserva el texto resultante | No se conserva | Sí. Ojo: el servicio de voz del teléfono puede procesar el audio fuera del dispositivo (ver §3.3) |

**Plazo de conservación del reporte:** lo fija el contrato con el mandante. Mientras no se conozca, se propone conservarlo hasta el cierre del contrato más 5 años, y debe confirmarse con la empresa de inspección.

### 2.2 Datos que decidimos **no** recoger

| Dato descartado | Por qué |
|---|---|
| Seguimiento continuo de ubicación | No hace falta para el reporte y convertiría la app en un sistema de vigilancia |
| RUT, teléfono o dirección del inspector | El reporte no los pide |
| Grabación de audio del dictado | Basta con el texto |
| Estados de cierre, responsables y plazos de las alertas | El reporte es constancia del turno, no seguimiento (decisión del equipo, ver [02-uso-de-ia.md](02-uso-de-ia.md)) |
| Fotos guardadas en la galería del teléfono | La cámara se usa con `saveToGallery: false`: la foto vive solo en la app |

### 2.3 Hallazgos en el código y acciones

| Hallazgo | Riesgo | Acción | Cuándo |
|---|---|---|---|
| Las fotos se suben a un depósito de Supabase y se enlazan con `getPublicUrl` (`src/lib/sync.ts`) | Cualquiera que obtenga el enlace puede ver la foto, sin iniciar sesión | Hacer privado el depósito `fotos` y usar enlaces firmados con vencimiento | Antes del piloto |
| Los datos quedan en el teléfono (IndexedDB) después de enviar el reporte | Si se pierde el teléfono, quedan fotos y ubicaciones | Borrar del teléfono los reportes ya enviados y sincronizados después de N días | Antes del piloto |
| No hay aún un procedimiento para ejercer los derechos ARCOP | Incumplimiento de la Ley 21.719 desde el 1 de diciembre | Definir un correo de contacto y quién responde (jefatura) | Semana 12 |
| El correo se envía desde una cuenta Gmail y los destinatarios están limitados por `MAIL_DESTINATARIOS_PERMITIDOS` | Bien resuelto para el prototipo: evita envíos a terceros por error | Mantener la lista de permitidos en producción | Permanente |

---

## 3. Sesgo, accesibilidad y transparencia

### 3.1 Priorización revisada

En el caso del curso, ordenar solicitudes por número de reportes favorece a quien ya sabe reportar. En Bitácora - ITO la pregunta equivalente es: **¿el sistema ordena o destaca algo de forma que alguien quede en desventaja?**

| Punto de priorización | Revisión | Decisión |
|---|---|---|
| **Criticidad de la alerta** (baja, media, alta) | La define el inspector, no el sistema. Una alerta alta exige foto (regla 4) | Se mantiene manual. **No** se automatiza la criticidad: sería una decisión que afecta a una empresa contratista |
| **Orden de las áreas** en la lista | El catálogo propone primero las del reporte anterior (`ultimo_uso`). Un área con poco movimiento puede quedar abajo y omitirse | Toda área agregada al turno sin registros obliga a declarar «sin actividad» (regla 2): ninguna desaparece del reporte en silencio |
| **Historial en rojo** (día de trabajo sin informe) | Sin el rol de turnos, un día de descanso se vería como incumplimiento | El rol 7x7 distingue descanso (gris) de no entregado (rojo) (regla 10). Además, un día rojo puede deberse a falta de señal: el historial debe considerar los reportes en cola |
| **Empresas en las alertas** | Las empresas que aparecen más pueden ser las que más trabajan, no las que peor trabajan | El reporte no genera rankings de empresas ni conteos comparativos |
| **Dictado** | El reconocimiento de voz funciona peor con ruido y con algunos acentos, lo que obliga a algunos inspectores a corregir más | Opción **Escribir** siempre disponible y «Repetir dictado» |

### 3.2 Revisión preliminar de accesibilidad (WCAG 2.2, nivel AA)

Revisión aplicada a las pantallas principales P1 a P5 del flujo, con las condiciones de terreno como criterio: sol directo, guantes, ruido y poca señal.

| Criterio WCAG 2.2 | Qué se revisó | Resultado | Acción |
|---|---|---|---|
| **1.4.3 Contraste mínimo** (4,5:1) | Texto principal `#1E2B38` sobre fondo `#F4F6F8` | ✅ 13,3:1 | — |
| 1.4.3 | Botón primario: texto `#1E2B38` sobre turquesa `#35D2C3` | ✅ 7,65:1 | — |
| 1.4.3 | Texto secundario gris `#6B7785` sobre blanco | ✅ 4,56:1 (justo) | — |
| 1.4.3 | Texto secundario gris `#6B7785` sobre fondo `#F4F6F8` | ❌ 4,21:1 | Oscurecer el gris a `#5D6A77` o más |
| 1.4.3 | Chips verde y rojo sobre su fondo claro | ✅ 4,64:1 y 4,92:1 | — |
| **1.4.11 Contraste no textual** (3:1) | Borde turquesa de la opción seleccionada sobre blanco | ❌ 1,88:1 | Acompañar la selección con un ícono o un borde oscuro, no solo con color |
| **1.4.1 Uso del color** | Calendario del historial (verde, rojo, gris) | ⚠️ El estado se distingue solo por color | Agregar un ícono o una letra a cada día (✓, ✗, –) |
| **2.5.8 Tamaño del objetivo** | Botones y controles | ✅ Mínimo de 44 px definido en `--toque` | — |
| **1.1.1 Contenido no textual** | Botones con solo ícono (cámara, volver, ajustes) | ⚠️ 43 atributos `aria-`/`alt` en el código; falta verificar que todos los botones con ícono tengan nombre | Revisar con un lector de pantalla (TalkBack) |
| **3.3.1 Identificación de errores** | Errores de foto, GPS y envío (pantallas 02c, 03b, 05d) | ✅ Mensaje en texto, no solo color | — |
| **3.3.7 Entrada redundante** | Áreas y empresas | ✅ Se eligen de una lista; no se reescriben | — |
| **1.4.4 Cambio de tamaño del texto** | Texto base 16 px | ⚠️ No se ha probado con el tamaño de letra del sistema al 200 % | Probar en el teléfono con letra grande |
| **Alternativa a la voz** | Dictado | ✅ Siempre existe «Escribir» | — |

La revisión es **preliminar**: se hizo sobre el código y las pantallas, sin usuarios con discapacidad ni lector de pantalla. Se completará en la validación del MVP (semana 12).

### 3.3 Aviso cuando interviene procesamiento automático

| Dónde | Aviso propuesto | Pantalla |
|---|---|---|
| Al dictar | «El texto lo transcribe el reconocimiento de voz del teléfono. Revísalo antes de guardar.» Bajo el campo de descripción | P2 y P3 |
| Primera vez que se usa el dictado | «El reconocimiento de voz puede enviar el audio al servicio de Google o Apple para transcribirlo. Si prefieres no hacerlo, usa Escribir.» | P2 |
| Vista previa del PDF | «Este reporte lo armó la aplicación con tus registros. Revísalo: al aprobar, el reporte sale con tu nombre.» | P4 / vista previa |
| En el propio PDF | Pie de página: «Reporte generado con Bitácora - ITO a partir de registros de terreno. Revisado y aprobado por [nombre], [hora].» | PDF |
| Registro de quién decide | Ya resuelto: `aprobado_por`, `hora_aprobacion` y `envio.enviado_por` | — |

Esto responde a la obligación de **transparencia** de la Ley 21.719 y a lo que el AI Act europeo exige desde el 2 de agosto de 2026: informar cuando interviene un sistema automático y mantener **supervisión humana** antes de afectar a personas.

### 3.4 Anotaciones para el prototipo

Notas para agregar como comentarios en Figma junto a cada pantalla:

| Pantalla | Anotación ética |
|---|---|
| P1 Turno y áreas | «Las áreas vienen del catálogo de la jefatura. Un área sin registros debe declararse sin actividad.» |
| P2 Registrar avance | «GPS solo al guardar. Dictado opcional; siempre se puede escribir. Aviso de transcripción automática.» |
| P3 Nueva alerta | «La criticidad la decide el inspector, no el sistema. Fotografiar la obra, no a las personas.» |
| P4 Borrador / vista previa | «Aviso: el reporte lo armó la app. La aprobación es humana y queda registrada.» |
| P5 Enviar | «Solo destinatarios del contrato. Un reporte enviado no se edita; se corrige con un nuevo envío.» |
| Historial | «Rojo = día de trabajo sin envío, gris = descanso. No es una evaluación de desempeño.» |

---

## 4. Sostenibilidad y riesgos

### 4.1 Tres planos

| Plano | Pregunta verificable | Respuesta actual |
|---|---|---|
| **Ambiental** | ¿Cuántas llamadas a IA? | Cero llamadas a modelos de IA generativa. El dictado usa el servicio del teléfono y el PDF se arma en el propio dispositivo |
| | ¿Cuántos datos? | Fotos JPEG con calidad 90 en la cámara y reescaladas con calidad 0,88 para el PDF. **Pendiente:** fijar peso máximo por foto antes de subirla (decisión pendiente §7 de la estructura de datos) |
| | ¿Qué queda encendido? | Producción en Vercel (bitacora-ito.vercel.app) y una base Supabase. Hay un segundo proyecto de Vercel conectado al mismo repositorio que debe revisarse y apagarse si no se usa |
| **Social** | ¿Quién se beneficia, quién se sobrecarga, quién queda fuera? | Ver §1. Se beneficia el inspector (menos horas extra) y el mandante. Se sobrecarga la jefatura con el catálogo. Quedan fuera contratistas y trabajadores fotografiados |
| **Continuidad** | ¿Quién lo mantiene? | Hoy, el equipo del curso. Para un piloto se necesita un responsable en la empresa de inspección (ver §4.3) |

### 4.2 Prácticas de uso eficiente

| Práctica | Estado |
|---|---|
| Modelo adecuado: no usar IA generativa donde una plantilla resuelve | ✅ Aplicado |
| IA o servicios bajo demanda: el dictado solo se activa al tocar «Dictar» | ✅ Aplicado |
| Imágenes comprimidas | ⚠️ Parcial: se comprimen para el PDF, falta reducirlas antes de subirlas |
| Consultar solo los datos que se usan | ⚠️ Por verificar en la PoC: que el teléfono descargue solo los datos del contrato y turno del inspector |
| Funcionar sin red, sin reintentos repetidos | ✅ Cola de envío sin conexión |
| Apagar despliegues de prueba y documentar su responsable | ⚠️ Pendiente: revisar el segundo proyecto de Vercel |
| Proyecto reproducible y documentado | ✅ README, manual de instalación y `.env.example` sin credenciales |

### 4.3 Matriz de riesgos

Todo riesgo tiene un tratamiento, un responsable y una fecha de revisión. Aceptar un riesgo también es una decisión y queda registrada con su justificación.

| # | Riesgo | Prob. | Impacto | Tratamiento | Acción | Responsable | Revisión |
|---|---|---|---|---|---|---|---|
| R1 | El inspector aprueba el PDF sin revisarlo (sesgo de automatización) | Media | Alto | Mitigar | Aprobación solo desde la vista previa; medir el tiempo de revisión; aviso de que el reporte sale con su nombre | Equipo (producto) | Semana 12 |
| R2 | Las fotos quedan accesibles por enlace público | Alta | Alto | Mitigar | Depósito privado y enlaces firmados | Equipo (técnico) | Antes del piloto |
| R3 | La jefatura usa GPS e historial para vigilar al inspector | Media | Alto | Evitar | GPS solo al guardar; sin seguimiento continuo; política de uso escrita | Empresa de inspección | Semana 13 |
| R4 | Fotos con trabajadores identificables sin su conocimiento | Media | Medio | Mitigar | Instrucción de fotografiar la obra; aviso en faena | Jefatura de inspección | Semana 13 |
| R5 | El dictado falla con ruido o ciertos acentos | Alta | Bajo | Aceptar | Se acepta porque siempre existe «Escribir» y «Repetir dictado». Se monitorea la proporción de registros escritos | Equipo (producto) | Semana 12 |
| R6 | El audio del dictado se procesa fuera del teléfono | Media | Medio | Mitigar | Aviso al primer uso; opción de escribir | Equipo (producto) | Semana 12 |
| R7 | Pérdida del teléfono con datos del turno | Baja | Alto | Mitigar | Borrar del teléfono lo ya enviado; bloqueo de pantalla obligatorio | Empresa de inspección | Antes del piloto |
| R8 | Nadie mantiene la app al terminar el curso (cuentas, costos, credenciales) | Alta | Alto | Transferir | Traspasar cuentas de Vercel, Supabase y Gmail a la empresa con un responsable técnico | Equipo + empresa | Semana 13 |
| R9 | Catálogo de áreas desactualizado: se registra en el área equivocada | Media | Medio | Mitigar | Revisión semanal del catálogo por la jefatura | Jefatura de inspección | Semana 12 |
| R10 | Incumplimiento de la Ley 21.719 desde el 1 de diciembre de 2026 (sin canal ARCOP) | Media | Alto | Mitigar | Correo de contacto y procedimiento para acceso y eliminación | Equipo + empresa | 1 de diciembre de 2026 |
| R11 | Contrastes de color bajo el mínimo de WCAG en terreno con sol | Alta | Medio | Mitigar | Ajustar el gris secundario y la selección turquesa (§3.2) | Equipo (técnico) | Semana 8 |
| R12 | Un día sin señal se ve en rojo en el historial y parece incumplimiento | Media | Medio | Mitigar | Mostrar como «en cola» los reportes pendientes de envío | Equipo (técnico) | Semana 12 |

---

## 5. Compromisos

1. **Impacto:** el inspector sigue siendo quien decide qué se observa, qué es una alerta y qué se envía. El sistema redacta; no juzga.
2. **Datos:** cada campo tiene finalidad, quién lo ve y cuánto se conserva. No se recoge ubicación continua ni audio.
3. **Inclusión:** el dictado nunca es obligatorio, la app funciona sin señal y la accesibilidad se revisa con WCAG 2.2 en cada entrega.
4. **Riesgos:** cada riesgo tiene responsable y fecha de revisión. Este documento se actualiza al probar con inspectores, al implementar la seguridad y al pasar a piloto.

## Referencias

- Apunte 4.1 del curso, Tabla 1.
- Ley 21.719 sobre protección de datos personales (BCN, 2024) y Gobierno Digital, *Guía práctica de la Ley 21.719*.
- Parlamento Europeo y Consejo (2024, mod. 2026). Reglamento de IA (AI Act).
- W3C (2023). *Web Content Accessibility Guidelines (WCAG) 2.2*.
- Bainbridge (1983). *Ironies of Automation*. Parasuraman y Riley (1997). *Humans and Automation*.
- Cavoukian (2011). *Privacy by Design*.
- Agencia Internacional de Energía (2026). *Energía e IA*.
