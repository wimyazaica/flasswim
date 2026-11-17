"""Package licensed swimming animation frames for the site's canvas player.

Requires Pillow for this optional preparation step; the site has no runtime
dependencies. Original GIFs stay unchanged. Derived atlases remain CC BY-SA 3.0.
"""
from collections import deque
import json
from pathlib import Path
import shutil
from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT.parent / 'motion-reference-9'
DESTINATION = PROJECT / 'dist' / 'assets'
ORIGINALS = DESTINATION / 'swim-sources'
ORIGINALS.mkdir(parents=True, exist_ok=True)
SOURCES = {
    'butterfly': ('butterfly-side.gif', 'Butterfly_stroke3_without_text.gif'),
    'backstroke': ('backstroke-oblique.gif', 'Backstroke.gif'),
    'breaststroke': ('breaststroke.gif', 'Breaststroke2.gif'),
    'freestyle': ('freestyle.gif', 'Freestyle_swimming.gif'),
}


def clear_studio_background(frame):
    """Key the flat studio water/sky, keeping isolated dark clothing intact."""
    image = frame.convert('RGBA')
    width, height = image.size
    pixels = list(image.getdata())
    candidates = bytearray(width * height)
    seen = bytearray(width * height)
    for index, (red, green, blue, alpha) in enumerate(pixels):
        navy = red <= 18 and green <= 18 and 94 <= blue <= 160
        black = red <= 3 and green <= 3 and blue <= 3
        if not alpha or navy or black:
            candidates[index] = 1
        if navy or not alpha:
            pixels[index] = (red, green, blue, 0)
    edge = list(range(width)) + list(range((height - 1) * width, height * width))
    edge += [row * width for row in range(height)]
    edge += [row * width + width - 1 for row in range(height)]
    queue = deque(index for index in edge if candidates[index])
    while queue:
        index = queue.popleft()
        if seen[index] or not candidates[index]:
            continue
        seen[index] = 1
        red, green, blue, _ = pixels[index]
        pixels[index] = (red, green, blue, 0)
        x, y = index % width, index // width
        if x:
            queue.append(index - 1)
        if x + 1 < width:
            queue.append(index + 1)
        if y:
            queue.append(index - width)
        if y + 1 < height:
            queue.append(index + width)
    # Remove the studio surface line where it reaches both image borders.
    for y in range(height):
        left, right = pixels[y * width], pixels[(y + 1) * width - 1]
        if left[3] and right[3] and max(abs(left[c] - right[c]) for c in range(3)) < 24:
            for x in range(width):
                index = y * width + x
                pixel = pixels[index]
                if pixel[3] and max(abs(pixel[c] - left[c]) for c in range(3)) < 24:
                    pixels[index] = (*pixel[:3], 0)
    # Preserve the requested red briefs without changing any joint or pose.
    for index, (red, green, blue, alpha) in enumerate(pixels):
        x = index % width
        if alpha and 125 <= x <= 220 and red < 35 and green < 35 and blue < 94:
            pixels[index] = (min(225, 140 + blue), 16 + blue // 8, 37 + blue // 10, alpha)
    image.putdata(pixels)
    return image


assets = {}
for style, (filename, original_name) in SOURCES.items():
    reference = SOURCE / filename
    path = reference if reference.exists() else ORIGINALS / original_name
    if path.resolve() != (ORIGINALS / original_name).resolve():
        shutil.copyfile(path, ORIGINALS / original_name)
    animation = Image.open(path)
    frames, delays = [], []
    for index in range(animation.n_frames):
        animation.seek(index)
        delays.append(max(20, animation.info.get('duration', 50)))
        frames.append(clear_studio_background(animation))
    boxes = [frame.getbbox() for frame in frames]
    boxes = [box for box in boxes if box]
    left = max(0, min(box[0] for box in boxes) - 5)
    top = max(0, min(box[1] for box in boxes) - 5)
    right = min(animation.width, max(box[2] for box in boxes) + 5)
    bottom = min(animation.height, max(box[3] for box in boxes) + 5)
    box = (left, top, right, bottom)
    width, height = right - left, bottom - top
    columns = 6
    rows = (len(frames) + columns - 1) // columns
    atlas = Image.new('RGBA', (columns * width, rows * height))
    for index, frame in enumerate(frames):
        atlas.paste(frame.crop(box), ((index % columns) * width, (index // columns) * height))
    name = f'swim-{style}-atlas.png'
    atlas.save(DESTINATION / name, optimize=True)
    assets[style] = dict(src='assets/' + name, width=width, height=height, columns=columns, delays=delays)
    print(style, width, height, len(frames), sum(delays), (DESTINATION / name).stat().st_size)

(PROJECT / 'dist' / 'swim-assets.js').write_text(
    '/* Fxqf and Wikimedia Commons contributors, CC BY-SA 3.0; see credits.html. */\n'
    + 'window.FLASHSWIM_SWIM_ASSETS = ' + json.dumps(assets, separators=(',', ':')) + ';\n', encoding='utf-8'
)
