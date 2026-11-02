"""Genera las planillas de catálogo de Bitácora ITO con diseño (prellenada y en blanco).

Uso (requiere openpyxl): python -I scripts/catalogo/planilla_lujo.py public/plantillas/catalogo-bitacora-ito.xlsx public/plantillas
Usa exactamente los encabezados y datos de la plantilla que genera la app.
"""
import sys
from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ORIGEN, SALIDA = Path(sys.argv[1]), Path(sys.argv[2])
SALIDA.mkdir(parents=True, exist_ok=True)

TINTA, TEAL, TEAL_OSC, TEAL_BG = "1E2B38", "35D2C3", "0F8F83", "E3F7F4"
GRIS, LINEA, ZEBRA, AMBAR_BG = "5B6875", "DDE3E8", "F4F7F9", "FFF4D6"
FUENTE = "Calibri"

TIPOS = ["Contratista", "Laboratorio", "Topografía", "Obras civiles", "Otro"]
ROLES = ["Inspector", "Jefe de turno", "Administrador"]
SINO = ["Sí", "No"]

borde = Border(*(Side(style="thin", color=LINEA),) * 4)
ANCHOS = {
    "Contrato": [18, 46, 26, 30, 22, 14, 16, 26, 14, 36, 16],
    "Áreas": [44, 10, 12],
    "Empresas": [30, 18],
    "Usuarios": [30, 34, 18, 12],
}
AYUDA = {  # (hoja, encabezado) -> (título, mensaje) que Excel muestra al seleccionar la celda
    ("Contrato", "Último correlativo"): ("Número entero", "Último número de reporte emitido. El próximo será este + 1."),
    ("Contrato", "Destinatarios (separados por ;)"): ("Correos del mandante", "Ejemplo: inspeccion@mandante.cl; jefe@mandante.cl"),
    ("Contrato", "Hora de cierre turno día"): ("Formato HH:MM", "Ejemplo: 19:00"),
    ("Áreas", "Orden"): ("Número entero", "Orden en que aparece el área (1, 2, 3…)."),
    ("Áreas", "Vigente"): ("Sí o No", "«No» = el área ya no se ofrece, pero no se borra."),
    ("Empresas", "Tipo"): ("Elija de la lista", "Contratista, Laboratorio, Topografía, Obras civiles u Otro."),
    ("Usuarios", "Rol"): ("Elija de la lista", "Inspector, Jefe de turno o Administrador."),
    ("Usuarios", "Activo"): ("Sí o No", "«No» = el usuario deja de aparecer en los teléfonos."),
    ("Usuarios", "Correo"): ("Correo electrónico", "Debe incluir @."),
}

origen = openpyxl.load_workbook(ORIGEN)
DATOS = {}
for nombre in ["Contrato", "Áreas", "Empresas", "Usuarios"]:
    ws = origen[nombre]
    filas = [list(r) for r in ws.iter_rows(values_only=True)]
    enc = [c for c in filas[0] if c is not None]
    datos = [r[: len(enc)] for r in filas[1:] if any(v not in (None, "") for v in r[: len(enc)])]
    DATOS[nombre] = (enc, datos)

EJEMPLOS = {
    "Contrato": ["(Ejemplo) 4600026893", "Servicio de Inspección Técnica de Obras …", "Nombre del mandante",
                 "4600026893-8211-FRMCS-00001", "JEJ-664-CT-INF-002", "1", "02-07-2024", "4600026893-8211-INDCS-", 1972,
                 "inspeccion@mandante.cl", "19:00"],
    "Áreas": ["(Ejemplo) Peralte Muro Sotelo", 1, "Sí"],
    "Empresas": ["(Ejemplo) TECNASIC", "Contratista"],
    "Usuarios": ["(Ejemplo) Jorge Orellana S.", "jorellana@empresa.cl", "Inspector", "Sí"],
}


