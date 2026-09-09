from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import re
from urllib.parse import unquote

ROOT = Path(__file__).parent
DATA = ROOT / "data"
CURRENT = DATA / "current.xlsx"
MAX_UPLOAD_SIZE = 10 * 1024 * 1024


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/current.xlsx":
            if not CURRENT.exists():
                self.send_error(404, "Excel data has not been uploaded")
                return
            content = CURRENT.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            self.send_header("Content-Disposition", 'attachment; filename="current-shifts.xlsx"')
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/upload":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400, "Invalid Content-Length")
            return
        if length < 1:
            self.send_error(400, "Empty request")
            return
        if length > MAX_UPLOAD_SIZE:
            self.send_error(413, "Excel file is too large")
            return
        body = self.rfile.read(length)
        content_type = self.headers.get("Content-Type", "")
        boundary_match = re.search(r'boundary=(?:"([^"]+)"|([^;]+))', content_type, re.IGNORECASE)
        if not boundary_match:
            self.send_error(400, "Multipart upload required")
            return
        boundary_value = boundary_match.group(1) or boundary_match.group(2).strip()
        boundary = ("--" + boundary_value).encode()
        parts = body.split(boundary)
        file_content = None
        for part in parts:
            if b'filename="' not in part:
                continue
            separator = b"\r\n\r\n"
            if separator not in part:
                continue
            file_content = part.split(separator, 1)[1]
            if file_content.endswith(b"\r\n"):
                file_content = file_content[:-2]
            break
        if not file_content:
            self.send_error(400, "No file provided")
            return
        DATA.mkdir(exist_ok=True)
        CURRENT.write_bytes(file_content)
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(b'{"ok":true}')


if __name__ == "__main__":
    port = int(os.environ.get("SHIFT_MANAGER_PORT", "80"))
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
