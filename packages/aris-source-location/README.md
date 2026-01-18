# @aris/source-location

Location feed source using the Geolocation API.

## Usage

```ts
import { createLocationSource, LocationKey } from "@aris/source-location"
import { contextValue } from "@aris/core"

const locationSource = createLocationSource(navigator.geolocation, {
	enableHighAccuracy: true,
	timeout: 10000,
})

// Use in a feed source graph
const sources = [locationSource, weatherSource]
```

## Exports

| Export                 | Description                          |
| ---------------------- | ------------------------------------ |
| `createLocationSource` | Factory function to create source    |
| `LocationKey`          | Context key for location data        |
| `Location`             | Type: `{ lat, lng, accuracy }`       |
| `GeolocationProvider`  | Interface for geolocation dependency |

## Options

| Option               | Default | Description                            |
| -------------------- | ------- | -------------------------------------- |
| `enableHighAccuracy` | `false` | Use GPS (more accurate, more battery)  |
| `maximumAge`         | `60000` | Max age of cached position (ms)        |
| `timeout`            | `10000` | Timeout for position requests (ms)     |
