from pathlib import Path
OUT = Path("/workspace/mortgage-readiness-os")
def w(name, text):
    p = OUT / name
    p.write_text(text)
    print(f"{name}\t{len(text.encode())}")
FILES = {}
