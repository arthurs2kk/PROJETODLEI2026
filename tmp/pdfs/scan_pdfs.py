from pathlib import Path
import re
import sys

from pypdf import PdfReader

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


pattern = re.compile(
    r"criter|avalia|pontua|pitch|video|banca|canvas|memorial|prototipo|cronograma|elimin",
    re.IGNORECASE,
)

for filename in sys.argv[1:]:
    path = Path(filename)
    print(f"\n### {path}")
    reader = PdfReader(path)
    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        folded = (
            text.replace("é", "e")
            .replace("É", "E")
            .replace("í", "i")
            .replace("Í", "I")
            .replace("ó", "o")
            .replace("Ó", "O")
        )
        if pattern.search(folded):
            matches = [
                line.strip()
                for line in text.splitlines()
                if pattern.search(
                    line.replace("é", "e")
                    .replace("É", "E")
                    .replace("í", "i")
                    .replace("Í", "I")
                    .replace("ó", "o")
                    .replace("Ó", "O")
                )
            ]
            print(f"PAGE {index}: {' | '.join(matches)[:1800]}")
