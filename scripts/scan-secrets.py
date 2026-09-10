#!/usr/bin/env python3
"""Fail when newly introduced content contains a Venice API credential."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


VENICE_KEY = re.compile(rb"VENICE-(?:INFERENCE|ADMIN)-KEY-[A-Za-z0-9_-]{20,}")


def git(*args: str) -> bytes:
    return subprocess.check_output(("git", *args), stderr=subprocess.DEVNULL)


def merge_base(base: str) -> str:
    return git("merge-base", base, "HEAD").decode().strip()


def changed_files(base: str) -> list[Path]:
    output = git(
        "diff",
        "--name-only",
        "--diff-filter=ACMR",
        "-z",
        f"{merge_base(base)}..HEAD",
    )
    return [Path(name.decode()) for name in output.split(b"\0") if name]


def added_lines(base: str) -> bytes:
    patches = git(
        "log",
        "--format=",
        "--unified=0",
        "--no-ext-diff",
        "-p",
        f"{merge_base(base)}..HEAD",
    )
    return b"\n".join(
        line[1:]
        for line in patches.splitlines()
        if line.startswith(b"+") and not line.startswith(b"+++")
    )


def scan(base: str) -> int:
    findings: list[tuple[str, int]] = []

    if VENICE_KEY.search(added_lines(base)):
        findings.append(("new commit content", 0))

    paths = changed_files(base)
    for path in paths:
        try:
            data = path.read_bytes()
        except (FileNotFoundError, OSError):
            continue
        for match in VENICE_KEY.finditer(data):
            findings.append((str(path), data.count(b"\n", 0, match.start()) + 1))

    if not findings:
        print(f"Credential scan passed ({len(paths)} changed files checked).")
        return 0

    print("Potential Venice API credential detected.", file=sys.stderr)
    for location, line in findings:
        annotation = f"file={location},line={line}" if line else "title=Credential detected"
        print(f"::error {annotation}::Remove the credential and load VENICE_API_KEY from the environment.", file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True, help="Base revision for this change.")
    args = parser.parse_args()
    return scan(args.base)


if __name__ == "__main__":
    sys.exit(main())
