import pytest

from seed_credentials import (
    MIN_SYSTEM_SEED_PASSWORD_LENGTH,
    SeedCredentialError,
    get_system_seed_passwords,
    validate_system_seed_password,
)


def test_system_seed_password_rejects_known_demo_password():
    with pytest.raises(SeedCredentialError):
        validate_system_seed_password("admin123", "SEED_ADMIN_PASSWORD")


def test_system_seed_password_requires_long_secret():
    with pytest.raises(SeedCredentialError):
        validate_system_seed_password("Short#123", "SEED_ADMIN_PASSWORD")


def test_system_seed_password_accepts_long_complex_secret():
    password = "DeployAdmin#109-" + ("A" * MIN_SYSTEM_SEED_PASSWORD_LENGTH)

    assert validate_system_seed_password(password, "SEED_ADMIN_PASSWORD") == password


def test_system_seed_passwords_read_required_env(monkeypatch):
    monkeypatch.setenv("SEED_OPERATOR_PASSWORD", "OperatorDeploy#109-Secure-Password")
    monkeypatch.setenv("SEED_ADMIN_PASSWORD", "AdminDeploy#109-Secure-Password")

    assert get_system_seed_passwords() == {
        "operator": "OperatorDeploy#109-Secure-Password",
        "admin": "AdminDeploy#109-Secure-Password",
    }
