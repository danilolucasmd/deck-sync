import json
import os
import posixpath

import decky

from .rclone import Rclone

MARKER = ".decksync.json"
SAVE_DIR = "save"
HISTORY_DIR = "history"
_MANAGED = {SAVE_DIR, HISTORY_DIR, MARKER}


class GuardError(Exception):
    pass


def normalize_remote(path: str) -> str:
    parts = [part.strip() for part in path.replace("\\", "/").split("/")]
    parts = [part for part in parts if part and part != "."]
    if not parts:
        raise GuardError("Choose a Drive folder for this game, not the Drive root.")
    if ".." in parts:
        raise GuardError("Drive folder can't contain '..'.")
    if parts[-1] in (SAVE_DIR, HISTORY_DIR):
        raise GuardError(f"Pick the game's folder itself, not its {parts[-1]}/ subfolder.")
    return "/".join(parts)


def normalize_local(path: str) -> str:
    if not path or not os.path.isabs(path):
        raise GuardError("Choose a save folder on the Deck.")
    path = os.path.realpath(path)
    if os.path.exists(path) and not os.path.isdir(path):
        raise GuardError("Save location must be a folder, not a file.")
    home = os.path.realpath(decky.DECKY_USER_HOME)
    if _contains(path, home):
        raise GuardError("That folder is too broad. Pick the folder that holds only this game's saves.")
    return path


def _contains(parent: str, child: str) -> bool:
    return child == parent or child.startswith(parent.rstrip("/") + "/")


def _overlaps(a: str, b: str) -> bool:
    return _contains(a, b) or _contains(b, a)


def check_conflicts(game: dict, games: list[dict]):
    for other in games:
        if other["id"] == game.get("id"):
            continue
        if other["app_id"] == game["app_id"]:
            raise GuardError(f"{other['name']} is already set up.")
        if _overlaps(other["remote_path"], game["remote_path"]):
            raise GuardError(f"That Drive folder overlaps the one used by {other['name']}.")
        if _overlaps(other["local_path"], game["local_path"]):
            raise GuardError(f"That save folder overlaps the one used by {other['name']}.")


def _same_game(marker: dict, game: dict) -> bool:
    return marker.get("app_id") == game["app_id"] or (
        str(marker.get("name", "")).casefold() == game["name"].casefold()
    )


async def check_remote(rclone: Rclone, game: dict) -> dict | None:
    marker_path = posixpath.join(game["remote_path"], MARKER)
    text = await rclone.read_text(marker_path)
    if text is not None:
        try:
            marker = json.loads(text)
        except ValueError:
            raise GuardError(f"{marker_path} is damaged. Fix or delete it in Drive.") from None
        if not _same_game(marker, game):
            raise GuardError(f"That Drive folder already holds saves for {marker.get('name', 'another game')}.")
        return marker

    entries = await rclone.list(game["remote_path"])
    unknown = sorted(entry["Name"] for entry in entries if entry["Name"] not in _MANAGED)
    if unknown:
        listed = ", ".join(unknown[:3]) + ("…" if len(unknown) > 3 else "")
        raise GuardError(f"That Drive folder already has other files ({listed}). Pick an empty folder or one made by DeckSync.")
    return None


async def claim_remote(rclone: Rclone, game: dict):
    marker = {"app_id": game["app_id"], "name": game["name"]}
    if await check_remote(rclone, game) != marker:
        await rclone.write_text(posixpath.join(game["remote_path"], MARKER), json.dumps(marker, indent=2))
