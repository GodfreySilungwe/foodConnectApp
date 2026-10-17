function requestPosition(geolocation, options) {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function describeLocationError(error) {
  if (error?.code === 1) {
    return 'Location permission was denied. Allow location access in your browser settings, then try again, or select a location on the map.';
  }
  if (error?.code === 3) {
    return 'Getting your location timed out. Check that location services are enabled, then try again, or select a location on the map.';
  }
  if (error?.code === 2) {
    return 'Your device could not determine your location. Check that location services are enabled, then try again, or select a location on the map.';
  }
  return 'Could not access your current location. Check your browser location settings, or select a location on the map.';
}

export function getCurrentCoordinates() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    const insecurePage = typeof globalThis.isSecureContext === 'boolean' && !globalThis.isSecureContext;
    return Promise.reject(new Error(
      insecurePage
        ? 'Current location requires a secure connection (HTTPS). Open this site over HTTPS or select a location on the map.'
        : 'Current location is not supported by this browser. Select a location on the map.'
    ));
  }

  return requestPosition(navigator.geolocation, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 30000,
  }).catch((error) => {
    if (error?.code === 1) {
      throw new Error(describeLocationError(error));
    }

    return requestPosition(navigator.geolocation, {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 120000,
    }).catch((fallbackError) => {
      throw new Error(describeLocationError(fallbackError));
    });
  }).then(({ coords }) => ({
    latitude: coords.latitude,
    longitude: coords.longitude,
  }));
}

export function getCoordinatesOrCurrentPosition(coordinates) {
  if (Number.isFinite(coordinates?.latitude) && Number.isFinite(coordinates?.longitude)) {
    return Promise.resolve({ latitude: coordinates.latitude, longitude: coordinates.longitude });
  }
  return getCurrentCoordinates();
}