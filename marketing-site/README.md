# WorkCraft AI marketing site

Static marketing site intended to run as a **separate Vercel project** with `marketing-site/` as its Root Directory. It is isolated from the existing WorkCraft AI application project and does not change the app's routes, deployment, or environment variables.

## Before publishing

- Replace the contact placeholder with the approved company contact address and details.
- Replace the demo-video placeholder with a real, captioned product walkthrough and poster image.
- The selected public company name is WorkCraft AI. Attach `workcraftai.com` to this project and `app.workcraftai.com` to the app project after registering the domain and configuring DNS. The app CTA currently points to `https://app.workcraftai.com/`.
- `robots.txt` and `sitemap.xml` are ready for Google Search Console after the custom domain resolves.
- Review all product and company claims before connecting a custom domain or using the site in ads.

The current design is a dependency-free static site: `index.html`, `styles.css`, and `favicon.svg`. A Vercel project rooted at this directory can serve it without building the application's Next.js project.
