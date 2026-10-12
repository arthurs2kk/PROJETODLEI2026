from pathlib import Path
import sys

import pypdfium2 as pdfium


pdf_path = Path(sys.argv[1])
output_dir = Path(sys.argv[2])
pages = [int(value) for value in sys.argv[3].split(",")]
scale = float(sys.argv[4]) if len(sys.argv) > 4 else 2.0
output_dir.mkdir(parents=True, exist_ok=True)

pdf = pdfium.PdfDocument(pdf_path)
for page_number in pages:
    page = pdf[page_number - 1]
    bitmap = page.render(scale=scale)
    image = bitmap.to_pil()
    output = output_dir / f"page-{page_number:03d}.png"
    image.save(output)
    print(output)
