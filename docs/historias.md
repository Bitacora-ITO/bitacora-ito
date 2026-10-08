# Historias de usuario y criterios de aceptación

**Proyecto:** Bitácora - ITO
**Semana:** 4
**Fuente:** caso de uso principal del Avance 2 y estructura de datos del Avance 3.

---

## Formato

Cada historia se descompone en rol, acción y beneficio, según la plantilla de Cohn (2004). El beneficio es lo que permite discutir alternativas y decidir si la historia merece el esfuerzo: sin él, no hay forma de priorizar.

## Roles

| Rol | Quién es |
|---|---|
| Inspector de terreno | Inspector técnico que recorre la obra durante su turno y elabora el reporte diario. |
| Jefatura de inspección | Coordinador del contrato, que supervisa la emisión de los reportes. |

## Orden del backlog

Las historias siguen la secuencia real de uso del turno, de la apertura del día al envío al mandante, y no la comodidad técnica. Se reordenan en cada sprint.

| Código | Historia | Rol | Prioridad |
|---|---|---|---|
| HU-01 | Abrir el turno y ver el estado de los frentes | Inspector | Alta |
| **HU-02** | **Registrar un avance en terreno** | **Inspector** | **Alta — flujo principal** |
| HU-03 | Levantar una alerta con su criticidad | Inspector | Alta |
| HU-04 | Declarar un frente sin actividad | Inspector | Alta |
| HU-05 | Agregar un frente nuevo desde terreno | Inspector | Media |
| HU-06 | Revisar el borrador del reporte del turno | Inspector | Alta |
| HU-07 | Emitir el reporte al mandante | Inspector | Alta |
| HU-08 | Consultar reportes anteriores | Jefatura | Baja |

> **HU-02 es la historia del flujo principal.** Es la que justifica el proyecto: si registrar un avance en terreno no resulta más rápido que anotarlo en la libreta, la solución no tiene sentido. El wireframe de esta semana desarrolla el flujo que va de HU-01 a HU-07, con HU-02 en el centro.

---

## HU-01 · Abrir el turno y ver el estado de los frentes

| | |
|---|---|
| **Rol** | Inspector de terreno |
| **Acción** | Ver, al empezar el turno, los frentes del contrato y cuáles ya tienen registro |
| **Beneficio** | Saber qué falta recorrer sin llevar la cuenta de memoria |

**Revisión INVEST**

| Atributo | Revisión |
|---|---|
| Independiente | Sí. Puede construirse antes que el registro de avances. |
| Negociable | Sí. Queda por acordar si los frentes se muestran agrupados o en lista plana. |
| Valiosa | Sí. Hoy el inspector reconstruye de memoria qué frentes visitó. |
| Estimable | Sí. |
| Pequeña | Sí. Una pantalla de lectura. |
| Comprobable | Sí, con los criterios de abajo. |

**Escenario principal**

- **Dado** que el inspector tiene un contrato asignado y es su turno,
- **cuando** abre la aplicación,
- **entonces** ve la fecha, el turno y la lista de frentes del reporte anterior, cada uno indicando si ya tiene registro, si fue declarado sin actividad o si sigue pendiente.

**Escenario alternativo · primer día del contrato**

- **Dado** que no existe un reporte anterior del contrato,
- **cuando** el inspector abre la aplicación,
- **entonces** ve la lista de frentes vacía y la opción de agregar el primero.

---

## HU-02 · Registrar un avance en terreno · flujo principal

| | |
|---|---|
| **Rol** | Inspector de terreno |
| **Acción** | Registrar lo observado en un frente con fotografía, dictado y ubicación, en el momento en que ocurre |
| **Beneficio** | Evitar reescribirlo en gabinete al final del turno |

**Revisión INVEST**

| Atributo | Revisión |
|---|---|
| Independiente | Sí, apoyándose en la lista de frentes de HU-01. |
| Negociable | Sí. Queda por acordar si el dictado se transcribe en el teléfono o en el servidor. |
| Valiosa | Sí. Es la historia que elimina la doble digitación, origen del problema. |
| Estimable | Sí. |
| Pequeña | Sí, una vez separada del armado del reporte, que es HU-06. |
| Comprobable | Sí, con los criterios de abajo. |

**Escenario principal**

- **Dado** que el inspector está en un frente del contrato,
- **cuando** toma una fotografía, dicta la descripción del avance y la guarda,
- **entonces** el registro queda asociado a ese frente con la hora y la ubicación en que se tomó, y el frente aparece con registro en la lista del turno.

