let currentPositionRequest;

export function getCurrentCoordinates() {
  if (currentPositionRequest) return currentPositionRequest;
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.reject(new Error('Current location is unavailable. Select a location on the map.'));
  }

  currentPositionRequest = new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => reject(new Error('Could not access your current location. Select a location on the map.')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }).finally(() => {
    currentPositionRequest = null;
  });

  return currentPositionRequest;
}

export function getCoordinatesOrCurrentPosition(coordinates) {
  if (Number.isFinite(coordinates?.latitude) && Number.isFinite(coordinates?.longitude)) {
    return Promise.resolve({ latitude: coordinates.latitude, longitude: coordinates.longitude });
  }
  return getCurrentCoordinates();
}