def hoja_instrucciones(wb, en_blanco: bool):
    ws = wb.active
    ws.title = "Instrucciones"
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = TEAL_OSC
    ws.column_dimensions["A"].width = 3
    ws.column_dimensions["B"].width = 36
    ws.column_dimensions["C"].width = 62
    ws.column_dimensions["D"].width = 52
    banda = PatternFill("solid", fgColor=TEAL_OSC)
    for fila in (1, 2, 3):
        for col in "ABCD":
            ws[f"{col}{fila}"].fill = banda
    ws.row_dimensions[2].height = 34
    ws["B2"] = "Catálogo de Bitácora ITO"
    ws["B2"].font = Font(name=FUENTE, size=20, bold=True, color="FFFFFF")
    ws["B3"] = "Contrato, áreas, empresas y usuarios que usan los teléfonos" + (" · plantilla en blanco" if en_blanco else " · catálogo actual")
    ws["B3"].font = Font(name=FUENTE, size=11, color="E3F7F4")

    fila = 5
    def titulo(t):
        nonlocal fila
        ws[f"B{fila}"] = t
        ws[f"B{fila}"].font = Font(name=FUENTE, size=13, bold=True, color=TINTA)
        fila += 1

    titulo("Cómo se usa")
    pasos = [
        "Llene las hojas Contrato, Áreas, Empresas y Usuarios. No cambie el nombre de las hojas ni los encabezados (fila 1).",
        "Use las listas desplegables donde aparecen (Tipo, Rol, Sí/No). Al seleccionar una celda, Excel muestra una ayuda.",
        "Guarde el archivo y cárguelo en la app: modo administrador → «Cargar Excel». La app revisa todo y muestra los cambios antes de publicar.",
        "Toque «Publicar catálogo». Los teléfonos verán «Hay un catálogo nuevo · Actualizar».",
        "Nada se borra: un área o usuario que ya no va se marca «No» en Vigente o Activo.",
    ]
    if en_blanco:
        pasos.insert(1, "La fila gris que empieza con «(Ejemplo)» es solo una guía: la app la ignora. Puede dejarla o borrarla.")
    for i, p in enumerate(pasos, 1):
        ws[f"B{fila}"] = f"Paso {i}"
        ws[f"B{fila}"].font = Font(name=FUENTE, bold=True, color=TEAL_OSC)
        ws[f"B{fila}"].alignment = Alignment(vertical="top")
        ws[f"C{fila}"] = p
        ws[f"C{fila}"].alignment = Alignment(wrap_text=True, vertical="top")
        ws.merge_cells(f"C{fila}:D{fila}")
        ws.row_dimensions[fila].height = 32
        fila += 1

    fila += 1
    titulo("Qué va en cada columna")
    for col, t in zip("BCD", ["Hoja · columna", "Qué es", "Valores permitidos"]):
        c = ws[f"{col}{fila}"]
        c.value = t
        c.font = Font(name=FUENTE, bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=TINTA)
        c.alignment = Alignment(vertical="center")
    ws.row_dimensions[fila].height = 22
    fila += 1
    filas = [
        ("Contrato · Número de contrato", "Número del contrato con el mandante", "Una sola fila en la hoja"),
        ("Contrato · Prefijo de correlativo", "Inicio del número de cada reporte", "Ejemplo: 4600026893-8211-INDCS-"),
        ("Contrato · Último correlativo", "Último número emitido", "Número entero"),
        ("Contrato · Destinatarios", "Correos del mandante que reciben el reporte", "Separados por punto y coma (;)"),
        ("Contrato · Hora de cierre", "Hora límite del turno día", "HH:MM, por ejemplo 19:00"),
        ("Áreas · Nombre", "Área de la obra que elige el inspector", "Sin repetir"),
        ("Áreas · Orden", "Orden en la lista", "Número entero mayor que 0"),
        ("Áreas · Vigente", "Si se ofrece en los teléfonos", "Sí / No"),
        ("Empresas · Nombre", "Empresa que ejecuta los trabajos", "Sin repetir"),
        ("Empresas · Tipo", "Clase de empresa", " / ".join(TIPOS)),
        ("Usuarios · Nombre", "Persona que usa la app", "Sin repetir; así aparece en «Elaborado por»"),
        ("Usuarios · Correo", "Correo de la persona", "Debe incluir @"),
        ("Usuarios · Rol", "Qué puede hacer en la app", " / ".join(ROLES)),
        ("Usuarios · Activo", "Si aparece en los teléfonos", "Sí / No"),
    ]
    for k, (a, b, c) in enumerate(filas):
        for col, v in zip("BCD", (a, b, c)):
            celda = ws[f"{col}{fila}"]
            celda.value = v
            celda.font = Font(name=FUENTE, bold=(col == "B"), color=TINTA if col != "D" else TEAL_OSC)
            celda.alignment = Alignment(wrap_text=True, vertical="center")
            celda.border = borde
            if k % 2:
                celda.fill = PatternFill("solid", fgColor=ZEBRA)
        ws.row_dimensions[fila].height = 22
        fila += 1

    fila += 1
    ws[f"B{fila}"] = "Importante"
    ws[f"B{fila}"].font = Font(name=FUENTE, bold=True, color="8A6100")
    ws[f"C{fila}"] = "Los destinatarios del contrato también deben estar autorizados en Vercel (MAIL_DESTINATARIOS_PERMITIDOS); si no, el correo no sale."
    ws[f"C{fila}"].alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(f"C{fila}:D{fila}")
    for col in "BCD":
        ws[f"{col}{fila}"].fill = PatternFill("solid", fgColor=AMBAR_BG)
    ws.row_dimensions[fila].height = 34


