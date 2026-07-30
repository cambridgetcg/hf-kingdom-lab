from __future__ import annotations

import hashlib
import json
import os
import platform
import tempfile
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from urllib.request import Request, urlopen

import duckdb


DATASET_ID = "MCPShield/mcp-security-scan-2026"
SOURCE_URL = (
    "https://huggingface.co/datasets/MCPShield/mcp-security-scan-2026/"
    "resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet"
)
MAX_BYTES = 5_000_000
QUERY = """
SELECT
  grade,
  count(*)::BIGINT AS repository_count,
  round(avg(score), 2) AS average_score,
  sum(findingCount)::BIGINT AS reported_finding_count,
  round(avg(toolCount), 2) AS average_tool_count
FROM read_parquet(?)
GROUP BY grade
ORDER BY grade
""".strip()


def _download_bounded() -> tuple[Path, int, str]:
    request = Request(
        SOURCE_URL,
        headers={
            "Accept": "application/octet-stream",
            "User-Agent": "hf-kingdom-lab/0.1 aggregate-only",
        },
    )
    path: Path | None = None
    try:
        with urlopen(request, timeout=30) as response:
            announced = response.headers.get("Content-Length")
            if announced is not None and int(announced) > MAX_BYTES:
                raise RuntimeError("source exceeded the fixed byte limit")

            digest = hashlib.sha256()
            size = 0
            with tempfile.NamedTemporaryFile(
                prefix="hf-kingdom-mcpshield-",
                suffix=".parquet",
                delete=False,
            ) as handle:
                path = Path(handle.name)
                while True:
                    chunk = response.read(min(64 * 1024, MAX_BYTES - size + 1))
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise RuntimeError("source exceeded the fixed byte limit")
                    digest.update(chunk)
                    handle.write(chunk)

        if path is None:
            raise RuntimeError("temporary file was not created")
        with path.open("rb") as handle:
            if handle.read(4) != b"PAR1":
                raise RuntimeError("downloaded bytes were not Parquet")
            handle.seek(-4, os.SEEK_END)
            if handle.read(4) != b"PAR1":
                raise RuntimeError("downloaded bytes had an invalid Parquet footer")
        return path, size, digest.hexdigest()
    except Exception:
        if path is not None:
            path.unlink(missing_ok=True)
        raise


def _json_value(value: object) -> object:
    if isinstance(value, Decimal):
        return float(value)
    return value


def main() -> None:
    path: Path | None = None
    try:
        path, size, source_sha256 = _download_bounded()
        connection = duckdb.connect()
        try:
            cursor = connection.execute(QUERY, [str(path)])
            columns = [description[0] for description in cursor.description]
            rows = [
                {
                    key: _json_value(value)
                    for key, value in zip(columns, row, strict=True)
                }
                for row in cursor.fetchall()
            ]
        finally:
            connection.close()

        document = {
            "protocol": "hf-kingdom-dataset-aggregate/v1",
            "observed_at": datetime.now(timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z"),
            "source": {
                "dataset_id": DATASET_ID,
                "url": SOURCE_URL,
                "bytes": size,
                "sha256": source_sha256,
            },
            "query": QUERY,
            "rows": rows,
            "classification": "unverified_signal",
            "tools": {
                "duckdb": duckdb.__version__,
                "python": platform.python_version(),
            },
            "effects": {
                "remote_reads": [SOURCE_URL],
                "remote_writes": [],
                "local_temporary_file": True,
                "temporary_file_removed": True,
            },
            "limits": [
                "Fixed public dataset and fixed aggregate-only SQL",
                "No target, slug, or raw finding rows are returned",
                "Scanner grades and scores are unverified signals, not vulnerability findings",
                "The source export is capped at 5000000 bytes",
                "No Hugging Face token, inference request, Job, or repository write is used",
                "The query uses a pre-synced project virtual environment and does not invoke uv or package indexes",
            ],
        }
        print(json.dumps(document, sort_keys=True, separators=(",", ":")))
    except Exception as error:
        raise SystemExit(f"bounded MCPShield query failed: {type(error).__name__}") from None
    finally:
        if path is not None:
            path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
