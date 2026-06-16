"""OGP カード画像生成スクリプト（ツール別・日英）.

icons/ に各ツールの共有カード（1200x630）を生成する。note/X で共有された
時に表示されるサムネイル。サイトと同じテラコッタ系 editorial 配色。

日本語(CJK)フォントが見つかれば「日本語タイトル + 英字サブ」で、無ければ
英字のみにフォールバックする（再現性のため）。CJKフォントは下記のいずれか
のパスに置く（リポジトリには同梱しない）:
  - 環境変数 OG_CJK_FONT
  - /tmp/NotoSansJP.ttf
  - ./fonts/NotoSansJP.ttf
取得例:
  curl -L -o /tmp/NotoSansJP.ttf \
    "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"

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
TERRA_TINT = "#e2bca9"

ICONS_DIR = "icons"
MARGIN = 84
MAXW = W - MARGIN * 2

SANS_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
SERIF_IT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

CJK_CANDIDATES = [
    os.environ.get("OG_CJK_FONT", ""),
    "/tmp/NotoSansJP.ttf",
    os.path.join("fonts", "NotoSansJP.ttf"),
]


def find_cjk():
    for p in CJK_CANDIDATES:
        if p and os.path.exists(p):
            return p
    return None


CJK = find_cjk()

# slug, ファイル名, コーナー, 和タイトル, 英タイトル, 英サブ, タグ
CARDS = [
    ("card",  "og-card.png",  "TOOLBOX",     "道具箱",                "The Toolbox",      "Practical, offline PWA tools", "Electronics  ·  Fix-it  ·  PC Build"),
    ("bench", "og-bench.png", "ELECTRONICS", "工房の電卓",            "Maker's Bench",    "Electronics bench calculators", "Ohm  ·  LED  ·  555  ·  Color code"),
    ("fixit", "og-fixit.png", "FIX-IT",      "直し方ナビ",            "Fix-it Navigator", "Step-by-step troubleshooting", "Mail  ·  Windows  ·  PC boot  ·  Obsidian"),
    ("kit",   "og-kit.png",   "ELECTRONICS", "装備ナビ",              "Starter Kit",      "What to buy, step by step", "Tools  ·  Parts  ·  Where to buy"),
    ("lab",   "og-lab.png",   "ELECTRONICS", "e-photoframe ラボ",     "e-photoframe Lab", "Modules & 5V power planner", "Catalog  ·  Current budget"),
    ("hdd",   "og-hdd.png",   "PC BUILD",    "HDD選びナビ",           "HDD Picker",       "WD color & CMR / SMR", "By use  ·  Model-suffix check"),
    ("mem",   "og-mem.png",   "PC BUILD",    "メモリ選びナビ",        "Memory Picker",    "DDR spec & capacity", "Socket  ·  Use  ·  Dual-channel"),
    ("build", "og-build.png", "PC BUILD",    "自作PC 構成プランナー", "PC Build Planner", "Socket · RAM · Storage · PSU", "Compatibility & power estimate"),
]


def fit_font(draw, text, path, start, maxw, minimum=48, bold_axis=False):
    size = start
    while size > minimum:
        f = ImageFont.truetype(path, size)
        if bold_axis:
            try:
                f.set_variation_by_axes([700])
            except Exception:
                pass
        if draw.textlength(text, font=f) <= maxw:
            return f
        size -= 4
    f = ImageFont.truetype(path, minimum)
    if bold_axis:
        try:
            f.set_variation_by_axes([700])
        except Exception:
            pass
    return f


def make_card(corner, jp_title, en_title, subtitle, tag, out_path):
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    # "y." 透かし
    d.text((W - 470, H - 70), "y.", font=ImageFont.truetype(SERIF_IT, 560),
           fill=TERRA_TINT, anchor="ls")

    # 上部メタ帯
    mfont = ImageFont.truetype(MONO, 26)
    d.text((MARGIN, 70), "YZRS WORK", font=mfont, fill=INK, anchor="ls")
    d.text((W - MARGIN, 70), corner, font=mfont, fill=MUTED, anchor="rs")
    d.line((MARGIN, 92, W - MARGIN, 92), fill=RULE, width=2)

    if CJK:
        # 日本語タイトル + 英字サブ（en_title）
        tfont = fit_font(d, jp_title, CJK, 120, MAXW, minimum=64, bold_axis=True)
        d.text((MARGIN, 255), jp_title, font=tfont, fill=INK, anchor="ls")
        d.text((MARGIN, 322), en_title, font=ImageFont.truetype(SERIF_IT, 46),
               fill=TERRA, anchor="ls")
        d.text((MARGIN, 392), tag, font=ImageFont.truetype(SANS_BOLD, 32),
               fill=MUTED, anchor="ls")
    else:
        # 英字フォールバック
        tfont = fit_font(d, en_title, SANS_BOLD, 132, MAXW, minimum=56)
        d.text((MARGIN, 258), en_title, font=tfont, fill=INK, anchor="ls")
        d.text((MARGIN, 330), subtitle, font=ImageFont.truetype(SERIF_IT, 50),
               fill=TERRA, anchor="ls")
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
    print(f"CJKフォント: {CJK if CJK else '見つからず（英字フォールバック）'}")
    print("=== 生成結果 ===")
    for slug, fname, corner, jp, en, sub, tag in CARDS:
        path = os.path.join(ICONS_DIR, fname)
        make_card(corner, jp, en, sub, tag, path)
        with Image.open(path) as im:
            w, h = im.size
        assert (w, h) == (W, H), f"{path} サイズ不正: {w}x{h}"
        print(f"{path}: {w}x{h}px  [{jp if CJK else en}]")
    print("すべてのOGカードを生成しました。")


if __name__ == "__main__":
    main()
