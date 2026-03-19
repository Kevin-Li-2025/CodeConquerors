import React, { useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';

import ReportHazardModal from '../../../components/MapView/ReportHazardModal';
import AdminHazardReport from '../../../components/MapView/AdminHazardReport';
import { ReportHazardType } from '../../../components/MapView/MapTypes';
import { api } from '../../../services/api';

// ======================
//TODO: The role was temporarily hardcoded (to be changed to a real logged-in user later).
// ======================
const MOCK_USER_ROLE: 'user' | 'admin' = 'user'; // Changing it to 'admin' allows you to test the admin redirect.

export default function ReportPage() {
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const [reportStep, setReportStep] = useState<1 | 2 | 3>(1);
  const [selectedReportType, setSelectedReportType] =
    useState<ReportHazardType | null>(null);
  const [reportDescription, setReportDescription] = useState('');

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const isAdmin = MOCK_USER_ROLE === 'admin'; // TODO: Change to a real user.role

  // ======================
  // Determine the role when entering the page
  // ======================
  useEffect(() => {
    if (isAdmin) {
      return;
    }

    setReportModalVisible(true);
    getCurrentLocation();
  }, [isAdmin]);

  // ======================
  // Get location (independent of MapScreen)
  // ======================
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
      console.error('Location error:', error);
      Alert.alert('Error', 'Could not get location.');
    }
  }

  // ======================
  // Close modal → Return to map
  // ======================
  function handleClose() {
    setReportModalVisible(false);
    router.back();
  }

  function handleNext() {
    if (!selectedReportType) {
      Alert.alert('Missing type', 'Please select a hazard type.');
      return;
    }
    setReportStep(2);
  }

  function handleBack() {
    setReportStep(1);
  }

  // ======================
  // Submit report
  // ======================
  async function handleSubmit() {
    if (!selectedReportType) {
      Alert.alert('Missing type', 'Please select a hazard type.');
      return;
    }

    if (!currentLocation) {
      Alert.alert('Location unavailable', 'Location not ready.');
      return;
    }

    try {
      await api.post(
        '/hazards',
        {
          type: selectedReportType,
          description: reportDescription.trim(),
          photoUrl: '',
          location: {
            x: currentLocation.longitude,
            y: currentLocation.latitude,
          },
        },
        { skipAuth: true } // TODO: If you need to add auth later, you need to modify this section.
      );

      setReportStep(3);
    } catch (error) {
      console.error(error);
      Alert.alert('Submit error', 'Could not submit report.');
    }
  }

  function handleDone() {
    setReportModalVisible(false);
    router.back();
  }

  if (isAdmin) {
    return <AdminHazardReport />;
  }

  // ======================
  // UI
  // ======================
  return (
    <View style={{ flex: 1 }}>
      <ReportHazardModal
        visible={reportModalVisible}
        reportStep={reportStep}
        selectedReportType={selectedReportType}
        reportDescription={reportDescription}
        onClose={handleClose}
        onSelectType={setSelectedReportType}
        onChangeDescription={setReportDescription}
        onNext={handleNext}
        onBack={handleBack}
        onSubmit={handleSubmit}
        onDone={handleDone}
      />
    </View>
  );
}