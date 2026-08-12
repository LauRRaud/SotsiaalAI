import unittest

from parser_worker import ParserLimits, ParserRejected, ensure_pdf_limits, run_test_sleep


class ParserWorkerTests(unittest.TestCase):
    def test_pdf_page_and_object_limits_are_both_enforced(self):
        ensure_pdf_limits(3, 10, ParserLimits(max_pdf_pages=3, max_pdf_objects=10))
        with self.assertRaisesRegex(ParserRejected, "pdf_page_limit"):
            ensure_pdf_limits(4, 1, ParserLimits(max_pdf_pages=3, max_pdf_objects=10))
        with self.assertRaisesRegex(ParserRejected, "pdf_object_limit"):
            ensure_pdf_limits(1, 11, ParserLimits(max_pdf_pages=3, max_pdf_objects=10))

    def test_parser_worker_timeout_terminates_child(self):
        with self.assertRaisesRegex(ParserRejected, "parser_timeout"):
            run_test_sleep(0.2, timeout_seconds=0.02)


if __name__ == "__main__":
    unittest.main()
