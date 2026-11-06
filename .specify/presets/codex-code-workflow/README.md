# Codex Code Workflow preset

This project-local preset adds agreed task boundaries, test-first planning, and Red → Green → Refactor tasks to Spec Kit. In this project it also captures the epic branch, spec commit, documentation, and manual PR rules. It does not choose a programming language, framework, or product architecture.

From an initialized project's directory, run:

```powershell
specify preset add --dev "C:\path\to\codex-speckit-workflow\preset"
specify preset resolve tasks-template
```

Replace the sample path with the location of your copy. `--dev` installs from a local directory. If the source preset changes, verify your CLI version and source before using `specify preset update codex-code-workflow --dev "...\preset"`. The [main README](../README.md) explains the full installation with the extension and `AGENTS.md`.

This preset changes `tasks-template` and adds instructions to `speckit.specify`, `speckit.plan`, `speckit.tasks`, and `speckit.implement`. Other templates and commands remain part of the official Spec Kit. The standard analyze pass remains read-only; the agent saves its full output to `analysis.md` in a separate action under the project `AGENTS.md` rules.
