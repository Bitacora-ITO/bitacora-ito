# Historias de usuario y criterios de aceptación

**Proyecto:** Bitácora - ITO
**Semana:** 4 (actualizado en la semana 6, versión 2)
**Fuente:** caso de uso principal del Avance 2 y estructura de datos del Avance 3.

> **Versión 2: observaciones del profesor guía.**
>
> 1. Las áreas no las escribe el inspector: vienen en una lista desplegable. Por eso cambia HU-05.
> 2. Antes de generar y enviar el PDF, el inspector debe poder revisarlo. Por eso se agrega HU-09.
>
> Además se agrega HU-10 (historial con calendario).
>
> **Terminología:** desde esta versión, lo que las historias llaman **«frente»** se llama **«área»** en la aplicación y en el prototipo. Cada área del turno lleva su empresa («Peralte Muro Sotelo · TECNASIC»).

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
| HU-05 | Elegir un área del catálogo del contrato *(v2)* | Inspector | Media |
| HU-06 | Revisar el borrador del reporte del turno | Inspector | Alta |
| HU-09 | Previsualizar el PDF antes de aprobarlo *(nueva, v2)* | Inspector | Alta |
| HU-07 | Emitir el reporte al mandante | Inspector | Alta |
| HU-10 | Consultar mi historial en el calendario *(nueva, v2)* | Inspector | Media |
| HU-08 | Consultar reportes anteriores | Jefatura | Baja |

> **HU-02 es la historia del flujo principal.** Es la que justifica el proyecto: si registrar un avance en terreno no resulta más rápido que anotarlo en la libreta, la solución no tiene sentido. El wireframe de esta semana desarrolla el flujo que va de HU-01 a HU-07, con HU-02 en el centro. En la versión 2, HU-09 se intercala entre HU-06 y HU-07: el reporte se aprueba desde la vista previa del PDF.

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

## HU-05 · Elegir un área del catálogo del contrato *(versión 2)*

> **Cambio por observación del profesor guía:** en la versión 1, el inspector escribía el número y el nombre del frente. Ahora el área **se elige de una lista desplegable** precargada con el contrato (14 áreas) y después se elige la empresa que la ejecuta. El inspector no escribe nada. La numeración del reporte (1.0, 1.1…) la asigna el sistema.

| | |
|---|---|
| **Rol** | Inspector de terreno |
| **Acción** | Agregar al turno un área del catálogo del contrato y la empresa que la ejecuta, eligiéndolas de una lista |
| **Beneficio** | Registrar el área el mismo día sin escribir nombres, sin errores de digitación y con los mismos nombres que usa el mandante |

**Revisión INVEST**

| Atributo | Revisión |
|---|---|
| Independiente | Sí. |
| Negociable | Sí. Queda por acordar si la jefatura puede agregar áreas nuevas al catálogo durante el contrato. |
| Valiosa | Sí. Los nombres quedan iguales en todos los reportes y el mandante los reconoce. |
| Estimable | Sí. |
| Pequeña | Sí. Dos pasos: área y empresa. |
| Comprobable | Sí, con los criterios de abajo. |

**Escenario principal**

- **Dado** que aparece en la obra un área que no está en el turno,
- **cuando** el inspector toca «Agregar área», la elige de la lista del contrato y elige la empresa que la ejecuta,
- **entonces** el área queda en el turno con su empresa, lista para registrar, y se propone en los reportes siguientes.

**Escenario alternativo · área ya incluida en el turno**

- **Dado** que el área ya está en el turno,
- **cuando** el inspector abre la lista,
- **entonces** el área aparece marcada como «En el turno» y no se puede agregar dos veces.

**Escenario alternativo · área terminada**

- **Dado** que un área de la obra ya terminó,
- **cuando** el inspector la quita del turno,
- **entonces** deja de proponerse en los reportes siguientes y los reportes ya emitidos la conservan sin cambios.

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

## HU-09 · Previsualizar el PDF antes de aprobarlo *(nueva, versión 2)*

> **Origen: observación del profesor guía.** Antes de que el PDF se genere y se envíe, el inspector debe poder revisarlo tal como lo recibirá el mandante.

