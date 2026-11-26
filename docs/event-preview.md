# Event Preview Deployments

Event previews let you spin up a clean, unbranded URL for a single event — no index listing, no GitHub corner, no tool name in the page source. Closing the GitHub issue tears the URL down.

## How it works

> **Currently disabled.** The issue trigger in `.github/workflows/event-preview.yml` is commented out (only `workflow_dispatch` remains). Uncomment the `issues` trigger to re-enable.

1. A GitHub issue labeled `event-preview` triggers a deploy of a **separate Cloudflare Worker** named `<secret prefix>-<slug>`.
2. The deployed `index.html` is the full React app shell, patched to open directly on the configured hash route (default `#v4`) with the title set to `App`.
3. The GitHub corner is compiled out of the JS bundle for event builds — it can't be revealed by removing a URL param.
4. Closing the issue tears down the preview and redacts the URL from the deployment comment.

The worker name prefix lives only in a GitHub secret — it never appears in source code.

## One-time setup

### 1. Add GitHub secrets

Go to **Settings → Secrets and variables → Actions** in the repo and add:

| Secret | Value |
|---|---|
| `PARTYKIT_EVENT_PROJECT` | Secret worker-name prefix (e.g. `mighty-beaver`). Lowercase letters, digits and dashes only. The name is historical; it no longer refers to a PartyKit project. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | *Optional.* Copied onto each event worker so the bat signal works there. If unset, the preview deploys without it. |

The `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets used by the other deploy workflows are reused. No bootstrap is needed: `wrangler deploy` creates the worker on first deploy.

### 2. Create the `event-preview` label

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
| `slug` | `event-{issue-number}` | URL suffix for the preview (lowercased; other characters become `-`) |
| `hash` | `v4` | App route to open (e.g. `v4`, `v2`, `v1`) |

Then add the `event-preview` label. The workflow will deploy and post a comment with the preview URL:

```
https://{PARTYKIT_EVENT_PROJECT}-{slug}.patcon.workers.dev
```

## Tearing down

Close the issue. The workflow will:

1. Delete the event worker (`wrangler delete`), including its Durable Object data.
2. Edit the deployment comment to replace the URL with `<link removed>`.
3. Post a "Event preview torn down." comment.

## What attendees see

- The page source shows a standard app shell with title `App` — no tool name, no description, no author meta tag.
- The GitHub corner (link to this repo) is absent from the JS bundle entirely for event builds.
- The room is always `default`, so there is nothing in the URL that identifies the tool.

## Troubleshooting

**Deploy fails with an invalid worker name** — the prefix plus slug must be lowercase letters, digits and dashes, at most 63 characters. Check the `PARTYKIT_EVENT_PROJECT` secret.

**Preview URL 404s immediately after deploy** — a brand-new `workers.dev` hostname can take a little while to start resolving. The workflow polls until it returns 200.
