import copy
import json
import os
import uuid

import decky

DEFAULTS = {
    "provider": None,
    "notify": True,
    "two_way": False,
    "history_limit": 30,
    "games": [],
}


class Settings:
    def __init__(self):
        self._path = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")
        self._data = self._load()

    def _load(self) -> dict:
        data = copy.deepcopy(DEFAULTS)
        try:
            with open(self._path, encoding="utf-8") as file:
                data.update(json.load(file))
        except FileNotFoundError:
            pass
        except (OSError, ValueError):
            decky.logger.exception("Could not read %s, using defaults", self._path)
        return data

    def save(self):
        temporary = f"{self._path}.tmp"
        with open(temporary, "w", encoding="utf-8") as file:
            json.dump(self._data, file, indent=2)
        os.replace(temporary, self._path)

    def __getitem__(self, key: str):
        return self._data[key]

    def __setitem__(self, key: str, value):
        self._data[key] = value
        self.save()

    def snapshot(self) -> dict:
        return copy.deepcopy(self._data)

    @property
    def games(self) -> list[dict]:
        return self._data["games"]

    def game(self, game_id: str) -> dict | None:
        return next((game for game in self.games if game["id"] == game_id), None)

    def game_for_app(self, app_id: int) -> dict | None:
        return next((game for game in self.games if game["app_id"] == app_id), None)

    def put_game(self, game: dict) -> dict:
        existing = self.game(game.get("id", ""))
        if existing:
            existing.update(game)
        else:
            game = {**game, "id": uuid.uuid4().hex, "last_sync": None}
            self.games.append(game)
            existing = game
        self.save()
        return existing

    def remove_game(self, game_id: str):
        self._data["games"] = [game for game in self.games if game["id"] != game_id]
        self.save()
