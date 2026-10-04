// Namita Garg Makeover, portfolio content.
// Every look on the home page strip, the hero slideshow and the
// portfolio page comes from this list. To add a look, copy a block,
// change the details and save. PORTFOLIO.md explains image and video sizes.
//
//   id      unique name, lowercase with dashes (used in links)
//   type    'photo' or 'video'
//   src     full-size photo (1200px wide) or the video file (.mp4)
//   thumb   small photo (640px wide); for a video, its cover image
//   before  optional "before" photo, same size and framing as src;
//           adds a drag-to-compare slider in the viewer
//   style   the filter it appears under on the portfolio page
//   title   short name shown under the look
//   alt     what the photo shows, for screen readers and Google Images
//   focus   which part of the photo to keep when it is cropped
//           ('center 20%' keeps the face near the top in view)
//   home    true = show in the strip on the home page
//   hero    true = part of the home page hero slideshow
//   details optional line shown in the viewer (finish, products, function)

window.NGM_PORTFOLIO = [
  {
    id: 'ivory-silver',
    type: 'photo',
    src: 'assets/img/look-03.webp',
    thumb: 'assets/img/look-03-sm.webp',
    style: 'Ivory',
    title: 'Ivory and silver',
    alt: 'Bride in an ivory lehenga and net dupatta with silver jewellery, a nath and a long braided paranda',
    focus: 'center 14%',
    home: true,
    hero: true
  },
  {
    id: 'maroon-velvet',
    type: 'photo',
    src: 'assets/img/look-01.webp',
    thumb: 'assets/img/look-01-sm.webp',
    style: 'Classic red',
    title: 'Maroon velvet and kundan',
    alt: 'Bride in a maroon velvet lehenga and red dupatta, wearing gold kundan jewellery and a matha patti',
    focus: 'center 16%',
    home: true,
    hero: true
  },
  {
    id: 'floral-umbrella',
    type: 'photo',
    src: 'assets/img/look-07.webp',
    thumb: 'assets/img/look-07-sm.webp',
    style: 'Floral',
    title: 'Floral jewellery',
    alt: 'Bride in an ivory lehenga and pink mirror-work blouse with floral jewellery, standing under a sheer umbrella',
    focus: 'center 22%',
    home: true
  },
  {
    id: 'classic-red',
    type: 'photo',
    src: 'assets/img/look-06.webp',
    thumb: 'assets/img/look-06-sm.webp',
    style: 'Classic red',
    title: 'Classic red bridal',
    alt: 'Close-up of a bride in red with a large maang tikka, a nath and layered kundan necklaces',
    focus: 'center 12%',
    home: true,
    hero: true
  },
  {
    id: 'ivory-portrait',
    type: 'photo',
    src: 'assets/img/look-04.webp',
    thumb: 'assets/img/look-04-sm.webp',
    style: 'Ivory',
    title: 'Ivory, portrait',
    alt: 'Portrait of the ivory bride smiling, with silver jewellery and a nath',
    focus: 'center 14%',
    home: true
  },
  {
    id: 'floral-terrace',
    type: 'photo',
    src: 'assets/img/look-08.webp',
    thumb: 'assets/img/look-08-sm.webp',
    style: 'Floral',
    title: 'Floral, in daylight',
    alt: 'Bride in floral jewellery and a pink mirror-work outfit, photographed outdoors in daylight',
    focus: 'center 16%',
    home: true,
    hero: true
  },
  {
    id: 'maroon-closeup',
    type: 'photo',
    src: 'assets/img/look-02.webp',
    thumb: 'assets/img/look-02-sm.webp',
    style: 'Classic red',
    title: 'Maroon velvet, close-up',
    alt: 'Close-up of the maroon velvet bride showing the eye makeup, kundan necklace and matha patti',
    focus: 'center 14%',
    home: true
  },
  {
    id: 'ivory-eyes',
    type: 'photo',
    src: 'assets/img/look-05.webp',
    thumb: 'assets/img/look-05-sm.webp',
    style: 'Ivory',
    title: 'Ivory, eyes down',
    alt: 'The ivory bride looking down, showing the eyelid makeup and silver jewellery',
    focus: 'center 14%'
  },
  {
    id: 'floral-full',
    type: 'photo',
    src: 'assets/img/look-09.webp',
    thumb: 'assets/img/look-09-sm.webp',
    style: 'Floral',
    title: 'Floral, full length',
    alt: 'Full-length photo of the bride in floral jewellery, a pink blouse and an ivory lehenga',
    focus: 'center 18%'
  },
  {
    id: 'floral-portrait',
    type: 'photo',
    src: 'assets/img/look-10.webp',
    thumb: 'assets/img/look-10-sm.webp',
    style: 'Floral',
    title: 'Floral, portrait',
    alt: 'Indoor portrait of the bride in floral jewellery and a pink mirror-work outfit',
    focus: 'center 18%'
  },

  // A short video looks like this (see PORTFOLIO.md):
  // {
  //   id: 'haldi-reel',
  //   type: 'video',
  //   src: 'assets/video/haldi-reel.mp4',
  //   thumb: 'assets/video/haldi-reel.webp',
  //   style: 'Floral',
  //   title: 'Haldi morning',
  //   alt: 'Short video of a bride in floral jewellery turning to the camera',
  //   home: true
  // },
  //
  // A before and after looks like this:
  // {
  //   id: 'red-transformation',
  //   type: 'photo',
  //   src: 'assets/img/red-after.webp',
  //   thumb: 'assets/img/red-after-sm.webp',
  //   before: 'assets/img/red-before.webp',
  //   style: 'Classic red',
  //   title: 'Classic red, before and after',
  //   alt: 'The same bride before and after her wedding makeup'
  // },
];
