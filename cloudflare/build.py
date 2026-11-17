from pathlib import Path
import html
import shutil
import sys

root = Path(__file__).resolve().parent
out = Path(sys.argv[1])
shutil.copytree(root.parent / "plantilla", out, dirs_exist_ok=True)
template = (out / "index.html").read_text()
bridge = (root / "bridge.js").read_text()
for source, page in [("cedi-current-inner.html", "index.html"), ("cedi-legacy-purchases.html", "compras-formato-viejo.html")]:
    wrapper = template
    script = bridge
    if page == "compras-formato-viejo.html":
        wrapper = wrapper.replace(", entryModule: new URLSearchParams(location.search).get('modulo'),", ",")
        script = script.replace("const storePrefix='/api';", "const storePrefix='/api/legacy-purchases';")
    inner = (root.parent / "work" / source).read_text()
    (out / page).write_text(wrapper.replace("__CEDI_BRIDGE__", script).replace("__CEDI_UI__", html.escape(inner)))
shutil.copyfile(root / "_worker.js", out / "_worker.js")
