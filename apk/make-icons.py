"""يولّد أيقونة التطبيق وشاشة البداية من شعار نور بلا أي أداة خارجية.

يعيد رسم شعار assets/logo/active/noor-c1-icon-color.svg بمقاييس مضخّمة:
نون بيضاء بمعينة نور وشريط ختمة على أخضر العلامة (#188038) للأيقونة،
والشعار نفسه على خلفية الصفحة الفاتحة لشاشة البداية. يرسم بعينات فرعية
(2×2) لتنعيم الحواف، ويكتب PNG بـRGB عبر zlib فقط.
الناتج في apk/assets يقرؤه @capacitor/assets داخل CI.
"""
import math
import os
import struct
import zlib

# ألوان الهوية من الشعار و:root في css/style.css
GREEN = (0x18, 0x80, 0x38)      # --green
WHITE = (0xFF, 0xFF, 0xFF)
DAY_BG = (0xF8, 0xF9, 0xFA)     # --bg
SAMPLES = ((0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75))

# مسار النون من الشعار (شبكة 64) مقسّم إلى نقاط: مستقيم ثم منحنيان ثم مستقيم.
def cubic_points(p0, p1, p2, p3, steps=10):
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        out.append((
            u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ))
    return out


NOON = (
    [(22.0, 27.0), (22.0, 36.0)]
    + cubic_points((22.0, 36.0), (22.0, 44.0), (26.0, 48.0), (32.0, 48.0))
    + cubic_points((32.0, 48.0), (38.0, 48.0), (42.0, 44.0), (42.0, 36.0))
    + [(42.0, 27.0)]
)

# معينة نور: مربع مائل قمّته عند (32,11) وقاعدته عند (32,21).
DIAMOND = [(32.0, 11.0), (37.0, 16.0), (32.0, 21.0), (27.0, 16.0)]

STROKE = 2.5  # نصف سماكة خط النون (stroke-width 5)


def dist_to_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    den = dx * dx + dy * dy
    if den == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / den
    t = 0.0 if t < 0 else 1.0 if t > 1 else t
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def near_polyline(x, y, points, width):
    for i in range(len(points) - 1):
        ax, ay = points[i]
        bx, by = points[i + 1]
        if dist_to_segment(x, y, ax, ay, bx, by) <= width:
            return True
    return False


def inside_polygon(x, y, points):
    inside = False
    j = len(points) - 1
    for i in range(len(points)):
        xi, yi = points[i]
        xj, yj = points[j]
        if (yi > y) != (yj > y):
            crossing = xi + (y - yi) * (xj - xi) / (yj - yi)
            if x < crossing:
                inside = not inside
        j = i
    return inside


def inside_rect(x, y, x0, y0, x1, y1):
    return x0 <= x <= x1 and y0 <= y <= y1


def logo_pixel(x, y):
    """لون نقطة في شبكة الشعار 64: أبيض للرسم، أخضر للخلفية."""
    if near_polyline(x, y, NOON, STROKE):
        return WHITE
    if inside_polygon(x, y, DIAMOND):
        return WHITE
    # شريط الختمة: خلفية خفيفة ثم تعبئة بيضاء على أول 15 من 24.
    if inside_rect(x, y, 20.0, 52.0, 44.0, 56.0):
        return WHITE if x <= 35.0 else (0x69, 0xAC, 0x7E)
    return GREEN


def render_tile(size):
    """يرسم الشعار كامل الخلفية بمقاس size (شبكة 64 تُقاس إلى size)."""
    scale = size / 64.0
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = 0
            for sx, sy in SAMPLES:
                x = (px + sx) / scale
                y = (py + sy) / scale
                c = logo_pixel(x, y)
                r += c[0]
                g += c[1]
                b += c[2]
            row += bytes((r // 4, g // 4, b // 4))
        rows.append(row)
    return rows


def upscale(rows, size, factor):
    out = []
    for y in range(size * factor):
        base = rows[y // factor]
        row = bytearray()
        for x in range(size * factor):
            i = (x // factor) * 3
            row += base[i:i + 3]
        out.append(bytes(row))
    return out


def write_png(path, rows):
    height, width = len(rows), len(rows[0]) // 3
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)
    print("كُتب", path, width, "×", height)


def splash_with_logo(tile, canvas, logo_size, radius):
    """خلفية فاتحة ووسطها الشعار بزوايا مستديرة (بدون قناة شفافية)."""
    bg_row = bytes(DAY_BG) * canvas
    offset = (canvas - logo_size) // 2
    rows = []
    for y in range(canvas):
        if y < offset or y >= offset + logo_size:
            rows.append(bg_row)
            continue
        ly = y - offset
        row = bytearray()
        for x in range(canvas):
            if x < offset or x >= offset + logo_size:
                row += bytes(DAY_BG)
                continue
            lx = x - offset
            # قص الزوايا بحساب أبعد نقطة داخل المستطيل المستدير.
            cx = min(max(lx, radius), logo_size - 1 - radius)
            cy = min(max(ly, radius), logo_size - 1 - radius)
            if (lx - cx) ** 2 + (ly - cy) ** 2 > radius * radius:
                row += bytes(DAY_BG)
            else:
                i = lx * 3
                row += tile[ly][i:i + 3]
        rows.append(bytes(row))
    return rows


tile = render_tile(512)
icon = upscale(tile, 512, 2)
os.makedirs("apk/assets", exist_ok=True)
write_png("apk/assets/icon.png", icon)

# شاشة البداية: 2732×2732، الشعار 1024 في الوسط بزوايا مستديرة.
splash = splash_with_logo(icon, 2732, 1024, 256)
write_png("apk/assets/splash.png", splash)
