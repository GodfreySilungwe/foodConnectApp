'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import '@/styles/components/LocationPicker.css';

const defaultCenter = [-13.2543, 34.3015];

export default function LocationPicker({ value, onChange, label = 'Choose a location' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const coordinatesSelected = Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let disposed = false;
    let map;

    import('leaflet').then((leafletModule) => {
      if (disposed || !containerRef.current) return;
      const leaflet = leafletModule.default || leafletModule;
      const currentValue = valueRef.current;
      const hasCurrentCoordinates = Number.isFinite(currentValue?.latitude) && Number.isFinite(currentValue?.longitude);
      const center = hasCurrentCoordinates ? [currentValue.latitude, currentValue.longitude] : defaultCenter;
      map = leaflet.map(containerRef.current).setView(center, hasCurrentCoordinates ? 14 : 6);
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', (event) => {
        onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      });
      mapRef.current = map;

      if (hasCurrentCoordinates) {
        markerRef.current = leaflet.circleMarker(center, {
          radius: 9,
          color: '#fff',
          weight: 3,
          fillColor: '#d9653b',
          fillOpacity: 1,
        }).addTo(map);
      }
    }).catch(() => {});

    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !coordinatesSelected) return;
    const point = [value.latitude, value.longitude];
    if (markerRef.current) markerRef.current.setLatLng(point);
    else {
      import('leaflet').then((leafletModule) => {
        const leaflet = leafletModule.default || leafletModule;
        if (mapRef.current && !markerRef.current) {
          markerRef.current = leaflet.circleMarker(point, {
            radius: 9,
            color: '#fff',
            weight: 3,
            fillColor: '#d9653b',
            fillOpacity: 1,
          }).addTo(mapRef.current);
        }
      });
    }
  }, [coordinatesSelected, value?.latitude, value?.longitude]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => onChange({ latitude: coords.latitude, longitude: coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="location-picker">
      <div className="location-picker-heading">
        <strong>{label}</strong>
        <button type="button" onClick={useCurrentLocation}>Use current location</button>
      </div>
      <div ref={containerRef} className="location-picker-map" role="application" aria-label={`${label} map`} />
      <p className="location-picker-coordinates">
        {coordinatesSelected
          ? `Selected: ${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
          : 'Click the map or use your current location to place a pin.'}
      </p>
    </div>
  );
}