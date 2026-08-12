import os
import unittest

from pinned_fetch import PinnedFetchRejected, open_pinned_response


class _Socket:
    def __init__(self, peer):
        self.peer = peer

    def getpeername(self):
        return (self.peer, 443)


class _RawResponse:
    status = 200
    headers = {"content-type": "text/html; charset=utf-8"}

    def __init__(self, peer):
        self.connection = type("Connection", (), {"sock": _Socket(peer)})()

    def stream(self, _size):
        yield b"ok"

    def release_conn(self):
        pass


class PinnedFetchTests(unittest.TestCase):
    def test_dns_rebinding_cannot_change_checked_connect_address(self):
        resolutions = 0
        connected = []

        def resolver(host, *_args, **_kwargs):
            nonlocal resolutions
            resolutions += 1
            address = "93.184.216.34" if resolutions == 1 else "127.0.0.1"
            return [(2, 1, 6, "", (address, 0))]

        def pool_factory(scheme, ip, port, **kwargs):
            connected.append((scheme, ip, port, kwargs))

            class Pool:
                def urlopen(self, **_request):
                    return _RawResponse(ip)

            return Pool()

        with open_pinned_response(
            "https://example.com/path?q=1",
            resolver=resolver,
            pool_factory=pool_factory,
        ) as response:
            self.assertEqual(b"".join(response.iter_content(10)), b"ok")

        self.assertEqual(resolutions, 1)
        self.assertEqual(connected[0][1], "93.184.216.34")
        self.assertEqual(connected[0][3]["server_hostname"], "example.com")
        self.assertEqual(connected[0][3]["assert_hostname"], "example.com")

    def test_connected_peer_must_equal_the_pinned_public_ip(self):
        def resolver(*_args, **_kwargs):
            return [(2, 1, 6, "", ("93.184.216.34", 0))]

        def pool_factory(*_args, **_kwargs):
            class Pool:
                def urlopen(self, **_request):
                    return _RawResponse("127.0.0.1")

            return Pool()

        with self.assertRaisesRegex(PinnedFetchRejected, "peer_address_mismatch"):
            open_pinned_response("https://example.com", resolver=resolver, pool_factory=pool_factory)

    def test_proxy_environment_is_not_consulted_by_direct_pool(self):
        previous = os.environ.get("HTTPS_PROXY")
        os.environ["HTTPS_PROXY"] = "http://127.0.0.1:9999"
        calls = []
        try:
            def resolver(*_args, **_kwargs):
                return [(2, 1, 6, "", ("93.184.216.34", 0))]

            def pool_factory(scheme, ip, port, **kwargs):
                calls.append((scheme, ip, kwargs))

                class Pool:
                    def urlopen(self, **_request):
                        return _RawResponse(ip)

                return Pool()

            response = open_pinned_response(
                "https://example.com", resolver=resolver, pool_factory=pool_factory
            )
            response.close()
        finally:
            if previous is None:
                os.environ.pop("HTTPS_PROXY", None)
            else:
                os.environ["HTTPS_PROXY"] = previous

        self.assertEqual(calls[0][1], "93.184.216.34")


if __name__ == "__main__":
    unittest.main()
