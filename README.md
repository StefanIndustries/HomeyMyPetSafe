# MyPetSafe for Homey

Connect your PetSafe Smart Feed automatic feeder to [Homey](https://homey.app). Check the food level and battery at a glance, give an extra portion from anywhere, and let Homey warn you before your pet's bowl stays empty.

> This app is not made by or affiliated with PetSafe.

## Features

- **Feed now**: give one portion from the device tile, as a quick action, or from a flow.
- **Dashboard widget**: shows the food level and last feeding, with a button to give a portion straight from the dashboard.
- **Food level**: alarms for food running low and food that has run out, with flow triggers and conditions for both.
- **Last feeding time**: see on the device when your pet was last fed.
- **Battery and power**: battery level, a low-battery alarm, and an alarm when the power adapter is disconnected.
- **Child lock**: lock or unlock the buttons on the feeder from Homey or a flow.
- **Easy setup**: sign in with a pincode sent to your email, with no password needed, and add every feeder in your account at once.
- **13 languages**: English, Dutch, German, French, Spanish, Italian, Danish, Norwegian, Swedish, Polish, Russian, Korean and Arabic.

## Flow cards

| Type | Cards |
|---|---|
| Triggers | Food is running low · Food is no longer running low · Food ran out · Food was refilled |
| Conditions | Food is / is not running low · Food has / has not run out |
| Actions | Feed now |

Homey also adds its standard cards for battery level, the battery and power alarms, and the lock (locked/unlocked triggers, an *is locked* condition, and lock/unlock actions).

## Requirements

- A PetSafe Smart Feed feeder, set up in the MyPetSafe app
- A Homey Pro (local platform) running Homey 12.2.0 or later
- An internet connection: the app talks to the PetSafe cloud and refreshes the feeder status every 5 minutes

## Setup

1. Install **MyPetSafe** from the Homey App Store.
2. Add a device, choose **MyPetSafe** and then **feeder**.
3. Enter the email address of your MyPetSafe account and press **Continue**.
4. Enter the 6-digit pincode PetSafe sends to that address.
5. Select the feeders you want to add.

## Development

The app is written in TypeScript and uses [Homey Compose](https://apps.developer.homey.app/advanced/homey-compose). Communication with the PetSafe cloud is handled by the [`mypetsafe`](https://www.npmjs.com/package/mypetsafe) npm package ([source](https://github.com/StefanIndustries/node-mypetsafe)).

```bash
npm ci
npm run build
homey app run
```

Validate the app before publishing:

```bash
homey app validate --level publish
```

Every push to `main` is validated and published to the Homey App Store by GitHub Actions. Bump the version in `.homeycompose/app.json` and add an entry to `.homeychangelog.json` before pushing.

### Project layout

| Path | Contents |
|---|---|
| `app.ts` | PetSafe client, polling and pairing logic |
| `drivers/feeder/` | Feeder driver, device, flow cards and pairing view |
| `widgets/feeder/` | Dashboard widget and its API |
| `.homeycompose/` | App manifest and custom capabilities |
| `assets/` | App and capability icons |
| `locales/` | Translations used in code and pairing views |

## Issues and contributions

Found a bug or missing a feature? [Open an issue](https://github.com/StefanIndustries/HomeyMyPetSafe/issues). Pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
