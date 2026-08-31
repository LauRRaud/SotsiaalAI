"""Exercise the two actual search projection expressions without starting RAG.

This proves output provenance, not HTTP/runtime or index health.
"""
import ast
from pathlib import Path
import unittest


class SearchVersionProjection(unittest.TestCase):
    def test_shared_and_dense_keep_only_the_stored_version(self):
        tree = ast.parse((Path(__file__).resolve().parents[2] / "rag-service/main.py").read_text(encoding="utf-8"))
        shared = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "_search_result_from_metadata")
        shared_dict = next(node.value for node in shared.body if isinstance(node, ast.Return))
        search = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "_execute_search")
        dense = next(node for node in ast.walk(search) if isinstance(node, ast.Dict) and any(
            isinstance(key, ast.Constant) and key.value == "global_dense_rank" for key in node.keys))
        for expression in [shared_dict, dense]:
            for version in ["stored-version-17", None]:
                with self.subTest(projection="shared" if expression is shared_dict else "dense", version=version):
                    metadata = {"doc_id": "fixture-doc", "source_id": "fixture-source", "is_current_version": False}
                    if version is not None:
                        metadata["document_version"] = version
                    scope = dict(md=metadata, item_id="chunk", _id="chunk", primary_channel="dense",
                                 retrieval_channels=["dense"], rank=1, lexical_score=None, lexical_details=None,
                                 authors_val=[], tags_val=[], tag_tokens_val=[], document="body", ch="body",
                                 distance=0.1, dists=[0.1], i=0, issue_val=None, file_name=None)
                    result = eval(compile(ast.Expression(expression), "search-projection", "eval"), scope)
                    self.assertEqual(result["document_version"], version)
                    self.assertIs(result["is_current_version"], False)
                    self.assertEqual(result["source_id"], "fixture-source")
                    self.assertEqual(result["doc_id"], "fixture-doc")


if __name__ == "__main__":
    unittest.main()
