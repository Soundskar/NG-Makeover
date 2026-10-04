# Adding photos and videos to the portfolio

Everything in the portfolio comes from one file: `js/portfolio-data.js`.
It drives the home page hero slideshow, the "Every bride, her own look"
strip, and the filterable grid on `portfolio.html`. You never edit the
HTML to add a look. Add the files, add one entry, save, and push.

## Adding a photo (5 minutes)

1. **Pick the shot.** Portrait (tall) photos work best. The site crops them
   into arch frames, so keep the face in the top third of the photo.
2. **Make two sizes** at [squoosh.app](https://squoosh.app), which is free
   and runs in the browser:
   - Full size: resize to **1200 px wide**, format **WebP**, quality **80**.
     This is what opens in the viewer.
   - Thumbnail: resize to **640 px wide**, WebP, quality **75**.
     This is what the grid and strip show.
3. **Name and save them** into `assets/img/`, for example
   `mehendi-anaya.webp` and `mehendi-anaya-sm.webp`. Use lowercase with dashes and no spaces.
4. **Add an entry** to `js/portfolio-data.js` (copy an existing block):

   ```js
   {
     id: 'mehendi-anaya',
     type: 'photo',
     src: 'assets/img/mehendi-anaya.webp',
     thumb: 'assets/img/mehendi-anaya-sm.webp',
     style: 'Floral',
     title: 'Mehendi in marigold',
     alt: 'Bride in a yellow lehenga with marigold floral jewellery',
     focus: 'center 20%',
     home: true
   },
   ```

   - `style` becomes a filter button automatically. A new word (for example
     `'Reception'`) creates a new filter with its own count.
   - `focus` decides what survives the crop. Raise the % if the face is lower in the photo.
   - `home: true` adds it to the home page strip. `hero: true` adds it to
     the big arch slideshow at the top (3 to 5 hero looks is plenty).
   - `alt` should say what is in the photo, plainly. Screen readers read it
     out, and Google Images uses it to find the photo.
   - Optional `details: 'Airbrush · MAC · Reception'` shows a line in the viewer.
5. **Order matters:** looks appear in the same order as the list, so put your best work first.

## Adding a short video

Short vertical clips are the most captivating thing you can add: a bride
turning to camera, a slow pan down the jewellery, the dupatta drop.

**Shoot:** vertical (9:16), 6 to 15 seconds, steady phone, good light, no
music needed (previews play muted).

**Export** at 720 × 1280, MP4 (H.264), under about 3 MB:

- **HandBrake** (free): open the clip; on the *Dimensions* tab set the width
  to 720 (the height follows); on the *Video* tab use H.264 with quality
  around RF 26; tick *Web Optimized*; then start the encode.
- **CapCut / InShot:** export at 720p, 30 fps, lowest bitrate that still looks clean.
- **ffmpeg** (if installed):
  ```bash
  ffmpeg -i input.mov -vf "scale=720:-2" -c:v libx264 -crf 26 -preset slow -an -movflags +faststart haldi-reel.mp4
  ```

**Cover image:** take a still from the clip (screenshot the best frame),
resize to 640 px wide WebP. It shows before the video loads.

Save the video to `assets/video/` (create the folder) and add:

```js
{
  id: 'haldi-reel',
  type: 'video',
  src: 'assets/video/haldi-reel.mp4',
  thumb: 'assets/video/haldi-reel.webp',
  style: 'Floral',
  title: 'Haldi morning',
  alt: 'Short video of a bride in floral jewellery turning to the camera',
  home: true
},
```

How it behaves:
- In the strip and grid, videos play **silently on loop only while on screen**
  and pause when scrolled away. They never play for visitors with "reduce
  motion" or data saver turned on.
- Tapping opens the viewer with sound and controls.
- A "Video" badge marks it, and a "Videos" filter appears on the portfolio page.

**Keep the site fast:** about 3 MB per clip and 8 to 10 clips in total. For anything
longer (a full bridal film), upload it to YouTube as *Unlisted* and link to
it, rather than putting it in the repo.

## Adding a before and after

This is the single most convincing thing a makeup artist can show. The
viewer turns it into a drag-to-compare slider.

The two photos must match: **same pose, same distance, same light, same
framing**. Shoot the "before" in the studio chair right before you start,
and the "after" in the same spot before she stands up. Export both at the
same size (1200 px wide), then add `before:` to the entry:

```js
{
  id: 'red-transformation',
  type: 'photo',
  src: 'assets/img/red-after.webp',
  thumb: 'assets/img/red-after-sm.webp',
  before: 'assets/img/red-before.webp',
  style: 'Classic red',
  title: 'Classic red, before and after',
  alt: 'The same bride before and after her wedding makeup'
},
```

A "Before / after" badge and filter appear automatically.

Always get the bride's written OK (a WhatsApp message counts) before
posting her photos, and especially before and after photos.

## Photos that sell the studio

The site promises "studio-only, controlled lighting", so the photos
should prove it:

- **One backdrop, one light setup.** The same wall, curtain or arch in
  every studio shot makes the portfolio look like a brand, not a camera
  roll. Clear out anything in frame (AC units, cables, buildings).
- **Daylight-balanced light** (a large softbox or a window) so reds and
  golds look true. Skin tone accuracy is what brides check first.
- **Two shots per bride:** one close-up (eyes, base, jewellery) and one
  full length (outfit, drape, hair). The close-up proves the skill; the
  full length sells the look.
- **No beauty filters.** Brides compare your portfolio with real photos
  from friends' weddings. Unfiltered work is what earns trust.
- **Variety over volume:** 20 to 30 strong looks across different skin
  tones, functions (haldi, mehendi, wedding, reception) and styles beat
  80 similar ones.

## Publishing

After adding files and entries, commit and push from the project folder:

```bash
git add -A
```

```bash
git commit -m "Add new portfolio looks"
```

```bash
git push
```

Vercel redeploys the live site automatically within a minute or two.
