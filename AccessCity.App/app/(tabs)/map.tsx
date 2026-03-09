import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

const hazards = [
  {
    id: 1,
    title: 'Broken pavement',
    latitude: 52.4865,
    longitude: -1.891,
  },
  {
    id: 2,
    title: 'No wheelchair ramp',
    latitude: 52.4852,
    longitude: -1.888,
  },
];

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 52.4862,
          longitude: -1.8904,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {hazards.map((hazard) => (
          <Marker
            key={hazard.id}
            coordinate={{
              latitude: hazard.latitude,
              longitude: hazard.longitude,
            }}
            title={hazard.title}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});