# ResumeMatch AI

Tailor your resume to the role — without compromising the truth.

A single-page app that analyses a job description against your resume, maps requirements to real evidence, shows a before/after alignment analysis, and produces an ATS-friendly tailored resume without fabricating experience.

## Features
- Requirement-to-evidence mapping (Strong / Partial / Evidence Missing / Not a Match)
- Transparent, code-computed alignment scores
- Gap analysis with user confirmation of missing experience
- Multi-stage pipeline: analyse, tailor, validate, auto-regenerate
- Change log with reasons; editable plain-text ATS-safe output

## Technology
Self-contained HTML/CSS/JavaScript (`index.html`). AI calls go through a single `provider.json()` function so the model provider can be swapped.

## Local setup
Open `index.html` in a browser. No install or build step. AI features rely on the Claude artifact runtime (`claude.use("sample")`); outside it, replace `provider.json()` with a call to your own backend.

## Environment variables
None are required by the current code. If you add a backend provider, copy the template and supply your own credentials:

```bash
cp .env.example .env.local
```

Never commit real credentials.

## Commands
No development, build or test commands yet.
