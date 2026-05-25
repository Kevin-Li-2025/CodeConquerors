import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AdminHazardReport from '@/components/MapView/AdminHazardReport';
import { hazardsService } from '@/services/hazards.service';
import { dashboardService } from '@/services/system.service';

jest.mock('@/services/aiAssist.service', () => ({
  aiAssistService: {
    getHazardEnrichment: jest.fn(),
  },
}));

jest.mock('@/services/hazards.service', () => ({
  hazardsService: {
    getHazardsPage: jest.fn(),
    getHazardById: jest.fn(),
    updateHazardStatus: jest.fn(),
  },
}));

jest.mock('@/services/system.service', () => ({
  dashboardService: {
    getSummary: jest.fn(),
  },
}));

import { aiAssistService } from '@/services/aiAssist.service';

const enrichment = {
  hazardId: 'h1',
  forRouteDecision: false,
  provider: 'local-rules',
  generatedAtUtc: new Date().toISOString(),
  text: {
    normalizedDescription: 'No lights.',
    suggestedType: 'low_lighting',
    suggestedSeverity: 'medium',
    confidence: 0.7,
    adminSummary: 'low_lighting report',
    tags: ['visibility'],
  },
  duplicateSuggestions: [],
  missingOsmAttributeCandidates: [
    {
      attribute: 'lit',
      value: 'no',
      confidence: 0.64,
      evidence: 'Report indicates missing or failed lighting.',
      source: 'user_report_text',
      canAutoApply: false,
    },
  ],
  guardrails: [],
};

const summary = (pendingAlerts: number) => ({
  totalHazards: pendingAlerts,
  activeUsers: 0,
  activeUsersDefinition: 'test',
  pendingAlerts,
  resolved: 0,
});

describe('AdminHazardReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(aiAssistService.getHazardEnrichment).mockResolvedValue(enrichment);
  });

  it('shows empty state when no pending hazards', async () => {
    jest.mocked(hazardsService.getHazardsPage).mockResolvedValue({
      items: [],
      nextCursor: null,
      limit: 100,
      hasMore: false,
    });
    jest.mocked(dashboardService.getSummary).mockResolvedValue(summary(0));

    const { findByText } = render(<AdminHazardReport />);

    expect(await findByText('No pending reports')).toBeTruthy();
  });

  it('lists pending reports and opens details', async () => {
    jest.mocked(hazardsService.getHazardsPage).mockResolvedValueOnce({
      items: [
        {
          id: 'h1',
          status: 'Reported',
          type: 'Lighting',
          title: 'Dark alley',
          description: 'No lights.',
          locationText: 'Main St',
          reportedTime: new Date().toISOString(),
          latitude: 52.48,
          longitude: -1.89,
        },
      ],
      nextCursor: null,
      limit: 100,
      hasMore: false,
    }).mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      limit: 100,
      hasMore: false,
    });
    jest.mocked(hazardsService.getHazardById).mockResolvedValue({
      id: 'h1',
      type: 'Lighting',
      status: 'Reported',
      title: 'Dark alley',
      description: 'No lights.',
      locationText: 'Main St',
      reportedTime: new Date().toISOString(),
      latitude: 52.48,
      longitude: -1.89,
    });
    jest.mocked(dashboardService.getSummary).mockResolvedValue(summary(1));

    const { findByText, getByText } = render(<AdminHazardReport />);

    expect(await findByText('Dark alley')).toBeTruthy();
    fireEvent.press(getByText('Dark alley'));

    expect(await findByText('Report Details')).toBeTruthy();
    expect(await findByText('Review signals')).toBeTruthy();
    expect(await findByText('Low Lighting')).toBeTruthy();
    expect(await findByText('Lit')).toBeTruthy();
    expect(await findByText('Review Report')).toBeTruthy();
  });

  it('submits approve decision and shows success', async () => {
    jest.mocked(hazardsService.getHazardsPage).mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      limit: 100,
      hasMore: false,
    }).mockResolvedValueOnce({
      items: [
        {
          id: 'h1',
          status: 'UnderReview',
          type: 'Obstruction',
          title: 'Blocked path',
          description: 'Barrier.',
          locationText: 'Side Rd',
          reportedTime: new Date().toISOString(),
          latitude: 52.48,
          longitude: -1.89,
        },
      ],
      nextCursor: null,
      limit: 100,
      hasMore: false,
    });
    jest.mocked(hazardsService.getHazardById).mockResolvedValue({
      id: 'h1',
      type: 'Obstruction',
      status: 'UnderReview',
      title: 'Blocked path',
      description: 'Barrier.',
      locationText: 'Side Rd',
      reportedTime: new Date().toISOString(),
      latitude: 52.48,
      longitude: -1.89,
    });
    jest.mocked(dashboardService.getSummary).mockResolvedValue(summary(1));
    jest.mocked(hazardsService.updateHazardStatus).mockResolvedValue(undefined);

    const { findByText, getByText } = render(<AdminHazardReport />);

    expect(await findByText('Blocked path')).toBeTruthy();
    fireEvent.press(getByText('Blocked path'));
    expect(await findByText('Review Report')).toBeTruthy();
    fireEvent.press(getByText('Review Report'));

    expect(await findByText('Approve Report')).toBeTruthy();
    fireEvent.press(getByText('Approve Report'));

    await waitFor(() => {
      expect(hazardsService.updateHazardStatus).toHaveBeenCalledWith('h1', 1);
    });

    expect(await findByText('Report Approved Successfully')).toBeTruthy();
  });
});
