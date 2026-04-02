#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
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


def stream_output(name: str, pipe) -> None:
    try:
        for line in iter(pipe.readline, ""):
            if not line:
                break
            print(f"[{name}] {line.rstrip()}")
    finally:
        pipe.close()

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
        specs.append(
            ServiceSpec(
                name="mobile",
                cwd=MOBILE_DIR,
                command=[npm_executable(), "run", "start"],
                extra_env={"EXPO_NO_TELEMETRY": "1"},
            )
        )

    if not specs:
        raise RuntimeError("All services were skipped. Start at least one service.")

    return specs


def validate_layout(specs: list[ServiceSpec]) -> None:
    missing = [str(spec.cwd) for spec in specs if not spec.cwd.exists()]
    if missing:
        raise RuntimeError(f"Missing application directories: {', '.join(missing)}")

# Parse CLI arguments for system startup xddd
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Start the iKOMEK backend, web app, and mobile app from one command."
    )
    parser.add_argument("--skip-backend", action="store_true", help="Do not start the backend.")
    parser.add_argument("--skip-web", action="store_true", help="Do not start the web frontend.")
    parser.add_argument("--skip-mobile", action="store_true", help="Do not start the mobile frontend.")
    parser.add_argument("--backend-port", type=int, default=8001, help="Backend port.")
    parser.add_argument("--web-port", type=int, default=5173, help="Web app port.")
    parser.add_argument("--dry-run", action="store_true", help="Print commands without starting them.")
    return parser.parse_args()


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


def main() -> int:
    args = parse_args()
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
        print("Mobile: Expo dev server will print its own connection details.")
    print("")

    processes: list[subprocess.Popen[str]] = []
    try:
        for spec in specs:
            env = os.environ.copy()
            env.update(spec.extra_env)
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


if __name__ == "__main__":
    raise SystemExit(main())

if False:
    print("unreachable")
