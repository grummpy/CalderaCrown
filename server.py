#!/usr/bin/env python3
"""Serve Caldera Crown on loopback. No dependencies beyond Python 3."""

import argparse
import socket
import sys
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
DEFAULT_PORT = 8816


def first_free_port(start: int, tries: int = 20) -> int:
    for port in range(start, start + tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((HOST, port))
            except OSError:
                continue
            return port
    sys.exit(f"No free port from {start} through {start + tries - 1}.")


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


def main():
    parser = argparse.ArgumentParser(description="Serve Caldera Crown on 127.0.0.1.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="preferred port (default 8816)")
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser window")
    args = parser.parse_args()

    port = first_free_port(args.port)
    server = ThreadingHTTPServer((HOST, port), partial(Handler, directory=str(ROOT)))
    url = f"http://{HOST}:{port}/"
    print(f"LISTENING {url}", flush=True)
    print("Caldera Crown is ready. Press Ctrl+C to stop.", flush=True)
    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception:
            print(f"Open this URL in a browser: {url}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
