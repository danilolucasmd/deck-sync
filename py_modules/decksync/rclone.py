import asyncio
import configparser
import json
import os
import re
import shutil
from dataclasses import dataclass, field
from datetime import datetime

import decky

REMOTE = "decksync"
DIRECTORY_NOT_FOUND = 3
FILE_NOT_FOUND = 4

_LOG_PREFIX = re.compile(r"^\d{4}/\d\d/\d\d \d\d:\d\d:\d\d \w+\s*:\s*")
_FRACTION = re.compile(r"(\.\d{6})\d+")
_CHANGE_MESSAGES = ("Copied", "Deleted", "Moved into backup dir")
_NETWORK_FLAGS = ("--contimeout", "15s", "--timeout", "60s", "--retries", "2", "--low-level-retries", "3")


class RcloneError(Exception):
    def __init__(self, message: str, code: int | None = None):
        super().__init__(message)
        self.code = code


@dataclass
class SyncStats:
    changed: set[str] = field(default_factory=set)


def binary() -> str:
    bundled = os.path.join(decky.DECKY_PLUGIN_DIR, "bin", "rclone")
    if os.access(bundled, os.X_OK):
        return bundled
    system = shutil.which("rclone")
    if system:
        return system
    raise RcloneError("rclone was not found. Reinstall the plugin.")


def config_path() -> str:
    return os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "rclone.conf")


def remote_path(path: str) -> str:
    return f"{REMOTE}:{path}"


def parse_time(value: str) -> float:
    return datetime.fromisoformat(_FRACTION.sub(r"\1", value.replace("Z", "+00:00"))).timestamp()


def _error_from_stderr(stderr: str) -> str:
    messages = []
    for line in stderr.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except ValueError:
            messages.append(_LOG_PREFIX.sub("", line))
            continue
        if entry.get("level") in ("error", "critical"):
            messages.append(entry.get("msg", ""))
    return messages[-1] if messages else "rclone failed without an error message"


class Rclone:
    def __init__(self):
        self._processes: set[asyncio.subprocess.Process] = set()

    async def run(self, *args: str, stdin: bytes | None = None) -> tuple[str, str]:
        process = await asyncio.create_subprocess_exec(
            binary(), "--config", config_path(), *_NETWORK_FLAGS, *args,
            stdin=asyncio.subprocess.PIPE if stdin is not None else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        self._processes.add(process)
        try:
            out, err = await process.communicate(stdin)
        finally:
            self._processes.discard(process)
        stdout, stderr = out.decode(errors="replace"), err.decode(errors="replace")
        if process.returncode != 0:
            raise RcloneError(_error_from_stderr(stderr), process.returncode)
        return stdout, stderr

    def kill_all(self):
        for process in list(self._processes):
            if process.returncode is None:
                process.kill()

    async def list(self, path: str, *flags: str) -> list[dict]:
        try:
            out, _ = await self.run("lsjson", "--no-mimetype", *flags, remote_path(path))
        except RcloneError as error:
            if error.code == DIRECTORY_NOT_FOUND:
                return []
            raise
        return json.loads(out or "[]")

    async def list_dirs(self, path: str) -> list[str]:
        entries = await self.list(path, "--dirs-only")
        return sorted((entry["Name"] for entry in entries), key=str.casefold)

    async def newest_mtime(self, path: str) -> float | None:
        entries = await self.list(path, "--recursive", "--files-only", "--fast-list")
        return max((parse_time(entry["ModTime"]) for entry in entries), default=None)

    async def read_text(self, path: str) -> str | None:
        try:
            out, _ = await self.run("cat", remote_path(path))
        except RcloneError as error:
            if error.code in (DIRECTORY_NOT_FOUND, FILE_NOT_FOUND):
                return None
            raise
        return out

    async def write_text(self, path: str, text: str):
        await self.run("rcat", remote_path(path), stdin=text.encode())

    async def purge(self, path: str):
        await self.run("purge", remote_path(path))

    async def sync(self, source: str, destination: str, backup_dir: str) -> SyncStats:
        _, stderr = await self.run(
            "sync", source, destination,
            "--backup-dir", backup_dir,
            "--use-json-log", "--verbose",
        )
        stats = SyncStats()
        for line in stderr.splitlines():
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if entry.get("msg", "").startswith(_CHANGE_MESSAGES) and "object" in entry:
                stats.changed.add(entry["object"])
        return stats

    async def copy(self, source: str, destination: str):
        await self.run("copy", source, destination)

    async def delete_remote(self):
        try:
            await self.run("config", "delete", REMOTE)
        except RcloneError:
            pass


def _remote_config() -> configparser.SectionProxy | None:
    parser = configparser.ConfigParser()
    try:
        parser.read(config_path())
    except configparser.Error:
        return None
    return parser[REMOTE] if parser.has_section(REMOTE) else None


def is_configured() -> bool:
    section = _remote_config()
    return section is not None and "token" in section


def signed_in_client_id() -> str:
    section = _remote_config()
    return section.get("client_id", "") if section is not None else ""
