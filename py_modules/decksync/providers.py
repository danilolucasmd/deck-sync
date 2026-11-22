from dataclasses import dataclass


@dataclass(frozen=True)
class Provider:
    id: str
    name: str
    rclone_type: str
    options: tuple[str, ...] = ()

    def to_dict(self) -> dict:
        return {"id": self.id, "name": self.name}


PROVIDERS = {
    provider.id: provider
    for provider in (
        Provider("gdrive", "Google Drive", "drive", ("scope=drive",)),
    )
}


def get(provider_id: str) -> Provider:
    try:
        return PROVIDERS[provider_id]
    except KeyError:
        raise ValueError(f"Unknown cloud provider: {provider_id}") from None
