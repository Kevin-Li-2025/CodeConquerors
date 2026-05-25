import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapLibreGL from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_MAP_CENTER_LNG_LAT } from '../../constants/defaultMapRegion';
import { Hazard } from '../../models/spatial';
import { API_BASE_URL } from '../../services/api';

const TILE_URL = `${API_BASE_URL}/api/v1/tiles/{z}/{x}/{y}.pbf`;
const EMPTY_ROUTE_DATA = { type: 'FeatureCollection', features: [] };

interface MapViewProps {
  centerCoordinate?: [number, number];
  markers?: Hazard[];
  routeGeoJSON?: any;
  onMarkerPress?: (hazard: Hazard) => void;
  onMapPress?: (point: { lng: number, lat: number }) => void;
  showHazards?: boolean;
}

export default function WebMapView({
  centerCoordinate = DEFAULT_MAP_CENTER_LNG_LAT,
  markers = [],
  routeGeoJSON,
  onMarkerPress,
  onMapPress,
  showHazards = true
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreGL.Map | null>(null);
  const markerObjects = useRef<Record<string, MapLibreGL.Marker>>({});
  const initialCenterRef = useRef(centerCoordinate);
  const onMapPressRef = useRef(onMapPress);
  const onMarkerPressRef = useRef(onMarkerPress);
  const showHazardsRef = useRef(showHazards);
  const pendingRouteDataRef = useRef(routeGeoJSON ?? EMPTY_ROUTE_DATA);
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    onMapPressRef.current = onMapPress;
  }, [onMapPress]);

  useEffect(() => {
    onMarkerPressRef.current = onMarkerPress;
  }, [onMarkerPress]);

  useEffect(() => {
    showHazardsRef.current = showHazards;
    if (map.current?.getLayer('hazard-layer')) {
      map.current.setLayoutProperty(
        'hazard-layer',
        'visibility',
        showHazards ? 'visible' : 'none'
      );
    }
  }, [showHazards]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new MapLibreGL.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm'
          }
        ],
        center: initialCenterRef.current as [number, number],
        zoom: 13
      }
    });

    map.current.on('load', () => {
      if (!map.current) return;

      // Add Vector Hazards with high visual quality
      if (showHazardsRef.current) {
        map.current.addSource('hazards', {
          type: 'vector',
          tiles: [TILE_URL]
        });

        map.current.addLayer({
          id: 'hazard-layer',
          type: 'circle',
          source: 'hazards',
          'source-layer': 'hazards',
          paint: {
            'circle-radius': 8,
            'circle-color': '#EF4444',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
            'circle-opacity': 0.8
          }
        });

        map.current.on('click', 'hazard-layer', (e) => {
          if (e.features && e.features.length > 0) {
            // Internal vector hazards press handler if needed
          }
        });
      }

      // Add Route Source
      map.current.addSource('route', {
        type: 'geojson',
        data: pendingRouteDataRef.current
      });

      map.current.addLayer({
        id: 'route-layer',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3B82F6',
          'line-width': 5,
          'line-opacity': 0.8
        }
      });
    });

    map.current.on('click', (e) => {
      onMapPressRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  // Update Route
  useEffect(() => {
    pendingRouteDataRef.current = routeGeoJSON ?? EMPTY_ROUTE_DATA;
    if (!map.current?.isStyleLoaded()) return;

    const source = map.current.getSource('route') as MapLibreGL.GeoJSONSource;
    source?.setData(pendingRouteDataRef.current);
  }, [routeGeoJSON]);

  // Update Markers
  useEffect(() => {
    if (!map.current) return;

    const visibleMarkerIds = new Set(showHazards ? markers.map((hazard) => String(hazard.id)) : []);

    Object.entries(markerObjects.current).forEach(([id, marker]) => {
      if (!visibleMarkerIds.has(id)) {
        marker.remove();
        delete markerObjects.current[id];
      }
    });

    if (!showHazards) {
      return;
    }

    markers.forEach(hazard => {
      const id = String(hazard.id);
      const existingMarker = markerObjects.current[id];
      if (existingMarker) {
        existingMarker.setLngLat([hazard.longitude, hazard.latitude]);
        return;
      }

      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.title = hazard.title;
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = hazard.type === 'wheelchair' ? '#2563EB' : '#D97706';
      el.style.border = '3px solid white';
      el.style.cursor = 'pointer';
      el.onclick = (event) => {
        event.stopPropagation();
        onMarkerPressRef.current?.(hazard);
      };

      const marker = new MapLibreGL.Marker(el)
        .setLngLat([hazard.longitude, hazard.latitude])
        .addTo(map.current!);

      markerObjects.current[id] = marker;
    });
  }, [markers, showHazards]);

  // Update Center
  useEffect(() => {
    if (map.current) {
      if (!hasCenteredRef.current) {
        map.current.jumpTo({ center: centerCoordinate as [number, number] });
        hasCenteredRef.current = true;
        return;
      }

      map.current.easeTo({ center: centerCoordinate as [number, number], duration: 250 });
    }
  }, [centerCoordinate]);

  return (
    <View style={styles.container}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
