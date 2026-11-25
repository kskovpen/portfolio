# Editing the site

## Writing a blog post (the simple way)

Double-click **Write a Post** on the Desktop (the app lives in ~/Applications; its source is the
private repository github.com/kskovpen/post-editor). It opens your posts in its own window, with a
live preview of the site.

- **Title**, **date**, then the text. Formatting buttons are above the text box; ⌘B / ⌘I / ⌘K work too.
- **Photos**: drag them (or paste, or "Photos…") into the text where they should appear.
  iPhone HEIC is converted, photos are shrunk and their location data removed.
  `![Caption](photo.jpg)` — what you type between the brackets becomes the caption.
  Photos are **never stored on GitHub**: the originals stay in `photos/` on this Mac (git-ignored)
  and web versions go to Cloudflare R2 (photos.kirillskovpen.com) when you publish.
- **Also show on**: tick Running, Travel, Music, … and the post is listed under
  "From the blog" on those pages (in every language), and linked from the post itself.
- **Tags** and **Summary** are optional.
- **Language**: EN / FR / NL / RU switch to the other versions of the same post.
- Everything is **saved automatically** on this Mac. Drafts are only visible in the preview.
- **Publish online** (⇧⌘P) sends exactly this post to GitHub; Cloudflare updates the site in about a
  minute. Other unpublished changes on this Mac are not sent along.
- **Delete…** moves a post to the Trash (and removes it from the website if it was online).

First time only: **Settings** (⌘,) → connect the photo storage (the steps are listed there).

No Claude needed for any of this.

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
Cloudflare Pages rebuilds and publishes in about a minute: https://kirillskovpen.pages.dev
Batch your changes and push when a piece of work is finished.
