export type LegalSection = { heading: string; body: string[]; list?: string[] };
export type LegalDoc = { slug: string; title: string; updated: string; intro: string; sections: LegalSection[] };

/** Full legacy Terms of Service text, parameterized only by app name and year. */
export function legalTerms(appName: string, updated: string): LegalDoc {
  return {
    slug: "terms",
    title: "Terms of Service",
    updated,
    intro: `Welcome to ${appName}. By creating an account or using the service you agree to these Terms.`,
    sections: [
      {
        heading: "1. Your account",
        body: [
          `You must provide accurate information and keep your password secure. You are responsible for all activity under your account. You must be at least 13 years old to use ${appName}.`,
        ],
      },
      {
        heading: "2. $DUYS points & wallet",
        body: [
          "$DUYS points are an in-app rewards unit and carry no guaranteed monetary value. Wallet deposits, withdrawals, tips and boosts are subject to review and applicable fees. Fraudulent activity may result in forfeiture of points or balances.",
        ],
      },
      {
        heading: "3. Content you post",
        body: [
          `You retain ownership of content you create, and grant ${appName} a licence to host and display it to operate the service. You are responsible for your content and must hold the rights to it.`,
        ],
      },
      {
        heading: "4. Acceptable use",
        body: [
          `Do not use ${appName} for unlawful, harmful, infringing or deceptive activity.`,
        ],
      },
      {
        heading: "5. Monetization & ads",
        body: [
          "Boosted posts are labelled “Sponsored”. Verification badges are granted at our discretion after review. We may run ads and reward viewing with $DUYS points.",
        ],
      },
      {
        heading: "6. Termination",
        body: [
          "We may suspend or terminate accounts that violate these Terms. You may delete your account at any time from Settings, which removes your data and media from our systems.",
        ],
      },
      {
        heading: "7. Disclaimer",
        body: [
          `The service is provided “as is” without warranties. To the extent permitted by law, ${appName} is not liable for indirect or consequential damages.`,
        ],
      },
      {
        heading: "8. Changes",
        body: ["We may update these Terms; continued use after changes constitutes acceptance."],
      },
    ],
  };
}
