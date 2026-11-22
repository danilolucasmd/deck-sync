import pytest


def test_remote_path_rules(decky):
    from decksync.guards import GuardError, normalize_remote

    assert normalize_remote("/Games Save//Zelda/") == "Games Save/Zelda"
    for bad in ("", "/", "Games/../x", "Games Save/Zelda/save", "Zelda/history"):
        with pytest.raises(GuardError):
            normalize_remote(bad)


def test_local_path_rules(decky, tmp_path):
    from decksync.guards import GuardError, normalize_local

    saves = tmp_path / "home" / "saves"
    saves.mkdir()
    assert normalize_local(str(saves)) == str(saves)
    for bad in ("", "relative/path", "/", str(tmp_path / "home")):
        with pytest.raises(GuardError):
            normalize_local(bad)


def test_conflicts(decky):
    from decksync.guards import GuardError, check_conflicts

    existing = [{"id": "a", "app_id": 1, "name": "OoT", "local_path": "/s/oot", "remote_path": "Games Save/OoT"}]
    ok = {"id": "", "app_id": 2, "name": "BotW", "local_path": "/s/botw", "remote_path": "Games Save/BotW"}
    check_conflicts(ok, existing)
    check_conflicts({**existing[0]}, existing)

    for change in (
        {"app_id": 1},
        {"remote_path": "Games Save/OoT"},
        {"remote_path": "Games Save/OoT/extra"},
        {"remote_path": "Games Save"},
        {"local_path": "/s/oot/sub"},
    ):
        with pytest.raises(GuardError):
            check_conflicts({**ok, **change}, existing)
