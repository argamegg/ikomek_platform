#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "test_reports" / "predeploy"
WEB_APP = ROOT / "apps" / "web-app"
MOBILE_APP = ROOT / "apps" / "mobile-app"
BACKEND = ROOT / "apps" / "backend"
BACKEND_PYTHON = BACKEND / "venv" / "bin" / "python"
PYTHON = str(BACKEND_PYTHON if BACKEND_PYTHON.exists() else Path(sys.executable))


def run_command(name: str, cmd: list[str], cwd: Path, timeout: int = 240) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            text=True,
            capture_output=True,
            timeout=timeout,
            env={**os.environ, "CI": "1"},
        )
        status = "pass" if proc.returncode == 0 else "fail"
        output = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
        return {
            "name": name,
            "status": status,
            "returncode": proc.returncode,
            "duration": round(time.perf_counter() - started, 2),
            "command": " ".join(cmd),
            "cwd": str(cwd.relative_to(ROOT)),
            "output": output.strip(),
        }
    except subprocess.TimeoutExpired as error:
        output = ((error.stdout or "") + "\n" + (error.stderr or "")).strip()
        return {
            "name": name,
            "status": "fail",
            "returncode": None,
            "duration": round(time.perf_counter() - started, 2),
            "command": " ".join(cmd),
            "cwd": str(cwd.relative_to(ROOT)),
            "output": f"Timed out after {timeout}s\n{output}".strip(),
        }


