# Bitácora - ITO

Aplicación móvil de inspección técnica de obras que registra en terreno lo observado durante el turno y **genera automáticamente el reporte diario** para emitirlo al mandante antes de que la jornada termine.

> Proyecto del curso *Ingeniería Digital en Acción: Datos, IA y MVPs*. Departamento de Ingeniería Industrial, Universidad de Santiago de Chile. Ecosistema de Desarrollo de Soluciones Digitales (DSD), segundo semestre 2026.

---

## Qué problema resuelve

Una empresa de inspección técnica de obras (ITO) presta servicios a mandantes de la industria minera. Sus inspectores pasan alrededor del 80 % de la jornada en terreno y un 20 % en gabinete, en turnos de 12 horas con una hora de colación. Al cierre de cada jornada deben elaborar el reporte diario y emitirlo al mandante, pero el tiempo no alcanza: el inspector se queda horas adicionales y, aun así, muchas veces el reporte se envía al día siguiente. El mandante reclama por la demora.

**Bitácora - ITO** traslada el registro al momento en que se observa: fotografía, dictado por voz y georreferencia desde el teléfono, organizados por los frentes de trabajo del contrato. Cada inspector revisa y firma su parte; el jefe de turno junta las partes firmadas en **un solo reporte**, lo revisa y lo envía al mandante sin volver a redactarlo.

## Para quién es

| Actor | Rol | Qué hace en el sistema |
|---|---|---|
| Inspector técnico de terreno | Usuario primario | Registra los avances y las alertas del turno; revisa y firma su parte |
| Jefe de turno | Usuario primario | Sigue el semáforo de partes firmadas, consolida, revisa el PDF y lo envía al mandante |
| Administrador | Usuario secundario | Mantiene el catálogo del contrato (áreas, empresas, usuarios y destinatarios) con una plantilla Excel |
| Mandante minero | Beneficiario | Recibe el reporte el mismo día, con evidencia fotográfica ubicada y trazable |
| Empresa de inspección técnica | Beneficiario | Reduce horas fuera de turno y reclamos contractuales |

## Qué es y qué no es el reporte

El reporte diario deja constancia de lo ocurrido en un turno: qué se ejecutó en cada frente, qué alertas hubo y, si el inspector detecta una observación, esa observación con su nivel de criticidad.

Cada reporte se cierra en sí mismo. El sistema no hace seguimiento: no arrastra alertas de un día a otro ni controla si algo se corrigió. Si la situación continúa, el inspector la reporta de nuevo al día siguiente.

## Propuesta de solución

> Creemos que reduciremos al menos a la mitad el tiempo de elaboración del reporte diario si el inspector técnico obtiene un reporte ya redactado al cierre del turno, mediante el registro en terreno de cada avance y cada alerta con fotografía, dictado y georreferencia, y su armado automático en el formato del mandante. Lo sabremos cuando, durante dos semanas seguidas, al menos el 80 % de los reportes de los inspectores participantes se emita antes del término del turno y el tiempo de elaboración disminuya por debajo de la mitad de la línea base.

El tipo de solución dominante es la **automatización**, sostenida por una capa de **registro**.

## Estado actual

**Semana 8: consolidación por el jefe de turno (versión 2, aprobada y publicada en Vercel).** Pedido del profesor guía: varios inspectores por turno y un solo reporte al mandante, enviado por el jefe de turno.

