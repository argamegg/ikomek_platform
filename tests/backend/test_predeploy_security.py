from datetime import datetime, timedelta
import re

import pytest

from apps.backend.helpers import (
    generate_verification_code,
    get_password_hash,
    hash_verification_code,
    normalize_email,
    normalize_language,
    seconds_until,
    to_pagination_params,
    verify_password,
)


def test_password_hashing_uses_non_plaintext_hashes():
    password = "DeployReady#109"

    hashed = get_password_hash(password)

    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrong-password", hashed)


def test_email_and_language_normalization_are_predictable():
    assert normalize_email("  Citizen@IKOMEK.KZ ") == "citizen@ikomek.kz"
    assert normalize_language("kz") == "kz"
    assert normalize_language("en") == "en"
    assert normalize_language("unexpected") == "ru"
    assert normalize_language(None) == "ru"


def test_verification_codes_are_six_digit_numeric_values():
    codes = {generate_verification_code() for _ in range(100)}

    assert all(re.fullmatch(r"\d{6}", code) for code in codes)
    assert len(codes) > 95


def test_verification_code_hash_is_context_bound_and_not_plaintext():
    code = "123456"

    first = hash_verification_code("registration-a", code)
    second = hash_verification_code("registration-b", code)

    assert first != code
    assert first != second
    assert re.fullmatch(r"[a-f0-9]{64}", first)


@pytest.mark.parametrize(
    ("page", "limit", "expected"),
    [
        (-10, -1, (1, 1)),
        (0, 0, (1, 1)),
        (2, 25, (2, 25)),
        (3, 1000, (3, 100)),
    ],
)
def test_pagination_is_clamped(page, limit, expected):
    assert to_pagination_params(page, limit) == expected


def test_seconds_until_never_returns_negative_values():
    assert seconds_until(datetime.utcnow() - timedelta(minutes=1)) == 0
    assert seconds_until(None) == 0
    assert seconds_until(datetime.utcnow() + timedelta(seconds=5)) in range(0, 6)
