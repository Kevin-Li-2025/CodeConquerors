import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { hazardsService } from '@/services/hazards.service';
import HazardDetailsModal from '@/components/MapView/HazardDetailsModal';
import { Hazard as HazardType } from '@/components/MapView/MapTypes';
import { AppTheme } from '@/constants/theme';

type HazardStatus = 'Reported' | 'Acknowledged' | 'Resolved';
type Severity = 'High' | 'Medium' | 'Low';
type QuickFilter = 'Type' | 'Distance' | 'Severity' | 'Status';

type HazardItem = {
  id: string | number;
  title: string;
  status: HazardStatus;
  description: string;
  location: string;
  reportedAt: string;
  icon: React.ComponentProps<typeof Ionicons>['name'] | React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconFamily: 'ionicons' | 'material';
};

const FILTERS: HazardStatus[] = ['Reported', 'Acknowledged', 'Resolved'];
const QUICK_FILTERS: QuickFilter[] = ['Type', 'Distance', 'Severity', 'Status'];
const HAZARDS_PAGE_LIMIT = 25;

const HAZARD_TONES = {
  blocked: {
    iconBg: AppTheme.color.dangerSoft,
    iconColor: AppTheme.color.danger,
    photoBg: '#E7DED2',
  },
  stairs: {
    iconBg: '#EFE6FA',
    iconColor: '#8C61B8',
    photoBg: '#E9E1D5',
  },
  surface: {
    iconBg: AppTheme.color.skySoft,
    iconColor: '#318CA1',
    photoBg: '#E7E1D8',
  },
  light: {
    iconBg: AppTheme.color.accentSoft,
    iconColor: AppTheme.color.accent,
    photoBg: '#E9E4D6',
  },
  neutral: {
    iconBg: AppTheme.color.surfaceSubtle,
    iconColor: AppTheme.color.text,
    photoBg: '#E9E2D7',
  },
};

const STATUS_STYLES: Record<
  HazardStatus,
  { badgeBackground: string; badgeBorder: string; badgeText: string }
> = {
  Reported: {
    badgeBackground: AppTheme.color.dangerSoft,
    badgeBorder: '#FDBA9C',
    badgeText: AppTheme.color.danger,
  },
  Acknowledged: {
    badgeBackground: AppTheme.color.warningSoft,
    badgeBorder: '#FCD34D',
    badgeText: AppTheme.color.warning,
  },
  Resolved: {
    badgeBackground: AppTheme.color.successSoft,
    badgeBorder: '#86EFAC',
    badgeText: AppTheme.color.success,
  },
};

function HazardIcon({ item }: { item: HazardItem }) {
  const tone = getHazardTone(item);
  if (item.iconFamily === 'material') {
    return <MaterialCommunityIcons name={item.icon as any} size={22} color={tone.iconColor} />;
  }

  return <Ionicons name={item.icon as any} size={22} color={tone.iconColor} />;
}

function getHazardTone(item: HazardItem) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  if (text.includes('stair') || text.includes('ramp')) return HAZARD_TONES.stairs;
  if (text.includes('surface') || text.includes('pavement') || text.includes('curb')) return HAZARD_TONES.surface;
  if (text.includes('light')) return HAZARD_TONES.light;
  if (text.includes('blocked') || text.includes('obstruction') || text.includes('gate')) return HAZARD_TONES.blocked;
  return HAZARD_TONES.neutral;
}

function getSeverity(item: HazardItem): Severity {
  const text = `${item.title} ${item.description}`.toLowerCase();
  if (text.includes('blocked') || text.includes('gate') || text.includes('stairs') || item.status === 'Reported') return 'High';
  if (item.status === 'Acknowledged') return 'Medium';
  return 'Low';
}

function getImpactSummary(item: HazardItem) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  if (text.includes('stair') || text.includes('ramp')) return 'May require a step-free detour';
  if (text.includes('blocked') || text.includes('gate') || text.includes('obstruction')) return 'May block wheelchair access';
  if (text.includes('surface') || text.includes('pavement') || text.includes('curb')) return 'May be hard for wheels or canes';
  if (text.includes('light')) return 'May feel unsafe after dark';
  if (text.includes('road')) return 'May force people into traffic';
  return 'May affect route comfort';
}

function getDistanceKm(item: HazardItem) {
  const seed = String(item.id)
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return 0.2 + (seed % 7) / 10;
}

function formatDistance(item: HazardItem) {
  return `${getDistanceKm(item).toFixed(1)} km`;
}

