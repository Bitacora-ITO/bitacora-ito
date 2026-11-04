# Análisis ético, de sostenibilidad e impacto preliminar

**Proyecto:** Bitácora - ITO · **Fecha:** 28 de octubre de 2026 · **Base:** Apunte 4.1, Tabla 1
**Actualización:** 4 de noviembre de 2026, versión de la semana 8 (consolidación por el jefe de turno, firma del inspector y semáforo).
**Estado:** preliminar. Se revisa en cada entrega.

Bitácora - ITO **automatiza la redacción del reporte, no el juicio de las personas**. El inspector decide qué registra, qué es una alerta y su criticidad, y firma su parte cuando la considera lista. El jefe de turno revisa el reporte consolidado y lo aprueba antes de enviarlo al mandante.

---

## 1. Mapa de impacto y exclusión

| Actor | Qué deja de hacer | Cómo cambia su rol | Riesgo |
|---|---|---|---|
| **Inspector** (ejecuta) | Redactar el reporte en gabinete al final del turno | Registra en terreno, revisa su parte y la firma con su clave | Firmar sin leer porque "lo hizo el sistema" (sesgo de automatización) |
| **Jefe de turno** (consolida) | Juntar a mano los reportes de cada inspector | Sigue el semáforo, consolida las partes firmadas, revisa el PDF y lo envía | Usar el semáforo o el GPS para presionar o vigilar al inspector; enviar sin revisar |
| **Administrador** (configura) | Pedir cambios del catálogo al equipo de desarrollo | Mantiene áreas, empresas, usuarios y destinatarios en una plantilla Excel | Dejar activo a alguien que ya no trabaja en el contrato |
| **Mandante** (recibe) | Esperar el reporte al día siguiente o recibir varios | Recibe un solo reporte por turno, el mismo día, con fotos ubicadas | Confiar en el reporte sin revisarlo |

**Quién queda fuera:**

- **Contratistas y trabajadores de faena:** aparecen en alertas y fotos, pero no usan la app ni ven el reporte antes del envío.
- **Inspectores sin señal:** la app funciona sin conexión y sincroniza después.
- **Inspectores con dificultad para dictar** (por ruido o acento): siempre pueden escribir.

---

## 2. Ficha de tratamiento de datos personales

Según la Ley 21.719, que rige desde el 1 de diciembre de 2026. Complementa la [estructura de datos](01-estructura-datos.md).

| Dato | Finalidad | Quién lo ve | Cuánto se conserva |
|---|---|---|---|
| Nombre del inspector | Ingresar a la app y aparecer en «Elaborado por» | Inspector, jefe de turno y mandante | Lo que exija el contrato |
| Firma de la parte (declaración, quién y a qué hora) | Dejar constancia de que el inspector validó su información | Inspector y jefe de turno | Igual que el reporte |
| Correo laboral (opcional) | Contacto; no se usa para ingresar | Administrador | Mientras la persona esté activa |
| Ubicación GPS | Probar que el registro se hizo en terreno | Inspector y jefe de turno | Igual que el reporte |
| Hora del registro | Probar que se registró durante el turno | Inspector y jefe de turno | Igual que el reporte |
| Fotografías | Evidencia del avance o de la alerta | Inspector, jefe de turno y mandante | Igual que el reporte |
| Rol de turnos (7x7) | Distinguir un día de descanso de un informe no entregado, y no contar en el semáforo a quien descansa | Inspector y jefe de turno | Mientras dure el contrato |

**Datos que no se recogen:** ubicación continua (el GPS se toma solo al guardar), audio del dictado (solo se guarda el texto), RUT ni teléfono.

**Lo que el inspector no ha firmado no lo ve el jefe de turno.** Se respalda en la nube para no perderlo, pero el jefe solo ve «Aún no envía». El inspector decide cuándo su información está lista.

---

## 3. Sesgo, accesibilidad y transparencia

**Priorización revisada.** La app no ordena ni prioriza de forma automática. La criticidad de cada alerta la decide el inspector. El historial no marca como incumplimiento los días de descanso, y el semáforo del jefe de turno no cuenta a los inspectores que están de descanso. El semáforo muestra cuántos enviaron, no clasifica a nadie.

**Accesibilidad (revisión preliminar, WCAG 2.2) de las pantallas principales:**

| Criterio | Resultado | Acción |
|---|---|---|
| Botones de al menos 44 px (para uso con guantes) | ✅ Cumple | — |
| Contraste del texto principal | ✅ Cumple | — |
| Contraste del texto gris secundario | ❌ No cumple | Oscurecer el gris |
| Calendario del historial distinguido solo por colores | ⚠️ Parcial | Agregar un símbolo por día (✓ ✗ –) |
| Semáforo del jefe de turno | ✅ Cumple | Además del color, dice el texto «3 de 4 ITO enviaron · 75 %» y el teléfono vibra al llegar al 100 % |
| Alternativa al dictado por voz | ✅ Opción «Escribir» | — |

**Aviso de automatización.** La app no usa IA generativa: el dictado lo transcribe el teléfono y el PDF se arma con una plantilla. Igual se avisa al usuario:

- **Al dictar:** «Texto transcrito automáticamente. Revísalo antes de guardar.»
- **Al firmar su parte (inspector):** «Yo, [nombre], declaro que revisé mi parte del turno y que la información registrada es correcta.» Sin marcar la declaración y escribir la clave, la parte no se envía.
- **En la vista previa del PDF (jefe de turno):** el reporte consolidado lo armó la app con las partes firmadas; el jefe lo revisa antes de «Aprobar y enviar al mandante».

El aviso del dictado está anotado en el prototipo de Figma (P2). La declaración de firma ya funciona en la app.

---

## 4. Sostenibilidad y riesgos

**Prácticas de uso eficiente:** no se usa IA generativa donde basta una plantilla, el dictado se activa solo cuando el inspector lo pide, las fotos se comprimen y se apagan los despliegues de prueba que no se usan.

**Matriz de riesgos:**

| Riesgo | Tratamiento | Acción | Responsable | Revisión |
|---|---|---|---|---|
| El inspector firma su parte sin revisarla | Mitigar | Antes de firmar ve el resumen de su parte y debe marcar la declaración | Equipo | Semana 12 |
| El jefe de turno envía sin revisar el consolidado | Mitigar | Aprobación solo desde la vista previa del PDF; aviso si faltan partes | Equipo | Semana 12 |
| La clave de la maqueta es la misma para todos (1234), así que la firma no prueba quién firmó | Mitigar | Cuentas reales con clave personal (Supabase Auth) | Equipo | Antes del piloto |
| Los datos en la nube se pueden leer con la llave pública de la app (acceso de maqueta) | Mitigar | Reglas de acceso por usuario y rol en Supabase | Equipo | Antes del piloto |
| Las fotos quedan accesibles con un enlace público | Mitigar | Dejar privado el almacenamiento de fotos | Equipo | Antes del piloto |
| El GPS o el semáforo se usan para vigilar o presionar al inspector | Evitar | Sin seguimiento continuo de ubicación; el semáforo solo cuenta partes firmadas | Empresa ITO | Semana 13 |
| El dictado falla con el ruido de faena | Aceptar | Siempre se puede escribir | Equipo | Semana 12 |
| Nadie mantiene la app al terminar el curso | Transferir | Traspasar las cuentas a un responsable de la empresa | Equipo y empresa | Semana 13 |
