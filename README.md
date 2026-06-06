# Optergy

Built for the WattTheHack energy hackathon, Optergy helps Australians understand what their appliances cost to run and whether an energy-efficient replacement could pay off.

Built with **TypeScript, Next.js, React, Tesseract.js and SQLite**.

## What it does

- Scan an energy label from a photo or camera capture to read annual kWh and energy stars.
- Preprocess tilted, faded and cracked labels, then let you check the readings against the photo.
- Estimate annual and ten-year running costs using **2025–26** regulated electricity benchmarks or your bill rate.
- Compare appliances by category and capacity, with energy ratings, photos, purchase links and payback estimates.

## Run locally

Requires **Node.js 24+**.

```sh
npm ci
npm run db:seed
npm run dev
```

Open [localhost:3000](http://localhost:3000). For camera capture, allow camera access, wait for the live preview and press **Capture label**. Camera access requires HTTPS or localhost. OCR runs in your browser.

## Checks

```sh
npm test
npm run lint
npm run build
npm run benchmark:ocr
```

The OCR benchmark uses annotated phone photos and official label examples, including rotated and faded variants. These are tuning images, not an independent accuracy study. Damaged labels can still need manual correction; the strict benchmark flags unread values as failures. Local benchmark output goes in `.cache/ocr/`.

## Data and assumptions

The SQLite catalog contains ten sourced models across five appliance categories. Product records include specification and retailer links; prices and stock are not live. Electricity benchmarks include regulator sources in the app. Where the 2025–26 Default Market Offer specifies an annual bill cap rather than a usage rate, enter the rate from your bill.

Cost comparisons assume constant energy use and tariffs over ten years. They exclude installation, repairs, water and financing. Confirm the label readings, appliance capacity and retailer details before comparing.
