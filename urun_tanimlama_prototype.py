"""
URUN TANIMLAMA MODULU - PROFESYONEL PROTOTIP
---------------------------------------------
Sol panel : Parca Kutuphanesi (aranabilir, turlere gore gruplu agac, surukleme kaynagi)
Sag panel : Secili parca icin iki sekme
  - Is Plani / Proses Akisi : aranabilir combo ile operasyon ekle, surukle-birak ile sirala,
    cift tikla makine sec (checkbox liste - MACHINES_MASTER'dan, tamamen ekle/cikar edilebilir)
  - Montaj Yapisi (BOM)     : sol kutuphaneden surukle-birak ile parca ekle

Calistirma : pip install PySide6   ->   python urun_tanimlama_prototype.py
"""

import sys
from PySide6.QtCore import Qt, QMimeData, QSize
from PySide6.QtGui import QDrag, QFont, QColor
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QSplitter, QVBoxLayout, QHBoxLayout,
    QTreeWidget, QTreeWidgetItem, QTabWidget, QListWidget, QListWidgetItem,
    QComboBox, QPushButton, QLabel, QDialog, QDialogButtonBox, QCheckBox,
    QLineEdit, QFormLayout, QMessageBox, QCompleter, QToolBar, QGroupBox,
    QAbstractItemView, QFrame, QMenu, QInputDialog
)

# ============================================================================
# DEMO MASTER VERI (gercekte DB/repository katmanindan gelecek)
# ============================================================================

PART_TYPES = ["raw_material", "assembly_material", "component", "sub_assembly", "final_product"]
PART_TYPE_LABELS = {
    "raw_material": "Hammadde",
    "assembly_material": "Montaj Malzemesi",
    "component": "Parca (Islem Gorur)",
    "sub_assembly": "Alt Montaj",
    "final_product": "Ana Mamul",
}
PART_TYPE_COLORS = {
    "raw_material": "#8d6e63",
    "assembly_material": "#607d8b",
    "component": "#1976d2",
    "sub_assembly": "#7b1fa2",
    "final_product": "#2e7d32",
}

OPERATIONS_MASTER = [
    {"op_code": 100, "op_name": "CUTTING"},
    {"op_code": 102, "op_name": "ANNEALING"},
    {"op_code": 105, "op_name": "HOT FORGING"},
    {"op_code": 114, "op_name": "COLD FORGING"},
    {"op_code": 200, "op_name": "QUENCH + TEMPERING"},
    {"op_code": 201, "op_name": "NORMALIZE"},
    {"op_code": 202, "op_name": "INDUCTION"},
    {"op_code": 301, "op_name": "HOUSING INNER MACHINING"},
    {"op_code": 303, "op_name": "BOOT CANAL MACHINING"},
    {"op_code": 304, "op_name": "SHAFT MACHINING"},
    {"op_code": 321, "op_name": "SPHERE BURNISHING"},
    {"op_code": 322, "op_name": "SCREWING WITH ROLLING"},
    {"op_code": 325, "op_name": "TUBE CUTTING"},
    {"op_code": 355, "op_name": "SPHERE MACHINING"},
    {"op_code": 356, "op_name": "SHAFT MACHINING"},
    {"op_code": 371, "op_name": "TUBE SWAGING"},
    {"op_code": 380, "op_name": "BURR CLEANING"},
    {"op_code": 408, "op_name": "LOGO DATE MARKING"},
    {"op_code": 410, "op_name": "ROLLING"},
    {"op_code": 412, "op_name": "SUPPORT ASSEMBLY"},
    {"op_code": 414, "op_name": "GREASING"},
    {"op_code": 415, "op_name": "MOUNTING DUST BOOT"},
    {"op_code": 420, "op_name": "PUTTING PROT. CAP"},
    {"op_code": 425, "op_name": "BALL JOINT ASSEMBLING"},
    {"op_code": 429, "op_name": "PAINTING"},
    {"op_code": 435, "op_name": "Fe/ZnPh COATING"},
    {"op_code": 438, "op_name": "CLAMP, BOLT, NUT ASSEMBLING"},
    {"op_code": 442, "op_name": "PUTTING END CAP"},
    {"op_code": 471, "op_name": "PUTTING BALL PIN IN HOUSING"},
    {"op_code": 473, "op_name": "MOUNTING U RING"},
    {"op_code": 492, "op_name": "MOUNTING RING ON DUST BOOT"},
    {"op_code": 499, "op_name": "OE NO INKJET MARKING"},
    {"op_code": 519, "op_name": "CRACK CONTROL"},
    {"op_code": 533, "op_name": "INCOME QUALITY CONTROL"},
    {"op_code": 534, "op_name": "FINAL CONTROL"},
    {"op_code": 612, "op_name": "PACKAGING"},
    {"op_code": 821, "op_name": "BOLT CANAL MACHINING"},
    {"op_code": 929, "op_name": "PUTTING BEARING"},
    # ... gercek sistemde 380 kayit repository/DB'den gelecek
]

