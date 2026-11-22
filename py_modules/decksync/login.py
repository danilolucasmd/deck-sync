import asyncio
import re
import socket
from typing import Awaitable, Callable

import decky

from . import rclone
from .providers import Provider

AUTH_PORT = 53682
_AUTH_URL = re.compile(rf"(http://127\.0\.0\.1:{AUTH_PORT}/auth\?state=\S+)")
_URL_TIMEOUT = 20


def _port_in_use() -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        return sock.connect_ex(("127.0.0.1", AUTH_PORT)) == 0


class Login:
    def __init__(self, runner: rclone.Rclone, on_finished: Callable[[Provider, bool], Awaitable[None]]):
        self._runner = runner
        self._on_finished = on_finished
        self._process: asyncio.subprocess.Process | None = None

    async def start(self, provider: Provider) -> str:
        await self.cancel()
        if _port_in_use():
            raise RuntimeError(f"Port {AUTH_PORT} is busy. Close other rclone sessions and try again.")

        await self._runner.delete_remote()
        self._process = await asyncio.create_subprocess_exec(
            rclone.binary(), "--config", rclone.config_path(),
            "config", "create", rclone.REMOTE, provider.rclone_type, *provider.options,
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            url = await asyncio.wait_for(self._read_auth_url(self._process), _URL_TIMEOUT)
        except (asyncio.TimeoutError, EOFError):
            await self.cancel()
            raise RuntimeError("rclone did not provide a sign-in link.") from None

        asyncio.get_running_loop().create_task(self._wait(self._process, provider))
        return url

    async def cancel(self):
        process, self._process = self._process, None
        if process and process.returncode is None:
            process.kill()
            await process.wait()

    @staticmethod
    async def _read_auth_url(process: asyncio.subprocess.Process) -> str:
        while line := await process.stderr.readline():
            match = _AUTH_URL.search(line.decode(errors="replace"))
            if match:
                return match.group(1)
        raise EOFError

    async def _wait(self, process: asyncio.subprocess.Process, provider: Provider):
        await process.stderr.read()
        code = await process.wait()
        if process is not self._process:
            return
        self._process = None
        success = code == 0 and rclone.is_configured()
        decky.logger.info("Sign-in to %s finished with code %s", provider.name, code)
        await self._on_finished(provider, success)
