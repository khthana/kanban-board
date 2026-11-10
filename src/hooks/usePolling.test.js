import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { usePolling } from './usePolling';
import * as client from '../api/client';

jest.mock('../api/client');

const BOARD_ID = 'board-1';
const FRESH    = { board: { id: BOARD_ID }, columns: [], cards: [], labels: [], members: [], cardLabels: [] };

beforeEach(() => {
  jest.useFakeTimers();
  client.getBoard.mockResolvedValue(FRESH);
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('an interval tick polls the board', async () => {
  renderHook(() =>
    usePolling({ boardId: BOARD_ID, intervalMs: 5_000 }),
  );

  await act(async () => {
    jest.advanceTimersByTime(5_000);
  });

  expect(client.getBoard).toHaveBeenCalledWith(BOARD_ID);
});

test('403 from getBoard calls onForbidden', async () => {
  const err403 = Object.assign(new Error('Forbidden'), { status: 403 });
  client.getBoard.mockRejectedValue(err403);
  const onForbidden = jest.fn();

  renderHook(() =>
    usePolling({ boardId: BOARD_ID, intervalMs: 5_000, onForbidden }),
  );

  await act(async () => {
    jest.advanceTimersByTime(5_000);
  });

  expect(onForbidden).toHaveBeenCalledTimes(1);
});

test('404 from getBoard calls onNotFound', async () => {
  const err404 = Object.assign(new Error('Not found'), { status: 404 });
  client.getBoard.mockRejectedValue(err404);
  const onNotFound  = jest.fn();

  renderHook(() =>
    usePolling({ boardId: BOARD_ID, intervalMs: 5_000, onNotFound }),
  );

  await act(async () => {
    jest.advanceTimersByTime(5_000);
  });

  expect(onNotFound).toHaveBeenCalledTimes(1);
});

test('unmount clears interval — no more polls after unmount', async () => {

  const { unmount } = renderHook(() =>
    usePolling({ boardId: BOARD_ID, intervalMs: 5_000 }),
  );

  unmount();

  await act(async () => {
    jest.advanceTimersByTime(10_000);
  });

  expect(client.getBoard).not.toHaveBeenCalled();
});
