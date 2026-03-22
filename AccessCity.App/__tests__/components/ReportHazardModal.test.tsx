import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ReportHazardModal from '@/components/MapView/ReportHazardModal';

describe('ReportHazardModal', () => {
  const base = {
    visible: true,
    reportStep: 1 as const,
    selectedReportType: null as null,
    reportDescription: '',
    onClose: jest.fn(),
    onSelectType: jest.fn(),
    onNext: jest.fn(),
    onBack: jest.fn(),
    onSubmit: jest.fn(),
    onDone: jest.fn(),
    onChangeDescription: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('step 1 selects hazard type and advances', () => {
    const onSelectType = jest.fn();
    const onNext = jest.fn();

    const { getByText, rerender } = render(
      <ReportHazardModal {...base} onSelectType={onSelectType} onNext={onNext} />,
    );

    fireEvent.press(getByText('Other'));
    expect(onSelectType).toHaveBeenCalledWith('other');

    rerender(
      <ReportHazardModal
        {...base}
        selectedReportType="other"
        onSelectType={onSelectType}
        onNext={onNext}
      />,
    );

    fireEvent.press(getByText('Next'));
    expect(onNext).toHaveBeenCalled();
  });

  it('Cancel calls onClose', () => {
    const onClose = jest.fn();
    const { getByText } = render(<ReportHazardModal {...base} onClose={onClose} />);

    fireEvent.press(getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
