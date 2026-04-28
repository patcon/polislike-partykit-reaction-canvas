# Event Preview Deployments

Event previews let you spin up a clean, unbranded URL for a single event — no index listing, no GitHub corner, no tool name in the page source. Closing the GitHub issue tears the URL down.

## How it works

1. A GitHub issue labeled `event-preview` triggers a deploy to a **secondary, secret PartyKit project**.
2. The deployed `index.html` is the full React app shell, patched to open directly on the configured hash route (default `#v4`) with the title set to `App`.
3. The GitHub corner is compiled out of the JS bundle for event builds — it can't be revealed by removing a URL param.
4. Closing the issue tears down the preview and redacts the URL from the deployment comment.

The secondary project name lives only in a GitHub secret — it never appears in source code.

## One-time setup

### 1. Create the secondary PartyKit project

The project is created automatically the first time the workflow deploys a preview. No manual bootstrap needed — just add the secrets below and trigger the workflow.

If the first deploy fails with a "project not found" error, bootstrap it once from your workstation:

```bash
PARTYKIT_LOGIN=patcon npx partykit deploy --name YOUR_SECRET_PROJECT_NAME
```

You can then ignore the base URL (`YOUR_SECRET_PROJECT_NAME.patcon.partykit.dev`) — nothing is ever deployed there intentionally.

### 2. Add GitHub secrets

Go to **Settings → Secrets and variables → Actions** in the repo and add:

| Secret | Value |
|---|---|
| `PARTYKIT_EVENT_PROJECT` | Your secret PartyKit project name (e.g. `mighty-beaver`) |

The existing `PARTYKIT_TOKEN` and `PARTYKIT_LOGIN` secrets are reused — no changes needed.

### 3. Create the `event-preview` label

The label must exist before it can be applied to an issue. Create it once:

```bash
gh label create "event-preview" --color "0075ca" --description "Triggers a stealth event preview deployment"
```

## Deploying a preview

Open a GitHub issue with a fenced `config` block in the body:

~~~
```config
slug: myevent
hash: v4
```
~~~

Both fields are optional:

| Field | Default | Description |
|---|---|---|
| `slug` | `event-{issue-number}` | URL prefix for the preview |
| `hash` | `v4` | App route to open (e.g. `v4`, `v2`, `v1`) |

Then add the `event-preview` label. The workflow will deploy and post a comment with the preview URL:

```
https://{slug}.{PARTYKIT_EVENT_PROJECT}.patcon.partykit.dev
```

## Tearing down

Close the issue. The workflow will:

1. Delete the preview deployment from PartyKit.
2. Edit the deployment comment to replace the URL with `<link removed>`.
3. Post a "Event preview torn down." comment.

## What attendees see

- The page source shows a standard app shell with title `App` — no tool name, no description, no author meta tag.
- The GitHub corner (link to this repo) is absent from the JS bundle entirely for event builds.
- The room is always `default`, so there is nothing in the URL that identifies the tool.

## Troubleshooting

**Workflow fails on deploy with "project not found"** — The PartyKit project doesn't exist yet. Bootstrap it once manually (see step 1 above).

**Workflow fails on delete with "Unrecognized key"** — `partykit delete` does not support `--config`. The workflow works around this by patching `partykit.json` in-place before running delete. If you see this error it means the workaround regressed — check the `Delete event preview` step in the workflow.

**Preview URL 404s immediately after deploy** — PartyKit preview propagation can take a few seconds. Wait and refresh.