**Escenario alternativo · sin cobertura de red**

- **Dado** que el teléfono no tiene señal en el frente,
- **cuando** el inspector guarda el registro,
- **entonces** el registro queda guardado en el teléfono, se avisa que está pendiente de sincronizar, y al recuperar la señal se envía conservando la hora y la ubicación originales.

**Escenario alternativo · dictado defectuoso por ruido de faena**

- **Dado** que el dictado se transcribió con errores,
- **cuando** el inspector revisa el texto antes de guardar,
- **entonces** puede corregirlo o repetir el dictado sin perder la fotografía ni la ubicación ya capturadas.

---

## HU-03 · Levantar una alerta con su criticidad

| | |
|---|---|
| **Rol** | Inspector de terreno |
| **Acción** | Reportar una observación indicando su nivel de criticidad y la columna del reporte en que se publica |
| **Beneficio** | Que el mandante distinga de inmediato qué requiere atención y qué no |

**Revisión INVEST**

| Atributo | Revisión |
|---|---|
| Independiente | Sí. |
| Negociable | Sí. La impresión de la criticidad en el PDF se acuerda con el mandante. |
| Valiosa | Sí. El formato actual no permite distinguir un hecho notable de un hallazgo grave. |
| Estimable | Sí. |
| Pequeña | Sí. |
| Comprobable | Sí, con los criterios de abajo. |

**Escenario principal**

- **Dado** que el inspector detecta una observación en terreno,
- **cuando** la registra eligiendo la columna del reporte, la empresa involucrada y la criticidad entre baja, media y alta,
- **entonces** la alerta queda incorporada a la tabla de alertas del reporte del día.

**Escenario alternativo · alerta de criticidad alta sin fotografía**

- **Dado** que el inspector marcó la alerta como de criticidad alta,
- **cuando** intenta guardarla sin fotografía,
- **entonces** el sistema no la guarda y pide adjuntar al menos una imagen de respaldo.

---

## HU-04 · Declarar un frente sin actividad

| | |
|---|---|
| **Rol** | Inspector de terreno |
| **Acción** | Marcar en un toque que un frente no tuvo trabajos durante el turno |
| **Beneficio** | Que el reporte lo declare de forma explícita y no parezca una omisión |

**Revisión INVEST**

| Atributo | Revisión |
|---|---|
| Independiente | Sí. |
| Negociable | Sí. Queda por acordar si admite una nota breve del motivo. |
| Valiosa | Sí. El mandante distingue el frente detenido del frente no inspeccionado. |
| Estimable | Sí. |
| Pequeña | Sí. |
| Comprobable | Sí, con los criterios de abajo. |

**Escenario principal**

- **Dado** que un frente no tuvo trabajos durante el turno,
- **cuando** el inspector lo marca como sin actividad,
- **entonces** el frente queda resuelto en la lista del turno y aparece en el reporte con esa declaración.

**Escenario alternativo · frente que ya tiene registros**

- **Dado** que el frente ya tiene al menos un avance registrado,
- **cuando** el inspector intenta marcarlo sin actividad,
- **entonces** el sistema advierte que existen registros y pide confirmación antes de continuar.

---

## HU-05 · Agregar un frente nuevo desde terreno

| | |
|---|---|
| **Rol** | Inspector de terreno |
| **Acción** | Crear un frente con su número y nombre cuando aparece en la obra |
| **Beneficio** | Registrarlo el mismo día sin esperar que alguien lo configure |

**Revisión INVEST**

| Atributo | Revisión |
|---|---|
| Independiente | Sí. |
| Negociable | Sí. Queda por acordar si se puede renumerar un frente ya usado. |
| Valiosa | Sí. Los frentes cambian con el avance de la obra. |
| Estimable | Sí. |
| Pequeña | Sí. |
| Comprobable | Sí, con los criterios de abajo. |

**Escenario principal**

- **Dado** que aparece un frente de trabajo que no está en la lista,
- **cuando** el inspector lo agrega con su número y su nombre,
- **entonces** queda disponible para registrar de inmediato y se propone en los reportes siguientes.

**Escenario alternativo · frente terminado**

- **Dado** que un frente de la obra ya terminó,
- **cuando** el inspector lo retira de la lista,
- **entonces** deja de proponerse en los reportes siguientes y los reportes ya emitidos lo conservan sin cambios.

---