| | |
|---|---|
| **Rol** | Inspector de terreno |
| **Acción** | Ver el PDF del reporte, página por página y en el formato del mandante, antes de aprobarlo |
| **Beneficio** | Detectar un error de forma o de contenido antes de que llegue al mandante, porque un reporte enviado ya no se edita |

**Revisión INVEST**

| Atributo | Revisión |
|---|---|
| Independiente | Sí, apoyándose en el borrador de HU-06. |
| Negociable | Sí. Queda por acordar si la vista previa permite acercar la imagen o solo pasar páginas. |
| Valiosa | Sí. Evita correcciones después del envío, que generan un envío nuevo (HU-07). |
| Estimable | Sí. |
| Pequeña | Sí. Una pantalla de lectura con dos acciones. |
| Comprobable | Sí, con los criterios de abajo. |

**Escenario principal**

- **Dado** que el borrador del turno está listo,
- **cuando** el inspector toca «Ver vista previa del PDF»,
- **entonces** ve el documento con el formato del mandante (encabezado, correlativo, clima, tabla de alertas, áreas con sus empresas y fotografías), puede pasar de página y solo desde ahí puede tocar «Aprobar y enviar».

**Escenario alternativo · encuentra un error**

- **Dado** que el inspector ve un dato incorrecto en la vista previa,
- **cuando** toca «Volver a editar»,
- **entonces** vuelve al borrador sin aprobar nada, corrige el registro y, al pedir de nuevo la vista previa, ve el documento actualizado.

**Escenario alternativo · sin señal**

- **Dado** que el teléfono no tiene señal al cierre del turno,
- **cuando** el inspector pide la vista previa,
- **entonces** el PDF se genera en el teléfono y se muestra igual, porque la vista previa no depende de la red.

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
| Independiente | Sí, apoyándose en el borrador de HU-06 y en la vista previa de HU-09. |
| Negociable | Sí. El medio de envío se acuerda con el mandante. |
| Valiosa | Sí. Es la entrega que hoy se atrasa y origina los reclamos. |
| Estimable | Sí. |
| Pequeña | Sí. |
| Comprobable | Sí, con los criterios de abajo. |

**Escenario principal**

- **Dado** que el inspector revisó el borrador y la vista previa del PDF (HU-09) y está conforme,
- **cuando** toca «Aprobar y enviar» y confirma el envío,
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

## HU-10 · Consultar mi historial en el calendario *(nueva, versión 2)*

| | |
|---|---|
| **Rol** | Inspector de terreno |
| **Acción** | Ver en un calendario mensual qué días envió el informe, cuáles no entregó y cuáles fueron de descanso, y abrir los datos del informe de un día |
| **Beneficio** | Responder sin buscar en el correo cuántos informes entregó en el mes y qué dijo un informe anterior |

**Revisión INVEST**

| Atributo | Revisión |
|---|---|
| Independiente | Sí, apoyándose en los reportes enviados (HU-07). |
| Negociable | Sí. Queda por acordar si el resumen se muestra por mes calendario o por ciclo de turno. |
| Valiosa | Sí. Da trazabilidad al inspector y a la jefatura sobre el cumplimiento diario. |
| Estimable | Sí. |
| Pequeña | Sí. Un calendario de lectura, un detalle por día y un ajuste del rol. |
| Comprobable | Sí, con los criterios de abajo. |

**Escenario principal**

- **Dado** que el inspector tiene marcado el primer día de su turno y su contrato tiene un rol 7x7,
- **cuando** abre el Historial,
- **entonces** ve el mes con cada día en verde (enviado), rojo (día de trabajo sin informe) o gris (descanso), con los inicios de turno marcados y el resumen del mes (enviados, no entregados y días de descanso).

**Escenario alternativo · revisar un día enviado**

- **Dado** que un día está en verde,
- **cuando** el inspector lo toca,
- **entonces** ve los datos con que se armó ese informe (correlativo, hora de envío, clima, áreas con sus registros, alertas y fotografías), solo para lectura y sin abrir el PDF.

**Escenario alternativo · cambiar el inicio de turno**

- **Dado** que el rol del inspector cambió,
- **cuando** marca en el calendario otro día como primer día de su turno,
- **entonces** el sistema recalcula los días de trabajo y de descanso desde esa fecha, sin modificar los informes ya enviados.

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
