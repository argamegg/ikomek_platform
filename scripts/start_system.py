#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "apps" / "backend"
MOBILE_DIR = ROOT / "apps" / "mobile-app"
WEB_DIR = ROOT / "apps" / "web-app"
COMPOSE_FILE = ROOT / "docker-compose.yml"
PROJECT_NAME = "ikomek-local"
LOCAL_API_URL = "http://127.0.0.1:8001/api"
DEFAULT_EXPO_HOST = "lan"


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


def run_command(command: list[str]) -> int:
    print(f"[docker] {' '.join(command)}", flush=True)
    return subprocess.run(command, cwd=ROOT, check=False).returncode


def exec_backend(*args: str, tty: bool = False) -> int:
    exec_args = ["exec"]
    if not tty:
        exec_args.append("-T")
    return run_command(compose_args(*exec_args, "backend", *args))


def print_docker_urls() -> None:
    print("")
    print("Backend: http://localhost:8001")
    print("Web:     http://localhost:8080")
    print("Mongo:   mongodb://localhost:27018")
    print("")


def detect_lan_host() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def default_mobile_api_url(backend_port: int) -> str:
    return f"http://{detect_lan_host()}:{backend_port}"


def seed_demo_via_backend() -> int:
    code = """
import json
import sys
import urllib.request
import urllib.error

request = urllib.request.Request("http://127.0.0.1:8001/api/seed-demo", method="POST")
try:
    with urllib.request.urlopen(request, timeout=180) as response:
        payload = json.loads(response.read().decode("utf-8"))
        print(json.dumps(payload, ensure_ascii=False, indent=2))
except urllib.error.HTTPError as error:
    body = error.read().decode("utf-8", errors="replace")
    print(f"HTTP {error.code}: {body}", file=sys.stderr)
    raise SystemExit(1)
"""
    return exec_backend("python", "-c", code)


def npm_executable() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def python_candidates() -> list[Path]:
    if os.name == "nt":
        return [
            BACKEND_DIR / "venv" / "Scripts" / "python.exe",
            ROOT / "venv" / "Scripts" / "python.exe",
        ]

    return [
        BACKEND_DIR / "venv" / "bin" / "python",
        ROOT / "venv" / "bin" / "python",
    ]


def find_backend_python() -> str:
    for candidate in python_candidates():
        if candidate.exists():
            return str(candidate)

    for executable in (shutil.which("python3"), shutil.which("python"), sys.executable):
        if executable:
            return executable

    raise RuntimeError("No Python executable was found for starting the backend.")


@dataclass
class ServiceSpec:
    name: str
    cwd: Path
    command: list[str]
    extra_env: dict[str, str]
    interactive: bool = False


def stream_output(name: str, pipe) -> None:
    try:
        for line in iter(pipe.readline, ""):
            if not line:
                break
            print(f"[{name}] {line.rstrip()}")
    finally:
        pipe.close()

def is_port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex(("127.0.0.1", port)) != 0


def find_available_port(preferred_port: int, *, dry_run: bool) -> int:
    if dry_run:
        return preferred_port

    port = preferred_port
    while port < preferred_port + 20:
        if is_port_available(port):
            return port
        port += 1

    raise RuntimeError(f"No available mobile dev server port found near {preferred_port}.")


def build_mobile_service_spec(args: argparse.Namespace, *, backend_port: int) -> ServiceSpec:
    mobile_port = find_available_port(args.mobile_port, dry_run=args.dry_run)
    if mobile_port != args.mobile_port:
        print(f"[system] Mobile port {args.mobile_port} is busy. Using port {mobile_port} instead.")

    mobile_api_url = args.mobile_api_url or default_mobile_api_url(backend_port)

    return ServiceSpec(
        name="mobile",
        cwd=MOBILE_DIR,
        command=[
            npm_executable(),
            "run",
            "start",
            "--",
            "--dev-client",
            "--host",
            args.expo_host,
            "--port",
            str(mobile_port),
        ],
        extra_env={
            "EXPO_NO_TELEMETRY": "1",
            "EXPO_PUBLIC_BACKEND_URL": mobile_api_url,
        },
        interactive=True,
    )


