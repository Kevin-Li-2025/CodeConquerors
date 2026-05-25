import React, { useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';

import ReportHazardModal from '../../../components/MapView/ReportHazardModal';
import { ReportHazardType } from '../../../components/MapView/MapTypes';
import {
  geocodingService,
  type GeocodingResult,
} from '../../../services/geocoding.service';
import { hazardsService } from '../../../services/hazards.service';
import type { HazardPhotoUpload } from '../../../services/hazards.service';

function formatReverseGeocode(result: GeocodingResult | null) {
  if (!result) return null;

  if (typeof result.display_name === 'string' && result.display_name.trim()) {
    return result.display_name.trim();
  }

  if (typeof result.name === 'string' && result.name.trim()) {
    return result.name.trim();
  }

  if (result.address) {
    const addressParts = [
      result.address.road,
      result.address.neighbourhood,
      result.address.suburb,
      result.address.city,
      result.address.town,
      result.address.village,
      result.address.postcode,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    if (addressParts.length > 0) {
      return addressParts.slice(0, 3).join(', ');
    }
  }

  return null;
}

export default function ReportPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(true);

  const [reportStep, setReportStep] = useState<1 | 2 | 3>(1);
  const [selectedReportType, setSelectedReportType] =
    useState<ReportHazardType | null>(null);
  const [reportDescription, setReportDescription] = useState('');
  const [reportSeverity, setReportSeverity] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [selectedPhoto, setSelectedPhoto] = useState<HazardPhotoUpload | null>(null);

  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationLabel, setLocationLabel] = useState('Current Location');
  const [locationHint, setLocationHint] = useState('Waiting for GPS fix');
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setReportModalVisible(true);
    getCurrentLocation();
  }, []);

  async function getCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocationLabel('Location permission needed');
        setLocationHint('Enable location to attach this report to the map');
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentLocation(coordinates);
      setLocationLabel('Current Location');
      setLocationHint('Location ready');
      setIsResolvingLocation(true);

      try {
        const reverseGeocode = await geocodingService.reverse(
          coordinates.latitude,
          coordinates.longitude
        );
        const resolvedLabel = formatReverseGeocode(reverseGeocode);

        if (resolvedLabel) {
          setLocationLabel(resolvedLabel);
          setLocationHint('Location matched automatically');
        }
      } catch (reverseError) {
        console.warn('Reverse geocoding failed:', reverseError);
        setLocationHint('Location ready');
      } finally {
        setIsResolvingLocation(false);
      }
    } catch (error) {
      console.error('Location error:', error);
      setLocationLabel('Location unavailable');
      setLocationHint('Try again after the device has a GPS fix');
      setIsResolvingLocation(false);
      Alert.alert('Error', 'Could not get location.');
    }
  }

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

  async function handleAddPhoto() {
    try {
      const ImagePicker = await import('expo-image-picker');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow photo access to attach an image to this hazard report.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.82,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const asset = result.assets[0];
      setSelectedPhoto({
        uri: asset.uri,
        name: asset.fileName || `hazard-photo-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
    } catch (error) {
      console.error('Photo selection error:', error);
      Alert.alert('Photo error', 'Could not select a photo.');
    }
  }

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
      const normalizedDescription = [
        reportDescription.trim(),
        `Severity: ${reportSeverity}.`,
      ].filter(Boolean).join('\n');

      const createdHazard = await hazardsService.reportHazard({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        type: selectedReportType,
        description: normalizedDescription,
      });

      if (selectedPhoto && createdHazard.id) {
        await hazardsService.uploadHazardPhoto(createdHazard.id, selectedPhoto);
      }

      setReportStep(3);
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Submit error', 'Could not submit report.');
    }
  }

  function handleDone() {
    setReportModalVisible(false);
    setSelectedPhoto(null);
    router.back();
  }

  return (
    <View style={{ flex: 1 }}>
      {isMounted ? (
        <ReportHazardModal
          visible={reportModalVisible}
          reportStep={reportStep}
          selectedReportType={selectedReportType}
          reportDescription={reportDescription}
          severity={reportSeverity}
          onClose={handleClose}
          onSelectType={setSelectedReportType}
          onChangeDescription={setReportDescription}
          onChangeSeverity={setReportSeverity}
          onAddPhoto={() => void handleAddPhoto()}
          selectedPhotoLabel={selectedPhoto?.name}
          onNext={handleNext}
          onBack={handleBack}
          onSubmit={handleSubmit}
          onDone={handleDone}
          locationLabel={locationLabel}
          locationHint={locationHint}
          isResolvingLocation={isResolvingLocation}
        />
      ) : null}
    </View>
  );
}
