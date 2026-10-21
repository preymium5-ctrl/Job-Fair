# Homepage social and work abroad strips

The homepage includes a continuous CSS marquee in
`components/home/CommunityMarquees.tsx`, after the introduction. It shows social
platform icons. Facebook links to `https://www.facebook.com/profile.php?id=61560913240742`
and TikTok links to `https://www.tiktok.com/@jobsincroatiaa`; both open in a new tab.
The remaining platforms are decorative until profile URLs are supplied.
Instagram and IG are represented by one icon.

Motion pauses on hover or focus. Keyboard focus reveals a static, wrapping list,
and repeated links stay out of the tab order. The visible pause button was removed at the site owner's
request. Reduced-motion
preferences show a static, wrapping layout with repeated artwork hidden.

## Social artwork

Facebook, Instagram, TikTok, Threads, X and Reddit SVGs are from
[Simple Icons](https://github.com/simple-icons/simple-icons), pinned to commit
`4d29a35c954699b389a834aacc97dd6e7e74143c`.
Files are stored in `public/images/social/`; the upstream CC0 license is retained
as `public/images/social/LICENSE.md`. Brand names and marks remain the property
of their owners. The generic Forums icon uses the existing Lucide library.

The `*-color.svg` variants preserve the source paths and apply platform colors:
Facebook blue, Instagram's multicolor gradient, TikTok's cyan/pink/black treatment,
and Reddit orange. Threads and X retain their black marks. X has a screen-reader
label instead of repeating the visible X next to its logo.

Add actual profile URLs before turning these decorative platform items into
social-profile links or adding them to SEO `sameAs` metadata.

## Work abroad logos

The homepage also includes all 58 logos from the
[VideoWorkers homepage](https://videoworkers.com/) section titled
“Partnerships and useful links for work abroad”, checked on 21 October 2026.
They appear in two continuously scrolling rows below the social platforms,
using the same animation and direction. The longer logo track has a longer
duration to keep its travel speed close to the social strip.

`data/work-abroad-logos.ts` records every name, original image URL, local path,
intrinsic dimensions, and destination in source order. All source homepage
logos link to the [partnership and support directory](https://videoworkers.com/partnership-and-support/);
the local cards preserve that behavior and open in a new tab.

The original artwork is saved as optimized WebP files under
`public/images/organizations/work-abroad/`, totaling approximately 499 KiB.
Excess outside margins were trimmed, colours and aspect ratios were retained,
and each image was resized to fit within 480 × 240 pixels without enlargement.
All 58 output files were decoded and visually checked. Brand marks remain the
property of their respective owners.

The logo strip shares hover/focus pause, keyboard wrapping, hidden duplicate
links, and a static reduced-motion layout with the social strip.