# Build the list of services to start based on CLI arguments
def build_service_specs(args: argparse.Namespace) -> list[ServiceSpec]:
    specs: list[ServiceSpec] = []

    if not args.skip_backend:
        specs.append(
            ServiceSpec(
                name="backend",
                cwd=BACKEND_DIR,
                command=[
                    find_backend_python(),
                    "-m",
                    "uvicorn",
                    "server:app",
                    "--host",
                    "0.0.0.0",
                    "--port",
                    str(args.backend_port),
                    "--reload",
                ],
                extra_env={},
            )
        )

    if not args.skip_web:
        specs.append(
            ServiceSpec(
                name="web",
                cwd=WEB_DIR,
                command=[
                    npm_executable(),
                    "run",
                    "dev",
                    "--",
                    "--host",
                    "0.0.0.0",
                    "--port",
                    str(args.web_port),
                ],
                extra_env={"BROWSER": "none"},
            )
        )

    if not args.skip_mobile:
        specs.append(build_mobile_service_spec(args, backend_port=args.backend_port))

    if not specs:
        raise RuntimeError("All services were skipped. Start at least one service.")

    return specs


def validate_layout(specs: list[ServiceSpec]) -> None:
    missing = [str(spec.cwd) for spec in specs if not spec.cwd.exists()]
    if missing:
        raise RuntimeError(f"Missing application directories: {', '.join(missing)}")

def add_dev_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--skip-backend", action="store_true", help="Do not start the backend.")
    parser.add_argument("--skip-web", action="store_true", help="Do not start the web frontend.")
    parser.add_argument("--skip-mobile", action="store_true", help="Do not start the mobile frontend.")
    parser.add_argument("--backend-port", type=int, default=8001, help="Backend port.")
    parser.add_argument("--web-port", type=int, default=5173, help="Web app port.")
    parser.add_argument("--mobile-port", type=int, default=8081, help="Preferred Expo dev server port.")
    parser.add_argument("--mobile-api-url", help="Backend base URL injected into the Expo app.")
    parser.add_argument(
        "--expo-host",
        default=DEFAULT_EXPO_HOST,
        choices=["lan", "localhost", "tunnel"],
        help="Expo host mode for the QR code.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print commands without starting them.")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Start iKOMEK locally from Docker images. Use `dev` for the old Python/NPM runner."
    )
    subparsers = parser.add_subparsers(dest="command")

    up = subparsers.add_parser("up", help="Build and start Mongo, backend, web, and the Expo mobile dev server.")
    up.add_argument("services", nargs="*", help="Optional service names: mongo, backend, web, mobile.")
    up.add_argument("-d", "--detach", action="store_true", help="Run containers in the background.")
    up.add_argument("--no-build", action="store_true", help="Start existing images without rebuilding.")
    up.add_argument("--force-recreate", action="store_true", help="Recreate containers to reload env files.")
    up.add_argument("--skip-mobile", action="store_true", help="Do not start Expo after Docker services.")
    up.add_argument("--mobile-port", type=int, default=8081, help="Preferred Expo dev server port.")
    up.add_argument("--mobile-api-url", help="Backend base URL injected into the Expo app.")
    up.add_argument(
        "--expo-host",
        default=DEFAULT_EXPO_HOST,
        choices=["lan", "localhost", "tunnel"],
        help="Expo host mode for the QR code.",
    )
    up.set_defaults(dry_run=False)

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

    dev = subparsers.add_parser("dev", help="Start services directly with Python/NPM instead of Docker.")
    add_dev_arguments(dev)

    if not argv:
        argv = ["up"]
    elif argv[0] == "--docker":
        argv = argv[1:] or ["up"]
    elif argv[0] in {"--skip-mobile", "--mobile-port", "--mobile-api-url", "--expo-host"}:
        argv = ["up", *argv]
    elif argv[0].startswith("--") and argv[0] not in {"-h", "--help"}:
        argv = ["dev", *argv]

    return parser.parse_args(argv)


def terminate_processes(processes: list[subprocess.Popen[str]]) -> None:
    for process in processes:
        if process.poll() is None:
            process.terminate()

    deadline = time.time() + 5
    for process in processes:
        if process.poll() is None:
            remaining = max(0, deadline - time.time())
            try:
                process.wait(timeout=remaining)
            except subprocess.TimeoutExpired:
                process.kill()


