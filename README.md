# artwork

A Pinterest-style gallery of realist and romantic landscape paintings — Hudson River School, Russian Realism, and similar work suited for large wall pieces (8×6 ft and up).

**Live site:** https://trevsm.github.io/bulma-social/

Pages deploys automatically via GitHub Actions on every push to `main` or `master`. If the site 404s on first setup, go to [Settings → Pages](https://github.com/trevsm/bulma-social/settings/pages) and set **Source** to either **GitHub Actions** or **Deploy from branch → `gh-pages` / root**.

## Add images

All images are listed in **`data/artworks.json`**. To add one:

1. **Optional:** Drop your image file in the `images/` folder (e.g. `images/my-painting.jpg`).
2. Add an entry to `data/artworks.json`:

```json
{
  "src": "images/my-painting.jpg",
  "title": "Forest at Dawn",
  "artist": "Your Name",
  "year": 2024,
  "professional": false,
  "style": "Russian Realism"
}
```

Or use an external URL for `src`:

```json
{
  "src": "https://example.com/photo.jpg",
  "title": "Mountain Lake",
  "artist": "Unknown",
  "professional": false
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `src` | Yes | Path to local file (`images/...`) or full image URL |
| `title` | Yes | Painting title |
| `artist` | Yes | Artist name |
| `year` | No | Year painted |
| `professional` | No | `true` shows a **Professional** chip (top-left). Omit or `false` for amateur/other |
| `style` | No | Used for filter buttons (e.g. `Hudson River School`, `Russian Realism`) |

3. Commit and push to `main`. GitHub Pages will update automatically.

## Local preview

```sh
python3 -m http.server 8080
```

Open http://localhost:8080

## Art style

This collection focuses on **naturalistic, representational landscape painting** — the kind of work that reads well at large scale on a wall:

- **Hudson River School** — Thomas Cole, Frederic Church, Albert Bierstadt, Asher Durand
- **Russian Realism** — Ivan Shishkin, Isaac Levitan, Alexei Savrasov, Arkhip Kuindzhi
- **Related** — John Constable, Caspar David Friedrich, Corot, Winslow Homer

Not modern or abstract — paintings that feel true to what they depict.
