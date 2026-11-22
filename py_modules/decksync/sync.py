import asyncio
import os
import posixpath
import shutil
from dataclasses import asdict, dataclass
from datetime import datetime

import decky

from . import guards
from .rclone import Rclone, remote_path

HISTORY_LIMITS = (20, 30, 50, 100)
DEFAULT_HISTORY_LIMIT = 30
MTIME_TOLERANCE = 2.0
_PURGE_CONCURRENCY = 4


@dataclass
class SyncResult:
    game_id: str
    name: str
    action: str
    files: int = 0
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def _timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d_%H-%M-%S")


def newest_local_mtime(path: str) -> float | None:
    newest = None
    for root, _, files in os.walk(path):
        for name in files:
            try:
                mtime = os.stat(os.path.join(root, name)).st_mtime
            except OSError:
                continue
            newest = mtime if newest is None else max(newest, mtime)
    return newest


class SyncEngine:
    def __init__(self, rclone: Rclone):
        self._rclone = rclone
        self._lock = asyncio.Lock()
        self._staging_root = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "pending-history")

    @property
    def busy(self) -> bool:
        return self._lock.locked()

    async def sync(self, game: dict, two_way: bool, history_limit: int = DEFAULT_HISTORY_LIMIT) -> SyncResult:
        async with self._lock:
            try:
                return await self._sync(game, two_way, history_limit)
            except Exception as error:
                decky.logger.exception("Sync failed for %s", game["name"])
                return SyncResult(game["id"], game["name"], "failed", error=str(error))

    async def _sync(self, game: dict, two_way: bool, history_limit: int) -> SyncResult:
        root = game["remote_path"]
        await guards.claim_remote(self._rclone, game)
        await self._flush_staged_history(game)

        local = await asyncio.to_thread(newest_local_mtime, game["local_path"])
        remote = await self._rclone.newest_mtime(posixpath.join(root, guards.SAVE_DIR))
        decky.logger.info("%s: newest local %s, newest remote %s", game["name"], local, remote)

        if local is None and remote is None:
            return SyncResult(game["id"], game["name"], "unchanged")
        if local is None and not two_way:
            return SyncResult(
                game["id"], game["name"], "skipped",
                error="The save folder on the Deck is empty, so Drive was left untouched.",
            )

        if two_way and remote is not None and (local is None or remote > local + MTIME_TOLERANCE):
            files = await self._download(game)
            action = "downloaded"
        else:
            files = await self._upload(game)
            action = "uploaded"

        await self._prune_history(root, history_limit)
        return SyncResult(game["id"], game["name"], action if files else "unchanged", files)

    async def _upload(self, game: dict) -> int:
        root = game["remote_path"]
        stats = await self._rclone.sync(
            game["local_path"],
            remote_path(posixpath.join(root, guards.SAVE_DIR)),
            remote_path(posixpath.join(root, guards.HISTORY_DIR, _timestamp())),
        )
        return len(stats.changed)

    async def _download(self, game: dict) -> int:
        root = game["remote_path"]
        os.makedirs(game["local_path"], exist_ok=True)
        staging = os.path.join(self._staging_root, game["id"], _timestamp())
        stats = await self._rclone.sync(
            remote_path(posixpath.join(root, guards.SAVE_DIR)),
            game["local_path"],
            staging,
        )
        await self._flush_staged_history(game)
        return len(stats.changed)

    async def _flush_staged_history(self, game: dict):
        game_staging = os.path.join(self._staging_root, game["id"])
        if not os.path.isdir(game_staging):
            return
        for name in sorted(os.listdir(game_staging)):
            staged = os.path.join(game_staging, name)
            if any(files for _, _, files in os.walk(staged)):
                await self._rclone.copy(
                    staged,
                    remote_path(posixpath.join(game["remote_path"], guards.HISTORY_DIR, name)),
                )
            shutil.rmtree(staged)
        os.rmdir(game_staging)

    async def _prune_history(self, root: str, limit: int):
        history = posixpath.join(root, guards.HISTORY_DIR)
        entries = await self._rclone.list_dirs(history)
        excess = entries[:-limit] if len(entries) > limit else []
        if not excess:
            return

        semaphore = asyncio.Semaphore(_PURGE_CONCURRENCY)

        async def purge(name: str):
            async with semaphore:
                await self._rclone.purge(posixpath.join(history, name))

        await asyncio.gather(*(purge(name) for name in excess))
        decky.logger.info("Removed %d old history entries from %s", len(excess), history)

    def forget(self, game_id: str):
        shutil.rmtree(os.path.join(self._staging_root, game_id), ignore_errors=True)
