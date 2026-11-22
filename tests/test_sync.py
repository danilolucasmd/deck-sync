import asyncio
import json
import os
import time

import pytest


def write(path, text, mtime=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    if mtime is not None:
        os.utime(path, (mtime, mtime))


@pytest.fixture
def setup(decky, tmp_path):
    from decksync.rclone import Rclone
    from decksync.sync import SyncEngine

    local = tmp_path / "home" / "game" / "saves"
    local.mkdir(parents=True)
    game = {
        "id": "g1",
        "app_id": 42,
        "name": "Zelda",
        "local_path": str(local),
        "remote_path": "Games Save/Zelda",
    }
    return SyncEngine(Rclone()), game, local, tmp_path / "cloud" / "Games Save" / "Zelda"


def run(coroutine):
    return asyncio.run(coroutine)


def test_upload_moves_replaced_files_to_history(setup):
    engine, game, local, cloud = setup
    write(local / "slot_00" / "progress.sav", "v1")
    write(local / "option.sav", "options")

    first = run(engine.sync(game, two_way=False))
    assert (first.action, first.files) == ("uploaded", 2)
    assert (cloud / "save" / "slot_00" / "progress.sav").read_text() == "v1"
    assert json.loads((cloud / ".decksync.json").read_text()) == {"app_id": 42, "name": "Zelda"}
    assert not (cloud / "history").exists()

    time.sleep(1.1)
    write(local / "slot_00" / "progress.sav", "v2")
    second = run(engine.sync(game, two_way=False))
    assert second.action == "uploaded"
    [entry] = list((cloud / "history").iterdir())
    assert (entry / "slot_00" / "progress.sav").read_text() == "v1"
    assert not (entry / "option.sav").exists()

    assert run(engine.sync(game, two_way=False)).action == "unchanged"


def test_history_is_capped(setup):
    engine, game, local, cloud = setup
    for index in range(25):
        (cloud / "history" / f"2026-01-01_00-00-{index:02d}").mkdir(parents=True)
    write(local / "a.sav", "a")

    run(engine.sync(game, two_way=False, history_limit=20))
    remaining = sorted(path.name for path in (cloud / "history").iterdir())
    assert len(remaining) == 20
    assert remaining[0] == "2026-01-01_00-00-05"


def test_larger_history_limit_keeps_more(setup):
    engine, game, local, cloud = setup
    for index in range(25):
        (cloud / "history" / f"2026-01-01_00-00-{index:02d}").mkdir(parents=True)
    write(local / "a.sav", "a")

    run(engine.sync(game, two_way=False, history_limit=30))
    assert len(list((cloud / "history").iterdir())) == 25


def test_two_way_downloads_newer_drive_save_and_keeps_deck_copy(setup):
    engine, game, local, cloud = setup
    now = time.time()
    write(local / "a.sav", "deck", now - 3600)
    write(cloud / "save" / "a.sav", "drive", now)

    result = run(engine.sync(game, two_way=True))
    assert result.action == "downloaded"
    assert (local / "a.sav").read_text() == "drive"
    [entry] = list((cloud / "history").iterdir())
    assert (entry / "a.sav").read_text() == "deck"


def test_one_way_never_downloads(setup):
    engine, game, local, cloud = setup
    now = time.time()
    write(local / "a.sav", "deck", now - 3600)
    write(cloud / "save" / "a.sav", "drive", now)

    assert run(engine.sync(game, two_way=False)).action == "uploaded"
    assert (cloud / "save" / "a.sav").read_text() == "deck"


def test_empty_deck_folder_does_not_wipe_drive(setup):
    engine, game, local, cloud = setup
    write(cloud / "save" / "a.sav", "drive")

    result = run(engine.sync(game, two_way=False))
    assert result.action == "skipped"
    assert (cloud / "save" / "a.sav").read_text() == "drive"


def test_refuses_folder_owned_by_another_game(setup):
    engine, game, local, cloud = setup
    write(cloud / ".decksync.json", json.dumps({"app_id": 7, "name": "Breath of the Wild"}))
    write(local / "a.sav", "a")

    result = run(engine.sync(game, two_way=False))
    assert result.action == "failed"
    assert "Breath of the Wild" in result.error
    assert not (cloud / "save").exists()


def test_refuses_folder_with_unmanaged_files(setup):
    engine, game, local, cloud = setup
    write(cloud / "botw-savegame.zip", "zip")
    write(local / "a.sav", "a")

    result = run(engine.sync(game, two_way=False))
    assert result.action == "failed"
    assert "botw-savegame.zip" in result.error


def test_adopts_existing_layout_without_marker(setup):
    engine, game, local, cloud = setup
    write(cloud / "save" / "a.sav", "old", time.time() - 3600)
    (cloud / "history" / "2026-01-01_00-00-00").mkdir(parents=True)
    write(local / "a.sav", "new")

    assert run(engine.sync(game, two_way=False)).action == "uploaded"
    assert (cloud / ".decksync.json").exists()
