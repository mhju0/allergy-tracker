# Allergy Tracker · 이유식 기록

A Korean-language iPhone app for recording foods introduced during weaning and observing reactions. It keeps the record on the device and shows each food's history and status.

[App Store](https://apps.apple.com/kr/app/id6827961276) · [Support](https://mhju0.github.io/allergy-tracker/support/) · [Privacy](https://mhju0.github.io/allergy-tracker/privacy/)

This is a tracking aid, not medical advice. Consult a healthcare professional about allergies.

## Engineering

- Food status is derived from trial history rather than stored separately. Trial transitions use transactions, and only one trial can be active at a time.
- The default observation window is three days; existing records retain their own window length. Check-ins record observations without ending the trial.
- Expo SQLite and Drizzle store data locally. There is no account, backend or sync; reminders are local. Exports leave the device through the share sheet, and device backups may include app data.

## Development

Built with Expo, React Native and TypeScript. Requires Node 22.13+; iOS development also requires Xcode and CocoaPods.

```sh
npm ci
npm run ios
npm run verify
```

[Design and data model](docs/design-spec.md) · [Decisions](docs/DECISIONS.md) · [Roadmap](docs/ROADMAP.md)

## License

Copyright (c) 2026 Michael Ju. All rights reserved.
No license is granted for use, copying, modification, or distribution of this code as of 2026-07-30. This repository is public for portfolio review purposes only.
