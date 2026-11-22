import logging
import os
import sys
import types

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "py_modules"))


@pytest.fixture
def decky(tmp_path, monkeypatch):
    module = types.ModuleType("decky")
    module.DECKY_PLUGIN_DIR = str(tmp_path / "plugin")
    module.DECKY_PLUGIN_SETTINGS_DIR = str(tmp_path / "settings")
    module.DECKY_PLUGIN_RUNTIME_DIR = str(tmp_path / "runtime")
    module.DECKY_USER_HOME = str(tmp_path / "home")
    module.logger = logging.getLogger("decksync-test")
    for directory in ("plugin", "settings", "runtime", "home", "cloud"):
        (tmp_path / directory).mkdir()
    (tmp_path / "settings" / "rclone.conf").write_text(
        f"[decksync]\ntype = alias\nremote = {tmp_path / 'cloud'}\n"
    )
    monkeypatch.setitem(sys.modules, "decky", module)
    for name in list(sys.modules):
        if name.startswith("decksync"):
            del sys.modules[name]
    return module
