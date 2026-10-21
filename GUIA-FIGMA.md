# Guía para armar el prototipo en Figma

> **Versión 2 (semana 6): ya está aplicada en el archivo de Figma.**
>
> Las pantallas nuevas y las modificadas se hicieron directo en el archivo, a través del conector de Figma. No hay que importar nada nuevo:
>
> - **Agregar área:** 06a y 06b.
> - **Vista previa del PDF:** 07a y 07b. La 07a es la antigua 05e.
> - **Historial:** 08a a 08d.
> - **Pantallas modificadas:** 01a, 01b, 01c, 02a a 02d, 04a, 04b, 04c y 05a.
>
> Esta guía sigue sirviendo para entender cómo está armado el prototipo. Si alguna vez hay que rehacerlo a mano, las conexiones nuevas están en el [Paso 3b](#paso-3b-conexiones-de-la-versión-2).

Las 17 pantallas (5 pantallas con sus estados) ya están dibujadas en la carpeta `pantallas/`. En Figma solo hay que importarlas, conectarlas y compartir el enlace. Calcula alrededor de una hora.

## Paso 1. Crear el archivo

1. Entra a figma.com con una cuenta gratuita (basta con una del grupo; los demás se invitan).
2. **New design file** y nómbralo «Bitácora ITO – Prototipo».

## Paso 2. Importar las pantallas

1. Descomprime `pantallas.zip` (o usa la carpeta `pantallas/`): son 17 archivos `.svg`.
2. Selecciónalos todos y arrástralos juntos al lienzo. Cada archivo queda como un marco con su nombre. Los textos quedan editables porque usan Inter, que Figma ya trae.
3. Ordénalos en cinco filas, una por pantalla:
   - P1: 01a · 01b · 01c
   - P2: 02a · 02c · 02d · 02b
   - P3: 03a · 03b · 03c
   - P4: 04a · 04b · 04c
   - P5: 05a · 05b · 05c · 05d
4. Si algún marco quedó como grupo y no como frame: selecciónalo y usa **Ctrl/Cmd + Alt + G**.

## Paso 3. Conectar las pantallas

Abre la pestaña **Prototype** (panel derecho). Para cada fila de la tabla: selecciona el botón dentro del marco (doble clic hasta llegar a su rectángulo), arrastra el círculo azul hasta el marco destino y elige el disparador.

Si cuesta seleccionar un botón, dibuja encima un rectángulo transparente (Fill al 0 %) del mismo tamaño y conecta ese rectángulo.

| Desde | Elemento | Disparador | Hacia |
|---|---|---|---|
| 01a Turno | Fila «1.2 Excavación ZCF» | On tap | 02a |
| 01a Turno | Nueva alerta | On tap | 03a |
| 01a Turno | Revisar reporte del turno | On tap | 04c (camino A2: falta resolver 1.2) |
| 01c Turno | Revisar reporte del turno | On tap | 04a |
| 01c Turno | Nueva alerta | On tap | 03a |
| 02a vacío | ← Turno | On tap | 01a |
| 02a vacío | Tomar fotografía | On tap | 02d (simula foto y dictado) |
| 02a vacío | Guardar registro | On tap | 02c (error) |
| 02a vacío | Dictar | On tap | 02d (simula el dictado) |
| 02c error | ← Turno | On tap | 01a |
| 02c error | Tomar fotografía | On tap | 02d (corrige) |
| 02d con datos | ← Turno | On tap | 01a |
| 02d con datos | Guardar registro | On tap | 02b |
| 02b cargando | (marco completo) | After delay 1200 ms | 01c |
| 03a sin foto | ← Turno | On tap | 01a |
| 03a sin foto | Guardar alerta | On tap | 03b (camino A1) |
| 03a sin foto | Tomar fotografía | On tap | 03c |
| 03b error | ← Turno | On tap | 01a |
| 03b error | Tomar fotografía | On tap | 03c |
| 03c con datos | ← Turno | On tap | 01a |
| 03c con datos | Guardar alerta | On tap | 01a |
| 04a cargando | (marco completo) | After delay 1500 ms | 04b |
| 04a cargando | Cancelar y volver al turno | On tap | 01c |
| 04b borrador | ← Turno | On tap | 01c |
| 04b borrador | Editar registros | On tap | 02d |
| 04b borrador | Aprobar reporte | On tap | 05a |
| 04c sin resolver | ← Turno / Volver al turno | On tap | 01a |
| 04c sin resolver | Ir al frente 1.2 | On tap | 02a |
| 05a enviar | ← Borrador | On tap | 04b |
| 05a enviar | Confirmar envío | On tap | 05b |
| 05b cargando | (marco completo) | After delay 1200 ms | 05c |
| 05c enviado | ← Turno / Volver al turno | On tap | 01c |
| 05d sin red | ← Turno / Volver al turno | On tap | 01c |

Para el «After delay»: selecciona el marco completo (clic en su nombre), agrega la interacción y cambia *On tap* por *After delay*.

Animación sugerida para todo: **Instant** o **Dissolve 200 ms**.

## Paso 3b. Conexiones de la versión 2

| Desde | Elemento | Disparador | Hacia |
|---|---|---|---|
| 01a / 01c | Agregar área | On tap | 06a |
| 01b | Agregar primera área | On tap | 06a |
| 01a / 01b / 01c | Ícono calendario (arriba a la derecha) | On tap | 08a |
| 06a | ← Turno | On tap | 01a |
| 06a | Fila «Túnel PAMo» o «Elegir empresa» | On tap | 06b |
| 06b | ← Áreas o «Cambiar» | On tap | 06a |
| 06b | Agregar al turno | On tap | 01a |
| 04b | Ver vista previa del PDF | On tap | 07a |
| 07a | ← Borrador o «Volver a editar» | On tap | 04b |
| 07a | Paginador «‹ 1 / 2 ›» | On tap | 07b |
| 07a / 07b | Aprobar y enviar | On tap | 05a |
| 07b | Paginador «‹ 2 / 2 ›» | On tap | 07a |
| 07b | ← Borrador o «Volver a editar» | On tap | 04b |
| 05a | ← Vista previa o tarjeta del PDF | On tap | 07a |
| 08a | ← Turno o «Volver al turno» | On tap | 01a |
| 08a | Días verdes (8, 9, 10, 12 y 13) | On tap | 08b |
| 08a | Día rojo (11) | On tap | 08c |
| 08a | Tarjeta «Rol 7x7 · Cambiar» | On tap | 08d |
| 08b / 08c / 08d | ← Historial o botón inferior | On tap | 08a |

## Paso 4. Puntos de inicio (flows)

En Prototype, con un marco seleccionado, toca **+ Flow starting point** y nómbralo:

| Marco | Nombre del flujo | Para qué |
|---|---|---|
| 01a | Ruta principal | Turno completo de punta a punta; incluye A2 si se pide el reporte antes de registrar 1.2 |
| 03a | A1 · Alerta alta sin foto | Mostrar el error de HU-03 |
| 05d | A3 · Envío sin red | Mostrar el envío en cola de HU-07 |
| 01b | Estado vacío | Primer día del contrato (HU-01) |
| 08a | Historial | Calendario con enviados, no entregados y descansos (HU-10) |

## Paso 5. Ajustes del dispositivo

Sin nada seleccionado, en Prototype: **Device: iPhone 13 / 14** (390 × 844). Fondo de presentación: gris claro.

## Paso 6. Anotaciones de estados

El apunte pide que los estados estén «señalados en la anotación». Al lado de cada marco agrega un cuadro de texto corto, por ejemplo:

- 01b: «P1 VACÍO · primer día del contrato (HU-01).»
- 01c: «P1 tras guardar sin señal: 1.2 Por sincronizar (HU-02).»
- 02a: «P2 VACÍO · requisitos visibles antes de llenar.»
- 02b: «P2 CARGANDO · simula guardado.»
- 02c: «P2 ERROR · junto al campo, se conserva lo ingresado.»
- 02d: «P2 CON DATOS · foto, GPS y dictado simulados.»
- 03b: «P3 ERROR · alerta alta sin foto (A1, HU-03).»
- 04a: «P4 CARGANDO · generación simulada.»
- 04c: «P4 ERROR · frentes sin resolver (A2, HU-06).»
- 05b: «P5 CARGANDO · envío simulado.»
- 05d: «P5 SIN RED · PDF en cola (A3, HU-07).»

## Paso 7. Probar y compartir

1. Toca **Present** (▶ arriba a la derecha) y recorre la ruta principal completa. Verifica que en **cada** pantalla el retorno funcione.
2. Prueba los caminos alternativos: en 01a toca «Revisar reporte» antes de registrar 1.2 (A2), y en P3 guarda la alerta alta sin foto (A1).
3. **Share prototype** → «Anyone with the link can view» → copia el enlace.
4. Pega el enlace en `docs/prototipo.md`, en la primera línea.

## Lista de revisión antes de entregar

- [ ] 5 pantallas enlazadas y recorribles de principio a fin
- [ ] Retorno visible y funcionando en cada pantalla
- [ ] Dos caminos alternativos (A1 y A2) recorribles; A3 y A4 de regalo
- [ ] Formulario con estados vacío, cargando, error y con datos, anotados
- [ ] Mapa de navegación y registro de decisiones en `docs/prototipo.md`
- [ ] `README.md` enlaza a `docs/prototipo.md`
- [ ] Enlace de Figma pegado y abierto en una ventana privada para confirmar que se ve sin iniciar sesión
