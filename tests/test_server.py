#!/usr/bin/env python3
"""Smoke test: server.py serves the game on loopback."""

import subprocess
import sys
import unittest
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 18916


class ServerSmokeTest(unittest.TestCase):
    def test_serves_index_html(self):
        proc = subprocess.Popen(
            [sys.executable, str(ROOT / "server.py"), "--port", str(PORT), "--no-browser"],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        try:
            line = proc.stdout.readline()
            self.assertIn("LISTENING", line)
            url = line.strip().split("LISTENING", 1)[1].strip()
            self.assertTrue(url.startswith("http://127.0.0.1:"))

            with urllib.request.urlopen(url, timeout=5) as response:
                body = response.read().decode("utf-8")
                self.assertEqual(response.status, 200)
                self.assertIn("Caldera Crown", body)
                self.assertIn("<canvas", body)
                self.assertIn('src="src/ui/main.js"', body)

            module_url = url + "src/ui/main.js"
            with urllib.request.urlopen(module_url, timeout=5) as response:
                self.assertEqual(response.status, 200)
                script = response.read().decode("utf-8")
                self.assertIn("createGame", script)

            with urllib.request.urlopen(url + "arcade.json", timeout=5) as response:
                self.assertEqual(response.status, 200)
                self.assertIn("calderacrown", response.read().decode("utf-8"))
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=3)
            if proc.stdout:
                proc.stdout.close()


if __name__ == "__main__":
    unittest.main()
