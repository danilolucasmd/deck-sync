import signal
import time

import decky

from decksync import guards, process, providers, rclone
from decksync.login import Login
from decksync.settings import Settings
from decksync.sync import HISTORY_LIMITS, SyncEngine, SyncResult

_OPTIONS = {"notify", "two_way"}


class Plugin:
    async def _main(self):
        self.settings = Settings()
        self.rclone = rclone.Rclone()
        self.engine = SyncEngine(self.rclone)
        self.login = Login(self.rclone, self._login_finished)
        decky.logger.info("DeckSync %s started", decky.DECKY_PLUGIN_VERSION)

    async def _unload(self):
        await self.login.cancel()
        self.rclone.kill_all()

    async def _uninstall(self):
        pass

    async def get_state(self) -> dict:
        state = self.settings.snapshot()
        state["connected"] = bool(state["provider"]) and rclone.is_configured()
        state["providers"] = [provider.to_dict() for provider in providers.PROVIDERS.values()]
        state["syncing"] = self.engine.busy
        state["home"] = decky.DECKY_USER_HOME
        state["history_limits"] = list(HISTORY_LIMITS)
        return state

    async def set_option(self, key: str, value: bool):
        if key not in _OPTIONS:
            raise ValueError(f"Unknown option: {key}")
        self.settings[key] = bool(value)

    async def set_history_limit(self, limit: int):
        if limit not in HISTORY_LIMITS:
            raise ValueError(f"History limit must be one of {HISTORY_LIMITS}")
        self.settings["history_limit"] = limit

    async def start_login(self, provider_id: str) -> str:
        return await self.login.start(providers.get(provider_id))

    async def _login_finished(self, provider: providers.Provider, success: bool):
        if success:
            self.settings["provider"] = provider.id
        await decky.emit("login_finished", provider.name, success)

    async def logout(self):
        await self.login.cancel()
        await self.rclone.delete_remote()
        self.settings["provider"] = None

    async def list_remote_folders(self, path: str) -> list[str]:
        return await self.rclone.list_dirs(path.strip("/"))

    async def save_game(self, game: dict) -> dict:
        try:
            candidate = {
                "id": game.get("id") or "",
                "app_id": int(game["app_id"]),
                "name": str(game["name"]).strip(),
                "local_path": guards.normalize_local(game.get("local_path", "")),
                "remote_path": guards.normalize_remote(game.get("remote_path", "")),
            }
            guards.check_conflicts(candidate, self.settings.games)
            await guards.check_remote(self.rclone, candidate)
        except (guards.GuardError, rclone.RcloneError) as error:
            return {"error": str(error)}

        if not candidate["id"]:
            del candidate["id"]
        return {"game": self.settings.put_game(candidate)}

    async def remove_game(self, game_id: str):
        self.settings.remove_game(game_id)
        self.engine.forget(game_id)

    async def sync_game(self, game_id: str) -> dict:
        game = self.settings.game(game_id)
        if not game:
            raise ValueError("That game is no longer set up.")
        return (await self._sync(game, "manual")).to_dict()

    async def sync_all(self) -> list[dict]:
        return [(await self._sync(game, "manual")).to_dict() for game in list(self.settings.games)]

    async def on_game_lifetime(self, app_id: int, pid: int, running: bool):
        game = self.settings.game_for_app(app_id)
        if not game:
            return

        trigger = "launch" if running else "exit"
        paused = []
        if running and self.settings["two_way"] and pid > 0:
            paused = process.process_tree(pid)
            process.send(paused, signal.SIGSTOP)
        try:
            await self._sync(game, trigger)
        finally:
            process.send(paused, signal.SIGCONT)

    async def _sync(self, game: dict, trigger: str) -> SyncResult:
        if not rclone.is_configured():
            result = SyncResult(game["id"], game["name"], "failed", error="Connect a cloud provider first.")
        else:
            await decky.emit("sync_started", game["name"])
            result = await self.engine.sync(game, self.settings["two_way"], self.settings["history_limit"])
            if result.error is None:
                self.settings.put_game({"id": game["id"], "last_sync": time.time()})
        await decky.emit("sync_finished", result.to_dict(), trigger)
        return result