# Goruntulerden derlenen 77 makine kodu (T/D/I/M/KK). Bu liste dinamiktir;
# "Makine Kutuphanesi" ekranindan ekle/pasiflestir/sil yapilabilir.
MACHINES_MASTER = (
    [{"machine_code": c, "machine_type": "cnc_tool"} for c in
     ["T11","T12","T27","T104","T112","T118","T119","T121","T122","T139","T146",
      "T150","T151","T154","T155","T157","T158","T164","T168","T181","T182","T188",
      "T189","T191","T192","T193","T194","T195","T196","T197","T203","T204","T205"]]
    + [{"machine_code": c, "machine_type": "die_fixture"} for c in
       ["D3","D15","D16","D19","D24","D30","D37","D38","D42","D53","D55","D60",
        "D61","D65","D66","D68","D69"]]
    + [{"machine_code": c, "machine_type": "gauge_instrument"} for c in
       ["I9","I11","I12","I13","I20","I30","I50","I60","I61"]]
    + [{"machine_code": c, "machine_type": "assembly_station"} for c in
       ["M2","M3","M4","M6","M12","M13","M17","M18","M22","M24","M45","M50","M51","M72"]]
    + [{"machine_code": c, "machine_type": "ndt_gauge"} for c in
       ["KK25","KK26","KK27","KK28"]]
)

MACHINE_TYPE_LABELS = {
    "cnc_tool": "CNC Tezgahi",
    "die_fixture": "Kalip / Fikstur",
    "gauge_instrument": "Olcum Aleti",
    "assembly_station": "Montaj Istasyonu",
    "ndt_gauge": "Catlak Kontrol (NDT)",
}

OPERATION_ELIGIBLE_MACHINES = {
    114: ["D24"],
    200: ["I13", "I9"],
    202: ["I50", "I20", "I30", "I61", "I60"],
    356: ["T195", "T196", "T197", "T191", "T192", "T164", "T193"],
    355: ["T195", "T196", "T197", "T191", "T192", "T164", "T193"],
    429: ["M12"],
    435: ["M18"],
    519: ["KK25", "KK26", "KK27", "KK28"],
}

# Uygulama-ici veri deposu (demo). Gercekte repository/DB katmani.
PARTS = {}
ROUTINGS = {}
BOM = {}


# ============================================================================
# YARDIMCI DIALOGLAR
# ============================================================================
class AddPartDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Yeni Parca Tanimla")
        self.setMinimumWidth(340)

        self.part_no_edit = QLineEdit()
        self.part_no_edit.setPlaceholderText("orn. A3-9132")
        self.part_name_edit = QLineEdit()
        self.part_name_edit.setPlaceholderText("orn. BALL PIN BLANK")
        self.type_combo = QComboBox()
        for t in PART_TYPES:
            self.type_combo.addItem(PART_TYPE_LABELS[t], t)

        form = QFormLayout()
        form.addRow("Parca No:", self.part_no_edit)
        form.addRow("Parca Adi:", self.part_name_edit)
        form.addRow("Tur:", self.type_combo)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)

        layout = QVBoxLayout(self)
        title = QLabel("Yeni Parca")
        title.setStyleSheet("font-size: 15px; font-weight: 600; margin-bottom: 6px;")
        layout.addWidget(title)
        layout.addLayout(form)
        layout.addWidget(buttons)

    def get_data(self):
        return {
            "part_no": self.part_no_edit.text().strip(),
            "part_name": self.part_name_edit.text().strip(),
            "type": self.type_combo.currentData(),
        }


