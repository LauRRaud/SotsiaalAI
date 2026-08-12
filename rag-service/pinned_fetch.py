"""SSRF-safe HTTP fetch: resolve once, connect to that IP, then verify the peer."""

from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

import urllib3


class PinnedFetchRejected(ValueError):
    pass


@dataclass(frozen=True)
class PinnedTarget:
    scheme: str
    host: str
    port: int
    ip: str
    request_target: str


def _normalized_ip(value: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address:
    return ipaddress.ip_address(str(value).split("%", 1)[0])


def _resolve_target(url: str, *, allow_private: bool, resolver) -> PinnedTarget:
    parsed = urlparse(str(url or "").strip())
    if parsed.scheme not in {"http", "https"}:
        raise PinnedFetchRejected("unsupported_scheme")
    host = parsed.hostname or ""
    if not host:
        raise PinnedFetchRejected("missing_host")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        literal = _normalized_ip(host)
        addresses = [literal]
    except ValueError:
        try:
            infos = resolver(host, port, type=socket.SOCK_STREAM, proto=socket.IPPROTO_TCP)
        except socket.gaierror as exc:
            raise PinnedFetchRejected("host_resolution_failed") from exc
        addresses = []
        for info in infos:
            try:
                address = _normalized_ip(info[4][0])
            except (ValueError, IndexError, TypeError):
                continue
            if address not in addresses:
                addresses.append(address)
    if not addresses:
        raise PinnedFetchRejected("host_has_no_address")
    if not allow_private and any(not address.is_global for address in addresses):
        raise PinnedFetchRejected("non_public_address")
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    return PinnedTarget(parsed.scheme, host, port, str(addresses[0]), path)


def _default_pool_factory(scheme: str, ip: str, port: int, **kwargs):
    timeout = kwargs.pop("timeout")
    if scheme == "https":
        return urllib3.HTTPSConnectionPool(
            ip,
            port=port,
            timeout=timeout,
            cert_reqs="CERT_REQUIRED",
            retries=False,
            **kwargs,
        )
    return urllib3.HTTPConnectionPool(ip, port=port, timeout=timeout, retries=False)


class PinnedResponse:
    def __init__(self, raw, pool):
        self._raw = raw
        self._pool = pool
        self.status_code = int(raw.status)
        self.headers = raw.headers
        content_type = str(raw.headers.get("content-type") or "")
        self.encoding = "utf-8"
        if "charset=" in content_type.lower():
            self.encoding = content_type.rsplit("charset=", 1)[-1].split(";", 1)[0].strip() or "utf-8"

    def iter_content(self, chunk_size: int):
        yield from self._raw.stream(chunk_size)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise PinnedFetchRejected(f"upstream_http_{self.status_code}")

    def close(self):
        self._raw.release_conn()
        close_pool = getattr(self._pool, "close", None)
        if callable(close_pool):
            close_pool()

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        self.close()


def open_pinned_response(
    url: str,
    *,
    allow_private: bool = False,
    timeout_seconds: float = 30,
    resolver=socket.getaddrinfo,
    pool_factory=None,
) -> PinnedResponse:
    target = _resolve_target(url, allow_private=allow_private, resolver=resolver)
    factory = pool_factory or _default_pool_factory
    tls = {
        "timeout": urllib3.Timeout(connect=timeout_seconds, read=timeout_seconds),
        "server_hostname": target.host,
        "assert_hostname": target.host,
    } if target.scheme == "https" else {
        "timeout": urllib3.Timeout(connect=timeout_seconds, read=timeout_seconds),
    }
    pool = factory(target.scheme, target.ip, target.port, **tls)
    host_header = target.host
    if target.port != (443 if target.scheme == "https" else 80):
        host_header = f"{host_header}:{target.port}"
    raw = pool.urlopen(
        method="GET",
        url=target.request_target,
        headers={"Host": host_header, "User-Agent": "SotsiaalAI-RAG/1.0"},
        redirect=False,
        preload_content=False,
        retries=False,
    )
    try:
        connection = getattr(raw, "connection", None) or getattr(raw, "_connection", None)
        sock = getattr(connection, "sock", None)
        if sock is None:
            raise PinnedFetchRejected("peer_address_unavailable")
        peer = _normalized_ip(sock.getpeername()[0])
        pinned = _normalized_ip(target.ip)
        if peer != pinned:
            raise PinnedFetchRejected("peer_address_mismatch")
        if not allow_private and not peer.is_global:
            raise PinnedFetchRejected("non_public_peer")
    except Exception:
        raw.release_conn()
        close_pool = getattr(pool, "close", None)
        if callable(close_pool):
            close_pool()
        raise
    return PinnedResponse(raw, pool)
