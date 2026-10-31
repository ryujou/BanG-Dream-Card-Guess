"""Generate local webfont subsets; requires fonttools[woff]."""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
fonts = root / "public/fonts"
output = fonts / "subsets"
output.mkdir(exist_ok=True)
source_text = "".join(
    p.read_text(encoding="utf-8")
    for p in (root / "src/client").rglob("*")
    if p.suffix in {".tsx", ".ts", ".json"}
)
common = set(map(ord, source_text)) | set(range(256))
frequent = {
    ord(bytes([lead, trail]).decode("gb2312"))
    for lead in range(0xB0, 0xD8)
    for trail in range(0xA1, 0xFF if lead < 0xD7 else 0xFA)
}
rules = []
for filename, family, weight in [
    ("NotoSansSC-Variable", "Noto Sans SC", "100 900"),
    ("MaShanZheng-Regular", "Ma Shan Zheng", "400"),
    ("Caveat-Variable", "Caveat", "400 700"),
]:
    path = root / "artifacts/fonts-source" / f"{filename}.ttf"
    with TTFont(path) as font:
        available = set(font.getBestCmap())
    initial = common | frequent if family == "Noto Sans SC" else common
    groups = [sorted(available & initial)]
    if family == "Noto Sans SC":
        # Keep every supported character available for editable community text.
        remaining = sorted(available - initial)
        groups += [remaining[i:i + 1024] for i in range(0, len(remaining), 1024)]
    for index, codes in enumerate(groups):
        options = subset.Options()
        options.flavor = "woff2"
        font = subset.load_font(str(path), options)
        sub = subset.Subsetter(options=options)
        sub.populate(unicodes=codes)
        sub.subset(font)
        name = f"{filename}-{index}.woff2"
        subset.save_font(font, str(output / name), options)
        font.close()
        print(name, flush=True)
        ranges = ",".join(f"U+{code:X}" for code in codes)
        rules.append(
            f'@font-face {{font-family:"{family}";font-style:normal;'
            f'font-weight:{weight};font-display:swap;'
            f'src:url("/fonts/subsets/{name}") format("woff2");'
            f'unicode-range:{ranges};}}'
        )
    print(f"{family}: {len(groups)} subsets", flush=True)
(root / "src/client/fonts.css").write_text("\n".join(rules) + "\n", encoding="utf-8")