## HU-06 · Revisar el borrador del reporte del turno

| | |
|---|---|
| **Rol** | Inspector de terreno |
| **Acción** | Ver, al cierre del turno, el reporte ya redactado con todo lo registrado |
| **Beneficio** | Revisarlo y corregirlo en vez de escribirlo desde cero |

**Revisión INVEST**

| Atributo | Revisión |
|---|---|
| Independiente | Sí, apoyándose en los registros de HU-02 y las alertas de HU-03. |
| Negociable | Sí. El grado de edición permitido se acuerda con la jefatura. |
| Valiosa | Sí. Es donde se concreta el ahorro de tiempo comprometido. |
| Estimable | Sí. |
| Pequeña | Sí. |
| Comprobable | Sí, con los criterios de abajo. |

**Escenario principal**

- **Dado** que el inspector registró los avances y las alertas del turno,
- **cuando** solicita el reporte del día,
- **entonces** ve un borrador con el correlativo asignado, el resumen del turno, los frentes con sus registros y la tabla de alertas, y puede editar el texto antes de aprobarlo.

**Escenario alternativo · frentes sin resolver**

- **Dado** que quedan frentes sin registro y sin declarar como sin actividad,
- **cuando** el inspector solicita el reporte,
- **entonces** el sistema los lista y pide resolverlos antes de generar el borrador.

---

## HU-07 · Emitir el reporte al mandante

| | |
|---|---|
| **Rol** | Inspector de terreno |
| **Acción** | Aprobar el reporte y enviarlo a los destinatarios del contrato |
| **Beneficio** | Cerrar la jornada con el reporte entregado y con constancia de la hora de envío |

**Revisión INVEST**

| Atributo | Revisión |
|---|---|
| Independiente | Sí, apoyándose en el borrador de HU-06. |
| Negociable | Sí. El medio de envío se acuerda con el mandante. |
| Valiosa | Sí. Es la entrega que hoy se atrasa y origina los reclamos. |
| Estimable | Sí. |
| Pequeña | Sí. |
| Comprobable | Sí, con los criterios de abajo. |

**Escenario principal**

- **Dado** que el inspector revisó el borrador y está conforme,
- **cuando** lo aprueba y confirma el envío,
- **entonces** el sistema genera el documento en PDF, lo envía a los destinatarios del contrato y deja registrada la fecha, la hora y quién lo aprobó.

**Escenario alternativo · falla el envío**

- **Dado** que el envío no pudo completarse,
- **cuando** el sistema lo detecta,
- **entonces** mantiene el reporte en espera, reintenta el envío y avisa al inspector del resultado.

**Escenario alternativo · corrección después de enviado**

- **Dado** que el reporte ya fue enviado,
- **cuando** el inspector necesita corregirlo,
- **entonces** el sistema no modifica el envío original y genera un envío nuevo sobre el mismo reporte, quedando ambos registrados.

**Escenario alternativo · emisión sin cobertura de red (offline)**

- **Dado** que el inspector aprueba el borrador del reporte al cerrar la jornada,
- **cuando** confirma el envío pero el dispositivo móvil no tiene cobertura de red,
- **entonces** el sistema genera y almacena el documento PDF localmente en estado `aprobado`, deja el envío en cola de espera y lo despacha automáticamente a los destinatarios tan pronto como el dispositivo detecte señal de red.
---

## HU-08 · Consultar reportes anteriores

| | |
|---|---|
| **Rol** | Jefatura de inspección |
| **Acción** | Buscar reportes ya emitidos por fecha o por frente |
| **Beneficio** | Respaldar con evidencia una consulta del mandante sin recurrir al inspector |

**Revisión INVEST**

| Atributo | Revisión |
|---|---|
| Independiente | Sí. |
| Negociable | Sí. Los filtros se acuerdan según el uso real. |
| Valiosa | Sí, aunque menos urgente que el flujo del turno. |
| Estimable | Sí. |
| Pequeña | Sí. |
| Comprobable | Sí, con los criterios de abajo. |

**Escenario principal**

- **Dado** que existen reportes emitidos del contrato,
- **cuando** la jefatura busca por fecha o por frente,
- **entonces** ve los reportes que coinciden y puede abrir el documento enviado con sus fotografías.

**Escenario alternativo · sin coincidencias**

- **Dado** que ningún reporte coincide con la búsqueda,
- **cuando** se ejecuta la consulta,
- **entonces** el sistema lo indica y mantiene los filtros para corregirlos.
