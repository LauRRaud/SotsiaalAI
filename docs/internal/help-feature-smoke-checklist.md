# Help Feature Smoke Checklist

Date: 2026-03-07

Use this checklist before calling the help request / help offer feature ready
for production on the chat page.

## 1. Chat-native mode confirmation

1. Open `/vestlus`.
2. Write a natural help message such as:
   - `Mul oleks vaja emale abi poes kaimiseks.`
3. Verify the first assistant reply is a natural mode-confirmation question, not
   an immediate save flow.
4. Verify the wording is user-facing:
   - no mention of `RAG`
   - no technical mode names
5. Reply `jah`.
6. Verify the help workflow starts only after that confirmation.

Repeat for:

- `Soovin pakkuda transporti Tabasalus.`
- `Koosta mulle vallale aruanne.`
- `Mul oleks vaja infot koduhoolduse kohta meie vallas.`

## 2. Chat-native creation

1. Open `/vestlus`.
2. Write a natural request message such as:
   - `Mul oleks vaja emale abi poes kaimiseks.`
3. Reply `jah` to the mode-confirmation question.
4. Verify the chat starts a help-request workflow instead of a generic answer.
5. Verify only missing fields are asked.
6. Verify a confirmation summary is shown before save.
7. Confirm save by writing `jah` or `salvesta`.
8. Verify the success reply appears in the same conversation.

Repeat for help offer:

1. Write:
   - `Soovin pakkuda transporti Tallinnas.`
2. Reply `jah` to the mode-confirmation question.
3. Verify the offer workflow starts inside the same chat.
4. Verify confirmation happens before save.
5. Verify save confirmation is plain chat text, not buttons or modal UI.

## 3. Location normalization

1. Start a request with a smaller place name:
   - `Mul oleks vaja abi Tabasalus.`
2. Verify the system normalizes it to the correct municipality.
3. If confidence is lower, verify it asks for confirmation.
4. Verify the saved structured location is `municipalityId`, not raw text.

## 4. Field extraction boundaries

1. Start a help offer draft where the place is still missing.
2. When asked who the help is meant for, answer:
   - `eakad ja puudega inimesed`
3. Verify this answer fills target group, not location.
4. Verify the next question still asks where help is offered.
5. Start a help offer that already has category and target group.
6. When asked about timing, answer:
   - `saan aidata dokumentidega teisipaeva ohtuti`
7. Verify timing is captured, but category and target group are not overwritten.

## 5. Optional nano extraction

This feature is off by default.

1. Verify normal help workflow still works without:
   - `HELP_WORKFLOW_AI_EXTRACTOR`
2. Enable:
   - `HELP_WORKFLOW_AI_EXTRACTOR=1`
   - `HELP_WORKFLOW_EXTRACTOR_MODEL=gpt-5.4-nano`
3. Verify the workflow still starts with deterministic extraction.
4. Verify the optional model patch can improve structured fields before the
   next question.
5. Verify failures are non-blocking:
   - remove or invalidate `OPENAI_API_KEY`
   - confirm the deterministic workflow still continues
6. Verify nano patching does not alter fields unrelated to the active question.

## 6. Structured persistence

1. Create and save a help request.
2. Verify request details are saved as structured fields where applicable:
   - beneficiary label
   - urgency
   - availability/start
   - compensation details
   - conditions
   - skills/background
3. Create and save a help offer.
4. Verify offer details are saved as structured fields where applicable:
   - provider scope/conditions
   - availability/start
   - compensation details
   - conditions
   - skills/background
5. Verify existing listing views still show readable descriptions and summaries.

## 7. Trigger boundaries

1. Write an info-seeking message such as:
   - `Mul oleks vaja infot koduhoolduse kohta meie koduvallas.`
2. Verify the assistant suggests `information and guidance`, not a help listing.
3. Reply `jah`.
4. Verify the response stays in info/guidance flow and does not start a
   help-offer or help-request draft.

Repeat for:

- `Kas tugiisik voiks olla KOV teenus voi peaksin ise otsima?`
- `Elan selles kohalikus omavalitsuses ja vajan infot abi saamiseks.`

## 8. LeftRail global browse

1. Open global `help requests` from LeftRail.
2. Verify listings are loaded from DB, not hardcoded.
3. Verify around 10 items load initially.
4. Verify `load more` loads more records.
5. Select one listing.
6. Verify its context opens in the chat area.

Repeat for LeftRail `help offers`.

## 9. RightRail personal workspace

1. Open `my help requests` from RightRail.
2. Verify only signed-in user listings are shown.
3. Select one listing.
4. Verify selected listing context opens in the chat area.
5. Verify `edit`, `close`, and `delete` work.

Repeat for `my help offers`.

Important:

- verify `Add people` still remains in RightRail
- verify it still opens the existing group-chat invite flow

## 10. Selected listing context

1. Open a global listing you do not own.
2. Verify the detail view is human-readable, not a raw DB dump.
3. Verify it shows:
   - title
   - summary / description
   - category
   - municipality
   - help type
   - time type
   - role label
   - target groups
   - status
4. Verify `Ask AI`, `Contact`, or `Offer help` actions are available as expected.

## 11. Matching and Room continuation

1. Open a request and choose one of your own offers, or vice versa.
2. Trigger explicit connect action.
3. Verify a `HelpMatch` is created only at this point.
4. Verify a `Room` is created or reused.
5. Verify the user lands in `/room/[roomId]`.
6. Verify the matched pair can continue communication in that Room.

## 12. Language checks

Check in:

- `et`
- `en`
- `ru`

Verify for each language:

- mode-confirmation wording
- LeftRail help labels
- RightRail personal help labels
- listing panel actions
- selected listing context actions
- empty states
- edit / close / delete flows

## 13. Regression checks

1. Generic RAG answers still work in the same chat page.
2. Existing Room chat still works.
3. `Add people` still works.
4. Document workflow still starts from the main chat when relevant, but only
   after a natural mode-confirmation question.
5. Profile page remains account/settings-focused and does not become the main
   listing-management surface.
