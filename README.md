# aris

To install dependencies:

```bash
bun install
```

## Packages

### @aris/data-source-tfl

TfL (Transport for London) data source for tube, overground, and Elizabeth line alerts.

#### Testing

```bash
cd packages/aris-data-source-tfl
bun run test
```

#### Fixtures

Tests use fixture data from real TfL API responses stored in `fixtures/tfl-responses.json`.

To refresh fixtures:

```bash
bun run fetch-fixtures
```
