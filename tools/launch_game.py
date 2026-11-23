"""Windows-friendly launcher for the Edenomaly browser game."""

from __future__ import annotations

import argparse
import functools
import http.server
import pathlib
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
HOST = "127.0.0.1"
PORT = 8000
HEALTH_PATH = "/__edenomaly_launcher_health__"
HEALTH_VALUE = "edenomaly-launcher-v1"


class GameHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def do_GET(self):
        if self.path == HEALTH_PATH:
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("X-Edenomaly-Launcher", HEALTH_VALUE)
            self.end_headers()
            self.wfile.write(HEALTH_VALUE.encode("ascii"))
            return
        super().do_GET()


class GameServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def is_our_server(port: int) -> bool:
    try:
        request = urllib.request.Request(
            f"http://{HOST}:{port}{HEALTH_PATH}", method="GET"
        )
        with urllib.request.urlopen(request, timeout=1.0) as response:
            return (
                response.status == 200
                and response.headers.get("X-Edenomaly-Launcher") == HEALTH_VALUE
                and response.read(128).decode("ascii") == HEALTH_VALUE
            )
    except (urllib.error.URLError, TimeoutError, OSError, UnicodeError):
        return False


def port_in_use(port: int) -> bool:
    try:
        with socket.create_connection((HOST, port), timeout=1.0):
            return True
    except OSError:
        return False


def update_from_git() -> bool:
    if not (ROOT / ".git").exists():
        print("[ERROR] No .git directory. Run from a Git clone.")
        return False
    print("[1/3] Checking GitHub updates (git pull --ff-only)...", flush=True)
    try:
        result = subprocess.run(
            ["git", "pull", "--ff-only"], cwd=ROOT, check=False
        )
    except FileNotFoundError:
        print("[ERROR] Git is not installed or is not in PATH.")
        return False
    if result.returncode != 0:
        print("[ERROR] Git update failed. Local files were not overwritten by this launcher.")
        print("Resolve the Git error before starting the game.")
        return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Launch Edenomaly locally.")
    parser.add_argument("--no-pull", action="store_true", help="Skip git pull.")
    parser.add_argument("--port", type=int, default=PORT, help="Local HTTP port.")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")

    url = f"http://{HOST}:{args.port}/"
    if is_our_server(args.port):
        print("Edenomaly is already running. Opening its browser tab.")
        webbrowser.open(url)
        return 0
    if port_in_use(args.port):
        print(f"[ERROR] Port {args.port} is occupied by another application.")
        print("Close it, or run: py -3 tools\\launch_game.py --port 8001")
        return 1

    if not WEB.is_dir() or not (WEB / "index.html").is_file():
        print("[ERROR] web/index.html was not found.")
        return 1
    if not args.no_pull and not update_from_git():
        return 1
    if args.no_pull:
        print("[1/3] Git update skipped (--no-pull).")

    # Re-check after pulling in case another launcher started during the update.
    if is_our_server(args.port):
        print("Another Edenomaly launcher started. Opening existing server.")
        webbrowser.open(url)
        return 0

    print(f"[2/3] Starting server on {url}")
    try:
        server = GameServer((HOST, args.port), GameHandler)
    except OSError as exc:
        print(f"[ERROR] Cannot bind port {args.port}: {exc}")
        return 1

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    try:
        thread.start()
        if not is_our_server(args.port):
            print("[ERROR] Server did not pass its startup check.")
            return 1
        print("[3/3] Opening default browser...")
        if not webbrowser.open(url):
            print(f"[INFO] Open this URL manually: {url}")
        print("Game is running. Press Ctrl+C in this window to stop the server.")
        while thread.is_alive():
            time.sleep(0.25)
        print("[ERROR] Web server stopped unexpectedly.")
        return 1
    except KeyboardInterrupt:
        print("\nStopping Edenomaly server...")
        return 0
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


if __name__ == "__main__":
    sys.exit(main())
