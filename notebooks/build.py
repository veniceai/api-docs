#!/usr/bin/env python3
"""Build the Colab notebooks from the tutorial pages they mirror.

The MDX page is the source of truth for tutorial code. Cells that carry code
declare where it comes from with `mdx(section, index)`, and the build fails if
that anchor stops resolving, so a rewritten tutorial cannot silently leave a
stale notebook behind.

The notebook cannot be a straight concatenation of the page, because a tutorial
is ordered to be read while a notebook has to run top to bottom. The page
inspects `chunks` before the text being chunked exists, imports `narrate` as a
module, and guards its entry point behind `__main__`. Cells marked `extra` cover
those gaps and the things that only make sense in Colab, such as reading the key
from Colab secrets and playing the audio back inline.

Usage: python notebooks/build.py [--check]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCS_URL = "https://docs.venice.ai"
GITHUB_REPO = "veniceai/api-docs"


def code_blocks(mdx: Path) -> dict[str, list[str]]:
    """Return the Python blocks on a page, grouped by their enclosing heading."""
    src = mdx.read_text(encoding="utf-8")
    headings = [(m.start(), m.group(1).strip()) for m in re.finditer(r"^## (.+)$", src, re.M)]

    blocks: dict[str, list[str]] = {}
    for match in re.finditer(r"```python[^\n]*\n(.*?)```", src, re.S):
        section = "(intro)"
        for start, name in headings:
            if start > match.start():
                break
            section = name
        blocks.setdefault(section, []).append(match.group(1).rstrip())
    return blocks


class Cell:
    def __init__(self, kind: str, body: str, drop: tuple[str, ...] = ()):
        self.kind, self.body, self.drop = kind, body, drop


def md(body: str) -> Cell:
    return Cell("markdown", body)


def extra(body: str) -> Cell:
    """Code that exists only in the notebook, not on the page."""
    return Cell("extra", body)


def mdx(section: str, index: int = 0, drop: tuple[str, ...] = ()) -> Cell:
    return Cell("mdx", f"{section}\u0000{index}", drop)


def resolve(cells: list[Cell], blocks: dict[str, list[str]], page: str) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for cell in cells:
        if cell.kind != "mdx":
            out.append(("markdown" if cell.kind == "markdown" else "code", cell.body))
            continue

        section, raw_index = cell.body.split("\u0000")
        index = int(raw_index)
        if section not in blocks:
            raise SystemExit(
                f"{page}: no section titled {section!r}.\n"
                f"  available: {sorted(blocks)}\n"
                f"  Update notebooks/build.py to match the rewritten page."
            )
        if index >= len(blocks[section]):
            raise SystemExit(
                f"{page}: section {section!r} has {len(blocks[section])} Python block(s), "
                f"needed index {index}.\n  Update notebooks/build.py to match the rewritten page."
            )

        code = blocks[section][index]
        for line in cell.drop:
            if line not in code:
                raise SystemExit(f"{page}: expected to drop {line!r} from {section!r}, not found.")
            code = "\n".join(l for l in code.splitlines() if l.strip() != line.strip())
        out.append(("code", code.strip("\n")))
    return out


def notebook(cells: list[tuple[str, str]]) -> dict:
    def cell(kind: str, source: str) -> dict:
        base = {"cell_type": kind, "metadata": {}, "source": source.splitlines(keepends=True)}
        if kind == "code":
            base |= {"execution_count": None, "outputs": []}
        return base

    return {
        "cells": [cell(k, s) for k, s in cells],
        "metadata": {
            "colab": {"provenance": [], "toc_visible": True},
            "kernelspec": {"name": "python3", "display_name": "Python 3"},
            "language_info": {"name": "python"},
        },
        "nbformat": 4,
        "nbformat_minor": 0,
    }


# --------------------------------------------------------------------------
# notebooks/article-narration.ipynb
# --------------------------------------------------------------------------

NARRATION_PAGE = "guides/media/article-narration.mdx"

NARRATION = [
    md(
        "# Narrating Articles with Venice Text-to-Speech\n"
        "\n"
        "Turn any web article into a single narrated audio file, and play it back here.\n"
        "\n"
        "This notebook accompanies "
        f"[Narrating Articles with Text-to-Speech]({DOCS_URL}/guides/media/article-narration), "
        "which explains the reasoning behind each step. Run the cells in order.\n"
        "\n"
        "You need a Venice API key from "
        f"[venice.ai/settings/api]({DOCS_URL}/guides/getting-started/generating-api-key). "
        "A full run scrapes one page, makes one chat completion, and synthesizes about six "
        "minutes of speech, so it consumes a small amount of credit."
    ),
    md(
        "## Setup\n"
        "\n"
        "Store the key with the key icon in the Colab sidebar, as a secret named "
        "`VENICE_API_KEY`, so it is not saved into the notebook when you share it. "
        "If no secret is set you will be prompted for it, and the value stays in memory."
    ),
    extra(
        "%pip install -q requests\n"
        "\n"
        "import os\n"
        "\n"
        "\n"
        "def load_api_key() -> str:\n"
        "    try:\n"
        "        from google.colab import userdata\n"
        "\n"
        "        return userdata.get('VENICE_API_KEY')\n"
        "    except Exception:\n"
        "        pass\n"
        "    if os.environ.get('VENICE_API_KEY'):\n"
        "        return os.environ['VENICE_API_KEY']\n"
        "    from getpass import getpass\n"
        "\n"
        "    return getpass('Venice API key: ')\n"
        "\n"
        "\n"
        "# The tutorial code reads the key from the environment.\n"
        "os.environ['VENICE_API_KEY'] = load_api_key()\n"
        "print('Key loaded.')"
    ),
    md(
        "## 1. Choose a model and a voice\n"
        "\n"
        "Voices belong to models, and sending a voice from one family to a model from another "
        "is the most common first mistake. `model_spec.voices` is the authoritative voice list "
        "for a model, and `supported_formats` tells you which `response_format` values it "
        "accepts.\n"
        "\n"
        "We use `tts-xai-v1` with the voice `eve`. It supports `pcm`, which is what makes "
        "joining chunks straightforward in section 4."
    ),
    extra(
        "import requests\n"
        "\n"
        "models = requests.get(\n"
        "    'https://api.venice.ai/api/v1/models',\n"
        "    headers={'Authorization': f\"Bearer {os.environ['VENICE_API_KEY']}\"},\n"
        "    params={'type': 'tts'},\n"
        "    timeout=60,\n"
        ").json()['data']\n"
        "\n"
        "for model in models:\n"
        "    spec = model['model_spec']\n"
        "    print(f\"{model['id']:28} formats={spec['supported_formats']} \"\n"
        "          f\"voices={len(spec['voices'])}\")"
    ),
    md(
        "## 2. Make a single request\n"
        "\n"
        "The response body is raw audio rather than JSON, so write the bytes straight to a file."
    ),
    mdx("2. Make a single request"),
    extra(
        "from IPython.display import Audio\n"
        "\n"
        "Audio('hello.mp3')"
    ),
    md(
        "## 3. Split text at the 4096 character limit\n"
        "\n"
        "The `input` field accepts at most 4096 characters, and longer text is rejected outright "
        "rather than truncated silently. Splitting on sentence boundaries matters, because a "
        "chunk that ends mid sentence produces an audible stumble at the join.\n"
        "\n"
        "The default `max_chars` is 1500 rather than something near the ceiling, and that is "
        "deliberate. Synthesis time grows with input length, so smaller chunks come back sooner "
        "and, because they run in parallel, finish the whole job faster."
    ),
    mdx("3. Split text at the 4096 character limit"),
    md(
        "## 4. Join the chunks into one file\n"
        "\n"
        "Concatenating encoded audio such as MP3 is unreliable, because every chunk carries its "
        "own frame headers. Requesting `pcm` avoids the problem entirely. PCM is raw samples "
        "with no container, so joining is just appending bytes, and the standard library `wave` "
        "module writes the header for us."
    ),
    mdx("4. Join the chunks into one file"),
    md(
        "Raw PCM carries no sample rate, so you have to supply the correct one when writing the "
        "WAV header, and it is model specific. `tts-xai-v1` returns 24 kHz while `tts-gradium-v1` "
        "returns 48 kHz. Guess wrong and the narration plays at the wrong speed and pitch.\n"
        "\n"
        "To find the rate for any model, ask for one short clip as `wav` and read the header it "
        "comes back with."
    ),
    extra(
        "import wave\n"
        "\n"
        "probe = requests.post(\n"
        "    f'{BASE_URL}/audio/speech',\n"
        "    headers=HEADERS,\n"
        "    json={'model': MODEL, 'voice': VOICE, 'input': 'Probe.', 'response_format': 'wav'},\n"
        "    timeout=300,\n"
        ")\n"
        "probe.raise_for_status()\n"
        "open('probe.wav', 'wb').write(probe.content)\n"
        "\n"
        "with wave.open('probe.wav') as handle:\n"
        "    print(handle.getframerate(), handle.getnchannels(), handle.getsampwidth())"
    ),
    md(
        "## 5. Prepare text that sounds right\n"
        "\n"
        "Scraped Markdown read aloud verbatim is close to unlistenable. A speech model spells "
        "URLs out one character at a time, so `https://docs.venice.ai/llms.txt` comes out as "
        "*h t t p s colon slash slash docs dot venice dot a i*. Rather than fighting Markdown "
        "with regular expressions, we ask a chat model to rewrite the article as something meant "
        "to be spoken.\n"
        "\n"
        "The page keeps this in a second file that imports `narrate`. Here everything shares one "
        "namespace, so that import is dropped."
    ),
    mdx("5. Prepare text that sounds right", drop=("from narrate import narrate",)),
    md(
        "## 6. Put it together\n"
        "\n"
        "The page guards its entry point behind `__main__` and takes the URL from the command "
        "line. In the notebook we set it directly, so change `URL` to narrate a different page.\n"
        "\n"
        "Saving `script.txt` next to the audio is worth the two lines. When a narration sounds "
        "wrong the script almost always shows why, and you can fix it without paying to "
        "synthesize again."
    ),
    extra(
        "URL = 'https://docs.venice.ai/overview/privacy'\n"
        "\n"
        "print('Scraping', URL)\n"
        "markdown = scrape(URL)\n"
        "\n"
        "print(f'Writing script from {len(markdown)} characters of Markdown')\n"
        "script = write_script(markdown)\n"
        "\n"
        "with open('script.txt', 'w') as handle:\n"
        "    handle.write(script)\n"
        "\n"
        "print(f'Script is {len(script)} characters')\n"
        "print(script[:400] + '...')"
    ),
    md("Now that `script` exists, the two inspection cells from the tutorial can run."),
    mdx("3. Split text at the 4096 character limit", 1),
    mdx("4. Join the chunks into one file", 1),
    md("Synthesize the whole article and listen to it."),
    extra(
        "narrate(script, 'article.wav')\n"
        "\n"
        "Audio('article.wav')"
    ),
    md(
        "## Streaming for interactive use\n"
        "\n"
        "Batch narration optimizes total time. A voice interface has the opposite priority, "
        "which is getting the first audio out as fast as possible. Setting `streaming: true` "
        "returns the body sentence by sentence as it is generated, so playback can start in "
        "about a second instead of waiting for the complete clip."
    ),
    mdx("Streaming for interactive use"),
    extra("Audio('streamed.mp3')"),
    md(
        "## Next steps\n"
        "\n"
        f"- [Text-to-Speech]({DOCS_URL}/guides/media/text-to-speech), reference for the endpoint "
        "and its parameters\n"
        f"- [Voice Cloning]({DOCS_URL}/guides/media/voice-cloning), narrate with a custom voice "
        "instead of a preset\n"
        f"- [Cited Answers with Web Search]({DOCS_URL}/guides/tools/cited-web-answers), generate "
        "the text this notebook narrates\n"
        f"- [Speech-to-Text]({DOCS_URL}/guides/media/speech-to-text), transcribe the audio back "
        "and compare it against `script.txt` to verify the chunks joined in the right order"
    ),
]

BUILDS = [(NARRATION_PAGE, "notebooks/article-narration.ipynb", NARRATION)]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if a notebook is out of date")
    args = parser.parse_args()

    stale = []
    for page, out, cells in BUILDS:
        built = notebook(resolve(cells, code_blocks(REPO / page), page))
        text = json.dumps(built, indent=1, ensure_ascii=False) + "\n"
        target = REPO / out

        if args.check:
            current = target.read_text(encoding="utf-8") if target.exists() else ""
            if current != text:
                stale.append(out)
            continue

        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
        code = sum(1 for k, _ in resolve(cells, code_blocks(REPO / page), page) if k == "code")
        print(f"wrote {out} ({len(built['cells'])} cells, {code} code) from {page}")

    if stale:
        print("out of date, run python notebooks/build.py:", ", ".join(stale), file=sys.stderr)
        return 1
    if args.check:
        print("notebooks are up to date")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
