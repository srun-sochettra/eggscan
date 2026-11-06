import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import RepoItem from './RepoItem';
import { deepDiveRepo } from '../../api/eggscan';

// Mock the API module
vi.mock('../../api/eggscan', () => ({
  deepDiveRepo: vi.fn(),
}));

describe('RepoItem Component', () => {
  const mockRepo = {
    name: 'test-repo',
    primaryLanguage: 'JavaScript',
    stars: 42,
    description: 'A test repository',
  };

  const mockUsername = 'testuser';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders repository details correctly', () => {
    render(<RepoItem repo={mockRepo} username={mockUsername} />);

    expect(screen.getByText('test-repo')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
    expect(screen.getByText('A test repository')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deep Dive/i })).toBeInTheDocument();
  });

  it('renders repository details correctly when optional fields are missing', () => {
    const minRepo = { name: 'min-repo', stars: 0 };
    render(<RepoItem repo={minRepo} username={mockUsername} />);

    expect(screen.getByText('min-repo')).toBeInTheDocument();
    expect(screen.getByText(/0/)).toBeInTheDocument();
    expect(screen.queryByText('JavaScript')).not.toBeInTheDocument();
    expect(screen.queryByText('A test repository')).not.toBeInTheDocument();
  });

  it('handles successful deep dive analysis', async () => {
    const mockAnalysis = {
      summary: 'A cool repo.',
      architectureAndStack: 'Monolithic',
      codeStructureFeedback: 'Low complexity',
      commitQualityFeedback: 'Good commits',
      actionableImprovements: ['Add more tests'],
    };

    let resolvePromise;
    const promise = new Promise((resolve) => { resolvePromise = resolve; });
    deepDiveRepo.mockReturnValue(promise);

    render(<RepoItem repo={mockRepo} username={mockUsername} />);

    // Click deep dive button
    await userEvent.click(screen.getByRole('button', { name: /Deep Dive/i }));

    // Should show loading state
    expect(screen.getByText(/Analyzing architecture/i)).toBeInTheDocument();

    // API should be called with correct arguments
    expect(deepDiveRepo).toHaveBeenCalledWith(mockUsername, mockRepo.name, mockRepo.defaultBranch);

    // Resolve the promise
    resolvePromise(mockAnalysis);

    // Wait for analysis to load
    await waitFor(() => {
      expect(screen.queryByText(/Analyzing architecture/i)).not.toBeInTheDocument();
    });

    // Check if analysis results are displayed
    expect(screen.getByText('A cool repo.')).toBeInTheDocument();
    expect(screen.getByText('Monolithic')).toBeInTheDocument();
    expect(screen.getByText('Low complexity')).toBeInTheDocument();
    expect(screen.getByText('Good commits')).toBeInTheDocument();
    expect(screen.getByText('Add more tests')).toBeInTheDocument();
  });

  it('handles successful deep dive analysis without actionableImprovements', async () => {
    const mockAnalysis = {
      summary: 'A cool repo.',
      architectureAndStack: 'Monolithic',
      codeStructureFeedback: 'Low complexity',
      commitQualityFeedback: 'Good commits',
    };

    deepDiveRepo.mockResolvedValue(mockAnalysis);

    render(<RepoItem repo={mockRepo} username={mockUsername} />);

    // Click deep dive button
    await userEvent.click(screen.getByRole('button', { name: /Deep Dive/i }));

    // Wait for analysis to load
    await waitFor(() => {
      expect(screen.getByText('A cool repo.')).toBeInTheDocument();
    });

    // Check if analysis results are displayed without improvements
    expect(screen.queryByText('Improvements')).not.toBeInTheDocument();
  });

  it('closes analysis results when close button is clicked', async () => {
    const mockAnalysis = {
      summary: 'A cool repo.',
      architectureAndStack: 'Monolithic',
      codeStructureFeedback: 'Low complexity',
      commitQualityFeedback: 'Good commits',
    };

    deepDiveRepo.mockResolvedValue(mockAnalysis);

    render(<RepoItem repo={mockRepo} username={mockUsername} />);

    // Open analysis
    await userEvent.click(screen.getByRole('button', { name: /Deep Dive/i }));

    // Wait for analysis to load
    await waitFor(() => {
      expect(screen.getByText('A cool repo.')).toBeInTheDocument();
    });

    // Close analysis
    await userEvent.click(screen.getByRole('button', { name: /Close analysis/i }));

    // Check if analysis results are closed
    expect(screen.queryByText('A cool repo.')).not.toBeInTheDocument();
  });

  it('handles deep dive error correctly', async () => {
    const error = new Error('API rate limit exceeded');

    let rejectPromise;
    const promise = new Promise((_, reject) => { rejectPromise = reject; });
    deepDiveRepo.mockReturnValue(promise);

    render(<RepoItem repo={mockRepo} username={mockUsername} />);

    // Click deep dive button
    await userEvent.click(screen.getByRole('button', { name: /Deep Dive/i }));

    // Should show loading state
    expect(screen.getByText(/Analyzing architecture/i)).toBeInTheDocument();

    // API should be called with correct arguments
    expect(deepDiveRepo).toHaveBeenCalledWith(mockUsername, mockRepo.name, mockRepo.defaultBranch);

    // Reject the promise
    rejectPromise(error);

    // Wait for error state to appear
    await waitFor(() => {
      expect(screen.getByText(/Failed to analyze:/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/API rate limit exceeded/i)).toBeInTheDocument();
  });
});
