# TradeFlow AI marketing site

Static marketing site intended to run as a **separate Vercel project** with `marketing-site/` as its Root Directory. It is isolated from the existing TradeFlow application project and does not change the app's routes, deployment, or environment variables.

## Before publishing

- Replace the contact placeholder with the approved company contact address and details.
- Replace the demo-video placeholder with a real, captioned product walkthrough and poster image.
- Confirm the public company name and final marketing/app domains. The app CTA currently points to `https://tradeflow-app-ai.vercel.app/`.
- Review all product and company claims before connecting a custom domain or using the site in ads.

The current design is a dependency-free static site: `index.html`, `styles.css`, and `favicon.svg`. A Vercel project rooted at this directory can serve it without building the application's Next.js project.
