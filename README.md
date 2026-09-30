# Bitácora - ITO

Aplicación móvil de inspección técnica de obras que registra en terreno lo observado durante el turno y **genera automáticamente el reporte diario** para emitirlo al mandante antes de que la jornada termine.

> Proyecto del curso *Ingeniería Digital en Acción: Datos, IA y MVPs*. Departamento de Ingeniería Industrial, Universidad de Santiago de Chile. Ecosistema de Desarrollo de Soluciones Digitales (DSD), segundo semestre 2026.

---

## Qué problema resuelve

Una empresa de inspección técnica de obras (ITO) presta servicios a mandantes de la industria minera. Sus inspectores pasan alrededor del 80 % de la jornada en terreno y un 20 % en gabinete, en turnos de 12 horas con una hora de colación. Al cierre de cada jornada deben elaborar el reporte diario y emitirlo al mandante, pero el tiempo no alcanza: el inspector se queda horas adicionales y, aun así, muchas veces el reporte se envía al día siguiente. El mandante reclama por la demora.

**Bitácora - ITO** traslada el registro al momento en que se observa: fotografía, dictado por voz y georreferencia desde el teléfono, organizados por los frentes de trabajo del contrato. Con eso el sistema arma el borrador del reporte diario, que el inspector revisa, aprueba y emite sin volver a redactarlo.

## Para quién es

| Actor | Rol | Qué hace en el sistema |
|---|---|---|
| Inspector técnico de terreno | Usuario primario | Registra los avances y las alertas del turno; revisa y aprueba el reporte |
| Jefatura de inspección | Usuario secundario | Configura el contrato y sus destinatarios; supervisa la emisión de los reportes |
| Mandante minero | Beneficiario | Recibe el reporte el mismo día, con evidencia fotográfica ubicada y trazable |
| Empresa de inspección técnica | Beneficiario | Reduce horas fuera de turno y reclamos contractuales |

## Qué es y qué no es el reporte

El reporte diario deja constancia de lo ocurrido en un turno: qué se ejecutó en cada frente, qué alertas hubo y, si el inspector detecta una observación, esa observación con su nivel de criticidad.

Cada reporte se cierra en sí mismo. El sistema no hace seguimiento: no arrastra alertas de un día a otro ni controla si algo se corrigió. Si la situación continúa, el inspector la reporta de nuevo al día siguiente.

## Propuesta de solución

> Creemos que reduciremos al menos a la mitad el tiempo de elaboración del reporte diario si el inspector técnico obtiene un reporte ya redactado al cierre del turno, mediante el registro en terreno de cada avance y cada alerta con fotografía, dictado y georreferencia, y su armado automático en el formato del mandante. Lo sabremos cuando, durante dos semanas seguidas, al menos el 80 % de los reportes de los inspectores participantes se emita antes del término del turno y el tiempo de elaboración disminuya por debajo de la mitad de la línea base.

El tipo de solución dominante es la **automatización**, sostenida por una capa de **registro**.

## Estado actual

**Semana 3: configuración del ambiente de desarrollo.** El repositorio, el README y la estructura de datos preliminar están definidos. Todavía no hay código de aplicación.

| Hito | Semana | Estado |
|---|---|---|
| Propuesta de valor, alcance, usuarios (Avance 1) | 1 | Entregado |
| Propuesta de solución, caso de uso, maqueta, roadmap (Avance 2) | 2 | Entregado |
| Repositorio, README, estructura de datos, uso de IA (Avance 3) | 3 | En curso |
| PoC del flujo principal | 8 | Pendiente |
| MVP validado con inspectores | 12 | Pendiente |

## Stack tecnológico

| Para qué | Herramienta |
|---|---|
| Escribir el código | VS Code |
| Guardar y versionar el código | GitHub |
| Publicar la aplicación | Vercel |
| Base de datos, archivos y cuentas de usuario | Supabase |
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
│   └── 02-uso-de-ia.md
├── src/                     Código de la aplicación
├── public/                  Archivos estáticos
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

- [Estructura de datos preliminar](docs/01-estructura-datos.md)
- [Primer uso documentado de IA](docs/02-uso-de-ia.md)
- [Espacio del proyecto en Notion](https://app.notion.com/p/Grupo-1-08f498f17d47828ca35e8193cb6cd76c)
