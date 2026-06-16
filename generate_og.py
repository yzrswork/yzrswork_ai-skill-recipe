"""OGP カード画像生成スクリプト（ツール別）.

icons/ に各ツールの共有カード（1200x630）を生成する。
note/X で共有された時に表示されるサムネイル。サイトと同じテラコッタ系
editorial 配色。環境に日本語(CJK)フォントが無いため、本文は英字ブランド
表記で構成する（サイトでも "YZRS WORK" 等の英字を多用しているため自然）。

生成物:
  icons/og-card.png   … 道具箱（スイート全体）
  icons/og-bench.png  … 工房の電卓
  icons/og-fixit.png  … 直し方ナビ
  icons/og-kit.png    … 装備ナビ
  icons/og-lab.png    … e-photoframe ラボ
  icons/og-hdd.png    … HDD選びナビ
  icons/og-mem.png    … メモリ選びナビ

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
TERRA_TINT = "#e2bca9"  # 紙に溶かしたテラコッタ（"y." 透かし）

ICONS_DIR = "icons"
MARGIN = 84
MAXW = W - MARGIN * 2

SANS_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
SERIF_IT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

# slug, ファイル名, コーナーラベル, タイトル, サブタイトル(italic), タグ
CARDS = [
    ("card",  "og-card.png",  "TOOLBOX",     "The Toolbox",      "Practical, offline PWA tools",     "Electronics  ·  Fix-it  ·  PC Build"),
    ("bench", "og-bench.png", "ELECTRONICS", "Maker's Bench",    "Electronics bench calculators",    "Ohm  ·  LED  ·  555  ·  Color code"),
    ("fixit", "og-fixit.png", "FIX-IT",      "Fix-it Navigator", "Step-by-step troubleshooting",     "Mail  ·  Windows  ·  PC boot  ·  Obsidian"),
    ("kit",   "og-kit.png",   "ELECTRONICS", "Starter Kit",      "What to buy, step by step",        "Tools  ·  Parts  ·  Where to buy"),
    ("lab",   "og-lab.png",   "ELECTRONICS", "e-photoframe Lab", "Modules & 5V power planner",       "Catalog  ·  Current budget"),
    ("hdd",   "og-hdd.png",   "PC BUILD",    "HDD Picker",       "WD color & CMR / SMR",             "By use  ·  Model-suffix check"),
    ("mem",   "og-mem.png",   "PC BUILD",    "Memory Picker",    "DDR spec & capacity",              "Socket  ·  Use  ·  Dual-channel"),
    ("build", "og-build.png", "PC BUILD",    "PC Build Planner", "Socket · RAM · Storage · PSU",     "Compatibility & power estimate"),
]


def fit_font(draw, text, path, start, maxw, minimum=56):
    """text が maxw に収まる最大サイズのフォントを返す。"""
    size = start
    while size > minimum:
        f = ImageFont.truetype(path, size)
        if draw.textlength(text, font=f) <= maxw:
            return f
        size -= 4
    return ImageFont.truetype(path, minimum)


def make_card(corner, title, subtitle, tag, out_path):
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    # "y." 透かし（右下・本文の下層）
    d.text((W - 470, H - 70), "y.", font=ImageFont.truetype(SERIF_IT, 560),
           fill=TERRA_TINT, anchor="ls")

    # 上部メタ帯
    mfont = ImageFont.truetype(MONO, 26)
    d.text((MARGIN, 70), "YZRS WORK", font=mfont, fill=INK, anchor="ls")
    d.text((W - MARGIN, 70), corner, font=mfont, fill=MUTED, anchor="rs")
    d.line((MARGIN, 92, W - MARGIN, 92), fill=RULE, width=2)

    # タイトル（幅に合わせて自動縮小）
    tfont = fit_font(d, title, SANS_BOLD, 132, MAXW)
    d.text((MARGIN, 258), title, font=tfont, fill=INK, anchor="ls")

    # サブタイトル（serif italic, terracotta）
    d.text((MARGIN, 330), subtitle, font=ImageFont.truetype(SERIF_IT, 50),
           fill=TERRA, anchor="ls")

    # タグ
    d.text((MARGIN, 400), tag, font=ImageFont.truetype(SANS_BOLD, 34),
           fill=MUTED, anchor="ls")

    # 下部ルール + URL
    d.line((MARGIN, H - 96, W - MARGIN, H - 96), fill=RULE, width=2)
    ufont = ImageFont.truetype(MONO, 26)
    d.text((MARGIN, H - 54), "yzrswork.github.io / works offline", font=ufont, fill=MUTED, anchor="ls")
    d.text((W - MARGIN, H - 54), "@yzrswork", font=ufont, fill=TERRA, anchor="rs")

    img.save(out_path, "PNG")
    return out_path


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    print("=== 生成結果 ===")
    for slug, fname, corner, title, sub, tag in CARDS:
        path = os.path.join(ICONS_DIR, fname)
        make_card(corner, title, sub, tag, path)
        with Image.open(path) as im:
            w, h = im.size
        assert (w, h) == (W, H), f"{path} サイズ不正: {w}x{h}"
        print(f"{path}: {w}x{h}px  [{title}]")
    print("すべてのOGカードを生成しました。")


if __name__ == "__main__":
    main()
