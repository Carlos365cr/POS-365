"""Prepare a lossless, idempotent import of a CEDI backup into D1."""
import base64
import gzip
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

source, destination = map(Path, sys.argv[1:])
backup = json.loads(source.read_bytes())
snapshot = backup['snapshot']
assert backup['format'] == 'cedi-trial-backup' and snapshot['version'] == 1
raw = json.dumps(snapshot, separators=(',', ':'), ensure_ascii=False).encode()
digest = hashlib.sha256(raw).hexdigest()
encoded = base64.b64encode(gzip.compress(raw, mtime=0)).decode()
parts = [encoded[i:i + 64000] for i in range(0, len(encoded), 64000)]
sql = [
    'CREATE TABLE IF NOT EXISTS cedi_parts (revision TEXT NOT NULL, part INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(revision,part));',
    'CREATE TABLE IF NOT EXISTS cedi_head (id INTEGER PRIMARY KEY CHECK(id=1), revision TEXT NOT NULL, parts INTEGER NOT NULL, author TEXT NOT NULL);',
]
for i, part in enumerate(parts):
    sql.append(f"INSERT OR IGNORE INTO cedi_parts VALUES ('{digest}',{i},'{part}');")
sql.append(f"INSERT OR IGNORE INTO cedi_head VALUES (1,'{digest}',{len(parts)},'migration');")
script = '\n'.join(sql)
db = sqlite3.connect(':memory:')
db.executescript(script)
db.executescript(script)
stored = ''.join(row[0] for row in db.execute('SELECT payload FROM cedi_parts ORDER BY part'))
assert gzip.decompress(base64.b64decode(stored)) == raw
destination.write_text(script)
print(len(parts), 'parts;', len(snapshot['products'])+len(snapshot['xmlPendingArticles']), 'articles;',len(snapshot['purchases']),'purchases;',len(snapshot['sales']),'sales')
