# Meelis EQ listening reference

Synthetic text: `Õues on soe ja päike paistab.` Voice `meelis`, speed 1,
from the public TartuNLP API on 2026-10-08. No user conversation content.

`meelis-oues-float32.wav` is the unmodified provider response (22050 Hz mono).
`meelis-oues-owner-eq-pcm16.wav` is the corresponding excerpt of the independently
rendered SciPy reference that the owner accepted as their final choice.
Ten peaking bands (Q 1.2): 80/-5, 160/-4.5, 315/-4, 630/-4.5, 1000/-6,
1600/-6, 2500/-8.5, 4000/-7.5, 6300/-8, 9000/-7 (Hz/dB).
There is no low-pass, gain normalization or added leading silence in the reference.

The production preparation test checks the full waveform within one PCM16 step,
in addition to the existing 300 ms leading silence. This locks the accepted
rendering; it does not prove the naturalness of arbitrary future TTS output.