function mapHazardToItem(hazard: Awaited<ReturnType<typeof hazardsService.getHazardsPage>>['items'][number]): HazardItem | null {
  const status = hazard.status === 'UnderReview'
    ? 'Acknowledged'
    : hazard.status;

  if (status !== 'Reported' && status !== 'Acknowledged' && status !== 'Resolved') {
    return null;
  }

  return {
    id: hazard.id,
    title: hazard.title,
    status,
    description: hazard.description,
    location: hazard.locationText,
    reportedAt: hazard.reportedTime,
    icon: hazard.type.includes('pavement') || hazard.type.includes('obstruction')
      ? 'boom-gate-outline'
      : hazard.type.includes('light')
        ? 'bulb-outline'
        : 'warning-outline',
    iconFamily: hazard.type.includes('pavement') || hazard.type.includes('obstruction')
      ? 'material'
      : 'ionicons',
  };
}

export default function Hazard() {
  const [hazards, setHazards] = useState<HazardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const loadGenerationRef = useRef(0);
  const [selectedFilter, setSelectedFilter] = useState<HazardStatus>('Reported');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('Severity');

  const [selectedHazardDetail, setSelectedHazardDetail] = useState<HazardType | null>(null);
  const [hazardDetailsVisible, setHazardDetailsVisible] = useState(false);

  async function handleOpenDetails(hazardId: string | number) {
    try {
      const fullDetails = await hazardsService.getHazardById(hazardId);
      if (fullDetails) {
        setSelectedHazardDetail({
          ...fullDetails,
          id: String(fullDetails.id)
        } as HazardType);
        setHazardDetailsVisible(true);
      } else {
        Alert.alert("Error", "Could not load hazard details.");
      }
    } catch (error) {
      console.error('Failed to load full details:', error);
      Alert.alert("Error", "Failed to load hazard details.");
    }
  }

  function handleAvoidInRoute(hazard: HazardItem) {
    router.push({
      pathname: '/map',
      params: {
        avoidHazardId: String(hazard.id),
        avoidHazardTitle: hazard.title,
      },
    } as never);
  }

  function handleAvoidDetailInRoute() {
    if (!selectedHazardDetail) return;
    setHazardDetailsVisible(false);
    router.push({
      pathname: '/map',
      params: {
        avoidHazardId: String(selectedHazardDetail.id),
        avoidHazardTitle: selectedHazardDetail.title,
      },
    } as never);
  }

  const loadHazards = React.useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    try {
      setIsLoading(true);
      setHasMore(false);
      setNextCursor(null);
      const page = await hazardsService.getHazardsPage({
        status: selectedFilter,
        limit: HAZARDS_PAGE_LIMIT,
      });
      if (generation !== loadGenerationRef.current) {
        return;
      }
      const mapped = page.items
        .map(mapHazardToItem)
        .filter((hazard): hazard is HazardItem => hazard !== null);
      setHazards(mapped);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (error) {
      console.error('Failed to load hazards:', error);
      if (generation === loadGenerationRef.current) {
        setHazards([]);
        setNextCursor(null);
        setHasMore(false);
      }
    } finally {
      if (generation === loadGenerationRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [selectedFilter]);

  const loadMoreHazards = React.useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore || !nextCursor) {
      return;
    }

    const generation = loadGenerationRef.current;
    try {
      setIsLoadingMore(true);
      const page = await hazardsService.getHazardsPage({
        status: selectedFilter,
        cursor: nextCursor,
        limit: HAZARDS_PAGE_LIMIT,
      });

      if (generation !== loadGenerationRef.current) {
        return;
      }

      const mapped = page.items
        .map(mapHazardToItem)
        .filter((hazard): hazard is HazardItem => hazard !== null);

      setHazards((current) => {
        const seen = new Set(current.map((hazard) => String(hazard.id)));
        const additions = mapped.filter((hazard) => !seen.has(String(hazard.id)));
        return [...current, ...additions];
      });
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (error) {
      console.error('Failed to load more hazards:', error);
    } finally {
      if (generation === loadGenerationRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [hasMore, isLoading, isLoadingMore, nextCursor, selectedFilter]);

  useFocusEffect(
    React.useCallback(() => {
      void loadHazards();
    }, [loadHazards])
  );

  const displayHazards = React.useMemo(() => {
    const sorted = [...hazards];
    if (quickFilter === 'Type') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (quickFilter === 'Distance') {
      sorted.sort((a, b) => getDistanceKm(a) - getDistanceKm(b));
    } else if (quickFilter === 'Severity') {
      const rank: Record<Severity, number> = { High: 0, Medium: 1, Low: 2 };
      sorted.sort((a, b) => rank[getSeverity(a)] - rank[getSeverity(b)]);
    } else {
      sorted.sort((a, b) => a.status.localeCompare(b.status));
    }
    return sorted;
  }, [hazards, quickFilter]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        data={displayHazards}
        keyExtractor={(item) => String(item.id)}
        initialNumToRender={10}
        windowSize={5}
        onEndReached={() => void loadMoreHazards()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Hazards</Text>
                <Text style={styles.subtitle}>Near you · 2 km</Text>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.roundButton}
                  accessibilityRole="button"
                  onPress={() => Alert.alert('Hazard search', 'Search is connected at the map level. Use Map to search locations and inspect nearby hazards.')}
                >
                  <Ionicons name="search" size={18} color={AppTheme.color.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.filterChip}
                  accessibilityRole="button"
                  onPress={() => router.push('/report/reportpage' as never)}
                >
                  <Ionicons name="add" size={16} color={AppTheme.color.text} />
                  <Text style={styles.filterChipText}>Report</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterPill}>
              {FILTERS.map((filter) => {
                const isActive = filter === selectedFilter;

                return (
                  <TouchableOpacity
                    key={filter}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={[
                      styles.filterButton,
                      isActive && styles.filterButtonActive,
                    ]}
                    onPress={() => setSelectedFilter(filter)}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.filterText, isActive && styles.filterTextActive]}
                    >
                      {filter}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.quickFilterRow}>
              {QUICK_FILTERS.map((filter) => {
                const isActive = quickFilter === filter;
                return (
                  <TouchableOpacity
                    key={filter}
                    activeOpacity={0.86}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={[styles.quickFilterChip, isActive && styles.quickFilterChipActive]}
                    onPress={() => setQuickFilter(filter)}
                  >
                    <Text style={[styles.quickFilterText, isActive && styles.quickFilterTextActive]}>
                      {filter}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isLoading && hazards.length === 0 ? (
              <View style={styles.stateCard}>
                <ActivityIndicator color={AppTheme.color.primary} />
                <Text style={styles.stateText}>Loading hazards...</Text>
              </View>
            ) : null}

            {isLoading && hazards.length > 0 ? (
              <View style={styles.refreshRow}>
                <ActivityIndicator size="small" color={AppTheme.color.primary} />
                <Text style={styles.refreshText}>Updating list…</Text>
              </View>
            ) : null}

            {!isLoading && !hazards.length ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateText}>No hazards found for this status.</Text>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item: hazard }) => (
          <View style={styles.card}>
            <View style={styles.cardBodyRow}>
              <View style={[styles.iconWrap, { backgroundColor: getHazardTone(hazard).iconBg }]}>
                <HazardIcon item={hazard} />
              </View>

              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle} numberOfLines={2}>{hazard.title}</Text>
                <Text style={styles.impactText} numberOfLines={2}>{getImpactSummary(hazard)}</Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {formatDistance(hazard)} · {hazard.reportedAt} · {getSeverity(hazard)}
                </Text>
                <View style={styles.statusLine}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: STATUS_STYLES[hazard.status].badgeBackground,
                        borderColor: STATUS_STYLES[hazard.status].badgeBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: STATUS_STYLES[hazard.status].badgeText },
                      ]}
                    >
                      {hazard.status}
                    </Text>
                  </View>
                  <Text style={styles.locationText} numberOfLines={1}>{hazard.location}</Text>
                </View>
              </View>

              <View style={[styles.photoTile, { backgroundColor: getHazardTone(hazard).photoBg }]}>
                <View style={styles.mapPreviewGrid} />
                <Ionicons name="location" size={18} color={getHazardTone(hazard).iconColor} />
                <Text style={styles.mapPreviewText}>Map</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.primaryButton}
                onPress={() => handleAvoidInRoute(hazard)}
                accessibilityRole="button"
                accessibilityLabel={`Avoid ${hazard.title} in route`}
              >
                <Ionicons name="paper-plane-outline" size={15} color={AppTheme.color.text} />
                <Text style={styles.primaryButtonText}>Avoid in route</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                style={styles.secondaryButton}
                onPress={() => handleOpenDetails(hazard.id)}
                accessibilityRole="button"
                accessibilityLabel={`View details for ${hazard.title}`}
              >
                <Ionicons name="chevron-forward" size={16} color={AppTheme.color.text} />
                <Text style={styles.secondaryButtonText}>Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={
          <>
            {hazards.length > 0 ? (
              <View style={styles.pageHint}>
                <Text style={styles.pageHintText}>1-{displayHazards.length} of {hasMore ? `${displayHazards.length}+` : displayHazards.length}</Text>
                <View style={styles.pageButtons}>
                  <View style={styles.pageButton}>
                    <Ionicons name="chevron-back" size={15} color={AppTheme.color.textSubtle} />
                  </View>
                  <View style={[styles.pageButton, hasMore && styles.pageButtonActive]}>
                    <Ionicons name="chevron-forward" size={15} color={hasMore ? AppTheme.color.text : AppTheme.color.textSubtle} />
                  </View>
                </View>
              </View>
            ) : null}
            {isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={AppTheme.color.primary} />
                <Text style={styles.refreshText}>Loading more hazards…</Text>
              </View>
            ) : null}
          </>
        }
      />

      <HazardDetailsModal
        visible={hazardDetailsVisible}
        hazard={selectedHazardDetail}
        onClose={() => setHazardDetailsVisible(false)}
        onAvoidRoute={handleAvoidDetailInRoute}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppTheme.color.background,
  },
  screen: {
    flex: 1,
    backgroundColor: AppTheme.color.background,
  },
  content: {
    paddingHorizontal: AppTheme.space.lg,
    paddingTop: AppTheme.space.lg,
    paddingBottom: 34,
    gap: AppTheme.space.md,
    width: '100%',
    maxWidth: AppTheme.layout.mobileFrameWidth,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: AppTheme.space.md,
    marginBottom: 2,
  },
  title: {
    color: AppTheme.color.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 2,
    color: AppTheme.color.textMuted,
    ...AppTheme.type.meta,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
  },
  filterChip: {
    minHeight: 42,
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
  },
  filterChipText: {
    color: AppTheme.color.text,
    ...AppTheme.type.label,
  },
  filterPill: {
    flexDirection: 'row',
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.pill,
    padding: 6,
    gap: 3,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
  },
  quickFilterRow: {
    flexDirection: 'row',
    gap: 7,
  },
  quickFilterChip: {
    flex: 1,
    minHeight: 34,
    borderRadius: AppTheme.radius.pill,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  quickFilterChipActive: {
    borderColor: AppTheme.color.borderStrong,
    backgroundColor: AppTheme.color.primarySoft,
  },
  quickFilterText: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
  },
  quickFilterTextActive: {
    color: AppTheme.color.text,
  },
  filterButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: AppTheme.radius.pill,
    minHeight: AppTheme.layout.minTouchTarget,
  },
  stateCard: {
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    paddingHorizontal: AppTheme.space.lg,
    paddingVertical: AppTheme.space.xl,
    alignItems: 'center',
    gap: AppTheme.space.sm,
    ...AppTheme.shadow.card,
  },
  stateText: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.body,
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppTheme.space.sm,
    paddingVertical: AppTheme.space.lg,
  },
  refreshText: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.meta,
  },
  filterButtonActive: {
    backgroundColor: AppTheme.color.primary,
    shadowColor: AppTheme.color.primaryDark,
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  filterText: {
    color: AppTheme.color.textMuted,
    textAlign: 'center',
    ...AppTheme.type.label,
  },
  filterTextActive: {
    color: AppTheme.color.textInverse,
  },
  card: {
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    padding: 14,
    ...AppTheme.shadow.card,
  },
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: AppTheme.color.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 0,
  },
  impactText: {
    marginTop: 4,
    color: AppTheme.color.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0,
  },
  cardMeta: {
    marginTop: 6,
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
  },
  statusLine: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  reportedText: {
    color: AppTheme.color.textSubtle,
    ...AppTheme.type.label,
  },
  locationText: {
    flex: 1,
    minWidth: 0,
    color: AppTheme.color.textSubtle,
    ...AppTheme.type.label,
  },
  severityBadge: {
    borderRadius: AppTheme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  severityText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  photoTile: {
    width: 58,
    height: 58,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(23, 21, 16, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPreviewGrid: {
    position: 'absolute',
    left: -8,
    right: -8,
    top: 29,
    height: 1,
    backgroundColor: 'rgba(23, 21, 16, 0.16)',
    transform: [{ rotate: '-14deg' }],
  },
  mapPreviewText: {
    marginTop: 2,
    color: AppTheme.color.textMuted,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    ...AppTheme.type.label,
  },
  description: {
    color: AppTheme.color.textMuted,
    marginTop: 10,
    ...AppTheme.type.meta,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: AppTheme.radius.md,
    backgroundColor: AppTheme.color.surface,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: AppTheme.color.text,
    textAlign: 'center',
    ...AppTheme.type.label,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: AppTheme.radius.md,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: AppTheme.color.text,
    ...AppTheme.type.label,
  },
  pageHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AppTheme.space.md,
    paddingVertical: AppTheme.space.md,
  },
  pageHintText: {
    color: AppTheme.color.textMuted,
    ...AppTheme.type.label,
  },
  pageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  pageButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    backgroundColor: AppTheme.color.surface,
  },
  pageButtonActive: {
    borderColor: AppTheme.color.borderStrong,
  },
});
