---
tags: []
data-folders: [Design]
---
# Home · lethal-chess

## Start here
- [[Now]] — what is in progress, what is next, open questions. Read this first.
- [[System Map]] — architecture as built.
- [[Index]] — generated list of every note with its status.
- [[Data sources]] — what data exists for classification, all verified.

## Vision

**A tool for drilling chess, starting with openings.** Not a course, not an analysis board — a
training loop. You meet a position, you play the move, you find out immediately whether you were
right, and the system decides when you see it again. The goal is *instinctive recall* of a
repertoire, not knowledge that you can only reconstruct slowly.

This is a **deliberate narrowing** of the earlier "Chess Lethality Visualizer" concept (see
[[Lineage — from lethality analyzer to drilling tool]]). That project's premise — that the
interesting signal is *how humans actually fail*, not what the engine prefers — is still the
long-term differentiator, and its scoring pipeline still exists in `../chess-lethality-analyzer`.
But it is parked. First build the thing that is useful to one person every day.

## Data folders

`Design/` hold project data, not planning notes; they are exempt from the note rules below.

## How this vault works
| Folder | Holds | Written how |
|---|---|---|
| `Features/` | one note per feature: spec + as built | rewritten in place, bump `updated` |
| `Decisions/` | one note per decision, `YYYY-MM-DD title` | immutable; a reversal is a new note that supersedes |
| `Research/` | audits, plans, investigations, brainstorms, dated | `status:` says whether it is still live |
| `Daily Logs/` | what was done, broke, was learned, one note per day | append-only |
| `Concepts/`, `Tech/` | evergreen explanations | rewritten in place |

- A **decision** is a choice between alternatives that constrains future work. Everything else is a **log** entry.
- Status lives in the `status:` property only. Tags are topics only. The folder is the type.
- Links must resolve inside this vault. To-dos go in [[Now]].
- End of session: append to today's log, overwrite [[Now]], run `vault-check`.
