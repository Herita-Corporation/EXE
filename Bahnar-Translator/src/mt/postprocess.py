"""Conservative cleanup shared by PyTorch and CTranslate2 inference."""
from __future__ import annotations

import re


def _key(token: str) -> str:
    return re.sub(r"[^\wÀ-ỹĐđ]", "", token, flags=re.UNICODE).casefold()


def remove_adjacent_repetitions(text: str, max_phrase_words: int = 8) -> str:
    """Remove exact adjacent word/phrase loops without rewriting vocabulary.

    Neural generation occasionally emits ``x x`` or repeats a short phrase
    two or more times. Matching normalized adjacent tokens keeps this cleanup
    deterministic and avoids trying to "correct" uncertain Ba Na content.
    """
    words = text.split()
    if len(words) < 2:
        return text.strip()

    changed = True
    while changed:
        changed = False
        for size in range(min(max_phrase_words, len(words) // 2), 0, -1):
            i = 0
            while i + 2 * size <= len(words):
                left = [_key(w) for w in words[i : i + size]]
                right = [_key(w) for w in words[i + size : i + 2 * size]]
                if any(left) and left == right:
                    del words[i + size : i + 2 * size]
                    changed = True
                else:
                    i += 1
    return " ".join(words).strip()
