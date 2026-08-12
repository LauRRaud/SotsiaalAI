"""Fail-closed authentication configuration for the RAG service."""

from __future__ import annotations

from dataclasses import dataclass
import ipaddress
from typing import Mapping


MIN_SERVICE_KEY_LENGTH = 32
_TRUE_VALUES = {"1", "true", "yes", "on"}


class AuthConfigError(RuntimeError):
    """Raised when the service would start with an unsafe auth boundary."""


@dataclass(frozen=True)
class AuthConfig:
    api_key: str
    insecure_no_auth: bool
    bind_host: str


def _is_loopback_host(value: str) -> bool:
    host = value.strip().lower().strip("[]")
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def load_auth_config(env: Mapping[str, str]) -> AuthConfig:
    api_key = str(env.get("RAG_SERVICE_API_KEY", "")).strip()
    insecure_no_auth = str(env.get("RAG_ALLOW_INSECURE_NO_AUTH", "")).strip().lower() in _TRUE_VALUES
    bind_host = str(env.get("RAG_BIND_HOST", "127.0.0.1")).strip() or "127.0.0.1"

    if api_key:
        if len(api_key) < MIN_SERVICE_KEY_LENGTH:
            raise AuthConfigError(
                f"RAG_SERVICE_API_KEY must be at least {MIN_SERVICE_KEY_LENGTH} characters"
            )
        return AuthConfig(api_key=api_key, insecure_no_auth=False, bind_host=bind_host)

    if not insecure_no_auth:
        raise AuthConfigError(
            "RAG_SERVICE_API_KEY is required; unauthenticated development requires "
            "RAG_ALLOW_INSECURE_NO_AUTH=1"
        )
    if not _is_loopback_host(bind_host):
        raise AuthConfigError(
            "RAG_ALLOW_INSECURE_NO_AUTH is allowed only with a loopback RAG_BIND_HOST"
        )

    return AuthConfig(api_key="", insecure_no_auth=True, bind_host=bind_host)
