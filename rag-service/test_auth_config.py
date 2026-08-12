"""SOL-RAGSVC-03 — RAG teenuse autentimine peab vaikimisi sulguma.

Test on teadlikult eraldi protsessis jooksutatav: ``main`` loeb turvaseaded
importimise ajal, täpselt nagu Uvicorni worker käivitumisel.
"""

import os
import subprocess
import sys
import unittest

from auth_config import AuthConfigError, load_auth_config


class AuthConfigTests(unittest.TestCase):
    def test_main_import_refuses_to_start_without_key(self):
        env = os.environ.copy()
        env["OPENAI_API_KEY"] = "test-key"
        env.pop("RAG_SERVICE_API_KEY", None)
        env.pop("RAG_ALLOW_INSECURE_NO_AUTH", None)
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from rag_test_stubs import install_chromadb_stub_if_missing; "
                "install_chromadb_stub_if_missing(); import main",
            ],
            cwd=os.path.dirname(__file__),
            env=env,
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("RAG_SERVICE_API_KEY is required", result.stderr)

    def test_missing_key_refuses_startup_by_default(self):
        with self.assertRaisesRegex(AuthConfigError, "RAG_SERVICE_API_KEY"):
            load_auth_config({})

    def test_weak_key_refuses_startup(self):
        with self.assertRaisesRegex(AuthConfigError, "at least 32"):
            load_auth_config({"RAG_SERVICE_API_KEY": "short-key"})

    def test_explicit_no_auth_dev_mode_requires_loopback_bind(self):
        for host in ("0.0.0.0", "::", "192.0.2.10", "example.test"):
            with self.subTest(host=host):
                with self.assertRaisesRegex(AuthConfigError, "loopback"):
                    load_auth_config({
                        "RAG_ALLOW_INSECURE_NO_AUTH": "1",
                        "RAG_BIND_HOST": host,
                    })

        config = load_auth_config({
            "RAG_ALLOW_INSECURE_NO_AUTH": "1",
            "RAG_BIND_HOST": "127.0.0.1",
        })
        self.assertTrue(config.insecure_no_auth)
        self.assertEqual(config.api_key, "")

    def test_strong_key_keeps_auth_enabled_on_any_bind(self):
        config = load_auth_config({
            "RAG_SERVICE_API_KEY": "k" * 32,
            "RAG_BIND_HOST": "0.0.0.0",
        })
        self.assertFalse(config.insecure_no_auth)
        self.assertEqual(config.api_key, "k" * 32)


if __name__ == "__main__":
    unittest.main()
