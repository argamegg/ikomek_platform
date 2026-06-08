import os


MIN_SYSTEM_SEED_PASSWORD_LENGTH = 24
SYSTEM_SEED_PASSWORD_ENV = {
    "operator": "SEED_OPERATOR_PASSWORD",
    "admin": "SEED_ADMIN_PASSWORD",
}
WEAK_SYSTEM_SEED_PASSWORDS = {
    "admin",
    "admin123",
    "demo123",
    "operator",
    "operator123",
    "password",
    "password123",
}


class SeedCredentialError(ValueError):
    pass


def validate_system_seed_password(password: str, env_name: str) -> str:
    normalized = password.strip()
    if not normalized:
        raise SeedCredentialError(f"{env_name} is required for seeding system accounts.")

    if len(normalized) < MIN_SYSTEM_SEED_PASSWORD_LENGTH:
        raise SeedCredentialError(
            f"{env_name} must be at least {MIN_SYSTEM_SEED_PASSWORD_LENGTH} characters."
        )

    lowered = normalized.lower()
    if lowered in WEAK_SYSTEM_SEED_PASSWORDS:
        raise SeedCredentialError(f"{env_name} cannot use a known demo password.")

    character_classes = sum(
        (
            any(char.islower() for char in normalized),
            any(char.isupper() for char in normalized),
            any(char.isdigit() for char in normalized),
            any(not char.isalnum() for char in normalized),
        )
    )
    if character_classes < 3:
        raise SeedCredentialError(
            f"{env_name} must include at least three of: lowercase, uppercase, digits, symbols."
        )

    return normalized


def get_system_seed_password(role: str) -> str:
    env_name = SYSTEM_SEED_PASSWORD_ENV[role]
    return validate_system_seed_password(os.environ.get(env_name, ""), env_name)


def get_system_seed_passwords() -> dict[str, str]:
    return {
        role: get_system_seed_password(role)
        for role in SYSTEM_SEED_PASSWORD_ENV
    }
