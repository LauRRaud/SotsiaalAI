"""Small import stubs used only when optional RAG runtime packages are absent."""

from __future__ import annotations

import sys
import types


class _Collection:
    def count(self):
        return 0


class _Client:
    def __init__(self, *_args, **_kwargs):
        self.collection = _Collection()

    def get_or_create_collection(self, *_args, **_kwargs):
        return self.collection


def install_chromadb_stub_if_missing():
    try:
        __import__("chromadb")
        return
    except ModuleNotFoundError:
        module = types.ModuleType("chromadb")
        module.PersistentClient = _Client
        sys.modules["chromadb"] = module
