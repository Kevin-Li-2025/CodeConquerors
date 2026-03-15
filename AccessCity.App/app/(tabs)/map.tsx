/**
 * =========================================================
 * 1. IMPORTS
 * =========================================================
 * Import all required libraries for the map screen
 */
import React, { useEffect, useState } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useGlobalSearchParams } from 'expo-router';
/**
 * =========================================================
 * 2. TYPE DEFINITIONS
 * =========================================================
 * Define all TypeScript data structures used in this screen
 */


/**
 * 2.1 Coordinate type
 * Used for GPS points (location, route, destination)
 */
type Coordinate = {
  latitude: number;
  longitude: number;
};
/**
 * 2.2 Hazard type
 * Used for hazards displayed on the map
 */
type Hazard = {
  id: number;
  title: string;
  type: 'lighting' | 'wheelchair';
  latitude: number;
  longitude: number;
  description: string;
  status: 'Acknowledged' | 'Pending';
  locationText: string;
  reportedTime: string;
};
/**
 * 2.3 Hazard report types
 */
type ReportHazardType =
  | 'broken_street_light'
  | 'blocked_pavement'
  | 'parked_car_blocking_dropped_kerb'
  | 'road_obstruction'
  | 'unsafe_crossing'
  | 'other';
/**
 * 2.4 Route filter preferences
 */
type RouteFilters = {
  avoidSteepHills: boolean;
  wheelchairAccessible: boolean;
  avoidReportedHazards: boolean;
  preferWellLitStreets: boolean;
  minSafetyScore: number;
  maxSafetyScore: number;
};
/**
 * =========================================================
 * 3. MOCK HAZARD DATA
 * =========================================================
 * Temporary hazards displayed on the map
 * Later replaced by backend data
 */
const hazards: Hazard[] = [
  {
    id: 1,
    title: 'Broken street light',
    type: 'lighting',
    latitude: 52.4865,
    longitude: -1.891,
    description: 'There is a broken street light. The street is dimly-lit.',
    status: 'Acknowledged',
    locationText: 'Hazard located in Birmingham',
    reportedTime: '2 minutes ago',
  },
  {
    id: 2,
    title: 'No wheelchair ramp',
    type: 'wheelchair',
    latitude: 52.4852,
    longitude: -1.888,
    description: 'Wheelchair users may find it difficult to access this path safely.',
    status: 'Pending',
    locationText: 'Hazard located near city centre',
    reportedTime: '10 minutes ago',
  },
];
/**
 * =========================================================
 * 4. REPORT HAZARD CONFIGURATION
 * =========================================================
 * Defines icons and labels used for reporting hazards
 */
const reportHazardOptions: {
  key: ReportHazardType;
  label: string;
  icon: React.ReactNode;
  iconBg: string;
}[] = [
  {
    key: 'broken_street_light',
    label: 'Broken street light',
    icon: <Ionicons name="bulb-outline" size={28} color="#EAB308" />,
    iconBg: '#FEF3C7',
  },
  {
    key: 'blocked_pavement',
    label: 'Blocked pavement',
    icon: <Ionicons name="warning-outline" size={28} color="#F97316" />,
    iconBg: '#FEE2E2',
  },
  {
    key: 'parked_car_blocking_dropped_kerb',
    label: 'Parked car blocking dropped kerb',
    icon: <Ionicons name="car-outline" size={28} color="#2563EB" />,
    iconBg: '#DBEAFE',
  },
  {
    key: 'road_obstruction',
    label: 'Road obstruction',
    icon: <Ionicons name="warning-outline" size={28} color="#EF4444" />,
    iconBg: '#FCE7F3',
  },
  {
    key: 'unsafe_crossing',
    label: 'Unsafe crossing',
    icon: <MaterialCommunityIcons name="walk" size={28} color="#14B8A6" />,
    iconBg: '#DCFCE7',
  },
  {
    key: 'other',
    label: 'Other',
    icon: <Ionicons name="document-text-outline" size={28} color="#4B5563" />,
    iconBg: '#E5E7EB',
  },
];

