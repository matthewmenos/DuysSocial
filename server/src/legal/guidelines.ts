import type { LegalDoc } from "./terms.js";

/** Full legacy Community Guidelines text, parameterized only by app name and year. */
export function legalGuidelines(appName: string, updated: string): LegalDoc {
  return {
    slug: "guidelines",
    title: "Community Guidelines",
    updated,
    intro: `${appName} is a place to post, connect, broadcast and earn. These guidelines keep it safe for everyone.`,
    sections: [
      {
        heading: "Be respectful",
        body: [
          "No harassment, hate speech, threats, or targeting people based on protected characteristics.",
        ],
      },
      {
        heading: "No illegal or harmful content",
        body: [
          "Do not post content that is unlawful, promotes violence, exploits minors, or facilitates fraud or scams, including deceptive crypto or “airdrop” schemes.",
        ],
      },
      {
        heading: "Authenticity",
        body: [
          "No impersonation, fake engagement, bots, or manipulating $DUYS rewards, referrals, or the leaderboard. View-once and disappearing media must not be used to harass or distribute prohibited content.",
        ],
      },
      {
        heading: "Adult & sensitive content",
        body: [
          "No pornography or gratuitous violence. Mark sensitive content appropriately where tools are provided.",
        ],
      },
      {
        heading: "Intellectual property",
        body: [
          "Only post content you own or have the right to share. Respect copyrights and trademarks.",
        ],
      },
      {
        heading: "Advertising",
        body: [
          "Boosted/Sponsored posts must follow advertising standards and link to safe, accurate landing pages.",
        ],
      },
      {
        heading: "Reporting & enforcement",
        body: [
          "Violations may lead to content removal, loss of verification, or account suspension. Admins review verification and reported content manually.",
        ],
      },
    ],
  };
}
