# Análisis ético, de sostenibilidad e impacto preliminar

**Proyecto:** Bitácora - ITO · **Fecha:** 28 de octubre de 2026 · **Base:** Apunte 4.1, Tabla 1
**Estado:** preliminar. Se revisa en cada entrega.

Bitácora - ITO **automatiza la redacción del reporte, no el juicio del inspector**. El inspector decide qué registra, qué es una alerta y su criticidad, y aprueba el reporte antes de enviarlo.

---

## 1. Mapa de impacto y exclusión

| Actor | Qué deja de hacer | Cómo cambia su rol | Riesgo |
|---|---|---|---|
| **Inspector** (ejecuta) | Redactar el reporte en gabinete al final del turno | Registra en terreno y revisa y aprueba un borrador ya armado | Aprobar sin leer porque "lo hizo el sistema" (sesgo de automatización) |
| **Jefatura de inspección** (supervisa) | Pedir y ordenar reportes a mano | Mantiene el catálogo de áreas y supervisa con el historial | Usar el GPS y el historial para vigilar al inspector |
| **Mandante** (recibe) | Esperar el reporte al día siguiente | Recibe el reporte el mismo día, con fotos ubicadas | Confiar en el reporte sin revisarlo |

**Quién queda fuera:**

- **Contratistas y trabajadores de faena:** aparecen en alertas y fotos, pero no usan la app ni ven el reporte antes del envío.
- **Inspectores sin señal:** la app funciona sin conexión y sincroniza después.
- **Inspectores con dificultad para dictar** (por ruido o acento): siempre pueden escribir.

---

## 2. Ficha de tratamiento de datos personales

Según la Ley 21.719, que rige desde el 1 de diciembre de 2026. Complementa la [estructura de datos](01-estructura-datos.md).

| Dato | Finalidad | Quién lo ve | Cuánto se conserva |
|---|---|---|---|
| Nombre del inspector | Firmar el reporte («Elaborado por») | Inspector, jefatura y mandante | Lo que exija el contrato |
| Correo laboral | Iniciar sesión | Inspector y administrador | Mientras la cuenta esté activa |
| Ubicación GPS | Probar que el registro se hizo en terreno | Inspector y jefatura | Igual que el reporte |
| Hora del registro | Probar que se registró durante el turno | Inspector y jefatura | Igual que el reporte |
| Fotografías | Evidencia del avance o de la alerta | Inspector, jefatura y mandante | Igual que el reporte |
| Rol de turnos (7x7) | Distinguir un día de descanso de un informe no entregado | Inspector y jefatura | Mientras dure el contrato |

**Datos que no se recogen:** ubicación continua (el GPS se toma solo al guardar), audio del dictado (solo se guarda el texto), RUT ni teléfono.

---

## 3. Sesgo, accesibilidad y transparencia

**Priorización revisada.** La app no ordena ni prioriza de forma automática. La criticidad de cada alerta la decide el inspector. El historial no marca como incumplimiento los días de descanso.

**Accesibilidad (revisión preliminar, WCAG 2.2) de las pantallas principales:**

| Criterio | Resultado | Acción |
|---|---|---|
| Botones de al menos 44 px (para uso con guantes) | ✅ Cumple | — |
| Contraste del texto principal | ✅ Cumple | — |
| Contraste del texto gris secundario | ❌ No cumple | Oscurecer el gris |
| Calendario del historial distinguido solo por colores | ⚠️ Parcial | Agregar un símbolo por día (✓ ✗ –) |
| Alternativa al dictado por voz | ✅ Opción «Escribir» | — |

**Aviso de automatización.** La app no usa IA generativa: el dictado lo transcribe el teléfono y el PDF se arma con una plantilla. Igual se avisa al usuario:

- **Al dictar:** «Texto transcrito automáticamente. Revísalo antes de guardar.»
- **En la vista previa:** «Este reporte lo armó la app con tus registros. Al aprobarlo, sale con tu nombre.»

Estos avisos quedan anotados en el prototipo de Figma, en las pantallas P2 y P4.

---

## 4. Sostenibilidad y riesgos

**Prácticas de uso eficiente:** no se usa IA generativa donde basta una plantilla, el dictado se activa solo cuando el inspector lo pide, las fotos se comprimen y se apagan los despliegues de prueba que no se usan.

**Matriz de riesgos:**

| Riesgo | Tratamiento | Acción | Responsable | Revisión |
|---|---|---|---|---|
| El inspector aprueba el reporte sin revisarlo | Mitigar | Aprobación solo desde la vista previa del PDF | Equipo | Semana 12 |
| Las fotos quedan accesibles con un enlace público | Mitigar | Dejar privado el almacenamiento de fotos | Equipo | Antes del piloto |
| El GPS se usa para vigilar al inspector | Evitar | Sin seguimiento continuo de ubicación | Empresa ITO | Semana 13 |
| El dictado falla con el ruido de faena | Aceptar | Siempre se puede escribir | Equipo | Semana 12 |
| Nadie mantiene la app al terminar el curso | Transferir | Traspasar las cuentas a un responsable de la empresa | Equipo y empresa | Semana 13 |
