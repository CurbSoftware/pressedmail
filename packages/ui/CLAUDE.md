
<!-- pressedmail-test-runner-policy -->

PressedMail WP unit tests and heavy website/plugin builds follow the required
[capped SSH runner policy](../../docs/operations/PRESSEDMAIL-TEST-VM.md). Use routed tests first, then capped build jobs when needed. The full release verification matrix runs on the capped verify VM, and Docker-based audit cells, PMQA lab runs and dashboard database tests on the capped docker VM.
Missing runner setup must stop a job rather than move it onto the host.
VM setup uses focused checks; full suites and release gates need a separate task.

@AGENTS.md

Follow the imported scoped guide and the current user task. Do not run broad tests, release gates, repository-wide cleanup, or unrelated work unless explicitly requested.