class MachineSelectDialog(QDialog):
    """Bir operasyon icin uygun makinelerin checkbox ile secildigi dialog."""
    def __init__(self, op_code, op_name, eligible_codes, selected_codes, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"[{op_code}] {op_name} - Nerede Yapilacak?")
        self.setMinimumWidth(300)
        self.checkboxes = []

        layout = QVBoxLayout(self)
        info = QLabel("Bu operasyonun yapilabilecegi makine/istasyonlari isaretleyin:")
        info.setWordWrap(True)
        layout.addWidget(info)

        codes = eligible_codes if eligible_codes else [m["machine_code"] for m in MACHINES_MASTER]
        by_type = {}
        for m in MACHINES_MASTER:
            if m["machine_code"] in codes:
                by_type.setdefault(m["machine_type"], []).append(m["machine_code"])

        for mtype, codes_of_type in by_type.items():
            grp = QGroupBox(MACHINE_TYPE_LABELS.get(mtype, mtype))
            grp_layout = QVBoxLayout(grp)
            for code in codes_of_type:
                cb = QCheckBox(code)
                cb.setChecked(code in selected_codes)
                grp_layout.addWidget(cb)
                self.checkboxes.append(cb)
            layout.addWidget(grp)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def get_selected(self):
        return [cb.text() for cb in self.checkboxes if cb.isChecked()]


