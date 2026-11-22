# Editing the site

## 1. Start the preview
```
cd ~/Sites/portfolio
./dev.sh
```
Open http://localhost:1313. The preview refreshes by itself when you save a file.
It also shows drafts (`draft = true`); drafts are never published.
Stop it with Ctrl+C.

## 2. Add or change things

### With the editor (easiest)
With ./dev.sh running, open http://localhost:1313/admin/ in Chrome and click
**Work with Local Repository**, then choose the `~/Sites/portfolio` folder (Chrome asks once
for permission to edit it). Ignore the GitHub sign-in buttons.

- **Blog posts / Projects / Trips**: click **New**, fill in the fields, drag in photos, **Save**.
  The language switcher at the top of the form edits the EN / FR / NL / RU versions.
- **Lists → Talks**: add or edit talks.
- New posts and trips start as drafts: visible in the preview, not on the public site.
  Untick **Draft** when they are ready.
- Saving only changes files on this Mac. Publish with step 3 when you are done.

### By hand

| What | How |
|---|---|
| Blog post | `hugo new posts/my-topic/index.md`, write, set `draft = false` |
| Post photo | put `photo.jpg` in the post folder, then `{{< postimage "photo.jpg" "description" "Caption" >}}` |
| Translation of any page | copy `index.md` to `index.fr.md` / `index.nl.md` / `index.ru.md` in the same folder and translate |
| Project | `hugo new projects/name/index.md`; add `cover.jpg` or `icon.png`; other images become the gallery |
| Trip | `hugo new travel/2025-place/index.md`; fill `places`; add photos (`cover.jpg` + gallery). The map image is made by `./dev.sh` |
| Music | automatic from SoundCloud; optional entries with `hugo new music/name/index.md` |
| Talk | add an entry at the top of `data/talks.yaml` |
| Road race | add the Strava activity id to `data/races.yaml` (trail races come from UTMB automatically) |
| Race website / course | `data/race_events.yaml` |
| Paper on a research page | entry in `data/publications.yaml`, key in the page's `publications = [...]` |
| Profile links, menu, taglines | `hugo.toml` |
| Interface words (buttons, labels) | `themes/basic/i18n/en.toml`, `fr.toml`, `nl.toml`, `ru.toml` |

Running stats, shoes and UTMB results update by themselves every day; nothing to do.

## 3. Publish
```
git add -A
git commit -m "Short description of the change"
git push
```
Netlify rebuilds and publishes in about a minute: https://kskovpen.netlify.app
Batch your changes and push when a piece of work is finished.
