import asyncio
import unittest

from request_limits import (
    BodySizeLimitMiddleware,
    RequestBodyTooLarge,
    read_upload_bytes_bounded,
    validate_ingest_budget,
)


class RequestLimitTests(unittest.TestCase):
    def test_upload_is_streamed_in_bounded_reads_and_oversize_stops_early(self):
        class Upload:
            def __init__(self, data):
                self.data = data
                self.offset = 0
                self.read_sizes = []

            async def read(self, size=None):
                self.read_sizes.append(size)
                if size is None:
                    raise AssertionError("unbounded read is forbidden")
                out = self.data[self.offset:self.offset + size]
                self.offset += len(out)
                return out

        allowed = Upload(b"1234567")
        self.assertEqual(asyncio.run(read_upload_bytes_bounded(allowed, 7, chunk_size=3)), b"1234567")
        self.assertEqual(allowed.read_sizes, [3, 3, 3, 3])

        denied = Upload(b"12345678")
        with self.assertRaises(RequestBodyTooLarge):
            asyncio.run(read_upload_bytes_bounded(denied, 7, chunk_size=3))
        self.assertLessEqual(denied.offset, 8)

    def test_text_chunk_and_query_budgets_fail_closed(self):
        validate_ingest_budget(text="x" * 20, chunks=[], max_text_chars=20, max_chunks=2, max_chunk_chars=10)
        with self.assertRaises(RequestBodyTooLarge):
            validate_ingest_budget(text="x" * 21, chunks=[], max_text_chars=20, max_chunks=2, max_chunk_chars=10)
        with self.assertRaises(RequestBodyTooLarge):
            validate_ingest_budget(text="", chunks=["a", "b", "c"], max_text_chars=20, max_chunks=2, max_chunk_chars=10)
        with self.assertRaises(RequestBodyTooLarge):
            validate_ingest_budget(text="", chunks=["x" * 11], max_text_chars=20, max_chunks=2, max_chunk_chars=10)

    def test_chunked_and_missing_content_length_are_counted(self):
        async def scenario(headers):
            sent = []
            messages = iter([
                {"type": "http.request", "body": b"1234", "more_body": True},
                {"type": "http.request", "body": b"5678", "more_body": False},
            ])

            async def receive():
                return next(messages)

            async def send(message):
                sent.append(message)

            async def downstream(_scope, downstream_receive, downstream_send):
                while True:
                    message = await downstream_receive()
                    if not message.get("more_body"):
                        break
                await downstream_send({"type": "http.response.start", "status": 204, "headers": []})
                await downstream_send({"type": "http.response.body", "body": b""})

            middleware = BodySizeLimitMiddleware(downstream, max_bytes=7)
            await middleware({"type": "http", "method": "POST", "headers": headers}, receive, send)
            return sent

        for headers in ([], [(b"transfer-encoding", b"chunked")], [(b"content-length", b"1")]):
            response = asyncio.run(scenario(headers))
            self.assertEqual(response[0]["status"], 413)

    def test_declared_oversize_is_rejected_without_reading_body(self):
        reads = 0

        async def scenario():
            nonlocal reads
            sent = []

            async def receive():
                nonlocal reads
                reads += 1
                return {"type": "http.request", "body": b"", "more_body": False}

            async def send(message):
                sent.append(message)

            async def downstream(*_args):
                raise AssertionError("downstream must not run")

            middleware = BodySizeLimitMiddleware(downstream, max_bytes=7)
            await middleware(
                {"type": "http", "method": "POST", "headers": [(b"content-length", b"8")]},
                receive,
                send,
            )
            return sent

        response = asyncio.run(scenario())
        self.assertEqual(response[0]["status"], 413)
        self.assertEqual(reads, 0)

    def test_parallel_oversize_requests_each_stop_at_the_same_boundary(self):
        async def one_request():
            sent = []
            messages = iter([
                {"type": "http.request", "body": b"12345", "more_body": True},
                {"type": "http.request", "body": b"67890", "more_body": False},
            ])

            async def receive():
                return next(messages)

            async def send(message):
                sent.append(message)

            async def downstream(_scope, limited_receive, _send):
                while True:
                    message = await limited_receive()
                    if not message.get("more_body"):
                        return

            await BodySizeLimitMiddleware(downstream, max_bytes=8)(
                {"type": "http", "method": "POST", "headers": []}, receive, send
            )
            return sent[0]["status"]

        async def all_requests():
            return await asyncio.gather(*(one_request() for _ in range(8)))

        statuses = asyncio.run(all_requests())
        self.assertEqual(statuses, [413] * 8)


if __name__ == "__main__":
    unittest.main()
