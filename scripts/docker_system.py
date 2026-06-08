#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPOSE_FILE = ROOT / "docker-compose.yml"
PROJECT_NAME = "ikomek-local"
LOCAL_API_URL = "http://127.0.0.1:8001/api"


def docker_compose_command() -> list[str]:
    docker = shutil.which("docker")
    if docker:
        probe = subprocess.run(
            [docker, "compose", "version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        if probe.returncode == 0:
            return [docker, "compose"]

    docker_compose = shutil.which("docker-compose")
    if docker_compose:
        return [docker_compose]

    raise RuntimeError("Docker Compose was not found. Install Docker Desktop or docker compose.")


def compose_args(*args: str) -> list[str]:
    return [
        *docker_compose_command(),
        "--project-name",
        PROJECT_NAME,
        "--file",
        str(COMPOSE_FILE),
        *args,
    ]


def run(command: list[str]) -> int:
    print(f"[docker] {' '.join(command)}", flush=True)
    return subprocess.run(command, cwd=ROOT, check=False).returncode


def exec_backend(*args: str, tty: bool = False) -> int:
    exec_args = ["exec"]
    if not tty:
        exec_args.append("-T")
    return run(compose_args(*exec_args, "backend", *args))


def print_urls() -> None:
    print("")
    print("Backend: http://localhost:8001")
    print("Web:     http://localhost:8080")
    print("Mongo:   mongodb://localhost:27018")


def seed_demo() -> int:
    code = """
import json
import urllib.request

request = urllib.request.Request("http://127.0.0.1:8001/api/seed-demo", method="POST")
with urllib.request.urlopen(request, timeout=180) as response:
    payload = json.loads(response.read().decode("utf-8"))
print(json.dumps(payload, ensure_ascii=False, indent=2))
"""
    return exec_backend("python", "-c", code)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run iKOMEK locally from Docker images and execute backend maintenance tasks."
    )
    subparsers = parser.add_subparsers(dest="command")

    up = subparsers.add_parser("up", help="Build and start Mongo, backend, and web containers.")
    up.add_argument("services", nargs="*", help="Optional service names: mongo, backend, web.")
    up.add_argument("-d", "--detach", action="store_true", help="Run containers in the background.")
    up.add_argument("--no-build", action="store_true", help="Start existing images without rebuilding.")

    build = subparsers.add_parser("build", help="Build Docker images.")
    build.add_argument("services", nargs="*", help="Optional service names: backend, web.")

    down = subparsers.add_parser("down", help="Stop and remove containers.")
    down.add_argument("-v", "--volumes", action="store_true", help="Also remove the Mongo volume.")

    logs = subparsers.add_parser("logs", help="Follow container logs.")
    logs.add_argument("services", nargs="*", help="Optional service names: mongo, backend, web.")
    logs.add_argument("--tail", default="150", help="Number of log lines to show first.")

    subparsers.add_parser("ps", help="Show container status.")
    subparsers.add_parser("seed-demo", help="Run POST /api/seed-demo inside the backend container.")
    subparsers.add_parser("reset-news", help="Recreate demo news through the local backend API.")
    subparsers.add_parser("rotate-passwords", help="Apply SEED_OPERATOR_PASSWORD and SEED_ADMIN_PASSWORD to local DB.")
    subparsers.add_parser("shell", help="Open a shell in the backend container.")

    if not argv:
        argv = ["up"]

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(list(argv if argv is not None else sys.argv[1:]))

    if not COMPOSE_FILE.exists():
        print(f"Compose file was not found: {COMPOSE_FILE}", file=sys.stderr)
        return 1

    try:
        if args.command == "up":
            command = ["up"]
            if not args.no_build:
                command.append("--build")
            if args.detach:
                command.append("--detach")
            command.extend(args.services)
            result = run(compose_args(*command))
            if result == 0:
                print_urls()
            return result

        if args.command == "build":
            return run(compose_args("build", *args.services))

        if args.command == "down":
            command = ["down"]
            if args.volumes:
                command.append("--volumes")
            return run(compose_args(*command))

        if args.command == "logs":
            return run(compose_args("logs", "--follow", "--tail", args.tail, *args.services))

        if args.command == "ps":
            return run(compose_args("ps"))

        if args.command == "seed-demo":
            return seed_demo()

        if args.command == "reset-news":
            return exec_backend(
                "python",
                "scripts/reset_news_via_api.py",
                "--base-url",
                LOCAL_API_URL,
            )

        if args.command == "rotate-passwords":
            return exec_backend("python", "scripts/rotate_system_passwords.py")

        if args.command == "shell":
            return exec_backend("sh", tty=True)

        raise RuntimeError(f"Unknown command: {args.command}")
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
