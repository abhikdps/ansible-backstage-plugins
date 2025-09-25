import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RatingsFeedbackModal from './RatingsFeedbackModal';
import { useAnalytics } from '@backstage/core-plugin-api';

jest.mock('@backstage/core-plugin-api');

describe('RatingsFeedbackModal', () => {
  const handleClose = jest.fn();
  const captureEventMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalytics as jest.Mock).mockReturnValue({
      captureEvent: captureEventMock,
    });
  });

  it('renders modal with sentiment feedback by default', () => {
    render(<RatingsFeedbackModal handleClose={handleClose} />);
    expect(screen.getByTestId('ratings-feedback-modal')).toBeInTheDocument();
    // Check the value of the native select input
    const feedbackTypeInput = screen
      .getByTestId('feedback-type')
      .querySelector('input');
    expect(feedbackTypeInput).toHaveValue('sentiment');
    expect(screen.getByTestId('user-ratings')).toBeInTheDocument();
    expect(screen.getByTestId('tell-us-why')).toBeInTheDocument();
    expect(screen.getByTestId('sentiment-checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('sentiment-submit-btn')).toBeDisabled();
  });

  it('enables submit button when all sentiment fields are filled', () => {
    render(<RatingsFeedbackModal handleClose={handleClose} />);

    // Fill rating
    const ratingStars = screen
      .getByTestId('user-ratings')
      .querySelectorAll('label');
    fireEvent.click(ratingStars[2]); // 3 stars

    // Fill feedback text
    const feedbackInput = screen
      .getByTestId('tell-us-why')
      .querySelector('textarea');
    fireEvent.change(feedbackInput!, { target: { value: 'Great product!' } });

    // Check the checkbox
    const checkbox = screen.getByTestId('sentiment-checkbox');
    fireEvent.click(checkbox);

    expect(screen.getByTestId('sentiment-submit-btn')).not.toBeDisabled();
  });

  it('sends sentiment feedback and shows snackbar', async () => {
    render(<RatingsFeedbackModal handleClose={handleClose} />);

    const ratingStars = screen
      .getByTestId('user-ratings')
      .querySelectorAll('label');
    fireEvent.click(ratingStars[2]);
    const feedbackInput = screen
      .getByTestId('tell-us-why')
      .querySelector('textarea');
    fireEvent.change(feedbackInput!, { target: { value: 'Nice!' } });
    fireEvent.click(screen.getByTestId('sentiment-checkbox'));

    fireEvent.click(screen.getByTestId('sentiment-submit-btn'));

    await waitFor(() => {
      expect(captureEventMock).toHaveBeenCalledWith('feedback', 'sentiment', {
        attributes: { type: 'sentiment', ratings: 3, feedback: 'Nice!' },
      });
    });

    expect(
      screen.getByText(/Thank you sharing the ratings and feedback/),
    ).toBeInTheDocument();
  });

  it('switches to feature-request and validates fields', () => {
    render(<RatingsFeedbackModal handleClose={handleClose} />);

    // Select feature request via native input
    const feedbackTypeInput = screen
      .getByTestId('feedback-type')
      .querySelector('input') as HTMLInputElement;
    fireEvent.change(feedbackTypeInput, {
      target: { value: 'feature-request' },
    });

    expect(screen.getByTestId('issue-title')).toBeInTheDocument();
    expect(screen.getByTestId('issue-description')).toBeInTheDocument();

    const submitBtn = screen.getByTestId('sentiment-submit-btn');
    expect(submitBtn).toBeDisabled();

    // Fill fields
    const titleInput = screen.getByTestId('issue-title').querySelector('input');
    const descInput = screen
      .getByTestId('issue-description')
      .querySelector('textarea');
    fireEvent.change(titleInput!, { target: { value: 'New Feature' } });
    fireEvent.change(descInput!, { target: { value: 'Add X functionality' } });
    fireEvent.click(screen.getByTestId('sentiment-checkbox'));

    expect(submitBtn).not.toBeDisabled();
  });

  it('sends feature-request feedback and shows snackbar', async () => {
    render(<RatingsFeedbackModal handleClose={handleClose} />);

    const feedbackTypeInput = screen
      .getByTestId('feedback-type')
      .querySelector('input') as HTMLInputElement;
    fireEvent.change(feedbackTypeInput, {
      target: { value: 'feature-request' },
    });

    const titleInput = screen.getByTestId('issue-title').querySelector('input');
    const descInput = screen
      .getByTestId('issue-description')
      .querySelector('textarea');
    fireEvent.change(titleInput!, { target: { value: 'New Feature' } });
    fireEvent.change(descInput!, { target: { value: 'Add X functionality' } });
    fireEvent.click(screen.getByTestId('sentiment-checkbox'));

    fireEvent.click(screen.getByTestId('sentiment-submit-btn'));

    await waitFor(() => {
      expect(captureEventMock).toHaveBeenCalledWith('feedback', 'issue', {
        attributes: {
          type: 'feature-request',
          title: 'New Feature',
          description: 'Add X functionality',
        },
      });
    });

    expect(
      screen.getByText(/Thank you sharing this feature request/),
    ).toBeInTheDocument();
  });
});
