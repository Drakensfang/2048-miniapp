const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const minikitConfig = {
  accountAssociation: {
    header: "eyJmaWQiOjI0NjQ3MSwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDQzQTgwOTQ1OTE0M2RBYTJFMDM5Njk1NTAwYzJBNjNBZTMyZTMxRDEifQ",
    payload: "eyJkb21haW4iOiIyMDQ4LW1pbmlhcHAtbGl2aWQudmVyY2VsLmFwcCJ9",
    signature: "Aj5Ct2B+ed7pvLXB8KN0YwmnTF/RSRwQjssEug/7hQYbrF9HxaX4UDsHFB1AR1+cIWNzkyBcP49SA6SI/0JnaRw="
  },
  miniapp: {
    version: "1",
    name: "Number Puzzle Game", 
    subtitle: "Classic sliding puzzle game",
    description: "Play the classic puzzle game inside the Base App!",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: `${ROOT_URL}/blue-icon.png`,
    splashImageUrl: `${ROOT_URL}/blue-hero.png`,
    splashBackgroundColor: "#000000",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "games",
    tags: ["games", "puzzle"],
    heroImageUrl: `${ROOT_URL}/blue-hero.png`, 
    tagline: "Play the classic Puzzle Game inside Base",
    ogTitle: "Puzzle Game",
    ogDescription: "Play the classic Puzzle Game inside Base.",
    ogImageUrl: `${ROOT_URL}/blue-hero.png`,
    noindex: false,
  },
} as const;

