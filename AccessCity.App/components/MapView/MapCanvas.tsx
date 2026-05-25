import React, { RefObject, memo, useMemo } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Coordinate, Hazard, ContextMapPoint } from './MapTypes';
import { AppTheme } from '@/constants/theme';

type MapCanvasProps = {
  mapRef?: RefObject<MapView | null>;
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  currentLocation: Coordinate | null;
  destination: Coordinate | null;
  hazards: Hazard[];
  contextPoints?: ContextMapPoint[];
  routeCoordinates: Coordinate[];
  navigationMode: boolean;
  onHazardPress: (hazard: Hazard) => void;
  onContextPointPress?: (point: ContextMapPoint) => void;
  onMapPress?: (point: Coordinate) => void;
};

function MapCanvasComponent({
  mapRef,
  initialRegion,
  currentLocation,
  destination,
  hazards,
  contextPoints = [],
  routeCoordinates,
  navigationMode,
  onHazardPress,
  onContextPointPress,
  onMapPress,
}: MapCanvasProps) {
  const safeRouteCoordinates = useMemo(() => {
    if (!Array.isArray(routeCoordinates)) return [];

    return routeCoordinates.filter(
      (point) =>
        point &&
        typeof point.latitude === 'number' &&
        typeof point.longitude === 'number' &&
        !Number.isNaN(point.latitude) &&
        !Number.isNaN(point.longitude)
    );
  }, [routeCoordinates]);

  const polylineKey = useMemo(() => {
    if (safeRouteCoordinates.length < 2) return 'empty-route';

    return safeRouteCoordinates
      .map((point) => `${point.latitude},${point.longitude}`)
      .join('|');
  }, [safeRouteCoordinates]);

  function renderHazardMarker(hazard: Hazard) {
    if (hazard.type === 'wheelchair') {
      return (
        <View style={styles.markerOuterBlue}>
          <View style={styles.markerInnerBlue}>
            <MaterialCommunityIcons
              name="wheelchair-accessibility"
              size={22}
              color={AppTheme.color.primary}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.markerOuterYellow}>
        <View style={styles.markerInnerYellow}>
          <Ionicons name="bulb" size={20} color={AppTheme.color.warning} />
        </View>
      </View>
    );
  }

  function renderContextMarker(point: ContextMapPoint) {
    const isSafeHaven = point.kind === 'safe-haven';

    return (
      <View style={isSafeHaven ? styles.contextOuterGreen : styles.contextOuterPurple}>
        <View style={isSafeHaven ? styles.contextInnerGreen : styles.contextInnerPurple}>
          <Ionicons
            name={isSafeHaven ? 'shield-checkmark-outline' : 'business-outline'}
            size={18}
            color={isSafeHaven ? AppTheme.color.success : AppTheme.color.primary}
          />
        </View>
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={initialRegion}
      mapType="mutedStandard"
      showsUserLocation={true}
      showsMyLocationButton={false}
      followsUserLocation={navigationMode}
      rotateEnabled={true}
      pitchEnabled={true}
      scrollEnabled={true}
      zoomEnabled={true}
      showsCompass={navigationMode}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      onPress={(event) => onMapPress?.(event.nativeEvent.coordinate)}
    >

      {!navigationMode && destination && (
        <Marker coordinate={destination} title="Destination">
          <View style={styles.destinationMarkerOuter}>
            <View style={styles.destinationMarkerInner}>
              <Ionicons name="location" size={22} color={AppTheme.color.danger} />
            </View>
          </View>
        </Marker>
      )}

      {!navigationMode &&
        hazards.map((hazard) => (
          <Marker
            key={String(hazard.id)}
            coordinate={{
              latitude: Number(hazard.latitude),
              longitude: Number(hazard.longitude),
            }}
            title={hazard.title}
            onPress={() => onHazardPress(hazard)}
          >
            {renderHazardMarker(hazard)}
          </Marker>
        ))}

      {!navigationMode &&
        contextPoints.map((point) => (
          <Marker
            key={point.id}
            coordinate={{
              latitude: point.latitude,
              longitude: point.longitude,
            }}
            title={point.title}
            description={point.subtitle}
            onPress={() => onContextPointPress?.(point)}
          >
            {renderContextMarker(point)}
          </Marker>
        ))}

      {safeRouteCoordinates.length >= 2 && (
        <Polyline
          key={polylineKey}
          coordinates={safeRouteCoordinates}
          strokeWidth={6}
          strokeColor={AppTheme.color.primary}
          lineCap="round"
          lineJoin="round"
          geodesic
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },

  destinationMarkerOuter: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(239,68,68,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  destinationMarkerInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AppTheme.color.dangerSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },

  markerOuterBlue: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59,130,246,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  markerInnerBlue: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: AppTheme.color.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },

  markerOuterYellow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(251,191,36,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  markerInnerYellow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: AppTheme.color.warningSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },

  contextOuterGreen: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(34,197,94,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  contextInnerGreen: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppTheme.color.successSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },

  contextOuterPurple: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(37,99,235,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  contextInnerPurple: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: AppTheme.color.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default memo(MapCanvasComponent);
