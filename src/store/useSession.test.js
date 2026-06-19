import useSession from './useSession';
import * as client from '../api/client';
import * as auth from '../api/auth';

jest.mock('../api/client');
jest.mock('../api/auth');

function makeToken(sub) {
  const payload = btoa(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `header.${payload}.signature`;
}

beforeEach(() => {
  jest.clearAllMocks();
  auth.getToken.mockReturnValue(null);
  client.login.mockResolvedValue({ token: makeToken('user-1') });
  client.register.mockResolvedValue({ token: makeToken('user-1') });
  client.getMe.mockResolvedValue({ id: 'user-1', displayName: 'Alice', email: 'alice@example.com' });
  client.patchMe.mockResolvedValue({ id: 'user-1', displayName: 'Alice Updated', email: 'alice@example.com' });
  useSession.setState({ currentUserId: 'user-1', isAuthenticated: true, displayName: 'Alice', email: 'alice@example.com' });
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
  useSession.setState({ displayName: null, email: null });
  await useSession.getState().fetchProfile();

  expect(useSession.getState().displayName).toBe('Alice');
  expect(useSession.getState().email).toBe('alice@example.com');
});

test('updateProfile() updates displayName and email in store', async () => {
  await useSession.getState().updateProfile({ displayName: 'Alice Updated' });

  expect(useSession.getState().displayName).toBe('Alice Updated');
  expect(useSession.getState().email).toBe('alice@example.com');
});

test('updateProfile() 409 throws error and leaves store unchanged', async () => {
  client.patchMe.mockRejectedValue(Object.assign(new Error('email already registered'), { status: 409 }));

  await expect(useSession.getState().updateProfile({ email: 'taken@example.com' })).rejects.toMatchObject({ status: 409 });

  expect(useSession.getState().displayName).toBe('Alice');
  expect(useSession.getState().email).toBe('alice@example.com');
});
