# Homepage social strip

The homepage includes a continuous CSS marquee in
`components/home/CommunityMarquees.tsx`, after the introduction. It shows social
platform icons; these are intentionally not links because the site has no social
profiles yet. Instagram and IG are represented by one icon.

Motion pauses on hover. The visible pause button was removed at the site owner's
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
