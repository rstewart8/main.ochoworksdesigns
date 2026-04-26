#!/usr/bin/env python3
"""Create a simple PDF version of the OchoWorks social traffic strategy."""

from __future__ import annotations

from pathlib import Path
import re
import textwrap


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "OchoWorks_Designs_Social_Traffic_Strategy.md"
OUTPUT = ROOT / "docs" / "OchoWorks_Designs_Social_Traffic_Strategy.pdf"

PAGE_WIDTH = 612
PAGE_HEIGHT = 792
LEFT = 54
TOP = 56
BOTTOM = 54
LINE_HEIGHT = 14
BODY_SIZE = 10.5
TITLE_SIZE = 20
H2_SIZE = 14
H3_SIZE = 12


def pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def clean_inline(value: str) -> str:
    value = re.sub(r"`([^`]+)`", r"\1", value)
    value = value.replace("&", "and")
    return value


def wrap_text(value: str, width: int = 92) -> list[str]:
    if not value:
        return [""]
    return textwrap.wrap(clean_inline(value), width=width, break_long_words=False) or [""]


def parse_markdown(markdown: str) -> list[tuple[str, str]]:
    blocks: list[tuple[str, str]] = []
    paragraph: list[str] = []

    def flush_paragraph() -> None:
        nonlocal paragraph
        if paragraph:
            blocks.append(("p", " ".join(paragraph)))
            paragraph = []

    for raw_line in markdown.splitlines():
        line = raw_line.strip()
        if not line:
            flush_paragraph()
            blocks.append(("space", ""))
            continue
        if line.startswith("# "):
            flush_paragraph()
            blocks.append(("h1", line[2:].strip()))
        elif line.startswith("## "):
            flush_paragraph()
            blocks.append(("h2", line[3:].strip()))
        elif line.startswith("### "):
            flush_paragraph()
            blocks.append(("h3", line[4:].strip()))
        elif line.startswith("- "):
            flush_paragraph()
            blocks.append(("li", line[2:].strip()))
        elif re.match(r"^\d+\.\s+", line):
            flush_paragraph()
            blocks.append(("li", re.sub(r"^\d+\.\s+", "", line)))
        else:
            paragraph.append(line)
    flush_paragraph()
    return blocks


class PdfBuilder:
    def __init__(self) -> None:
        self.pages: list[list[str]] = [[]]
        self.y = TOP

    def ensure_space(self, amount: int) -> None:
        if self.y + amount > PAGE_HEIGHT - BOTTOM:
            self.pages.append([])
            self.y = TOP

    def text_line(self, text: str, x: int, size: float, font: str = "F1") -> None:
        self.pages[-1].append(f"BT /{font} {size} Tf {x} {PAGE_HEIGHT - self.y} Td ({pdf_escape(text)}) Tj ET")
        self.y += LINE_HEIGHT

    def add_block(self, kind: str, value: str) -> None:
        if kind == "space":
            self.y += 5
            return

        if kind == "h1":
            self.ensure_space(42)
            self.text_line(value, LEFT, TITLE_SIZE, "F2")
            self.y += 8
            return

        if kind == "h2":
            self.ensure_space(34)
            self.y += 7
            self.text_line(value, LEFT, H2_SIZE, "F2")
            self.y += 3
            return

        if kind == "h3":
            self.ensure_space(28)
            self.y += 5
            self.text_line(value, LEFT, H3_SIZE, "F2")
            self.y += 2
            return

        if kind == "li":
            lines = wrap_text(value, 86)
            self.ensure_space(len(lines) * LINE_HEIGHT + 4)
            self.text_line("- " + lines[0], LEFT + 12, BODY_SIZE)
            for line in lines[1:]:
                self.text_line("  " + line, LEFT + 20, BODY_SIZE)
            self.y += 2
            return

        lines = wrap_text(value)
        self.ensure_space(len(lines) * LINE_HEIGHT + 6)
        for line in lines:
            self.text_line(line, LEFT, BODY_SIZE)
        self.y += 4

    def render(self) -> bytes:
        objects: list[bytes] = []

        def add_object(data: bytes) -> int:
            objects.append(data)
            return len(objects)

        catalog_id = add_object(b"<< /Type /Catalog /Pages 2 0 R >>")
        pages_id = add_object(b"")
        font_regular_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
        font_bold_id = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

        page_ids: list[int] = []
        for page in self.pages:
            stream = "\n".join(page).encode("latin-1", errors="replace")
            content_id = add_object(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream")
            page_id = add_object(
                (
                    f"<< /Type /Page /Parent {pages_id} 0 R "
                    f"/MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
                    f"/Resources << /Font << /F1 {font_regular_id} 0 R /F2 {font_bold_id} 0 R >> >> "
                    f"/Contents {content_id} 0 R >>"
                ).encode()
            )
            page_ids.append(page_id)

        kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
        objects[pages_id - 1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode()

        output = bytearray(b"%PDF-1.4\n")
        offsets = [0]
        for index, data in enumerate(objects, start=1):
            offsets.append(len(output))
            output.extend(f"{index} 0 obj\n".encode())
            output.extend(data)
            output.extend(b"\nendobj\n")

        xref_position = len(output)
        output.extend(f"xref\n0 {len(objects) + 1}\n".encode())
        output.extend(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            output.extend(f"{offset:010d} 00000 n \n".encode())
        output.extend(
            (
                f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
                f"startxref\n{xref_position}\n%%EOF\n"
            ).encode()
        )
        return bytes(output)


def main() -> None:
    builder = PdfBuilder()
    for kind, value in parse_markdown(SOURCE.read_text(encoding="utf-8")):
        builder.add_block(kind, value)
    OUTPUT.write_bytes(builder.render())
    print(OUTPUT)


if __name__ == "__main__":
    main()
