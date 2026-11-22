import os
import signal

import decky


def _children() -> dict[int, list[int]]:
    tree: dict[int, list[int]] = {}
    for entry in os.listdir("/proc"):
        if not entry.isdigit():
            continue
        try:
            with open(f"/proc/{entry}/stat", encoding="utf-8") as file:
                fields = file.read().rsplit(")", 1)[1].split()
        except (OSError, IndexError):
            continue
        tree.setdefault(int(fields[1]), []).append(int(entry))
    return tree


def process_tree(pid: int) -> list[int]:
    tree = _children()
    found, pending = [], [pid]
    while pending:
        current = pending.pop()
        found.append(current)
        pending.extend(tree.get(current, []))
    return found


def send(pids: list[int], sig: signal.Signals):
    for pid in pids:
        try:
            os.kill(pid, sig)
        except ProcessLookupError:
            pass
        except PermissionError:
            decky.logger.warning("Not allowed to send %s to %d", sig.name, pid)
