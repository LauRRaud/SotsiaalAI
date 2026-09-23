# Snowball 3.1.1

Generated JavaScript: base runtime and Estonian, English, Russian stemmers.
Algorithms unchanged; trailing blank lines removed for repository whitespace checks.
Source: https://snowballstem.org/dist/jsstemmer-3.1.1.tar.gz
Archive SHA-256: `793c5a4063de2a4cf6601b5a89bdef19a7655318fdd35eeb30c00c4d6a24b8db`.
License: [BSD-3-Clause](COPYING), retained verbatim.

Used only by the server-side lexical search adapter. These are algorithmic word
stems, not linguistic lemmas, translations, eligibility rules or source evidence.
Upgrade together with the versioned lexical index contract; existing generations
must never silently change their analysis rules.
