from pathlib import Path
import sys

from pypdf import PdfReader


sys.stdout.reconfigure(encoding="utf-8", errors="replace")
path = Path(sys.argv[1])
pages = [int(value) for value in sys.argv[2].split(",")]
reader = PdfReader(path)
for page_number in pages:
    print(f"\n===== PAGE {page_number} =====\n")
    print(reader.pages[page_number - 1].extract_text() or "")
