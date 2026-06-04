import useSession from './useSession';
import * as client from '../api/client';

jest.mock('../api/client');

function makeToken(sub) {
  const payload = btoa(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `header.${payload}.signature`;
}

beforeEach(() => {
  jest.clearAllMocks();
  client.getToken.mockReturnValue(null);
  client.login.mockResolvedValue({ token: makeToken('user-1') });
  client.register.mockResolvedValue({ token: makeToken('user-1') });
  client.getMe.mockResolvedValue({ id: 'user-1', displayName: 'Alice', email: 'alice@example.com' });
  useSession.setState({ currentUserId: null, isAuthenticated: false, displayName: null, email: null });
});

test('login() populates displayName and email from getMe', async () => {
  await useSession.getState().login('alice@example.com', 'secret123');

  expect(useSession.getState().displayName).toBe('Alice');
  expect(useSession.getState().email).toBe('alice@example.com');
  expect(useSession.getState().isAuthenticated).toBe(true);
});

test('register() populates displayName and email from getMe', async () => {
  await useSession.getState().register('alice@example.com', 'secret123', 'Alice');

  expect(useSession.getState().displayName).toBe('Alice');
  expect(useSession.getState().email).toBe('alice@example.com');
  expect(useSession.getState().isAuthenticated).toBe(true);
});

test('logout() clears displayName and email', async () => {
  useSession.setState({ displayName: 'Alice', email: 'alice@example.com', isAuthenticated: true });

  useSession.getState().logout();

  expect(useSession.getState().displayName).toBeNull();
  expect(useSession.getState().email).toBeNull();
  expect(useSession.getState().isAuthenticated).toBe(false);
});

test('fetchProfile() populates displayName and email', async () => {
  await useSession.getState().fetchProfile();

  expect(useSession.getState().displayName).toBe('Alice');
  expect(useSession.getState().email).toBe('alice@example.com');
});
