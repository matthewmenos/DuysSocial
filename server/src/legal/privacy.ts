import type { LegalDoc } from "./terms.js";

/** Full legacy Privacy Policy text, parameterized only by app name and year. */
export function legalPrivacy(appName: string, updated: string): LegalDoc {
  return {
    slug: "privacy",
    title: "Privacy Policy",
    updated,
    intro: `This policy explains what ${appName} collects and how we use it.`,
    sections: [
      {
        heading: "What we collect",
        body: [],
        list: [
          "Account info: email, username, display name, and (if you sign in with Google) your Google profile basics.",
          "Content you create: posts, stories, messages, media, and engagement.",
          "Usage & device data, and presence (online/last-seen) to power the app.",
          "Wallet & points activity for deposits, withdrawals, tips, boosts and rewards.",
        ],
      },
      {
        heading: "How we use it",
        body: [
          "To operate and secure the service, personalize your feed, process payments and rewards, and prevent abuse.",
        ],
      },
      {
        heading: "Storage & security",
        body: [
          "Data is stored in a per-user database and a shared database; media is stored in object storage (Cloudflare R2). Passwords are hashed. Two-factor authentication is available.",
        ],
      },
      {
        heading: "Disappearing & deleted content",
        body: [
          "View-once media is deleted from our database and storage after it is viewed. Stories expire after 24 hours and are removed. Deleting your account or content removes it from our database and storage.",
        ],
      },
      {
        heading: "Sharing",
        body: [
          "We do not sell your personal data. We share data only with providers needed to run the service (e.g. authentication, storage) or where required by law.",
        ],
      },
      {
        heading: "Your choices",
        body: [
          "You can edit your profile, manage 2FA, control your theme, and delete your account at any time from Settings.",
        ],
      },
      {
        heading: "Contact",
        body: [`Questions about privacy? Contact the ${appName} team.`],
      },
    ],
  };
}
