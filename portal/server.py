from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os

PAGE = Path(__file__).with_name("index.html").read_bytes()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.respond(include_body=True)

    def do_HEAD(self):
        self.respond(include_body=False)

    def respond(self, include_body):
        if self.path.partition("?")[0] != "/":
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(PAGE)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
        self.end_headers()
        if include_body:
            self.wfile.write(PAGE)


host = os.environ.get("HOME_HOST", "127.0.0.1")
port = int(os.environ.get("HOME_PORT", "18080"))
ThreadingHTTPServer((host, port), Handler).serve_forever()
