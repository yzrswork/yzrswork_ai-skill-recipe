"""PWA アイコン生成スクリプト.

icons/ に以下3ファイルを生成する:
  - icon-192.png         (192x192, 文字サイズ 60%)
  - icon-512.png         (512x512, 文字サイズ 60%)
  - icon-512-maskable.png(512x512, 文字サイズ 40% / safe zone 対応)

実行:
  pip install Pillow
  python generate_icons.py
"""

import os

from PIL import Image, ImageDraw, ImageFont

BG_COLOR = "#FAF7F2"
TEXT_COLOR = "#C8673A"
LETTER = "M"
ICONS_DIR = "icons"

FONT_CANDIDATES = [
    "/System/Library/Fonts/Helvetica.ttc",          # macOS
    "/Library/Fonts/Helvetica.ttc",                 # macOS
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",  # Linux (一部ディストリ)
]


def load_font(size):
    """サンセリフ太字フォントを読み込む。見つからなければデフォルトにフォールバック。"""
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def make_icon(size, ratio, out_path):
    """1枚のアイコンを生成して保存する。"""
    img = Image.new("RGB", (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)

    font = load_font(int(size * ratio))
    center = (size / 2, size / 2)

    # anchor='mm' はメトリクス基準のため、グリフの実インク中心は
    # 数pxずれることがある。インク中心が画像中心に来るよう補正する。
    probe = draw.textbbox(center, LETTER, font=font, anchor="mm")
    probe_cx = (probe[0] + probe[2]) / 2
    probe_cy = (probe[1] + probe[3]) / 2
    pos = (center[0] - (probe_cx - center[0]), center[1] - (probe_cy - center[1]))
    draw.text(pos, LETTER, font=font, fill=TEXT_COLOR, anchor="mm")

    # 文字の中心が画像中心から ±2px 以内にあることを検証
    bbox = draw.textbbox(pos, LETTER, font=font, anchor="mm")
    text_cx = (bbox[0] + bbox[2]) / 2
    text_cy = (bbox[1] + bbox[3]) / 2
    assert abs(text_cx - center[0]) <= 2, f"X中心ずれ: {text_cx} vs {center[0]}"
    assert abs(text_cy - center[1]) <= 2, f"Y中心ずれ: {text_cy} vs {center[1]}"

    img.save(out_path, "PNG")
    return out_path


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)

    specs = [
        (192, 0.60, os.path.join(ICONS_DIR, "icon-192.png")),
        (512, 0.60, os.path.join(ICONS_DIR, "icon-512.png")),
        (512, 0.40, os.path.join(ICONS_DIR, "icon-512-maskable.png")),
    ]

    for size, ratio, path in specs:
        make_icon(size, ratio, path)

    # 生成後の検証出力
    print("=== 生成結果 ===")
    for size, ratio, path in specs:
        exists = os.path.exists(path)
        with Image.open(path) as im:
            w, h = im.size
        print(f"{path}: 存在={exists}, サイズ={w}x{h}px")
        assert exists, f"{path} が生成されていない"
        assert (w, h) == (size, size), f"{path} のサイズ不正: {w}x{h}"
    print("すべてのアイコンを正常に生成しました。")


if __name__ == "__main__":
    main()
