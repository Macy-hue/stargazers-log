#!/usr/bin/env python3
"""Local static server for MOMENTO.

Usage:
    python serve.py
    python serve.py --port 4173 --open
"""

from __future__ import annotations

import argparse
import ipaddress
import mimetypes
import socket
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("text/javascript", ".js")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Keep the terminal readable.
        if " 200 " not in (fmt % args):
            super().log_message(fmt, *args)


def lan_ips() -> list[str]:
    """Return usable private LAN addresses, ignoring VPN benchmark ranges."""
    candidates: set[str] = set()
    try:
        _, _, addresses = socket.gethostbyname_ex(socket.gethostname())
        candidates.update(addresses)
    except OSError:
        pass
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            candidates.add(sock.getsockname()[0])
    except OSError:
        pass

    usable = []
    benchmark = ipaddress.ip_network("198.18.0.0/15")
    for value in candidates:
        try:
            address = ipaddress.ip_address(value)
        except ValueError:
            continue
        if address.is_loopback or address.is_link_local or not address.is_private:
            continue
        if address in benchmark:
            continue
        usable.append(value)
    usable.sort(key=lambda ip: (not ip.startswith("192.168."), not ip.startswith("10."), ip))
    return usable or ["127.0.0.1"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the MOMENTO static app.")
    parser.add_argument("--port", type=int, default=4173)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--open", action="store_true", help="open the local URL in a browser")
    args = parser.parse_args()

    port = args.port
    server = None
    for offset in range(0, 20):
        try:
            server = ThreadingHTTPServer((args.host, port), Handler)
            break
        except OSError as error:
            if error.errno not in (48, 98, 10048) or offset == 19:
                raise
            port += 1
    assert server is not None

    if port != args.port:
        print(f"  {args.port} 端口已被占用，改用 {port}。")
    local = f"http://127.0.0.1:{port}/"
    addresses = lan_ips()
    print("")
    print("  拾光拼贴 MOMENTO")
    print("  本机预览 : " + local)
    print("  iPhone   : http://" + addresses[0] + f":{port}/" + "（同一 Wi-Fi）")
    for extra in addresses[1:]:
        print("  也可以试 : http://" + extra + f":{port}/")
    print("  Ctrl+C 停止")
    print("")
    if args.open:
        threading.Timer(0.5, lambda: webbrowser.open(local)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  已停止。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
