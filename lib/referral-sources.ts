export const referralSources = [
  "Facebook",
  "TikTok",
  "Instagram",
  "Reddit",
  "YouTube",
  "Google Search",
  "Friend or family",
  "Other",
] as const;

export type ReferralSource = (typeof referralSources)[number];