- Cada persona entra con su nombre y clave, y solo ve lo de su rol: inspector, jefe de turno o administrador.
- El inspector registra en terreno, **cierra su parte y la firma**. No genera PDF.
- El jefe de turno ve solo las partes firmadas y sigue un **semáforo** («3 de 4 ITO enviaron»). Con el semáforo en verde consolida, genera el PDF y envía **un solo correo** al mandante.
- El administrador mantiene el catálogo del contrato (áreas, empresas, usuarios y destinatarios) desde una **plantilla Excel**.
- Solo turno de día. El detalle está en [prototipo.md](docs/prototipo.md#6-cambios-de-la-semana-8) y las historias en [historias.md](docs/historias.md).

La aplicación está publicada en Vercel y se genera también como APK para Android.

| Hito | Semana | Estado |
|---|---|---|
| Propuesta de valor, alcance, usuarios (Avance 1) | 1 | Entregado |
| Propuesta de solución, caso de uso, maqueta, roadmap (Avance 2) | 2 | Entregado |
| Repositorio, README, estructura de datos, uso de IA (Avance 3) | 3 | Entregado |
| Historias de usuario y wireframes (Avance 4) | 4 | Entregado|
| Prototipo navegable (Avance 5) | 5 | Entregado |
| Prototipo v2: observaciones del profesor e Historial | 6 | Entregado |
| Análisis ético, de sostenibilidad e impacto | 7 | Entregado |
| Consolidación por el jefe de turno, firma del inspector y semáforo (PoC del flujo principal) | 8 | Entregado |
| MVP validado con inspectores | 12 | Pendiente |

## Stack tecnológico

| Para qué | Herramienta |
|---|---|
| Escribir el código | VS Code |
| Guardar y versionar el código | GitHub |
| Publicar la aplicación | Vercel |
| Base de datos y archivos (fotos y PDF) | Supabase |
| Documentar el proyecto | Notion |
| Comunicación del equipo | Slack |
| Asistencia de IA | Claude |

## Cómo se ejecuta

Aplicación desplegada: **https://bitacora-ito.vercel.app**

```bash
# 1. Clonar el repositorio
git clone https://github.com/Bitacora-ITO/bitacora-ito.git
cd bitacora-ito

# 2. Instalar dependencias
npm install

# 3. Configurar las variables de entorno
cp .env.example .env.local
# editar .env.local con las credenciales reales (nunca se suben al repositorio)

# 4. Levantar el entorno de desarrollo
npm run dev
```

Con esos pasos la aplicación se abre en el propio computador, en `http://localhost:3000`, que sirve solo para probar mientras se programa. La versión pública se genera automáticamente en Vercel con cada cambio en la rama `main`.

## Estructura del repositorio

```
bitacora-ito/
├── docs/                    Documentación del proyecto
│   ├── 01-estructura-datos.md
│   ├── 02-uso-de-ia.md
│   ├── historias.md         Historias de usuario y criterios de aceptación
│   ├── prototipo.md         Prototipo navegable, mapas y registro de decisiones
│   ├── etica.md
│   └── manual-instalacion.md
├── src/                     Código de la aplicación
├── public/                  Archivos estáticos y plantilla Excel del catálogo
├── supabase/migrations/     Estructura de la base de datos
├── android/                 Proyecto para generar el APK
├── pantallas/               Pantallas del prototipo (para Figma)
├── GUIA-FIGMA.md            Cómo está armado el prototipo en Figma
├── .env.example             Ejemplo de variables de entorno (sin credenciales reales)
├── .gitignore               Archivos y carpetas excluidos del repositorio
└── README.md
```

## Ramas y flujo de trabajo

| Rama | Uso |
|---|---|
| `main` | Versión estable. Es la que se publica en Vercel. |
| `dev` | Integración del trabajo del equipo. |

## Equipo

| Integrante | Usuario de GitHub |
|---|---|
| Jaritza Ramírez Valles | `Jariramirez` |
| Alejandra Silva Arroyo | `alejandrasilvaarroyo` |
| Fabián Prada Robles | `fabianpradar` |
| Marcela Arancibia Godoy | `Marcelarac` |

Equipo N.º 1, modalidad online.

## Documentación

- [Estructura de datos](docs/01-estructura-datos.md)
- [Primer uso documentado de IA](docs/02-uso-de-ia.md)
- [Historias de usuario y criterios de aceptación](docs/historias.md)
- [Prototipo navegable: mapa de navegación, estados y registro de decisiones](docs/prototipo.md) · [abrir en Figma](https://www.figma.com/proto/6lebHYRTbcb8f5WOnMW3pv/Sin-t%C3%ADtulo?node-id=1-2&p=f&t=XOez3IwfZ95WUirR-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1&starting-point-node-id=1%3A2&show-proto-sidebar=1)
- [Análisis ético, de sostenibilidad e impacto](docs/etica.md)
- [Manual de instalación](docs/manual-instalacion.md)
- [Espacio del proyecto en Notion](https://app.notion.com/p/Grupo-1-08f498f17d47828ca35e8193cb6cd76c)
