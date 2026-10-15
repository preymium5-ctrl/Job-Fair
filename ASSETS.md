# Jobs in Croatia asset provenance

Original stock assets downloaded and checked on 14 October 2026. Stock photographs and the new AI-generated role illustrations do not represent Jobs in Croatia staff, actual employers, partner organisations, or confirmed job locations. New job images generated on 15 October 2026 are documented below; original photo credits are retained for the hero, introduction, and archived example assets.

## Brand identity

The Jobs in Croatia wordmark and navy briefcase with a red checkerboard motif were created as original vector artwork on 16 October 2026. The shared website mark is in `components/ui/Brand.tsx`; the matching browser icon is in `app/icon.svg`.

## Photo licence

All photographs below are sourced from individual free photo pages on Pexels under the [Pexels licence](https://www.pexels.com/legal-pages/license/). Pexels permits use on websites and commercial projects, modification, and downloading. Attribution is appreciated but not mandatory. Restrictions include standalone resale or stock redistribution, using imagery as a trademark, offensive depictions, and implying endorsement by a depicted person or brand. The original photographers are credited here for traceability.

Verified against the [official licence guidance](https://help.pexels.com/hc/en-us/articles/360042295174-What-is-the-license-of-the-photos-and-videos-on-Pexels) and [commercial-use guidance](https://help.pexels.com/hc/en-us/articles/360042295214-Can-I-use-the-photos-and-videos-for-a-commercial-project).

The downloaded files use the Pexels CDN's compression and width parameters. Role photographs are at most 1,600 pixels wide; the hero is 2,400 pixels wide. Next.js Image provides responsive optimisation and lazy loading below the first viewport. No job photograph is reused for a different job. Industry tiles intentionally refer to the matching profession's image.

| Local file | Source / photographer | Subject and use |
| --- | --- | --- |
| `public/images/hero.jpg` | [Men Walking in a Warehouse — Tiger Lily](https://www.pexels.com/photo/men-walking-in-a-warehouse-4481323/) | Wide photograph of warehouse workers in motion. Homepage hero. |
| `public/images/intro.jpg` | [Man signinig on a Clipboard — Tima Miroshnichenko](https://www.pexels.com/photo/man-signinig-on-a-clipboard-6170090/) | Couriers coordinating paperwork in a warehouse. Introduction. |
| `public/images/jobs/warehouse-worker.jpg` | [Man Walking on a Warehouse — Tiger Lily](https://www.pexels.com/photo/man-walking-on-a-warehouse-4480793/) | Worker moving between racks and packages. Warehouse Worker. |
| `public/images/jobs/bus-driver.jpg` | [Bus Driver Navigating Busy Highway — Caleb Oquendo](https://www.pexels.com/photo/bus-driver-navigating-busy-highway-34612274/) | Bus driver at the wheel. Bus Driver. |
| `public/images/jobs/auto-mechanic.jpg` | [A Mechanic Working on a Car — Sergey Meshkov](https://www.pexels.com/photo/a-mechanic-working-on-a-car-8478226/) | Mechanic working on an engine. Auto Mechanic. |
| `public/images/jobs/carpenter.jpg` | [Man Working in a Carpentry — cottonbro studio](https://www.pexels.com/photo/man-working-in-a-carpentry-7480729/) | Carpenter preparing a precisely cut timber joint at a workshop bench. Carpenter. |
| `public/images/jobs/construction-worker.jpg` | [Man Wearing Hard Hat Standing — Life Of Pix](https://www.pexels.com/photo/man-wearing-hard-hat-standing-8159/) | Worker operating site equipment with hard hat, harness, and reflective vest. Construction Worker. |
| `public/images/jobs/production-line-worker.jpg` | [Textile Factory Workers in Production Line — EqualStock IN](https://www.pexels.com/photo/textile-factory-workers-in-production-line-32048365/) | Workers at a textile production line. Production Line Worker. |
| `public/images/jobs/hotel-housekeeper.jpg` | [Housekeepers Changing Sheets in Hotel Room — Liliana Drew](https://www.pexels.com/photo/housekeepers-changing-sheets-in-hotel-room-9462740/) | Housekeepers preparing bed linen. Hotel Housekeeper. |
| `public/images/jobs/butcher.jpg` | [Butchers Preparing Meat Indoors with Expertise — Freek Wolsink](https://www.pexels.com/photo/butchers-preparing-meat-indoors-with-expertise-29346648/) | Professional butchers preparing meat. Butcher. |
| `public/images/jobs/electrician.jpg` | [A man is working on an electrical panel — ranjeet .](https://www.pexels.com/photo/a-man-is-working-on-an-electrical-panel-27928760/) | Electrician at a circuit-breaker panel. Electrician. |
| `public/images/jobs/welder.jpg` | [Photo of a Person Welding — Rik Schots](https://www.pexels.com/photo/photo-of-a-person-welding-11624248/) | Welder using a protective mask and gloves in a workshop. Welder. |
| `public/images/jobs/bakery-worker.jpg` | [Man Preparing Dough For Bread — Vaibhav Jadhav](https://www.pexels.com/photo/man-preparing-dough-for-bread-3218467/) | Baker preparing bread dough. Bakery Worker. |
| `public/images/jobs/truck-mechanic.jpg` | [Mechanic and Truck](https://www.pexels.com/photo/mechanic-and-truck-7019378/) | Mechanic at a workshop workbench beside a red commercial truck. Truck Mechanic. |

## Current font

- Family: THICCCBOI, normal styles at weights 400, 500, 600, 700, and 800.
- Maker and copyright holder: Wonder Unit Inc. (copyright 2017).
- Source: the maker's [official font repository](https://github.com/wonderunit/font-thicccboi), pinned to [revision 5f52dbefb2192934c1405164097cfa7918c94504](https://github.com/wonderunit/font-thicccboi/tree/5f52dbefb2192934c1405164097cfa7918c94504/fonts/Webfont).
- Local original web fonts: `public/fonts/thicccboi/THICCCBOI-Regular.woff2`, `THICCCBOI-Medium.woff2`, `THICCCBOI-SemiBold.woff2`, `THICCCBOI-Bold.woff2`, and `THICCCBOI-ExtraBold.woff2`. These are unmodified WOFF2 files downloaded directly from the maker's repository on 14 October 2026.
- Licence: [SIL Open Font License 1.1](https://github.com/wonderunit/font-thicccboi/blob/5f52dbefb2192934c1405164097cfa7918c94504/OFL.txt), permitting commercial website embedding and self-hosting. The original copyright notice and complete licence are retained in `public/fonts/thicccboi/LICENSE.txt`. The font may be bundled with software under the OFL; font files may not be sold on their own.
- Typography reference: [TopMercury](https://www.topmercury.com/?ref=bestagencysites.com). No font assets were copied from the reference website.

## Original font (retained asset)

- Family: Manrope, variable normal weights 200–800, Latin subset.
- Designers: Mikhail Sharanda and Mirko Velimirovic, with the Manrope Project Authors.
- Local font: `public/fonts/manrope.woff2`.
- Source: [Google Fonts](https://fonts.google.com/specimen/Manrope), official [Google Fonts CSS API](https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap), [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/manrope).
- CDN file: `https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2`.
- Licence: SIL Open Font License 1.1; original copyright and licence retained in `public/fonts/OFL-Manrope.txt`. Original font log retained in `public/fonts/FONTLOG-Manrope.txt`.

## Content

The 17 roles, 248 proposed workers, and salary ranges in `data/jobs.ts` were provided by the user on 15 October 2026. All amounts are in EUR per month, proposed NET salary, not confirmed employer offers. Descriptions and skills are indicative; no employer, location, benefit or contract is invented. Proposed roles omit JobPosting structured data and job sitemap entries.

## Generated role images

The 17 new WebP assets in `public/images/jobs/proposed/` were created separately using the built-in image generation tool. They illustrate trades and are labeled as AI-generated; they are not photographs of actual employers or workplaces. Full generation prompts, source filenames, output mapping, and alt descriptions are recorded in [prompt set A](docs/job-image-prompts-a.md) and [prompt set B](docs/job-image-prompts-b.md).

Each job's image and alternative text are editable through job management. The per-role mapping is explicit in `data/jobs.ts`. There are no missing photo assets in this seed set.