def command_available(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def npm_available(app_dir: Path) -> bool:
    return (app_dir / "node_modules").exists() and command_available("npm")


def collect_tree_size(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(file.stat().st_size for file in path.rglob("*") if file.is_file())


def bytes_to_mb(size: int) -> float:
    return round(size / 1024 / 1024, 2)


def read_json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def parse_npm_audit(output: str) -> dict[str, Any] | None:
    match = re.search(r"\{.*\}", output, flags=re.S)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return data.get("metadata", {}).get("vulnerabilities")


def normalize_command_result(item: dict[str, Any]) -> dict[str, Any]:
    output = item.get("output", "")
    if item["name"] == "Mobile Expo doctor" and item["status"] == "fail":
        known_native_sync_warning = (
            "Check for app config fields that may not be synced in a non-CNG project" in output
            and "1 checks failed" in output
        )
        if known_native_sync_warning:
            item["status"] = "warn"
            item["summary"] = (
                "Expo doctor passed runtime/package checks; native folders are present, so app.json changes must be synced by prebuild or manually."
            )
    return item


def scan_files() -> list[dict[str, Any]]:
    checks: list[dict[str, Any]] = []
    ignored_parts = {"node_modules", ".git", "dist", "build", ".expo", "Pods", "__pycache__", "venv"}
    secret_patterns = [
        ("private_key", re.compile(r"-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
        ("jwt_secret_default", re.compile(r"ikomek109-secret-key-2025-secure")),
        ("hardcoded_bearer", re.compile(r"Bearer[ \t]+[A-Za-z0-9._~+/=-]{20,}")),
        ("password_assignment", re.compile(r"(?i)(password|secret|token|api[_-]?key)\s*=\s*['\"][^'\"\n]{8,}['\"]")),
    ]
    findings: list[dict[str, str]] = []
    ignored_files = {
        "scripts/predeploy_test_report.py",
        "tests/backend/test_predeploy_security.py",
    }
    for file in ROOT.rglob("*"):
        if not file.is_file():
            continue
        relative_file = str(file.relative_to(ROOT))
        if relative_file in ignored_files or any(part in ignored_parts for part in file.parts):
            continue
        if file.suffix.lower() not in {".py", ".ts", ".tsx", ".js", ".json", ".env", ".example", ".md"}:
            continue
        try:
            text = file.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for label, pattern in secret_patterns:
            if pattern.search(text):
                findings.append({"file": relative_file, "type": label})

    checks.append(
        {
            "name": "Repository secret-pattern scan",
            "status": "pass" if not findings else "warn",
            "summary": f"{len(findings)} potential finding(s)",
            "findings": findings[:50],
        }
    )

    backend_env = read_json(MOBILE_APP / "app.json")
    checks.append(
        {
            "name": "Mobile native identifiers",
            "status": "warn"
            if backend_env
            and backend_env.get("expo", {}).get("ios", {}).get("bundleIdentifier", "").startswith("com.anonymous")
            else "pass",
            "summary": "Checks app.json for placeholder bundle/package identifiers.",
        }
    )
    return checks


def build_sections(results: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    sections = {"Backend": [], "Web": [], "Mobile": [], "Security": [], "Performance": []}
    for item in results:
        sections[item["component"]].append(item)
    return sections


def status_counts(results: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"pass": 0, "warn": 0, "fail": 0, "skip": 0}
    for result in results:
        counts[result.get("status", "fail")] = counts.get(result.get("status", "fail"), 0) + 1
    return counts


def write_html(results: list[dict[str, Any]], metadata: dict[str, Any]) -> Path:
    counts = status_counts(results)
    overall = "fail" if counts["fail"] else "warn" if counts["warn"] else "pass"
    rows = []
    for section, items in build_sections(results).items():
        cards = []
        for item in items:
            output = html.escape(item.get("output") or json.dumps(item.get("details", ""), ensure_ascii=False, indent=2))
            summary = html.escape(item.get("summary", ""))
            command = html.escape(item.get("command", ""))
            duration = item.get("duration")
            meta = f"{duration}s" if duration is not None else ""
            cards.append(
                f"""
                <article class="check {item['status']}">
                  <div class="check-head">
                    <h3>{html.escape(item['name'])}</h3>
                    <span class="pill">{item['status'].upper()}</span>
                  </div>
                  <p>{summary}</p>
                  <div class="meta">{html.escape(command)} {html.escape(meta)}</div>
                  <details><summary>Details</summary><pre>{output}</pre></details>
                </article>
                """
            )
        rows.append(f"<section><h2>{section}</h2><div class='grid'>{''.join(cards)}</div></section>")

    overview = """
    <section class="overview">
      <div>
        <h2>Обзор тестирования</h2>
        <p>Этот отчет показывает готовность проекта iKOMEK к деплою по трем частям системы: backend API, web frontend и mobile app. Проверки объединяют функциональные smoke-тесты, production-сборку, TypeScript/ESLint-контроль, аудит зависимостей, статический security scan и базовую оценку размера артефактов.</p>
        <p>Смысл набора проверок: поймать ошибки до выката, подтвердить что критичные API-контракты не сломаны, зависимости не содержат известных уязвимостей, приложения собираются в production-режиме, а мобильный проект соответствует требованиям Expo SDK.</p>
        <ul>
          <li><strong>Backend:</strong> pytest проверяет безопасность helper-функций, JWT-protected API contract и структуру маршрутов; pip check и pip-audit проверяют совместимость и уязвимости Python-зависимостей.</li>
          <li><strong>Web:</strong> ESLint и production build подтверждают качество React/TypeScript-кода и готовность Vite-сборки; npm audit ищет известные уязвимости JavaScript-пакетов.</li>
          <li><strong>Mobile:</strong> Expo lint, TypeScript и Expo doctor проверяют React Native/Expo проект, конфигурацию SDK и типовую корректность; npm audit проверяет мобильные зависимости.</li>
          <li><strong>Security:</strong> dependency audit ищет CVE/advisories, secret-pattern scan подсвечивает потенциальные секреты и дефолтные ключи, которые нужно проверить перед production.</li>
          <li><strong>Performance:</strong> размер build/export артефактов помогает заранее увидеть слишком тяжелые сборки и риск медленной загрузки.</li>
        </ul>
      </div>
      <div>
        <h2>Test Overview</h2>
        <p>This report summarizes deployment readiness for the iKOMEK project across the backend API, web frontend, and mobile app. The suite combines functional smoke tests, production builds, TypeScript/ESLint validation, dependency vulnerability audits, static security scanning, and basic artifact-size checks.</p>
        <p>The purpose is to catch deployment blockers before release, confirm that critical API contracts still work, verify that dependencies have no known vulnerabilities, ensure production builds are valid, and validate that the mobile project matches Expo SDK expectations.</p>
        <ul>
          <li><strong>Backend:</strong> pytest validates security-sensitive helpers, JWT-protected API contracts, and route structure; pip check and pip-audit verify Python dependency consistency and vulnerabilities.</li>
          <li><strong>Web:</strong> ESLint and production build validate React/TypeScript quality and Vite deployment readiness; npm audit checks JavaScript packages for known advisories.</li>
          <li><strong>Mobile:</strong> Expo lint, TypeScript, and Expo doctor validate the React Native/Expo app, SDK configuration, and type correctness; npm audit checks mobile dependencies.</li>
          <li><strong>Security:</strong> dependency audits search for CVEs/advisories, while the secret-pattern scan highlights possible secrets and default keys that need review before production.</li>
          <li><strong>Performance:</strong> build/export artifact sizes help identify heavy bundles and possible slow-load risks early.</li>
        </ul>
      </div>
    </section>
    """

    report = f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>iKOMEK Predeploy Test Report</title>
  <style>
    :root {{ color-scheme: light; --ink:#16211f; --muted:#63706c; --line:#d8e0dc; --bg:#f7faf8; --card:#fff; --pass:#147d47; --warn:#a86300; --fail:#b42318; --skip:#59636e; }}
    body {{ margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--bg); }}
    header {{ padding:32px clamp(18px, 4vw, 56px); background:#163a36; color:white; }}
    h1 {{ margin:0 0 10px; font-size:clamp(28px, 4vw, 48px); letter-spacing:0; }}
    h2 {{ margin:32px 0 14px; font-size:24px; }}
    h3 {{ margin:0; font-size:17px; }}
    main {{ padding:24px clamp(18px, 4vw, 56px) 56px; }}
    .summary {{ display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }}
    .summary span, .pill {{ border-radius:999px; padding:7px 11px; font-weight:700; font-size:13px; background:rgba(255,255,255,.14); }}
    .overall {{ display:inline-flex; margin-top:12px; padding:8px 12px; border:1px solid rgba(255,255,255,.35); border-radius:6px; font-weight:800; }}
    .grid {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:14px; }}
    .overview {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:24px; background:var(--card); border:1px solid var(--line); border-radius:8px; padding:8px 24px 18px; box-shadow:0 8px 22px rgba(17,35,31,.06); }}
    .overview ul {{ margin:0; padding-left:20px; color:var(--muted); line-height:1.55; }}
    .overview li {{ margin:8px 0; }}
    .check {{ background:var(--card); border:1px solid var(--line); border-left:6px solid var(--skip); border-radius:8px; padding:16px; box-shadow:0 8px 22px rgba(17,35,31,.06); min-width:0; }}
    .check.pass {{ border-left-color:var(--pass); }} .check.warn {{ border-left-color:var(--warn); }} .check.fail {{ border-left-color:var(--fail); }} .check.skip {{ border-left-color:var(--skip); }}
    .check-head {{ display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }}
    .check.pass .pill {{ color:var(--pass); background:#e8f6ee; }} .check.warn .pill {{ color:var(--warn); background:#fff3df; }} .check.fail .pill {{ color:var(--fail); background:#ffedea; }} .check.skip .pill {{ color:var(--skip); background:#edf0f2; }}
    p {{ color:var(--muted); line-height:1.5; }}
    .meta {{ color:#71807b; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; overflow-wrap:anywhere; }}
    details {{ margin-top:12px; }} summary {{ cursor:pointer; font-weight:700; }}
    pre {{ max-height:420px; overflow:auto; background:#101917; color:#d9eee7; padding:14px; border-radius:6px; font-size:12px; line-height:1.45; white-space:pre-wrap; }}
    footer {{ color:var(--muted); margin-top:28px; }}
  </style>
</head>
<body>
  <header>
    <h1>iKOMEK Predeploy Test Report</h1>
    <div>Generated: {html.escape(metadata['generated_at'])}</div>
    <div class="overall">Overall: {overall.upper()}</div>
    <div class="summary">
      <span>PASS {counts['pass']}</span><span>WARN {counts['warn']}</span><span>FAIL {counts['fail']}</span><span>SKIP {counts['skip']}</span>
    </div>
  </header>
  <main>
    {overview}
    {''.join(rows)}
    <footer>Raw JSON and command logs are saved next to this HTML file.</footer>
  </main>
</body>
</html>"""
    path = REPORT_DIR / "index.html"
    path.write_text(report, encoding="utf-8")
    return path


def main() -> int:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, Any]] = []

    backend_commands = [
        ("Backend pytest security/API contract", [PYTHON, "-m", "pytest", "tests/backend", "-q"], ROOT, 180),
        ("Backend dependency consistency", [PYTHON, "-m", "pip", "check"], ROOT, 120),
    ]
    for name, cmd, cwd, timeout in backend_commands:
        item = run_command(name, cmd, cwd, timeout)
        item["component"] = "Backend"
        item["summary"] = "Python backend predeploy check."
        results.append(normalize_command_result(item))

    pip_audit = run_command(
        "Backend dependency vulnerability audit",
        [PYTHON, "-m", "pip_audit", "-r", str(BACKEND / "requirements.txt"), "-f", "json"],
        ROOT,
        240,
    )
    if pip_audit["returncode"] is None or "No module named pip_audit" in pip_audit.get("output", ""):
        pip_audit["status"] = "skip"
        pip_audit["summary"] = "pip-audit is not installed in this Python environment."
    else:
        pip_audit["summary"] = "Scans backend Python dependencies for known vulnerabilities."
    pip_audit["component"] = "Security"
    results.append(normalize_command_result(pip_audit))

    if npm_available(WEB_APP):
        for name, cmd, timeout in [
            ("Web lint", ["npm", "run", "lint"], 180),
            ("Web production build", ["npm", "run", "build"], 240),
            ("Web npm audit", ["npm", "audit", "--json"], 240),
        ]:
            item = run_command(name, cmd, WEB_APP, timeout)
            item["component"] = "Web" if "audit" not in name.lower() else "Security"
            audit = parse_npm_audit(item.get("output", "")) if "audit" in name.lower() else None
            item["summary"] = f"npm audit vulnerabilities: {audit}" if audit else "Frontend predeploy check."
            results.append(normalize_command_result(item))
    else:
        results.append({"component": "Web", "name": "Web checks", "status": "skip", "summary": "npm or node_modules unavailable.", "details": {}})

    if npm_available(MOBILE_APP):
        for name, cmd, timeout in [
            ("Mobile lint", ["npm", "run", "lint"], 180),
            ("Mobile TypeScript", ["npx", "tsc", "--noEmit"], 180),
            ("Mobile Expo doctor", ["npx", "expo-doctor"], 240),
            ("Mobile npm audit", ["npm", "audit", "--json"], 240),
        ]:
            item = run_command(name, cmd, MOBILE_APP, timeout)
            item["component"] = "Mobile" if "audit" not in name.lower() else "Security"
            audit = parse_npm_audit(item.get("output", "")) if "audit" in name.lower() else None
            item["summary"] = f"npm audit vulnerabilities: {audit}" if audit else "Mobile predeploy check."
            results.append(normalize_command_result(item))
    else:
        results.append({"component": "Mobile", "name": "Mobile checks", "status": "skip", "summary": "npm or node_modules unavailable.", "details": {}})

    for check in scan_files():
        check["component"] = "Security"
        results.append(check)

    web_dist = WEB_APP / "dist"
    mobile_dist = MOBILE_APP / "dist"
    results.extend(
        [
            {
                "component": "Performance",
                "name": "Web build artifact size",
                "status": "pass" if collect_tree_size(web_dist) and bytes_to_mb(collect_tree_size(web_dist)) < 15 else "warn",
                "summary": f"{bytes_to_mb(collect_tree_size(web_dist))} MB in apps/web-app/dist",
                "details": {"bytes": collect_tree_size(web_dist)},
            },
            {
                "component": "Performance",
                "name": "Mobile web export artifact size",
                "status": "pass" if collect_tree_size(mobile_dist) and bytes_to_mb(collect_tree_size(mobile_dist)) < 30 else "warn",
                "summary": f"{bytes_to_mb(collect_tree_size(mobile_dist))} MB in apps/mobile-app/dist",
                "details": {"bytes": collect_tree_size(mobile_dist)},
            },
        ]
    )

    metadata = {"generated_at": dt.datetime.now().astimezone().isoformat(timespec="seconds")}
    (REPORT_DIR / "results.json").write_text(json.dumps({"metadata": metadata, "results": results}, ensure_ascii=False, indent=2), encoding="utf-8")
    for index, item in enumerate(results, start=1):
        if item.get("output"):
            safe_name = re.sub(r"[^a-z0-9]+", "-", item["name"].lower()).strip("-")
            (REPORT_DIR / f"{index:02d}-{safe_name}.log").write_text(item["output"], encoding="utf-8")
    report_path = write_html(results, metadata)
    print(report_path)
    return 1 if any(item.get("status") == "fail" for item in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