# ============================================================================
# SOL PANEL - PARCA KUTUPHANESI (surukleme kaynagi + canli arama)
# ============================================================================
class PartsTree(QTreeWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setHeaderHidden(True)
        self.setDragEnabled(True)
        self.setDragDropMode(QAbstractItemView.DragOnly)
        self.setAnimated(True)
        self.setIndentation(14)

    def refresh(self, filter_text=""):
        self.clear()
        filter_text = filter_text.lower().strip()
        groups = {}
        for t in PART_TYPES:
            header = QTreeWidgetItem([f"{PART_TYPE_LABELS[t]}"])
            f = header.font(0)
            f.setBold(True)
            header.setFont(0, f)
            header.setForeground(0, QColor(PART_TYPE_COLORS[t]))
            groups[t] = header

        any_match = {t: False for t in PART_TYPES}
        for part_no, p in sorted(PARTS.items()):
            label = f"{part_no}   {p['part_name']}"
            if filter_text and filter_text not in label.lower():
                continue
            child = QTreeWidgetItem([label])
            child.setData(0, Qt.UserRole, part_no)
            groups[p["type"]].addChild(child)
            any_match[p["type"]] = True

        for t in PART_TYPES:
            if groups[t].childCount() > 0 or not filter_text:
                self.addTopLevelItem(groups[t])
        self.expandAll()

    def startDrag(self, actions):
        item = self.currentItem()
        part_no = item.data(0, Qt.UserRole) if item else None
        if not part_no:
            return
        mime = QMimeData()
        mime.setText(part_no)
        drag = QDrag(self)
        drag.setMimeData(mime)
        drag.exec(Qt.CopyAction)


# ============================================================================
# BOM (MONTAJ YAPISI) - surukle-birak hedefi
# ============================================================================
class BomList(QListWidget):
    def __init__(self, get_selected_part, parent=None):
        super().__init__(parent)
        self.setAcceptDrops(True)
        self.get_selected_part = get_selected_part
        self.setStyleSheet("QListWidget{border:1px dashed #b0bec5; border-radius:6px; padding:4px;}")
        self.setContextMenuPolicy(Qt.CustomContextMenu)
        self.customContextMenuRequested.connect(self.show_context_menu)

    def refresh(self):
        self.clear()
        part_no = self.get_selected_part()
        if not part_no:
            return
        children = BOM.get(part_no, [])
        if not children:
            placeholder = QListWidgetItem("Soldaki kutuphaneden parca surukleyip buraya birakin...")
            placeholder.setFlags(Qt.NoItemFlags)
            placeholder.setForeground(QColor("#9e9e9e"))
            self.addItem(placeholder)
            return
        for child_no in children:
            child = PARTS.get(child_no, {"part_name": "?", "type": "component"})
            item = QListWidgetItem(f"{child_no}   {child['part_name']}   [{PART_TYPE_LABELS[child['type']]}]")
            item.setData(Qt.UserRole, child_no)
            self.addItem(item)

    def dragEnterEvent(self, event):
        part_no = self.get_selected_part()
        if part_no and PARTS.get(part_no, {}).get("type") in ("sub_assembly", "final_product"):
            event.acceptProposedAction()
        else:
            event.ignore()

    def dragMoveEvent(self, event):
        event.acceptProposedAction()

    def dropEvent(self, event):
        parent_no = self.get_selected_part()
        child_no = event.mimeData().text()
        if child_no == parent_no:
            QMessageBox.warning(self, "Gecersiz Islem", "Bir parca kendi montajina eklenemez.")
            return
        if child_no not in PARTS:
            return
        BOM.setdefault(parent_no, [])
        if child_no not in BOM[parent_no]:
            BOM[parent_no].append(child_no)
        self.refresh()
        event.acceptProposedAction()

    def show_context_menu(self, pos):
        item = self.itemAt(pos)
        if not item or not item.data(Qt.UserRole):
            return
        menu = QMenu(self)
        remove_action = menu.addAction("Montajdan Cikar")
        action = menu.exec(self.mapToGlobal(pos))
        if action == remove_action:
            parent_no = self.get_selected_part()
            child_no = item.data(Qt.UserRole)
            if QMessageBox.question(self, "Onay", f"{child_no} montajdan cikarilsin mi?") == QMessageBox.Yes:
                BOM[parent_no].remove(child_no)
                self.refresh()


# ============================================================================
# ROUTING (IS PLANI / PROSES AKISI)
# ============================================================================
class RoutingList(QListWidget):
    def __init__(self, get_selected_part, parent=None):
        super().__init__(parent)
        self.setDragDropMode(QAbstractItemView.InternalMove)
        self.get_selected_part = get_selected_part
        self.itemDoubleClicked.connect(self.edit_machines)
        self.setContextMenuPolicy(Qt.CustomContextMenu)
        self.customContextMenuRequested.connect(self.show_context_menu)

    def refresh(self):
        self.clear()
        part_no = self.get_selected_part()
        if not part_no:
            return
        steps = ROUTINGS.get(part_no, [])
        if not steps:
            placeholder = QListWidgetItem("Henuz adim yok. Yukaridan operasyon secip '+ Adim Ekle' ile baslayin.")
            placeholder.setFlags(Qt.NoItemFlags)
            placeholder.setForeground(QColor("#9e9e9e"))
            self.addItem(placeholder)
            return
        for i, step in enumerate(steps, 1):
            marks = " ".join(step.get("control_marks", []))
            machines = ", ".join(step["machines"]) if step["machines"] else "makine secilmedi"
            text = f"{i:02d}   [{step['op_code']}] {step['op_name']}   ->  {machines}"
            if marks:
                text += f"   {marks}"
            item = QListWidgetItem(text)
            if not step["machines"]:
                item.setForeground(QColor("#e65100"))
            self.addItem(item)

    def edit_machines(self, item):
        part_no = self.get_selected_part()
        steps = ROUTINGS.get(part_no, [])
        idx = self.row(item)
        if idx >= len(steps):
            return
        step = steps[idx]
        eligible = OPERATION_ELIGIBLE_MACHINES.get(step["op_code"], [])
        dlg = MachineSelectDialog(step["op_code"], step["op_name"], eligible, step["machines"], self)
        if dlg.exec() == QDialog.Accepted:
            step["machines"] = dlg.get_selected()
            self.refresh()

    def add_step(self, op_code, op_name, control_marks=None):
        part_no = self.get_selected_part()
        ROUTINGS.setdefault(part_no, [])
        ROUTINGS[part_no].append({
            "op_code": op_code, "op_name": op_name,
            "machines": [], "control_marks": control_marks or []
        })
        self.refresh()

    def remove_selected(self):
        part_no = self.get_selected_part()
        idx = self.currentRow()
        steps = ROUTINGS.get(part_no, [])
        if idx < 0 or idx >= len(steps):
            return
        del steps[idx]
        self.refresh()

    def show_context_menu(self, pos):
        item = self.itemAt(pos)
        if not item:
            return
        menu = QMenu(self)
        del_action = menu.addAction("Adimi Sil")
        action = menu.exec(self.mapToGlobal(pos))
        if action == del_action:
            self.remove_selected()


# ============================================================================
# ANA PENCERE
# ============================================================================
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Urun Tanimlama")
        self.resize(1180, 700)
        self.current_part_no = None
        self._build_ui()
        self._seed_demo_data()
        self.parts_tree.refresh()

    # ---------------------------------------------------------------- UI ---
    def _build_ui(self):
        self.setStyleSheet("""
            QMainWindow { background: #f5f6f8; }
            QGroupBox { font-weight: 600; border: 1px solid #dcdfe3; border-radius: 8px;
                        margin-top: 10px; padding-top: 10px; background: white; }
            QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 4px; }
            QPushButton { padding: 6px 14px; border-radius: 6px; background: #1976d2;
                          color: white; font-weight: 600; }
            QPushButton:hover { background: #1565c0; }
            QPushButton#secondary { background: #eceff1; color: #263238; }
            QPushButton#secondary:hover { background: #cfd8dc; }
            QListWidget, QTreeWidget { background: white; border: 1px solid #dcdfe3; border-radius: 6px; }
            QComboBox, QLineEdit { padding: 5px 8px; border: 1px solid #cfd8dc; border-radius: 6px; background: white; }
            QTabWidget::pane { border: 1px solid #dcdfe3; border-radius: 8px; background: white; top: -1px; }
            QTabBar::tab { padding: 8px 18px; margin-right: 2px; border-top-left-radius: 6px; border-top-right-radius: 6px; }
            QTabBar::tab:selected { background: white; font-weight: 600; }
        """)

        toolbar = QToolBar()
        toolbar.setMovable(False)
        self.addToolBar(toolbar)
        add_part_btn = QPushButton("  +  Yeni Parca Tanimla")
        add_part_btn.clicked.connect(self.add_part)
        toolbar.addWidget(add_part_btn)

        # --- Sol panel ---
        self.search_box = QLineEdit()
        self.search_box.setPlaceholderText("Parca ara (kod veya isim)...")
        self.search_box.textChanged.connect(lambda t: self.parts_tree.refresh(t))

        self.parts_tree = PartsTree()
        self.parts_tree.itemClicked.connect(self.on_part_selected)

        left_box = QGroupBox("Parca Kutuphanesi")
        left_layout = QVBoxLayout(left_box)
        left_layout.addWidget(self.search_box)
        left_layout.addWidget(self.parts_tree)
        hint = QLabel("Ipucu: bir parcayi sag taraftaki 'Montaj Yapisi' listesine surukleyip birakabilirsiniz.")
        hint.setWordWrap(True)
        hint.setStyleSheet("color:#78909c; font-size:11px; padding-top:4px;")
        left_layout.addWidget(hint)

        # --- Sag panel ust bilgi ---
        self.breadcrumb = QLabel("Bir parca secin")
        self.breadcrumb.setStyleSheet("font-size: 16px; font-weight: 700; color:#263238; padding: 4px 2px;")
        self.type_badge = QLabel("")
        self.type_badge.setStyleSheet("font-size: 11px; padding: 3px 10px; border-radius: 9px; color: white;")
        self.type_badge.setFixedHeight(20)
        self.type_badge.hide()

        header_row = QHBoxLayout()
        header_row.addWidget(self.breadcrumb)
        header_row.addWidget(self.type_badge)
        header_row.addStretch()

        # --- Sekme 1: Is Plani ---
        routing_tab = QWidget()
        routing_layout = QVBoxLayout(routing_tab)

        add_row = QHBoxLayout()
        self.op_combo = QComboBox()
        self.op_combo.setEditable(True)
        self.op_combo.setInsertPolicy(QComboBox.NoInsert)
        for op in OPERATIONS_MASTER:
            self.op_combo.addItem(f"[{op['op_code']}] {op['op_name']}", op)
        completer = QCompleter([f"[{op['op_code']}] {op['op_name']}" for op in OPERATIONS_MASTER])
        completer.setCaseSensitivity(Qt.CaseInsensitive)
        completer.setFilterMode(Qt.MatchContains)
        self.op_combo.setCompleter(completer)

        add_step_btn = QPushButton("+ Adim Ekle")
        add_step_btn.clicked.connect(self.add_routing_step)

        add_row.addWidget(QLabel("Operasyon:"))
        add_row.addWidget(self.op_combo, 1)
        add_row.addWidget(add_step_btn)

        self.routing_list = RoutingList(self.get_current_part_no)
        routing_layout.addLayout(add_row)
        info_lbl = QLabel("Adimlari surukleyerek sirasini degistirebilir, cift tiklayarak makine secebilirsiniz.")
        info_lbl.setStyleSheet("color:#78909c; font-size:11px;")
        routing_layout.addWidget(info_lbl)
        routing_layout.addWidget(self.routing_list)

        # --- Sekme 2: Montaj Yapisi (BOM) ---
        bom_tab = QWidget()
        bom_layout = QVBoxLayout(bom_tab)
        self.bom_list = BomList(self.get_current_part_no)
        bom_layout.addWidget(self.bom_list)

        self.tabs = QTabWidget()
        self.tabs.addTab(routing_tab, "Is Plani / Proses Akisi")
        self.tabs.addTab(bom_tab, "Montaj Yapisi (BOM)")

        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)
        right_layout.addLayout(header_row)
        right_layout.addWidget(self.tabs)

        splitter = QSplitter()
        splitter.addWidget(left_box)
        splitter.addWidget(right_widget)
        splitter.setSizes([320, 860])
        self.setCentralWidget(splitter)

    # ------------------------------------------------------------- veri ---
    def _seed_demo_data(self):
        demo = [
            ("A3-9132", "BALL PIN BLANK", "component"),
            ("A3-8977", "BALL PIN", "component"),
            ("A2-8163", "HOUSING BLANK", "component"),
            ("A3-8976", "HOUSING (RH)", "component"),
            ("A3-9149", "HOUSING (LH)", "component"),
            ("A3-9148", "TUBE", "component"),
            ("A4-747", "SUPPORT", "assembly_material"),
            ("A3-1243", "U RING", "assembly_material"),
            ("A3-5352", "BEARING", "assembly_material"),
            ("A3-2573", "END CAP", "assembly_material"),
            ("A2-863", "DUST BOOT", "assembly_material"),
            ("A1-762/3B", "CLAMP RING", "assembly_material"),
            ("KLUBER-GREASE", "GREASE", "raw_material"),
            ("A2-8004", "BALL JOINT (RH)", "sub_assembly"),
            ("A2-8063", "BALL JOINT (LH)", "sub_assembly"),
            ("A3-789", "CLAMP", "assembly_material"),
            ("A4-1277", "BOLT", "assembly_material"),
            ("A4-1836", "NUT", "assembly_material"),
            ("A3-1942", "PROTECTIVE CAP", "assembly_material"),
            ("A1-6000", "TRACK ROD ASSEMBLY", "final_product"),
        ]
        for no, name, t in demo:
            PARTS[no] = {"part_no": no, "part_name": name, "type": t}

    # ---------------------------------------------------------- islevler ---
    def get_current_part_no(self):
        return self.current_part_no

    def add_part(self):
        dlg = AddPartDialog(self)
        if dlg.exec() == QDialog.Accepted:
            data = dlg.get_data()
            if not data["part_no"] or not data["part_name"]:
                QMessageBox.warning(self, "Eksik Bilgi", "Parca No ve Parca Adi bos birakilamaz.")
                return
            if data["part_no"] in PARTS:
                QMessageBox.warning(self, "Zaten Var", "Bu parca numarasi zaten tanimli.")
                return
            PARTS[data["part_no"]] = data
            self.parts_tree.refresh(self.search_box.text())

    def on_part_selected(self, item, col):
        part_no = item.data(0, Qt.UserRole)
        if not part_no:
            return
        self.current_part_no = part_no
        part = PARTS[part_no]

        self.breadcrumb.setText(f"{part_no}   —   {part['part_name']}")
        self.type_badge.setText(PART_TYPE_LABELS[part["type"]])
        self.type_badge.setStyleSheet(
            f"font-size: 11px; padding: 3px 10px; border-radius: 9px; color: white; "
            f"background: {PART_TYPE_COLORS[part['type']]};"
        )
        self.type_badge.show()

        self.routing_list.refresh()
        self.bom_list.refresh()

        no_routing = part["type"] in ("raw_material", "assembly_material")
        self.tabs.setTabEnabled(0, not no_routing)
        no_bom = part["type"] not in ("sub_assembly", "final_product")
        self.tabs.setTabEnabled(1, not no_bom)
        if no_routing and not no_bom:
            self.tabs.setCurrentIndex(1)
        elif not no_routing:
            self.tabs.setCurrentIndex(0)

    def add_routing_step(self):
        if not self.current_part_no:
            QMessageBox.information(self, "Parca Secilmedi", "Once soldan bir parca secin.")
            return
        op = self.op_combo.currentData()
        if not op:
            return
        self.routing_list.add_step(op["op_code"], op["op_name"])


if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setFont(QFont("Segoe UI", 10))
    win = MainWindow()
    win.show()
    sys.exit(app.exec())