def hoja_listas(wb):
    ws = wb.create_sheet("Listas")
    for col, (titulo, valores) in enumerate([("Tipos", TIPOS), ("Roles", ROLES), ("SiNo", SINO)], start=1):
        ws.cell(row=1, column=col, value=titulo)
        for i, v in enumerate(valores, start=2):
            ws.cell(row=i, column=col, value=v)
    ws.sheet_state = "hidden"


def hoja_datos(wb, nombre, en_blanco: bool):
    enc, datos = DATOS[nombre]
    ws = wb.create_sheet(nombre)
    ws.sheet_properties.tabColor = TEAL if nombre != "Contrato" else TINTA
    ws.freeze_panes = "A2"
    ws.sheet_view.zoomScale = 110
    filas = [EJEMPLOS[nombre]] if en_blanco else datos
    total = 1 if nombre == "Contrato" else max(len(filas) + 40, 60)

    for j, h in enumerate(enc, start=1):
        c = ws.cell(row=1, column=j, value=h)
        c.font = Font(name=FUENTE, bold=True, color="FFFFFF", size=11)
        c.fill = PatternFill("solid", fgColor=TINTA)
        c.alignment = Alignment(vertical="center", wrap_text=True)
        c.border = borde
        ws.column_dimensions[get_column_letter(j)].width = ANCHOS[nombre][j - 1] if j - 1 < len(ANCHOS[nombre]) else 18
    ws.row_dimensions[1].height = 30

    for i in range(2, total + 2):
        valores = filas[i - 2] if i - 2 < len(filas) else [None] * len(enc)
        ejemplo = en_blanco and i == 2
        for j in range(1, len(enc) + 1):
            v = valores[j - 1] if j - 1 < len(valores) else None
            c = ws.cell(row=i, column=j, value=v)
            c.border = borde
            c.alignment = Alignment(vertical="center")
            c.font = Font(name=FUENTE, italic=ejemplo, color="8A96A3" if ejemplo else TINTA)
            if i % 2 == 1:
                c.fill = PatternFill("solid", fgColor=ZEBRA)
            if enc[j - 1] in ("Número de contrato", "Revisión de formato", "Fecha de formato", "Hora de cierre turno día"):
                c.number_format = "@"
        ws.row_dimensions[i].height = 20
    ultima = total + 1
    ws.auto_filter.ref = f"A1:{get_column_letter(len(enc))}{ultima}"

    def validar(encabezado, dv):
        if encabezado not in enc:
            return
        col = get_column_letter(enc.index(encabezado) + 1)
        titulo, msg = AYUDA.get((nombre, encabezado), (None, None))
        if titulo:
            dv.promptTitle, dv.prompt, dv.showInputMessage = titulo, msg, True
        dv.errorTitle, dv.error, dv.showErrorMessage = "Valor no permitido", "Use un valor de la lista o el formato indicado.", True
        ws.add_data_validation(dv)
        dv.add(f"{col}2:{col}{ultima}")

    validar("Vigente", DataValidation(type="list", formula1="=Listas!$C$2:$C$3", allow_blank=True))
    validar("Activo", DataValidation(type="list", formula1="=Listas!$C$2:$C$3", allow_blank=True))
    validar("Tipo", DataValidation(type="list", formula1="=Listas!$A$2:$A$6", allow_blank=True))
    validar("Rol", DataValidation(type="list", formula1="=Listas!$B$2:$B$4", allow_blank=True))
    validar("Orden", DataValidation(type="whole", operator="greaterThan", formula1="0", allow_blank=True))
    validar("Último correlativo", DataValidation(type="whole", operator="greaterThanOrEqual", formula1="0", allow_blank=True))
    if "Correo" in enc:
        col = get_column_letter(enc.index("Correo") + 1)
        validar("Correo", DataValidation(type="custom", formula1=f'ISNUMBER(SEARCH("@",{col}2))', allow_blank=True))
    for (h_hoja, h), _ in AYUDA.items():
        pass


def generar(en_blanco: bool, nombre_archivo: str):
    wb = openpyxl.Workbook()
    hoja_instrucciones(wb, en_blanco)
    for n in ["Contrato", "Áreas", "Empresas", "Usuarios"]:
        hoja_datos(wb, n, en_blanco)
    hoja_listas(wb)
    wb.properties.title = "Catálogo de Bitácora ITO"
    wb.properties.creator = "Bitácora ITO"
    wb.active = 0
    destino = SALIDA / nombre_archivo
    wb.save(destino)
    print("ok", destino)


generar(False, "catalogo-bitacora-ito.xlsx")
generar(True, "catalogo-bitacora-ito-en-blanco.xlsx")
