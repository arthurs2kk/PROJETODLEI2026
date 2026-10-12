from pathlib import Path
import math
import sys

from PIL import Image, ImageDraw


input_dir = Path(sys.argv[1])
output = Path(sys.argv[2])
columns = int(sys.argv[3])
thumb_width = int(sys.argv[4])
files = sorted(input_dir.glob("page-*.png"))
images = []
for file in files:
    image = Image.open(file).convert("RGB")
    height = round(image.height * thumb_width / image.width)
    image.thumbnail((thumb_width, height), Image.Resampling.LANCZOS)
    images.append((file.stem, image.copy()))

label_height = 28
cell_height = max(image.height for _, image in images) + label_height
rows = math.ceil(len(images) / columns)
sheet = Image.new("RGB", (columns * thumb_width, rows * cell_height), "white")
draw = ImageDraw.Draw(sheet)
for index, (label, image) in enumerate(images):
    x = (index % columns) * thumb_width
    y = (index // columns) * cell_height
    draw.text((x + 8, y + 6), label, fill="black")
    sheet.paste(image, (x, y + label_height))
sheet.save(output)
print(output)
