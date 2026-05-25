import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import ReportPage from '@/app/(tabs)/report/reportpage';
import { geocodingService } from '@/services/geocoding.service';
import { hazardsService } from '@/services/hazards.service';
import { aiAssistService } from '@/services/aiAssist.service';
jest.mock('@/components/MapView/ReportHazardModal', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    __esModule: true,
    default: function MockReportModal({
      visible,
      onClose,
      reportStep,
      onNext,
      onSelectType,
      onSubmit,
      locationLabel,
      locationHint,
      similarReportCount,
      isCheckingSimilarReports,
      onReviewSimilarReports,
      aiDraftSuggestion,
      isLoadingAiDraft,
      onApplyAiDraft,
    }: {
      visible: boolean;
      onClose: () => void;
      reportStep: number;
      onNext: () => void;
      onSelectType: (type: string) => void;
      onSubmit: () => void;
      locationLabel?: string;
      locationHint?: string;
      similarReportCount?: number;
      isCheckingSimilarReports?: boolean;
      onReviewSimilarReports?: () => void;
      aiDraftSuggestion?: { suggestedType: string; suggestedSeverity: string; duplicateCount: number } | null;
      isLoadingAiDraft?: boolean;
      onApplyAiDraft?: () => void;
    }) {
      if (!visible) {
        return null;
      }
      return (
        <View testID="report-modal">
          <Text>step-{reportStep}</Text>
          <Text>{locationLabel}</Text>
          <Text>{locationHint}</Text>
          <Text>similar-{isCheckingSimilarReports ? 'checking' : similarReportCount ?? 0}</Text>
          <Text>ai-{isLoadingAiDraft ? 'checking' : aiDraftSuggestion?.suggestedType ?? 'none'}</Text>
          <Text>ai-severity-{aiDraftSuggestion?.suggestedSeverity ?? 'none'}</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close modal">
            <Text>Close</Text>
          </Pressable>
          <Pressable onPress={() => onSelectType('blocked_pavement')} accessibilityLabel="Select blocked pavement">
            <Text>Select blocked pavement</Text>
          </Pressable>
          <Pressable onPress={onNext} accessibilityLabel="Next step">
            <Text>Next</Text>
          </Pressable>
          <Pressable onPress={onSubmit} accessibilityLabel="Submit report">
            <Text>Submit</Text>
          </Pressable>
          <Pressable onPress={onReviewSimilarReports} accessibilityLabel="Review similar reports">
            <Text>Review similar</Text>
          </Pressable>
          <Pressable onPress={onApplyAiDraft} accessibilityLabel="Use AI suggestion">
            <Text>Use AI suggestion</Text>
          </Pressable>
        </View>
      );
    },
  };
});

jest.mock('@/services/geocoding.service', () => ({
  geocodingService: {
    reverse: jest.fn(),
  },
}));

jest.mock('@/services/hazards.service', () => ({
  hazardsService: {
    getHazardsPage: jest.fn(() => Promise.resolve({
      items: [],
      nextCursor: null,
      limit: 10,
      hasMore: false,
    })),
    reportHazard: jest.fn(),
    uploadHazardPhoto: jest.fn(),
  },
}));

jest.mock('@/services/aiAssist.service', () => ({
  aiAssistService: {
    previewHazardReportDraft: jest.fn(() => Promise.resolve({
      forRouteDecision: false,
      provider: 'local-rules',
      generatedAtUtc: '2026-05-25T00:00:00Z',
      text: {
        normalizedDescription: 'Pavement is blocked and wheelchair cannot pass safely.',
        suggestedType: 'obstruction',
        suggestedSeverity: 'high',
        confidence: 0.82,
        adminSummary: 'obstruction report',
        tags: ['temporary_obstacle'],
      },
      duplicateSuggestions: [{ hazardId: 'h1', distanceMetres: 10, confidence: 0.9, reason: 'nearby same type' }],
      missingOsmAttributeCandidates: [],
      shouldReviewExistingReport: true,
      suggestedDescriptionChips: ['Pavement is blocked'],
      guardrails: ['review only'],
    })),
  },
}));

describe('ReportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(geocodingService.reverse).mockResolvedValue(null);
    jest.mocked(hazardsService.getHazardsPage).mockResolvedValue({
      items: [],
      nextCursor: null,
      limit: 10,
      hasMore: false,
    });
    jest.mocked(aiAssistService.previewHazardReportDraft).mockResolvedValue({
      forRouteDecision: false,
      provider: 'local-rules',
      generatedAtUtc: '2026-05-25T00:00:00Z',
      text: {
        normalizedDescription: 'Pavement is blocked and wheelchair cannot pass safely.',
        suggestedType: 'obstruction',
        suggestedSeverity: 'high',
        confidence: 0.82,
        adminSummary: 'obstruction report',
        tags: ['temporary_obstacle'],
      },
      duplicateSuggestions: [{ hazardId: 'h1', distanceMetres: 10, confidence: 0.9, reason: 'nearby same type' }],
      missingOsmAttributeCandidates: [],
      shouldReviewExistingReport: true,
      suggestedDescriptionChips: ['Pavement is blocked'],
      guardrails: ['review only'],
    });
  });

  it('shows report modal on mount', async () => {
    const { findByTestId } = render(<ReportPage />);
    expect(await findByTestId('report-modal')).toBeTruthy();
  });

  it('closes modal and goes back', async () => {
    const { findByLabelText } = render(<ReportPage />);
    fireEvent.press(await findByLabelText('Close modal'));
    expect(router.back).toHaveBeenCalled();
  });

  it('uses reverse geocoding for the report location label', async () => {
    jest.mocked(geocodingService.reverse).mockResolvedValue({
      display_name: 'New Street, Birmingham',
    });

    const { findByText } = render(<ReportPage />);

    expect(await findByText('New Street, Birmingham')).toBeTruthy();
    expect(await findByText('Location matched automatically')).toBeTruthy();
  });

  it('checks nearby reports before submitting duplicate hazards', async () => {
    jest.mocked(hazardsService.getHazardsPage).mockResolvedValue({
      items: [
        {
          id: 'h1',
          title: 'Blocked pavement',
          type: 'blocked_pavement',
          latitude: 52.48,
          longitude: -1.89,
          description: 'Pavement blocked',
          status: 'Reported',
          locationText: 'Birmingham',
          reportedTime: 'Today',
        },
      ],
      nextCursor: null,
      limit: 10,
      hasMore: false,
    });

    const { findByLabelText, findByText } = render(<ReportPage />);
    fireEvent.press(await findByLabelText('Select blocked pavement'));
    fireEvent.press(await findByLabelText('Next step'));

    expect(await findByText('similar-1')).toBeTruthy();
  });

  it('previews AI hazard intake suggestions before submit', async () => {
    const { findByLabelText, findByText } = render(<ReportPage />);
    fireEvent.press(await findByLabelText('Select blocked pavement'));
    fireEvent.press(await findByLabelText('Next step'));

    expect(await findByText('ai-obstruction')).toBeTruthy();
    expect(await findByText('ai-severity-high')).toBeTruthy();
    expect(aiAssistService.previewHazardReportDraft).toHaveBeenCalledWith(expect.objectContaining({
      latitude: 52.48,
      longitude: -1.89,
      type: 'blocked_pavement',
      photoAttached: false,
    }));
  });
});
