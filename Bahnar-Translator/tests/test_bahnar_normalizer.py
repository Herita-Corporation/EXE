import unicodedata

import pytest

from src.text.bahnar_normalizer import (
    BREVE, graphemes, has_digit, normalize_bahnar, normalize_for_asr, normalize_for_mt, words,
)
from src.text.vocab import build_ctc_vocab, text_to_ctc_chars, unk_rate


def test_nfc_composes_precomposable():
    decomposed = "ă"  # ă
    assert normalize_for_mt(decomposed) == "ă"


def test_o_horn_breve_stays_two_codepoints():
    s = normalize_for_mt("bơ̆n")
    assert "ơ" + BREVE in s
    assert len(graphemes("ơ̆")) == 1


def test_u_horn_breve_stays_two_codepoints():
    s = normalize_for_asr("kư̆m")
    assert s == "kư̆m"


def test_nfc_is_idempotent():
    s = "'Bok Kei-Dei rơ̆ih 'nhŏng bơ̆n"
    once = normalize_for_mt(s)
    assert normalize_for_mt(once) == once
    assert unicodedata.is_normalized("NFC", once)


@pytest.mark.parametrize("q", ["’", "‘", "ʼ", "´", "`"])
def test_apostrophe_variants_unified(q):
    assert normalize_for_mt(f"{q}Bok") == "'Bok"


def test_apostrophe_phoneme_kept_for_asr():
    assert normalize_for_asr("'Bok Kei-Dei") == "'bok kei-dei"
    assert normalize_for_asr("P'lơk") == "p'lơk"


def test_apostrophe_as_quote_removed_for_asr():
    assert normalize_for_asr("inh khan: 'năr' '") == "inh khan 'năr"


def test_double_apostrophe_is_quote():
    assert normalize_for_mt("''Năr Văn hoa''") == '"Năr Văn hoa"'
    assert normalize_for_asr("''Năr Văn hoa''") == "năr văn hoa"


def test_hyphen_unified_and_kept_intraword():
    assert normalize_for_mt("ling–lang") == "ling-lang"
    assert normalize_for_asr("hiôk-hian ling-lang") == "hiôk-hian ling-lang"


def test_standalone_dash_removed_for_asr():
    assert normalize_for_asr("tuyên truyền - giáo dục") == "tuyên truyền giáo dục"


def test_asr_lowercase_and_punct():
    assert normalize_for_asr("Inh Pôl, bơngai mă!") == "inh pôl bơngai mă"


def test_mt_keeps_case_and_punct():
    assert normalize_for_mt("Inh Pôl,  bơngai mă!") == "Inh Pôl, bơngai mă!"


def test_digits_kept_for_filtering():
    s = normalize_for_asr("'Năr 31/7, sơnăm 2019")
    assert has_digit(s)
    assert "31" in s and "/" not in s


def test_eth_mapped_to_d_stroke():
    assert normalize_for_mt("Ðak") == "Đak"


def test_nbsp_and_zero_width_removed():
    assert normalize_for_mt("inh pôl​") == "inh pôl"


def test_caron_to_breve_default_on_and_can_disable():
    assert normalize_for_mt("khěi") == "khĕi"
    assert normalize_for_asr("Hǒk") == "hŏk"
    assert normalize_for_mt("khěi", fix_caron=False) == "khěi"


def test_caron_fix_keeps_vietnamese_tones():
    assert normalize_for_mt("Vĩnh Thạnh ě") == "Vĩnh Thạnh ĕ"


def test_empty_and_none():
    assert normalize_bahnar("", for_asr=True) == ""
    assert normalize_bahnar(None, for_asr=False) == ""


def test_words_split():
    assert words("'Bok Kei-Dei rơih.") == ["'bok", "kei-dei", "rơih"]


def test_vocab_contains_breve_token_and_no_unk():
    texts = ["Inh Pôl bơngai 'Bok Kei-Dei", "iĕm jơ̆p kư̆m", "ơ̆ ư̆"]
    vocab = build_ctc_vocab(texts)
    assert BREVE in vocab
    rate, unk = unk_rate(texts, vocab)
    assert rate == 0.0 and not unk


def test_vocab_excludes_digits_by_default():
    vocab = build_ctc_vocab(["năr 31"])
    assert "3" not in vocab and "1" not in vocab


def test_ctc_chars_word_delim():
    assert text_to_ctc_chars("a b") == ["a", "|", "b"]


def test_saltillo_is_apostrophe():
    assert normalize_for_asr("\ua78cbok") == "'bok"


def test_non_latin_detected_and_excluded_from_vocab():
    from src.text.bahnar_normalizer import has_non_latin

    assert has_non_latin("inh ក") and has_non_latin("ә") and not has_non_latin("'bơ̆n kei-dei ĭ")
    vocab = build_ctc_vocab(["inh ក pôl"])
    assert "ក" not in vocab and "i" in vocab
