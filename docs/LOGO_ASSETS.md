# Homepage logo and social strips

The homepage includes two continuous CSS marquees in
`components/home/CommunityMarquees.tsx`, after the introduction. The first shows
the two organizations requested by the site owner. The second shows social
platform icons; these are intentionally not links because the site has no social
profiles yet. Instagram and IG are represented by one icon.

Motion pauses on hover. The visible pause button was removed at the site owner's
request. Reduced-motion
preferences show a static, wrapping layout with repeated artwork hidden.

## Organization artwork

- **Humble Hunters**: the inline SVG wordmark from https://humble-hunters.com/,
  retrieved 16 October 2026. The original white lettering is changed to ink for
  this light background; the paths and orange-red mark are preserved.
  Local asset: `public/images/organizations/humble-hunters.svg`.
- **Philippine Institute of Welding Technology Incorporated**: seal from
  https://www.philippineinstituteofwelding.com/images/brand/piwti-seal.webp,
  retrieved 16 October 2026, preserved as supplied.
  Local asset: `public/images/organizations/piwti-seal.webp`.

Organization marks belong to their respective owners. The strip does not add
accreditation or employer-offer claims.

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
