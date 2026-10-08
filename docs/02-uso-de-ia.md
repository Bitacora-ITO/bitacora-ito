# Primer uso documentado de IA

**Proyecto:** Bitácora - ITO
**Fecha:** 30 de septiembre de 2026
**Herramienta:** Claude (Anthropic)
**Responsable del registro:** Marcela Arancibia Godoy

---

## 1. Objetivo del uso

Diseñar la **estructura de datos preliminar** del sistema (entidades, relaciones y diccionario de campos) a partir del formato real del reporte diario que la empresa entrega hoy al mandante.

Se recurrió a IA porque el equipo tenía definido el flujo del usuario pero no su traducción a un modelo de datos, y porque omitir un campo tiene consecuencias difíciles de revertir: un dato que no se captura en terreno no puede reconstruirse después en gabinete.

## 2. Instrucción entregada

El trabajo se hizo en dos vueltas.

**Primera vuelta.** Se entregó como contexto el Avance 1 (propuesta de valor, alcance, usuarios) y el Avance 2 (propuesta de solución, caso de uso principal, maqueta preliminar), y se pidió:

> Diseñar la estructura de datos preliminar del proyecto: entidades, relaciones y diccionario de campos con tipo, obligatoriedad y ejemplo, más un diagrama. El modelo debe sostener el caso de uso principal y permitir calcular los indicadores de la propuesta de solución.

**Segunda vuelta.** Se entregaron dos reportes diarios reales del contrato (24 y 27 de septiembre de 2026, turno día, código de proyecto 4600026893-8211-FRMCS-00001) y se pidió analizar el formato vigente, proponer mejoras y corregir el modelo contra ese formato.

## 3. Respuesta obtenida

En la primera vuelta la herramienta propuso siete entidades (`usuario`, `proyecto`, `area`, `informe`, `hallazgo`, `fotografia`, `envio`), el diagrama de relaciones, el diccionario de campos y un conjunto de reglas de negocio. Aportó además un criterio de diseño que el equipo no había formulado: **construir el modelo desde el reporte hacia el terreno**, de modo que cada campo del documento final tenga un origen identificado en la captura.

En la segunda vuelta, al contrastar ese modelo con los reportes reales, quedó a la vista que **varias de sus decisiones estaban equivocadas**. El modelo se rehízo por completo y su versión corregida es la que acompaña este documento.

## 4. Qué se corrigió

La corrección más importante no fue de detalle sino de concepto. La propuesta inicial incorporaba seguimiento de hallazgos (estados de abierta y cerrada, responsables, plazos y arrastre de una alerta de un día al siguiente), funciones que parecen naturales en una herramienta digital. **El equipo determinó que el reporte no es un sistema de seguimiento**, sino la constancia de un turno, y todo eso se eliminó del modelo.

| Qué se corrigió | Por qué |
|---|---|
| Se eliminó todo el seguimiento de alertas: estado, cierre, responsable, plazo y arrastre entre reportes | El reporte deja constancia de un turno; no controla si alguien corrigió lo observado |
| Se eliminaron los campos técnicos separados (Pk, cota, capa, cantidad) y las marcas de liberación | Van dentro del texto que el inspector dicta, como se redacta hoy. Separarlos habría cargado al inspector en terreno sin beneficio |
| `hallazgo` se dividió en `registro` y `alerta` | En el reporte real son dos bloques distintos: el cuerpo de actividades por frente y la tabla de alertas del encabezado |
| `area` pasó a ser `frente` con jerarquía de frente y subfrente | El reporte se estructura en frentes y subfrentes numerados, por ejemplo 1.0 Muro Sotelo y dentro de él 1.2 Excavación y rellenos de zanja cortafuga, y no en áreas planas |
| El reporte pasó a ser del **turno** y no de un inspector | El reporte corresponde al turno y lleva el nombre de quien lo elabora en el campo «Elaborado por» |
| El catálogo de frentes dejó de configurarse por contrato | Los frentes cambian con el avance de la obra y los escribe el propio inspector |
| Se separaron `registrado_en` y `sincronizado_en` | Con una sola hora no se distingue un registro levantado en terreno de uno reconstruido en gabinete, que es uno de los indicadores comprometidos |
| Se agregó el campo `sin_actividad` | El reporte declara explícitamente los frentes detenidos, y eso también es información que el mandante espera |
| Se agregaron clima del turno y proyección del día siguiente | Están en el encabezado del formato real y la primera versión los había omitido |
| Se incorporó el campo `resumen_turno` en `reporte` y el escenario offline en `HU-07` | Permitir consolidar el texto del borrador en P4 y asegurar la generación local del PDF sin señal al cerrar el turno. |

## 5. Cómo se verificó

1. **Contraste con el documento real.** Se revisaron los dos reportes campo por campo, comprobando que cada dato del documento tuviera dónde guardarse en el modelo y que ningún campo del modelo careciera de lugar donde capturarse. De aquí salieron las correcciones de la sección anterior.
2. **Recorrido del caso de uso.** Se siguieron los nueve pasos del escenario principal del Avance 2 verificando que existiera el campo donde guardar lo que ocurre en cada paso. El paso 9, envío con registro de destinatarios, no tenía dónde almacenarse, y de ahí salió la entidad `envio`.
3. **Recorrido de las extensiones.** La extensión «sin cobertura de red» fue la que obligó a separar las dos marcas de tiempo.
4. **Prueba con los indicadores.** Se escribió el cálculo de los indicadores de la propuesta de solución usando solo campos del modelo. Un indicador que no se puede calcular señala un campo faltante.
5. **Decisión del equipo sobre el alcance.** El seguimiento de alertas no lo descartó la herramienta: lo descartó el equipo, al precisar qué es y qué no es el reporte diario.

## 6. Conclusión y límite del uso

La IA aportó velocidad y una estructura de partida razonable, pero **la primera versión del modelo estaba equivocada en aspectos de fondo**, y solo el contraste con el documento real y con el criterio del equipo permitió corregirla. Un modelo construido únicamente sobre la descripción del problema habría llevado a desarrollar funciones que nadie pidió.

El equipo mantiene el criterio de que toda salida de IA se revisa contra el caso de uso, el documento real y los indicadores antes de incorporarse, y que ninguna decisión de diseño se adopta solo porque la herramienta la propuso.

