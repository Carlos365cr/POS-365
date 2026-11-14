import base64
import datetime as dt
import hashlib
import http.server
import json
import pathlib
import secrets
import sys
import time
import urllib.parse as url
import urllib.request as net
import webbrowser
from zoneinfo import ZoneInfo

ACCOUNT = "operador@example.com"
SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
API = "https://gmail.googleapis.com/gmail/v1/users/me"
CR = ZoneInfo("America/Costa_Rica")


def encode(value):
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def authorize(client):
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    result = {}

    class Callback(http.server.BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            query = url.parse_qs(url.urlsplit(self.path).query)
            if query.get("state") != [state]:
                self.send_error(400)
                return
            result.update(query)
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Pode volver a la prueba de CEDI.")

    with http.server.HTTPServer(("127.0.0.1", 0), Callback) as server:
        redirect = f"http://127.0.0.1:{server.server_port}/"
        params = dict(client_id=client["client_id"], redirect_uri=redirect,
                      response_type="code", scope=SCOPE, login_hint=ACCOUNT,
                      state=state, code_challenge=encode(hashlib.sha256(verifier.encode()).digest()),
                      code_challenge_method="S256")
        webbrowser.open("https://accounts.google.com/o/oauth2/v2/auth?" + url.urlencode(params))
        server.timeout = 1
        deadline = time.monotonic() + 180
        while not result and time.monotonic() < deadline:
            server.handle_request()
    if "code" not in result:
        raise ValueError("La autorización fue cancelada o venció.")
    fields = dict(client_id=client["client_id"], code=result["code"][0],
                  redirect_uri=redirect, code_verifier=verifier, grant_type="authorization_code")
    if client.get("client_secret"):
        fields["client_secret"] = client["client_secret"]
    with net.urlopen("https://oauth2.googleapis.com/token", url.urlencode(fields).encode(), timeout=30) as response:
        return json.load(response)["access_token"]


def parts(node):
    yield node
    for child in node.get("parts", []):
        yield from parts(child)


def export(client_path, first, last, folder):
    start = dt.datetime.combine(dt.date.fromisoformat(first), dt.time(), CR)
    end = dt.datetime.combine(dt.date.fromisoformat(last) + dt.timedelta(days=1), dt.time(), CR)
    if start >= end:
        raise ValueError("Revisá el rango de fechas.")
    token = authorize(json.loads(pathlib.Path(client_path).read_text())["installed"])

    def read(path, **params):
        req = net.Request(API + path + "?" + url.urlencode(params),
                          headers={"Authorization": "Bearer " + token})
        with net.urlopen(req, timeout=45) as response:
            return json.load(response)

    if read("/profile")["emailAddress"].lower() != ACCOUNT:
        raise ValueError("La cuenta autorizada no coincide con el correo configurado.")
    print("Conexión confirmada con", ACCOUNT)
    folder.mkdir(exist_ok=True, parents=True)
    query = f"after:{int(start.timestamp())-1} before:{int(end.timestamp())}"
    args = dict(q=query, maxResults=100, includeSpamTrash="true")
    with (folder / "origenes.jsonl").open("x", encoding="utf8") as manifest:
        count = 0
        while True:
            page = read("/messages", **args)
            for ref in page.get("messages", []):
                message = read("/messages/" + ref["id"], format="full")
                if not start.timestamp()*1000 <= int(message["internalDate"]) < end.timestamp()*1000:
                    continue
                for i, part in enumerate(parts(message["payload"])):
                    name = part.get("filename", "")
                    if not (name.lower().endswith(".xml") or part.get("mimeType") in ("text/xml", "application/xml")):
                        continue
                    body = part["body"]
                    if body.get("attachmentId"):
                        body = read("/messages/" + ref["id"] + "/attachments/" + body["attachmentId"])
                    raw = body["data"]
                    data = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
                    file = ref["id"] + "-" + str(i) + ".xml"
                    (folder / file).write_bytes(data)
                    info = dict(archivo=file, nombreOriginal=name, correo=ACCOUNT,
                                mensaje=ref["id"], recibido=message["internalDate"],
                                enlaceCorreo="https://mail.google.com/mail/u/?authuser=" + url.quote(ACCOUNT) + "#all/" + message["threadId"])
                    manifest.write(json.dumps(info, ensure_ascii=False) + "\n")
                    manifest.flush()
                    count += 1
            if not page.get("nextPageToken"):
                break
            args["pageToken"] = page["nextPageToken"]
    print(count, "XML guardados en", folder)


if __name__ == "__main__":
    try:
        export(sys.argv[1], sys.argv[2], sys.argv[3], pathlib.Path(sys.argv[4]))
    except Exception as error:
        sys.exit("La prueba no terminó. " + str(error))
