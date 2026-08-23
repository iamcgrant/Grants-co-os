import sys
from pathlib import Path
p=Path(sys.argv[1]); p.parent.mkdir(parents=True, exist_ok=True)
mode=sys.argv[2]
text=sys.argv[3]
if mode=="w": p.write_text(text)
else: p.write_text(p.read_text()+text)
