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
| Name | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required for AI features outside claude.ai. Set it in Vercel: Project Settings, Environment Variables. |
| `ANTHROPIC_MODEL` | Optional model override. |

For local development with `vercel dev`:

```bash
cp .env.example .env.local
```

Then add your own key. Never commit real credentials.

## API key without server configuration
Outside claude.ai, each user pastes their own Anthropic API key into step 3. It is stored in that browser (localStorage) and sent only to api.anthropic.com. Never hardcode a key in this repo: it is public and any key shipped in the page can be read by anyone.

## Deployment
Deploy on Vercel with no build step. `api/complete.js` makes the server-side AI call. Inside claude.ai the app uses the artifact runtime instead.
