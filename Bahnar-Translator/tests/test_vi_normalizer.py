import pytest

from src.text.vi_normalizer import normalize_vi, number_to_words


@pytest.mark.parametrize("n,expected", [
    (0, "không"), (5, "năm"), (10, "mười"), (15, "mười lăm"), (21, "hai mươi mốt"),
    (24, "hai mươi tư"), (25, "hai mươi lăm"), (105, "một trăm linh năm"),
    (1005, "một nghìn không trăm linh năm"), (2019, "hai nghìn không trăm mười chín"),
    (150000, "một trăm năm mươi nghìn"), (1_000_000, "một triệu"),
    (2_500_000, "hai triệu năm trăm nghìn"), (1_000_000_000, "một tỷ"),
])
def test_number_to_words(n, expected):
    assert number_to_words(n) == expected


def test_money():
    assert normalize_vi("Giá 150.000 đồng") == "Giá một trăm năm mươi nghìn đồng"
    assert normalize_vi("Vé 50k") == "Vé năm mươi nghìn đồng"
    assert normalize_vi("Phòng 350.000đ/đêm") == "Phòng ba trăm năm mươi nghìn đồng/đêm"


def test_time():
    assert normalize_vi("Xe chạy lúc 7h30") == "Xe chạy lúc bảy giờ ba mươi phút"
    assert normalize_vi("Mở cửa 8:00") == "Mở cửa tám giờ"


def test_date():
    assert normalize_vi("ngày 31/7") == "ngày ba mươi mốt tháng bảy"
    assert normalize_vi("12/04/2026") == "ngày mười hai tháng tư năm hai nghìn không trăm hai mươi sáu"


def test_units_and_decimal():
    assert normalize_vi("Cách 3,5 km") == "Cách ba phẩy năm ki lô mét"
    assert normalize_vi("Nhiệt độ 25°C") == "Nhiệt độ hai mươi lăm độ xê"
    assert normalize_vi("Nặng 2 kg") == "Nặng hai ki lô gam"


def test_unit_not_confused_with_hour():
    assert normalize_vi("Rộng 15 ha") == "Rộng mười lăm héc ta"


def test_range_and_ordinal():
    assert normalize_vi("Ở 2-3 ngày") == "Ở hai đến ba ngày"
    assert normalize_vi("thứ 4") == "thứ tư"
    assert normalize_vi("thứ 1") == "thứ nhất"


def test_abbrev_and_phone():
    assert normalize_vi("UBND huyện") == "ủy ban nhân dân huyện"
    assert normalize_vi("Gọi 0905123456") == "Gọi không chín không năm một hai ba bốn năm sáu"


def test_no_digits_left():
    out = normalize_vi("Tour 2 ngày 1 đêm giá 1.250.000 VND, khởi hành 6h, ngày 30/4")
    assert not any(c.isdigit() for c in out)


def test_hour_keeps_space_before_next_word():
    assert normalize_vi("lúc 5 giờ chiều") == "lúc năm giờ chiều"
    assert normalize_vi("từ 6 giờ sáng") == "từ sáu giờ sáng"
    assert normalize_vi("lúc 7 giờ 15 phút") == "lúc bảy giờ mười lăm phút"


def test_emergency_numbers_read_digitwise():
    assert normalize_vi("Gọi 115 ngay") == "Gọi một một năm ngay"
    assert normalize_vi("Giá 1150 đồng") == "Giá một nghìn một trăm năm mươi đồng"
