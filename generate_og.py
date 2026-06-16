"""OGP カード画像生成スクリプト.

icons/og-card.png (1200x630) を生成する。note/X で共有された時に
表示されるサムネイル。サイトと同じテラコッタ系 editorial 配色。

環境に日本語(CJK)フォントが無いため、カード本文は英字ブランド表記で構成する
（サイトでも "YZRS WORK" 等の英字を多用しているため違和感はない）。

実行:
  pip install Pillow
  python generate_og.py
"""

import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PAPER = "#f0ebe3"
INK = "#1c1a16"
MUTED = "#6f675b"
TERRA = "#b5451b"
RULE = "#3a342c"
# テラコッタを紙色に溶かした淡色（透かしの "y." 用。flat 合成で擬似的に薄く）
TERRA_TINT = "#e2bca9"

ICONS_DIR = "icons"
OUT = os.path.join(ICONS_DIR, "og-card.png")

SANS_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
SERIF_IT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    margin = 84

    # 透かしの "y." を先に描く（右下、本文の下層）
    yfont = font(SERIF_IT, 560)
    d.text((W - 470, H - 70), "y.", font=yfont, fill=TERRA_TINT, anchor="ls")

    # 上部メタ帯
    mfont = font(MONO, 26)
    d.text((margin, 70), "YZRS WORK", font=mfont, fill=INK, anchor="ls")
    label = "VOL. 01  /  TOOLBOX"
    d.text((W - margin, 70), label, font=mfont, fill=MUTED, anchor="rs")
    d.line((margin, 92, W - margin, 92), fill=RULE, width=2)

    # タイトル
    tfont = font(SANS_BOLD, 132)
    d.text((margin, 250), "The Toolbox", font=tfont, fill=INK, anchor="ls")

    # サブタイトル（serif italic, terracotta）
    sfont = font(SERIF_IT, 50)
    d.text((margin, 322), "Practical, offline PWA tools", font=sfont, fill=TERRA, anchor="ls")

    # タグライン
    gfont = font(SANS_BOLD, 34)
    d.text((margin, 392), "Electronics  ·  Fix-it  ·  PC Build", font=gfont, fill=MUTED, anchor="ls")

    # 下部ルール + URL
    d.line((margin, H - 96, W - margin, H - 96), fill=RULE, width=2)
    ufont = font(MONO, 26)
    d.text((margin, H - 54), "yzrswork.github.io / works offline", font=ufont, fill=MUTED, anchor="ls")
    d.text((W - margin, H - 54), "@yzrswork", font=ufont, fill=TERRA, anchor="rs")

    img.save(OUT, "PNG")

    with Image.open(OUT) as im:
        w, h = im.size
    print(f"{OUT}: {w}x{h}px")
    assert (w, h) == (W, H), f"サイズ不正: {w}x{h}"
    print("OGカードを生成しました。")


if __name__ == "__main__":
    main()