const reportHazardLabelMap: Record<ReportHazardType, string> = {
  broken_street_light: 'Broken street light',
  blocked_pavement: 'Blocked pavement',
  parked_car_blocking_dropped_kerb: 'Parked car blocking dropped kerb',
  road_obstruction: 'Road obstruction',
  unsafe_crossing: 'Unsafe crossing',
  other: 'Other',
};
/**
 * =========================================================
 * 5. MAIN MAP COMPONENT
 * =========================================================
 * This screen is responsible for:
 *
 * - Showing the map
 * - Displaying hazards
 * - Generating safe routes
 * - Reporting hazards
 * - Filtering routes
 */
export default function MapScreen() {
    /**
   * =========================================================
   * 6. STATE VARIABLES
   * =========================================================
   */
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [destinationText, setDestinationText] = useState('');
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [travelTime, setTravelTime] = useState<string>('');
  const [distance, setDistance] = useState<string>('');
  const [safetyScore, setSafetyScore] = useState<string>('');

  const [reportModalVisible, setReportModalVisible] = useState(false);

  const { openReportModal: openReportModalParam } =
    useGlobalSearchParams<{
      openReportModal?: string;
    }>();

  const [selectedReportType, setSelectedReportType] =
    useState<ReportHazardType | null>(null);

  const [reportStep, setReportStep] = useState<1 | 2 | 3>(1);
  const [reportDescription, setReportDescription] = useState('');
  const [reportPhoto, setReportPhoto] = useState<string | null>(null);

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
      const newMin = Math.max(0, Math.min(prev.minSafetyScore + delta, prev.maxSafetyScore));
      return {
        ...prev,
        minSafetyScore: newMin,
      };
    });
  }

  function adjustMaxSafety(delta: number) {
    setRouteFilters((prev) => {
      const newMax = Math.min(100, Math.max(prev.maxSafetyScore + delta, prev.minSafetyScore));
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
 /**
   * =========================================================
   * 7. LIFECYCLE HOOKS
   * =========================================================
   */


  /**
   * 7.1 Load GPS location when screen loads
   */
  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (openReportModalParam) {
      setReportModalVisible(true);
      setReportStep(1);
      setSelectedReportType(null);
      setReportDescription('');
      setReportPhoto(null);
    }
  }, [openReportModalParam]);
  /**
   * =========================================================
   * 8. LOCATION FUNCTIONS
   * =========================================================
   */


  /**
   * 8.1 Request GPS permission and retrieve location
   */
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
  /**
   * =========================================================
   * 9. ROUTE FUNCTIONS
   * =========================================================
   */


  /**
   * 9.1 Set destination from search bar
   */
  function handleSetDestination() {
    if (!destinationText.trim()) {
      Alert.alert('Missing destination', 'Please enter a destination.');
      return;
    }

    setDestination({
      latitude: 52.4862,
      longitude: -1.8904,
    });
  }

  async function fetchRouteFromBackend() {
    if (!currentLocation || !destination) {
      Alert.alert('Missing data', 'Current location or destination is missing.');
      return;
    }

    try {
      const response = await fetch('https://your-backend-api.com/route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startLatitude: currentLocation.latitude,
          startLongitude: currentLocation.longitude,
          endLatitude: destination.latitude,
          endLongitude: destination.longitude,
          filters: routeFilters,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch route');
      }

      const data = await response.json();

      setRouteCoordinates(data.routeCoordinates || []);
      setTravelTime(data.travelTime || '');
      setDistance(data.distance || '');
      setSafetyScore(data.safetyScore || '');
    } catch (error) {
      console.error('Error fetching route:', error);
      Alert.alert('Route error', 'Could not load the route from backend.');
    }
  }

  async function handleStartRoute() {
    if (!destination) {
      Alert.alert('No destination', 'Please set a destination first.');
      return;
    }

    await fetchRouteFromBackend();
  }

  function closeReportModal() {
    setReportModalVisible(false);
    setReportStep(1);
    setSelectedReportType(null);
    setReportDescription('');
    setReportPhoto(null);

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
  /**
   * =========================================================
   * 10. HAZARD FUNCTIONS
   * =========================================================
   */


  /**
   * 10.1 When user taps a hazard marker
   */
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

  function renderHazardMarker(hazard: Hazard) {
    if (hazard.type === 'wheelchair') {
      return (
        <View style={styles.markerOuterBlue}>
          <View style={styles.markerInnerBlue}>
            <MaterialCommunityIcons
              name="wheelchair-accessibility"
              size={22}
              color="#2563EB"
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.markerOuterYellow}>
        <View style={styles.markerInnerYellow}>
          <Ionicons name="bulb" size={20} color="#D97706" />
        </View>
      </View>
    );
  }

  function getSheetStyleByStep() {
    if (reportStep === 1) return styles.sheetStepOne;
    if (reportStep === 2) return styles.sheetStepTwo;
    return styles.sheetStepThree;
  }

  const selectedTypeOption = reportHazardOptions.find(
    (item) => item.key === selectedReportType
  );
  /**
   * =========================================================
   * 11. MAP REGION CONFIGURATION
   * =========================================================
   */
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
  /**
   * =========================================================
   * 12. RENDER UI
   * =========================================================
   */
  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion}>
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="Current Location"
            pinColor="blue"
          />
        )}

        {destination && (
          <Marker
            coordinate={destination}
            title="Destination"
            pinColor="red"
          />
        )}

        {hazards.map((hazard) => (
          <Marker
            key={hazard.id}
            coordinate={{
              latitude: hazard.latitude,
              longitude: hazard.longitude,
            }}
            title={hazard.title}
            onPress={() => handleHazardPress(hazard)}
          >
            {renderHazardMarker(hazard)}
          </Marker>
        ))}

        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={5}
            strokeColor="#1D4ED8"
          />
        )}
      </MapView>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.input}
            placeholder="Search anything..."
            placeholderTextColor="#9CA3AF"
            value={destinationText}
            onChangeText={setDestinationText}
            returnKeyType="search"
            onSubmitEditing={handleSetDestination}
          />
        </View>
      </View>

      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setFilterModalVisible(true)}
      >
        <Ionicons name="options-outline" size={20} color="#FFFFFF" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.routeButton} onPress={handleStartRoute}>
        <Text style={styles.routeButtonText}>Start Route</Text>
      </TouchableOpacity>

      {travelTime || distance || safetyScore ? (
        <View style={styles.routeCard}>
          <Text style={styles.routeTitle}>{travelTime || 'Route ready'}</Text>
          <Text style={styles.routeSubtitle}>
            {distance ? `${distance}` : ''}
            {distance && safetyScore ? ' • ' : ''}
            {safetyScore ? `Safety: ${safetyScore}` : ''}
          </Text>
        </View>
      ) : null}
      
      {hazardPreviewVisible && selectedHazard && !hazardDetailsVisible ? (
        <View style={styles.hazardPreviewCard}>
          <Pressable
            style={styles.hazardPreviewClose}
            onPress={closeHazardPreview}
          >
            <Ionicons name="close" size={18} color="#6B7280" />
          </Pressable>

          <Text style={styles.hazardPreviewLabel}>Hazard ID</Text>
          <Text style={styles.hazardPreviewTitle}>{selectedHazard.title}</Text>

          <TouchableOpacity
            style={styles.hazardPreviewDetailsButton}
            onPress={openHazardDetails}
          >
            <Text style={styles.hazardPreviewDetailsText}>Details</Text>
          </TouchableOpacity>
        </View>
      ) : null}


            <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.overlay}
            onPress={() => setFilterModalVisible(false)}
          />

          <View style={styles.sheetWrapper}>
            <View style={styles.filterSheet}>
              <View style={styles.dragHandle} />

              <Text style={styles.filterTitle}>Filter by:</Text>

              <View style={styles.sheetDivider} />

              <Text style={styles.filterSectionHeading}>
                Accessibility Preferences
              </Text>

              <View style={styles.filterCard}>
                <Text style={styles.filterCardTitle}>
                  Filter accessibility preferences
                </Text>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => toggleFilter('avoidSteepHills')}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      routeFilters.avoidSteepHills && styles.checkboxChecked,
                    ]}
                  >
                    {routeFilters.avoidSteepHills && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Avoid steep hills</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => toggleFilter('wheelchairAccessible')}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      routeFilters.wheelchairAccessible && styles.checkboxChecked,
                    ]}
                  >
                    {routeFilters.wheelchairAccessible && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Wheelchair accessibility</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => toggleFilter('avoidReportedHazards')}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      routeFilters.avoidReportedHazards && styles.checkboxChecked,
                    ]}
                  >
                    {routeFilters.avoidReportedHazards && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Avoid reported hazards</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => toggleFilter('preferWellLitStreets')}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      routeFilters.preferWellLitStreets && styles.checkboxChecked,
                    ]}
                  >
                    {routeFilters.preferWellLitStreets && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={styles.checkboxLabel}>Well-lit streets</Text>
                </TouchableOpacity>

                <View style={styles.filterButtonRow}>
                  <TouchableOpacity
                    style={styles.applyButton}
                    onPress={handleApplyFilters}
                  >
                    <Text style={styles.applyButtonText}>Apply</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={handleResetFilters}
                  >
                    <Text style={styles.resetButtonText}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sheetDividerLarge} />

              <Text style={styles.filterSectionHeading}>Safety Score</Text>

              <View style={styles.safetyPanel}>
                <View style={styles.safetyAdjustRow}>
                  <Text style={styles.safetyAdjustLabel}>Min</Text>
                  <View style={styles.safetyStepper}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => adjustMinSafety(-10)}
                    >
                      <Text style={styles.stepperButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.safetyValue}>{routeFilters.minSafetyScore}</Text>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => adjustMinSafety(10)}
                    >
                      <Text style={styles.stepperButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.safetyAdjustRow}>
                  <Text style={styles.safetyAdjustLabel}>Max</Text>
                  <View style={styles.safetyStepper}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => adjustMaxSafety(-10)}
                    >
                      <Text style={styles.stepperButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.safetyValue}>{routeFilters.maxSafetyScore}</Text>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => adjustMaxSafety(10)}
                    >
                      <Text style={styles.stepperButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.fakeSliderWrap}>
                  <View style={styles.fakeSliderTrack} />
                  <View
                    style={[
                      styles.fakeSliderActive,
                      {
                        left: `${routeFilters.minSafetyScore}%`,
                        width: `${routeFilters.maxSafetyScore - routeFilters.minSafetyScore}%`,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.fakeSliderThumb,
                      { left: `${routeFilters.minSafetyScore}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.fakeSliderThumb,
                      { left: `${routeFilters.maxSafetyScore}%` },
                    ]}
                  />
                </View>

                <View style={styles.safetyRangeLabels}>
                  <Text style={styles.safetyRangeText}>0</Text>
                  <Text style={styles.safetyRangeText}>100</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={hazardDetailsVisible}
        animationType="fade"
        transparent
        onRequestClose={closeHazardDetails}
      >
        <View style={styles.detailModalRoot}>
          <Pressable style={styles.detailOverlay} onPress={closeHazardDetails} />

          <View style={styles.hazardDetailCard}>
            <View style={styles.hazardDetailHeader}>
              <View
                style={[
                  styles.hazardDetailIconBox,
                  selectedHazard?.type === 'wheelchair'
                    ? styles.hazardDetailIconBlue
                    : styles.hazardDetailIconYellow,
                ]}
              >
                {selectedHazard?.type === 'wheelchair' ? (
                  <MaterialCommunityIcons
                    name="wheelchair-accessibility"
                    size={28}
                    color="#2563EB"
                  />
                ) : (
                  <Ionicons name="bulb-outline" size={28} color="#D97706" />
                )}
              </View>

              <View style={styles.hazardDetailHeaderText}>
                <Text style={styles.hazardDetailTitle}>
                  {selectedHazard?.title}
                </Text>

                <View style={styles.hazardStatusBadge}>
                  <Text style={styles.hazardStatusText}>
                    Status: {selectedHazard?.status}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.hazardDetailDivider} />

            <Text style={styles.hazardDetailSectionLabel}>Description</Text>
            <Text style={styles.hazardDetailDescription}>
              {selectedHazard?.description}
            </Text>

            <View style={styles.hazardMetaRow}>
              <View style={styles.hazardMetaItem}>
                <Ionicons name="location-outline" size={20} color="#EF4444" />
                <Text style={styles.hazardMetaTitle}>Location</Text>
                <Text style={styles.hazardMetaText}>
                  {selectedHazard?.locationText}
                </Text>
              </View>

              <View style={styles.hazardMetaItem}>
                <Ionicons name="time-outline" size={20} color="#9CA3AF" />
                <Text style={styles.hazardMetaTitle}>Reported</Text>
                <Text style={styles.hazardMetaText}>
                  {selectedHazard?.reportedTime}
                </Text>
              </View>
            </View>

            <View style={styles.hazardActionRow}>
              <TouchableOpacity style={styles.avoidRouteButton}>
                <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
                <Text style={styles.avoidRouteButtonText}>Avoid in Route</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.detailSecondaryButton}
                onPress={closeHazardDetails}
              >
                <Ionicons name="chevron-forward" size={18} color="#4B5563" />
                <Text style={styles.detailSecondaryButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={reportModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeReportModal}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.overlay} onPress={closeReportModal} />

          <View style={styles.sheetWrapper}>
            <View style={[styles.sheet, getSheetStyleByStep()]}>
              <View style={styles.dragHandle} />

              <Text style={styles.sheetTitle}>Report hazard</Text>

              <View style={styles.sheetDivider} />

              <View style={styles.stepRow}>
                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      reportStep >= 1 && styles.stepCircleActive,
                    ]}
                  />
                  <Text style={styles.stepLabel}>STEP 1</Text>
                  <Text style={styles.stepTitle}>Select type</Text>
                  <View
                    style={reportStep === 1 ? styles.stepBadgeActive : styles.stepBadge}
                  >
                    <Text
                      style={
                        reportStep === 1
                          ? styles.stepBadgeActiveText
                          : styles.stepBadgeText
                      }
                    >
                      {reportStep === 1 ? 'In Progress' : 'Completed'}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.stepLine,
                    reportStep >= 2 && styles.stepLineActive,
                  ]}
                />

                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      reportStep >= 2 && styles.stepCircleActive,
                    ]}
                  />
                  <Text style={styles.stepLabel}>STEP 2</Text>
                  <Text style={styles.stepTitle}>Add details</Text>
                  <View
                    style={reportStep === 2 ? styles.stepBadgeActive : styles.stepBadge}
                  >
                    <Text
                      style={
                        reportStep === 2
                          ? styles.stepBadgeActiveText
                          : styles.stepBadgeText
                      }
                    >
                      {reportStep === 1
                        ? 'Not Completed'
                        : reportStep === 2
                        ? 'In Progress'
                        : 'Completed'}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.stepLine,
                    reportStep >= 3 && styles.stepLineActive,
                  ]}
                />

                <View style={styles.stepItem}>
                  <View
                    style={[
                      styles.stepCircle,
                      reportStep >= 3 && styles.stepCircleActive,
                    ]}
                  />
                  <Text style={styles.stepLabel}>STEP 3</Text>
                  <Text style={styles.stepTitle}>Report Done</Text>
                  <View
                    style={reportStep === 3 ? styles.stepBadgeActive : styles.stepBadge}
                  >
                    <Text
                      style={
                        reportStep === 3
                          ? styles.stepBadgeActiveText
                          : styles.stepBadgeText
                      }
                    >
                      {reportStep === 3 ? 'Completed' : 'Not Completed'}
                    </Text>
                  </View>
                </View>
              </View>

              {reportStep === 1 && (
                <>
                  <ScrollView
                    style={styles.sheetScroll}
                    contentContainerStyle={styles.sheetContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.questionTitle}>
                      What is the type of hazard?
                      <Text style={styles.required}>*</Text>
                    </Text>

                    <Text style={styles.questionSubtitle}>
                      Select the type of hazard you want to report
                    </Text>

                    <View style={styles.grid}>
                      {reportHazardOptions.map((item) => {
                        const isSelected = selectedReportType === item.key;

                        return (
                          <TouchableOpacity
                            key={item.key}
                            style={[styles.card, isSelected && styles.cardSelected]}
                            onPress={() => setSelectedReportType(item.key)}
                            activeOpacity={0.85}
                          >
                            <View
                              style={[
                                styles.cardIconBox,
                                { backgroundColor: item.iconBg },
                              ]}
                            >
                              {item.icon}
                            </View>
                            <Text style={styles.cardText}>{item.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>

                  <View style={styles.sheetBottomButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={closeReportModal}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.nextButton,
                        !selectedReportType && styles.nextButtonDisabled,
                      ]}
                      onPress={handleNextFromReportModal}
                      disabled={!selectedReportType}
                    >
                      <Text style={styles.nextButtonText}>Next</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {reportStep === 2 && (
                <>
                  <ScrollView
                    style={styles.sheetScroll}
                    contentContainerStyle={styles.sheetContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.selectedTypeBox}>
                      <View style={styles.selectedTypeLeft}>
                        <View
                          style={[
                            styles.selectedTypeIcon,
                            {
                              backgroundColor:
                                selectedTypeOption?.iconBg ?? '#F3F4F6',
                            },
                          ]}
                        >
                          {selectedTypeOption?.icon ?? (
                            <Ionicons
                              name="warning-outline"
                              size={22}
                              color="#EF4444"
                            />
                          )}
                        </View>

                        <View style={styles.selectedTypeTextWrap}>
                          <Text style={styles.selectedTypeMiniLabel}>
                            Reporting
                          </Text>
                          <Text style={styles.selectedTypeText}>
                            {selectedReportType
                              ? reportHazardLabelMap[selectedReportType]
                              : ''}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity onPress={handleBackToStep1}>
                        <Text style={styles.changeText}>Change &gt;&gt;</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>Where is this hazard?</Text>

                    <View style={styles.locationBox}>
                      <Ionicons name="location-outline" size={22} color="#6B7280" />
                      <Text style={styles.locationText}>Current Location</Text>
                    </View>

                    <Text style={styles.locationHint}>
                      Using your current location
                    </Text>

                    <Text style={styles.sectionTitle}>Tell us more (optional)</Text>

                    <TextInput
                      style={styles.descriptionInput}
                      placeholder="Describe what you see to help others..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      value={reportDescription}
                      onChangeText={setReportDescription}
                      textAlignVertical="top"
                    />

                    <Text style={styles.sectionTitle}>Add a photo (optional)</Text>

                    <TouchableOpacity style={styles.photoBox} activeOpacity={0.85}>
                      <View style={styles.photoIconCircle}>
                        <Ionicons
                          name="camera-outline"
                          size={28}
                          color="#9CA3AF"
                        />
                      </View>
                      <Text style={styles.photoTitle}>Tap to add a photo</Text>
                      <Text style={styles.photoSubtitle}>
                        Helps others identify the hazard
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>

                  <View style={styles.sheetBottomButtons}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleBackToStep1}
                    >
                      <Text style={styles.cancelButtonText}>Back</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.nextButton}
                      onPress={handleSubmitReport}
                    >
                      <Text style={styles.nextButtonText}>Submit Report</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {reportStep === 3 && (
                <>
                  <View style={styles.successContainer}>
                    <View style={styles.successIconCircle}>
                      <Ionicons name="checkmark" size={40} color="#16A34A" />
                    </View>

                    <Text style={styles.successTitle}>Report Submitted!</Text>

                    <Text style={styles.successSubtitle}>
                      Thank you for making our community safer
                    </Text>

                    <View style={styles.successMessageBox}>
                      <Text style={styles.successMessageText}>
                        Your report has been acknowledged
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sheetBottomButtons}>
                    <TouchableOpacity
                      style={styles.fullWidthButton}
                      onPress={handleDoneFromSuccess}
                    >
                      <Text style={styles.nextButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
/**
 * =========================================================
 * 13. STYLES
 * =========================================================
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  map: {
    flex: 1,
  },

  searchContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 90,
  },

  searchBox: {
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  input: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111827',
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
    backgroundColor: '#EFF6FF',
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
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  routeCard: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 16,
    backgroundColor: '#1D4ED8',
    borderRadius: 18,
    padding: 16,
    elevation: 4,
  },

  routeTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },

  routeSubtitle: {
    color: '#E5E7EB',
    fontSize: 14,
    marginTop: 4,
  },

  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  sheetWrapper: {
    width: '100%',
    justifyContent: 'flex-end',
  },

  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 22,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },

  sheetStepOne: {
    height: '95%',
  },

  sheetStepTwo: {
    height: '95%',
  },

  sheetStepThree: {
    height: '95%',
  },

  dragHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 14,
  },

  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
  },

  sheetDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 14,
    marginBottom: 16,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  stepItem: {
    width: '28%',
    alignItems: 'center',
  },

  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#D1D5DB',
    marginBottom: 6,
  },

  stepCircleActive: {
    backgroundColor: '#1D4ED8',
  },

  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#D1D5DB',
    marginTop: 16,
    marginHorizontal: 6,
  },

  stepLineActive: {
    backgroundColor: '#1D4ED8',
  },

  stepLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 2,
  },

  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    color: '#111827',
    marginBottom: 5,
  },

  stepBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  stepBadgeText: {
    fontSize: 9,
    color: '#9CA3AF',
  },

  stepBadgeActive: {
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  stepBadgeActiveText: {
    fontSize: 9,
    color: '#2563EB',
    fontWeight: '600',
  },

  sheetScroll: {
    flex: 1,
  },

  sheetContent: {
    paddingBottom: 10,
  },

  questionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 30,
  },

  required: {
    color: '#EF4444',
  },

  questionSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 18,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  card: {
    width: '48%',
    minHeight: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  cardSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },

  cardIconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  cardText: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    color: '#111827',
    lineHeight: 20,
  },

  sheetBottomButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },

  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },

  nextButton: {
    flex: 1,
    backgroundColor: '#1D4ED8',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },

  fullWidthButton: {
    flex: 1,
    backgroundColor: '#1D4ED8',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },

  nextButtonDisabled: {
    backgroundColor: '#93C5FD',
  },

  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  selectedTypeBox: {
    minHeight: 84,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  selectedTypeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },

  selectedTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  selectedTypeTextWrap: {
    flex: 1,
  },

  selectedTypeMiniLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },

  selectedTypeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },

  changeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },

  locationBox: {
    height: 64,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 6,
  },

  locationText: {
    fontSize: 17,
    color: '#111827',
    marginLeft: 10,
  },

  locationHint: {
    marginTop: 10,
    fontSize: 14,
    color: '#10B981',
    marginBottom: 22,
  },

  descriptionInput: {
    minHeight: 124,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
    marginBottom: 22,
  },

  photoBox: {
    minHeight: 150,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 16,
  },

  photoIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  photoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },

  photoSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 40,
  },

  successIconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },

  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },

  successSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 22,
  },

  successMessageBox: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },

  successMessageText: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
  },
    filterSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 28,
    minHeight: '62%',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },

  filterTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: '#4B5563',
    marginBottom: 4,
  },

  filterSectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
  },

  filterCard: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  filterCardTitle: {
    fontSize: 15,
    color: '#9CA3AF',
    marginBottom: 14,
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  checkboxChecked: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },

  checkboxLabel: {
    fontSize: 16,
    color: '#374151',
    flexShrink: 1,
  },

  filterButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },

  applyButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1D4ED8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  resetButton: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  resetButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },

  sheetDividerLarge: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 22,
  },

  safetyPanel: {
    paddingTop: 4,
  },

  safetyAdjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  safetyAdjustLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },

  safetyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },

  stepperButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    lineHeight: 22,
  },

  safetyValue: {
    width: 44,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  fakeSliderWrap: {
    position: 'relative',
    height: 34,
    justifyContent: 'center',
    marginTop: 10,
  },

  fakeSliderTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    width: '100%',
  },

  fakeSliderActive: {
    position: 'absolute',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#1D4ED8',
  },

  fakeSliderThumb: {
    position: 'absolute',
    marginLeft: -10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1D4ED8',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    top: 6,
  },

  safetyRangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },

  safetyRangeText: {
    fontSize: 15,
    color: '#111827',
  },
    hazardPreviewCard: {
    position: 'absolute',
    left: 16,
    top: 160,
    width: 210,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  hazardPreviewClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  hazardPreviewLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 6,
  },

  hazardPreviewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
    paddingRight: 24,
  },

  hazardPreviewDetailsButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  hazardPreviewDetailsText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '700',
  },

  detailModalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  hazardDetailCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 22,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },

  hazardDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  hazardDetailIconBox: {
    width: 68,
    height: 68,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  hazardDetailIconYellow: {
    backgroundColor: '#FEF3C7',
  },

  hazardDetailIconBlue: {
    backgroundColor: '#DBEAFE',
  },

  hazardDetailHeaderText: {
    flex: 1,
  },

  hazardDetailTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },

  hazardStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  hazardStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
  },

  hazardDetailDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 18,
  },

  hazardDetailSectionLabel: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 8,
  },

  hazardDetailDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: '#111827',
    marginBottom: 22,
  },

  hazardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 16,
  },

  hazardMetaItem: {
    flex: 1,
  },

  hazardMetaTitle: {
    fontSize: 15,
    color: '#9CA3AF',
    marginTop: 6,
    marginBottom: 6,
  },

  hazardMetaText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },

  hazardActionRow: {
    flexDirection: 'row',
    gap: 12,
  },

  avoidRouteButton: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#1D4ED8',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  avoidRouteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  detailSecondaryButton: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },

  detailSecondaryButtonText: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '600',
  },

});
