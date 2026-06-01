import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { usePolling } from './usePolling';
import * as client from '../api/client';

jest.mock('../api/client');

const BOARD_ID = 'board-1';
const USER_ID  = 'user-1';
const FRESH    = { board: { id: BOARD_ID }, columns: [], cards: [], labels: [], members: [], cardLabels: [] };

beforeEach(() => {
  jest.useFakeTimers();
  client.getBoard.mockResolvedValue(FRESH);
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

test('interval tick triggers reconcile and calls onReconcile', async () => {
  const onReconcile = jest.fn();

  renderHook(() =>
    usePolling({ boardId: BOARD_ID, userId: USER_ID, intervalMs: 5_000, onReconcile }),
  );

  await act(async () => {
    jest.advanceTimersByTime(5_000);
  });

  expect(client.getBoard).toHaveBeenCalledWith(BOARD_ID, USER_ID);
  expect(onReconcile).toHaveBeenCalledWith(FRESH);
});

test('403 from getBoard calls onForbidden and does not call onReconcile', async () => {
  const err403 = Object.assign(new Error('Forbidden'), { status: 403 });
  client.getBoard.mockRejectedValue(err403);
  const onReconcile = jest.fn();
  const onForbidden = jest.fn();

  renderHook(() =>
    usePolling({ boardId: BOARD_ID, userId: USER_ID, intervalMs: 5_000, onReconcile, onForbidden }),
  );

  await act(async () => {
    jest.advanceTimersByTime(5_000);
  });

  expect(onForbidden).toHaveBeenCalledTimes(1);
  expect(onReconcile).not.toHaveBeenCalled();
});

test('404 from getBoard calls onNotFound and does not call onReconcile', async () => {
  const err404 = Object.assign(new Error('Not found'), { status: 404 });
  client.getBoard.mockRejectedValue(err404);
  const onReconcile = jest.fn();
  const onNotFound  = jest.fn();

  renderHook(() =>
    usePolling({ boardId: BOARD_ID, userId: USER_ID, intervalMs: 5_000, onReconcile, onNotFound }),
  );

  await act(async () => {
    jest.advanceTimersByTime(5_000);
  });

  expect(onNotFound).toHaveBeenCalledTimes(1);
  expect(onReconcile).not.toHaveBeenCalled();
});

test('unmount clears interval — no more reconcile after unmount', async () => {
  const onReconcile = jest.fn();

  const { unmount } = renderHook(() =>
    usePolling({ boardId: BOARD_ID, userId: USER_ID, intervalMs: 5_000, onReconcile }),
  );

  unmount();

  await act(async () => {
    jest.advanceTimersByTime(10_000);
  });

  expect(onReconcile).not.toHaveBeenCalled();
});
