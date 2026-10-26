from src.mt.postprocess import remove_adjacent_repetitions


def test_removes_adjacent_word_loop():
    assert remove_adjacent_repetitions("xin xin chào") == "xin chào"


def test_removes_adjacent_phrase_loop():
    assert remove_adjacent_repetitions("đi đến làng đi đến làng hôm nay") == "đi đến làng hôm nay"


def test_keeps_non_adjacent_words():
    text = "đi đến làng rồi đi về nhà"
    assert remove_adjacent_repetitions(text) == text