def run_dev_services(args: argparse.Namespace) -> int:
    specs = build_service_specs(args)
    validate_layout(specs)

    print("Starting iKOMEK services from:")
    print(f"  root: {ROOT}")
    print(f"  backend: {BACKEND_DIR}")
    print(f"  mobile: {MOBILE_DIR}")
    print(f"  web: {WEB_DIR}")
    print("")

    for spec in specs:
        print(f"{spec.name}: {' '.join(spec.command)}")

    if args.dry_run:
        return 0

    print("")
    print(f"Backend URL: http://localhost:{args.backend_port}")
    if not args.skip_web:
        print(f"Web URL: http://localhost:{args.web_port}")
    if not args.skip_mobile:
        print("Mobile: Expo dev server is interactive. Scan the QR code or press i/a for simulator/device launch.")
    print("")

    processes: list[subprocess.Popen[str]] = []
    try:
        for spec in specs:
            env = os.environ.copy()
            env.update(spec.extra_env)
            if spec.interactive:
                process = subprocess.Popen(spec.command, cwd=spec.cwd, env=env)
                processes.append(process)
                continue

            process = subprocess.Popen(
                spec.command,
                cwd=spec.cwd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            processes.append(process)
            assert process.stdout is not None
            thread = threading.Thread(
                target=stream_output,
                args=(spec.name, process.stdout),
                daemon=True,
            )
            thread.start()

        while True:
            for process, spec in zip(processes, specs):
                return_code = process.poll()
                if return_code is not None:
                    print(f"[system] {spec.name} exited with code {return_code}. Shutting down remaining services.")
                    terminate_processes(processes)
                    return return_code
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n[system] Stopping services...")
        terminate_processes(processes)
        return 0


def run_mobile_service(args: argparse.Namespace, *, backend_port: int = 8001) -> int:
    spec = build_mobile_service_spec(args, backend_port=backend_port)
    validate_layout([spec])

    print("")
    print("Mobile Expo:")
    print(f"  cwd: {spec.cwd}")
    print(f"  API: {spec.extra_env['EXPO_PUBLIC_BACKEND_URL']}")
    print(f"  cmd: {' '.join(spec.command)}")
    print("")
    print("[mobile] Expo QR code and logs will appear below.")
    print("[mobile] Stop Expo with Ctrl+C. Docker services will keep running; use `./setup.sh down` to stop them.")
    print("")

    env = os.environ.copy()
    env.update(spec.extra_env)
    process = subprocess.Popen(spec.command, cwd=spec.cwd, env=env)
    try:
        return process.wait()
    except KeyboardInterrupt:
        print("\n[mobile] Stopping Expo...")
        terminate_processes([process])
        return 0


def run_docker_command(args: argparse.Namespace) -> int:
    if not COMPOSE_FILE.exists():
        print(f"Compose file was not found: {COMPOSE_FILE}", file=sys.stderr)
        return 1

    try:
        if args.command == "up":
            requested_services = list(args.services)
            start_mobile = not args.detach and not args.skip_mobile and (
                not requested_services or "mobile" in requested_services
            )
            compose_services = [service for service in requested_services if service != "mobile"]
            command = ["up"]
            if not args.no_build:
                command.append("--build")
            if args.detach or start_mobile:
                command.append("--detach")
            if args.force_recreate:
                command.append("--force-recreate")
            command.extend(compose_services)
            print_docker_urls()
            if start_mobile:
                mobile_api_url = args.mobile_api_url or default_mobile_api_url(8001)
                print(f"Mobile API for Expo: {mobile_api_url}")
                print("")
            result = run_command(compose_args(*command))
            if result != 0 or not start_mobile:
                return result
            return run_mobile_service(args, backend_port=8001)

        if args.command == "build":
            return run_command(compose_args("build", *args.services))

        if args.command == "down":
            command = ["down"]
            if args.volumes:
                command.append("--volumes")
            return run_command(compose_args(*command))

        if args.command == "logs":
            return run_command(compose_args("logs", "--follow", "--tail", args.tail, *args.services))

        if args.command == "ps":
            return run_command(compose_args("ps"))

        if args.command == "seed-demo":
            return seed_demo_via_backend()

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


def main(argv: list[str] | None = None) -> int:
    args = parse_args(list(argv if argv is not None else sys.argv[1:]))
    if args.command == "dev":
        return run_dev_services(args)
    return run_docker_command(args)


if __name__ == "__main__":
    raise SystemExit(main())
