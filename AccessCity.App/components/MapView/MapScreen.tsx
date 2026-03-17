import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router, useGlobalSearchParams } from 'expo-router';

import SearchBar from './SearchBar';
import RouteInfoCard from './RouteInfoCard';
import HazardPreviewCard from './HazardPreviewCard';
import HazardDetailsModal from './HazardDetailsModal';
import FilterModal from './FilterModal';
import ReportHazardModal from './ReportHazardModal';
import MapCanvas from './MapCanvas';
import { api } from '../../services/api';

import { hazards as staticHazards } from './mapData';
import {
  Coordinate,
  Hazard,
  ReportHazardType,
  RouteFilters,
} from './MapTypes';

export default function MapScreen() {
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [destinationText, setDestinationText] = useState('');
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [travelTime, setTravelTime] = useState('');
  const [distance, setDistance] = useState('');
  const [safetyScore, setSafetyScore] = useState('');
  const [hazardsState, setHazardsState] = useState<Hazard[]>([]);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReportType, setSelectedReportType] =
    useState<ReportHazardType | null>(null);
  const [reportStep, setReportStep] = useState<1 | 2 | 3>(1);
  const [reportDescription, setReportDescription] = useState('');

  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const [routeFilters, setRouteFilters] = useState<RouteFilters>({
    avoidSteepHills: false,
    wheelchairAccessible: false,
    avoidReportedHazards: false,
    preferWellLitStreets: false,
    minSafetyScore: 0,
    maxSafetyScore: 100,
  });

  const [selectedHazard, setSelectedHazard] = useState<Hazard | null>(null);
  const [hazardPreviewVisible, setHazardPreviewVisible] = useState(false);
  const [hazardDetailsVisible, setHazardDetailsVisible] = useState(false);

  const { openReportModal: openReportModalParam } =
    useGlobalSearchParams<{ openReportModal?: string }>();

  useEffect(() => {
    getCurrentLocation();
    fetchHazards();
  }, []);

  async function fetchHazards() {
    try {
      const data: any = await api.get('/hazards');
      const mapped = data.map((h: any) => ({
        id: h.id,
        title: h.description.split('.')[0],
        type: h.type,
        latitude: h.location.coordinates[1],
        longitude: h.location.coordinates[0],
        description: h.description,
        status: h.status === 0 ? 'Reported' : h.status === 1 ? 'UnderReview' : 'Resolved',
        locationText: 'Hazard reported',
        reportedTime: new Date(h.reportedAt).toLocaleDateString()
      }));
      setHazardsState(mapped);
    } catch (err) {
      console.error("Failed to fetch hazards:", err);
    }
  }

  useEffect(() => {
    if (openReportModalParam) {
      setReportModalVisible(true);
      setReportStep(1);
      setSelectedReportType(null);
      setReportDescription('');
    }
  }, [openReportModalParam]);

  async function getCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get current location.');
    }
  }

  async function handleSearch(): Promise<Coordinate | null> {
    if (!destinationText.trim()) return null;
    
    try {
      const results: any = await api.get(`/geocoding/search?query=${encodeURIComponent(destinationText)}`);
      if (results && results.length > 0) {
        const first = results[0];
        const newDest: Coordinate = {
          latitude: parseFloat(first.lat),
          longitude: parseFloat(first.lon),
        };
        setDestination(newDest);
        return newDest;
      } else {
        Alert.alert('Not found', 'Could not find that location.');
      }
    } catch (err) {
      console.error("Search failed:", err);
    }
    return null;
  }

  async function handleStartRoute() {
    let finalDest = destination;

    if (!finalDest) {
      if (!destinationText.trim()) {
        Alert.alert('Set destination', 'Type a place and tap Start Navigation.');
        return;
      }
      finalDest = await handleSearch();
      if (!finalDest) return;
    }

    const start: Coordinate = currentLocation ?? { latitude: 52.4814, longitude: -1.9003 };

    try {
      const preferences = [];
      if (routeFilters.wheelchairAccessible) preferences.push('wheelchair');
      if (routeFilters.preferWellLitStreets) preferences.push('low-light-penalty');
      if (routeFilters.avoidReportedHazards) preferences.push('avoid-reported-hazards');
      if (routeFilters.avoidSteepHills) preferences.push('avoid-steep-hills');

      const data: any = await api.post('/routing/safe-path', {
        start: { x: start.longitude, y: start.latitude },
        end: { x: finalDest.longitude, y: finalDest.latitude },
        preferences: preferences,
        safetyWeight: routeFilters.avoidReportedHazards ? 0.9 : 0.6
      });

      const path = data.path || data.Path;
      const coords = path?.coordinates?.map((c: number[]) => ({
        longitude: c[0],
        latitude: c[1]
      })) || [];
      
      setRouteCoordinates(coords);
      
      const dist = data.distance ?? data.Distance ?? 0;
      const time = data.estimatedTime ?? data.EstimatedTime ?? 0;
      const score = data.safetyScore ?? data.SafetyScore ?? 0;
      
      setTravelTime(`${Math.round(time / 60)} min`);
      setDistance(`${(dist / 1000).toFixed(1)} km`);
      setSafetyScore(`${Math.round(score * 100)}%`);
    } catch (error) {
      console.error(error);
      Alert.alert('Routing Error', 'Could not compute route.');
    }
  }

  function toggleFilter<K extends keyof RouteFilters>(key: K) {
    setRouteFilters((prev) => {
      if (typeof prev[key] !== 'boolean') return prev;
      return {
        ...prev,
        [key]: !prev[key],
      };
    });
  }

  function adjustMinSafety(delta: number) {
    setRouteFilters((prev) => {
      const newMin = Math.max(
        0,
        Math.min(prev.minSafetyScore + delta, prev.maxSafetyScore)
      );

      return {
        ...prev,
        minSafetyScore: newMin,
      };
    });
  }

  function adjustMaxSafety(delta: number) {
    setRouteFilters((prev) => {
      const newMax = Math.min(
        100,
        Math.max(prev.maxSafetyScore + delta, prev.minSafetyScore)
      );

      return {
        ...prev,
        maxSafetyScore: newMax,
      };
    });
  }

  function handleResetFilters() {
    setRouteFilters({
      avoidSteepHills: false,
      wheelchairAccessible: false,
      avoidReportedHazards: false,
      preferWellLitStreets: false,
      minSafetyScore: 0,
      maxSafetyScore: 100,
    });
  }

  function handleApplyFilters() {
    setFilterModalVisible(false);
    Alert.alert('Filters applied', 'Your route preferences have been updated.');
  }

  function closeReportModal() {
    setReportModalVisible(false);
    setReportStep(1);
    setSelectedReportType(null);
    setReportDescription('');

    router.setParams({
      openReportModal: undefined,
    });
  }

  function handleNextFromReportModal() {
    if (!selectedReportType) {
      Alert.alert('Missing type', 'Please select a hazard type.');
      return;
    }

    setReportStep(2);
  }

  function handleBackToStep1() {
    setReportStep(1);
  }

  function handleSubmitReport() {
    setReportStep(3);
  }

  function handleDoneFromSuccess() {
    closeReportModal();
  }

  function handleHazardPress(hazard: Hazard) {
    setSelectedHazard(hazard);
    setHazardPreviewVisible(true);
    setHazardDetailsVisible(false);
  }

  function openHazardDetails() {
    if (!selectedHazard) return;
    setHazardDetailsVisible(true);
  }

  function closeHazardDetails() {
    setHazardDetailsVisible(false);
  }

  function closeHazardPreview() {
    setHazardPreviewVisible(false);
  }

  const initialRegion = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: 52.4862,
        longitude: -1.8904,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <View style={styles.container}>
      <MapCanvas
        initialRegion={initialRegion}
        currentLocation={currentLocation}
        destination={destination}
        hazards={hazardsState}
        routeCoordinates={routeCoordinates}
        onHazardPress={handleHazardPress}
      />

      <SearchBar
        value={destinationText}
        onChangeText={setDestinationText}
        onSubmitEditing={handleSearch}
      />

      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setFilterModalVisible(true)}
      >
        <Ionicons name="options-outline" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.routeButton} onPress={handleStartRoute}>
        <Text style={styles.routeButtonText}>Start Route</Text>
      </TouchableOpacity>

      <RouteInfoCard
        travelTime={travelTime}
        distance={distance}
        safetyScore={safetyScore}
      />

      <HazardPreviewCard
        visible={hazardPreviewVisible && !hazardDetailsVisible}
        hazard={selectedHazard}
        onClose={closeHazardPreview}
        onOpenDetails={openHazardDetails}
      />

      <FilterModal
        visible={filterModalVisible}
        routeFilters={routeFilters}
        onClose={() => setFilterModalVisible(false)}
        onToggleFilter={toggleFilter}
        onAdjustMinSafety={adjustMinSafety}
        onAdjustMaxSafety={adjustMaxSafety}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      <HazardDetailsModal
        visible={hazardDetailsVisible}
        hazard={selectedHazard}
        onClose={closeHazardDetails}
      />

      <ReportHazardModal
        visible={reportModalVisible}
        reportStep={reportStep}
        selectedReportType={selectedReportType}
        reportDescription={reportDescription}
        onClose={closeReportModal}
        onSelectType={setSelectedReportType}
        onNext={handleNextFromReportModal}
        onBack={handleBackToStep1}
        onSubmit={handleSubmitReport}
        onDone={handleDoneFromSuccess}
        onChangeDescription={setReportDescription}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0F3D91',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  routeButton: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 16,
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    elevation: 4,
  },
  routeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
