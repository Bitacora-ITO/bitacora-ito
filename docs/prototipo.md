# Prototipo navegable · Bitácora ITO

**Enlace al prototipo en Figma:** [abrir prototipo navegable](https://www.figma.com/proto/6lebHYRTbcb8f5WOnMW3pv/Sin-t%C3%ADtulo?node-id=1-2&p=f&t=XOez3IwfZ95WUirR-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=1%3A2&show-proto-sidebar=1)

Al abrirlo, la barra lateral muestra cuatro flujos: **Ruta principal** (parte en 01a), **A1 · Alerta alta sin foto** (03a), **A3 · Envío sin red** (05d) y **Estado vacío** (01b). El camino A2 (frentes sin resolver) se recorre desde la ruta principal tocando «Revisar reporte del turno» antes de registrar el frente 1.2.

**Origen:** las cinco pantallas P1 a P5 del wireframe anotado de la semana 4 y las historias HU-01 a HU-07 de `historias.md`. HU-02 es la historia del flujo principal.
**Dispositivo:** teléfono, marco de 390 × 844 px (iPhone 13/14 en Figma).
**Quién lo prueba:** inspector de terreno, en faena, con guantes, a veces sin señal.

Vista general de los 17 marcos: [pantallas-vista-general.png](pantallas-vista-general.png)

---

## 1. Pantallas y su historia de origen

Cinco pantallas, las mismas del wireframe. Las letras (a, b, c, d) son estados de la misma pantalla, no pantallas nuevas.

| Pantalla | Historia de origen | Marcos (estados) | Criterio que verifica |
|---|---|---|---|
| **P1 Turno y frentes** | HU-01 | 01a con datos · 01b vacío · 01c registro guardado sin señal | Al abrir la app, el inspector ve la fecha, el turno y los frentes, cada uno con registro, sin actividad o pendiente |
| **P2 Registrar avance** | HU-02 (y HU-04) | 02a vacío · 02b cargando · 02c error · 02d con datos | Al tomar la foto, dictar y guardar, el registro queda asociado al frente con hora y ubicación, y el frente aparece con registro en P1 |
| **P3 Nueva alerta** | HU-03 | 03a sin foto · 03b error · 03c con datos | Si la criticidad es alta, no se guarda la alerta sin al menos una fotografía de respaldo |
| **P4 Borrador del reporte** | HU-06 | 04a cargando · 04b con datos · 04c frentes sin resolver | Si quedan frentes sin registro ni declarados sin actividad, se listan y se pide resolverlos antes del borrador |
| **P5 Enviar al mandante** | HU-07 | 05a con datos · 05b cargando · 05c enviado · 05d sin red | Al aprobar y confirmar, se genera el PDF, se envía y queda registrada la fecha, la hora y quién aprobó; sin señal, queda en cola |

HU-05 (agregar frente) y HU-08 (consultar reportes) quedan fuera del flujo de esta semana. El botón «Nuevo frente» aparece en P1 pero no navega (ver registro de decisiones).

---

## 2. Mapa de navegación

![Mapa de navegación](mapa.png)

**Punto de entrada:** P1 Turno y frentes (01a).

**Ruta principal (escenario de éxito, HU-01 → HU-07):**
P1 Turno → toca el frente 1.2 → P2 Registrar avance → Guardar → P1 con el frente resuelto → Revisar reporte → P4 Borrador → Aprobar → P5 Enviar → Confirmar → Enviado → Volver al turno

**Retornos visibles (arriba a la izquierda en cada pantalla):**

| Pantalla | Retorno | Vuelve a |
|---|---|---|
| P1 Turno y frentes | Es la raíz: todo vuelve a ella | — |
| P2 Registrar avance | ← Turno | P1 |
| P3 Nueva alerta | ← Turno | P1 |
| P4 Borrador | ← Turno, y «Editar registros» | P1 / P2 |
| P5 Enviar | ← Borrador (antes de enviar), ← Turno y «Volver al turno» (después) | P4 / P1 |

**Caminos alternativos (tomados de los criterios de aceptación):**

| Código | Historia | Situación | Recorrido en el prototipo |
|---|---|---|---|
| **A1** | HU-03 | Alerta de criticidad alta sin fotografía | P1 → Nueva alerta → 03a → Guardar → 03b error junto al campo → Tomar fotografía → 03c → Guardar → P1 |
| **A2** | HU-06 | Frentes sin resolver al pedir el reporte | P1 (01a, con 1.2 pendiente) → Revisar reporte → 04c lista el frente 1.2 → Ir al frente 1.2 → P2 |
| A3 (adicional) | HU-07 | Envío sin cobertura de red | P5 → 05d «Pendiente de envío por falta de red · PDF guardado» → Volver al turno |
| A4 (adicional) | HU-02 | Guardar sin señal en el frente | P2 → Guardar → 01c, el frente 1.2 aparece «Por sincronizar» con aviso de que se enviará solo |

**Estado vacío de P1 (HU-01, primer día del contrato):** 01b, lista de frentes vacía con «Agregar primer frente».

---

## 3. Formulario y estados (P2 Registrar avance)

### Campos y por qué están

Solo campos que pide HU-02 y que existen en la estructura de datos del Avance 3 (los mismos que anota el wireframe).

| Campo | Atributo de datos | Obligatorio | Control | Por qué está | Mensaje de error junto al campo |
|---|---|---|---|---|---|
| Fotografía | `fotografia` | Sí | Botón grande «Tomar fotografía» | Es la evidencia del avance | «Toma al menos 1 fotografía del avance.» |
| Ubicación | `latitud`, `longitud` | Sí (automática) | Precargada por GPS | HU-02 pide la ubicación en que se tomó, sin escribirla | (no aplica: se captura sola) |
| Empresa | `empresa_id` | Sí | Selector de la lista del contrato | El reporte agrupa por empresa contratista | «Elige la empresa.» |
| Origen de la descripción | `origen_descripcion` | Sí | Selector Dictar / Escribir | Dictar es lo que ahorra tiempo; escribir es la salida si hay ruido | (tiene valor por defecto: Dictar) |
| Descripción del avance | `descripcion` | Sí | Texto dictado o escrito, con «Repetir dictado» | Es el contenido del reporte | «Dicta o escribe qué se avanzó.» |
| Declarar sin actividad | `sin_actividad` | No | Interruptor | HU-04: declarar el frente sin trabajos con un toque | (si el frente ya tiene registros, pide confirmación) |

`frente_id` y `registrado_en` no se piden: vienen del frente elegido en P1 y del reloj del teléfono.

### Las cuatro decisiones del apunte, aplicadas

1. **Solo campos justificados:** cada campo tiene historia y atributo de datos.
2. **Etiqueta visible:** sobre el campo; el asterisco rojo y «* obligatorio» se ven antes de llenar, no después del error.
3. **Error junto al campo:** borde rojo, ícono y un mensaje que dice cómo corregir, más un aviso arriba con cuántos datos faltan.
4. **Precargar o elegir antes que escribir:** ubicación precargada, empresa elegida de una lista, descripción dictada.

### Los cuatro estados

| Estado | Marco | Qué ve el inspector |
|---|---|---|
| Vacío | 02a | Sin foto ni descripción; ubicación ya precargada; requisitos visibles |
| Cargando | 02b | Formulario atenuado y botón «Guardando registro…» |
| Con error | 02c | «Faltan 2 datos para guardar», borde rojo y mensaje bajo la foto y bajo la descripción; lo demás se conserva |
| Con datos | 02d | Foto, empresa, descripción dictada y la opción «Repetir dictado» (escenario de dictado defectuoso de HU-02) |

Los estados también están en las otras pantallas donde importan: P1 vacío (01b), P3 error (03b), P4 cargando y error (04a, 04c), P5 cargando y sin red (05b, 05d).

---

## 4. Registro de decisiones

### Qué quedó simulado y qué funciona de verdad

| Elemento | Simulado o funcional | Cómo se representa |
|---|---|---|
| Navegación, retornos y caminos alternativos | **Funcional** | Enlaces de Figma en cada botón y retorno |
| Validación de P2 y de P3 | **Funcional en el recorrido** | «Guardar» con datos faltantes lleva al marco de error |
| Estados vacío / cargando / error / con datos | **Funcional** | Marcos separados; los de carga avanzan solos («After delay») |
| Cámara | Simulado | «Tomar fotografía» salta al marco con una foto de ejemplo |
| Dictado y transcripción | Simulado | Tocar «Dictar» o «Tomar fotografía» lleva a 02d, con el texto de ejemplo ya transcrito |
| GPS | Simulado | Coordenadas fijas -22.4512, -68.9231 |
| Guardado sin señal y sincronización | Simulado | Etiqueta «Por sincronizar» y aviso en 01c |
| Generación del borrador | Simulado | 04a muestra el avance y pasa a un borrador de ejemplo |
| PDF, envío y acuse | Simulado | 05c confirma «Enviado 17:58 · acuse recibido»; «Ver PDF» no abre nada |
| Clima del turno | Simulado | Selector visible, no cambia nada |
| Nuevo frente (HU-05), declarar sin actividad (HU-04) | Fuera del recorrido | Visibles para que el usuario sepa que existen; no navegan |
| Inicio de sesión | Fuera del prototipo | Se asume sesión iniciada |

### Qué se observa en la prueba con usuarios (semana 7)

| Pantalla | Se cumple si el inspector… |
|---|---|
| P1 | Dice en voz alta qué frente le falta en menos de 5 segundos |
| P2 | Registra el avance del frente 1.2 sin ayuda y en menos de 1 minuto |
| P2 con error | Corrige al primer intento sin volver a llenar lo que tenía |
| P3 | Entiende por qué no se guardó la alerta alta y adjunta la foto |
| P4 | Aprueba el borrador sin reescribirlo, o lo resuelve si falta un frente |
| P5 | Sabe que el reporte se envió (o quedó en cola) y no lo reenvía para asegurarse |

### Decisiones de diseño

- **Una acción primaria por pantalla:** un solo botón turquesa abajo, al alcance del pulgar (Ley de Fitts). Lo secundario va con borde y sin relleno.
- **Sistema mínimo:** 2 tamaños de texto (16 y 24), 1 color de acción (turquesa 35D2C3 con texto 1E2B38), 1 color de alerta (rojo C62828), 1 unidad de espaciado (8 px; márgenes de 16 px).
- **Estado con palabra y color:** «Con registro», «Pendiente», «Sin actividad», «Por sincronizar» siempre escritos, no solo pintados.
- **Accesibilidad (WCAG 2.2, criterio 2.5.8):** objetivos táctiles de 44 px o más, sobre el mínimo de 24 × 24, pensando en uso con guantes.
- **Patrones conocidos (Ley de Jakob):** retorno arriba a la izquierda, lista con flecha, botón principal abajo.
- **Números grandes y no gráficos** en el resumen de P4: «5 frentes» y «2 alertas» son datos únicos, no comparaciones.
- **Datos de ejemplo:** tomados del wireframe (contrato 4600026893, J. Orellana, TECNASIC, inspeccion@mandante.cl).


