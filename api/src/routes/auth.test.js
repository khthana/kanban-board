import request from 'supertest';
import app from '../app.js';
import { clearDb } from '../test/helpers.js';

beforeAll(clearDb);
beforeEach(clearDb);

async function registerUser(email = 'alice@example.com', password = 'secret123') {
  await request(app).post('/auth/register').send({ email, password, displayName: 'Alice' });
}

describe('POST /auth/register', () => {
  it('happy path → 201 with token and refreshToken', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      password: 'secret123',
      displayName: 'Alice',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it.each([
    [{ password: 'secret123', displayName: 'Alice' }, 'missing email'],
    [{ email: 'x@x.com', displayName: 'Alice' }, 'missing password'],
    [{ email: 'x@x.com', password: 'secret123' }, 'missing displayName'],
    [{ email: 'not-an-email', password: 'secret123', displayName: 'Alice' }, 'bad email format'],
    [{ email: 'x@x.com', password: 'short', displayName: 'Alice' }, 'password too short'],
  ])('missing/invalid fields → 400 (%s)', async (body) => {
    const res = await request(app).post('/auth/register').send(body);
    expect(res.status).toBe(400);
  });

  it('duplicate email → 409', async () => {
    const body = { email: 'bob@example.com', password: 'secret123', displayName: 'Bob' };
    await request(app).post('/auth/register').send(body);
    const res = await request(app).post('/auth/register').send(body);

    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  it('happy path → 200 with token and refreshToken', async () => {
    await registerUser();
    const res = await request(app).post('/auth/login').send({
      email: 'alice@example.com',
      password: 'secret123',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('wrong password → 401', async () => {
    await registerUser();
    const res = await request(app).post('/auth/login').send({
      email: 'alice@example.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });

  it('unknown email → 401', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'nobody@example.com',
      password: 'secret123',
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('valid refreshToken → 200 with new access token', async () => {
    const reg = await request(app).post('/auth/register').send({
      email: 'alice@example.com', password: 'secret123', displayName: 'Alice',
    });
    const { refreshToken } = reg.body;

    const res = await request(app).post('/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('missing refreshToken → 400', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('invalid refreshToken → 401', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'not-a-real-token' });
    expect(res.status).toBe(401);
  });

  it('new access token works for authenticated endpoints', async () => {
    const reg = await request(app).post('/auth/register').send({
      email: 'alice@example.com', password: 'secret123', displayName: 'Alice',
    });
    const { refreshToken } = reg.body;

    const refreshRes = await request(app).post('/auth/refresh').send({ refreshToken });
    const { token } = refreshRes.body;

    const meRes = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('alice@example.com');
  });
});

describe('PATCH /auth/me', () => {
  it('updates displayName → 200 with updated user', async () => {
    const reg = await request(app).post('/auth/register').send({
      email: 'alice@example.com', password: 'secret123', displayName: 'Alice',
    });
    const { token } = reg.body;

    const res = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Alice Updated' });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Alice Updated');
    expect(res.body.email).toBe('alice@example.com');
    expect(res.body.id).toBeTruthy();
  });

  it('updates email → 200 with updated user', async () => {
    const reg = await request(app).post('/auth/register').send({
      email: 'alice@example.com', password: 'secret123', displayName: 'Alice',
    });
    const { token } = reg.body;

    const res = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'alice-new@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice-new@example.com');
    expect(res.body.displayName).toBe('Alice');
  });

  it('email already taken → 409', async () => {
    await request(app).post('/auth/register').send({
      email: 'bob@example.com', password: 'secret123', displayName: 'Bob',
    });
    const reg = await request(app).post('/auth/register').send({
      email: 'alice@example.com', password: 'secret123', displayName: 'Alice',
    });
    const { token } = reg.body;

    const res = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'bob@example.com' });

    expect(res.status).toBe(409);
  });

  it('no token → 401', async () => {
    const res = await request(app).patch('/auth/me').send({ displayName: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /auth/me/password', () => {
  async function registerAlice() {
    const reg = await request(app).post('/auth/register').send({
      email: 'alice@example.com', password: 'secret123', displayName: 'Alice',
    });
    return reg.body.token;
  }

  it('correct currentPassword → 200, can login with new password', async () => {
    const token = await registerAlice();

    const patch = await request(app)
      .patch('/auth/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'secret123', newPassword: 'newpass456' });

    expect(patch.status).toBe(200);

    const login = await request(app).post('/auth/login').send({
      email: 'alice@example.com', password: 'newpass456',
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it('wrong currentPassword → 400, password unchanged', async () => {
    const token = await registerAlice();

    const res = await request(app)
      .patch('/auth/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpass456' });

    expect(res.status).toBe(400);

    const login = await request(app).post('/auth/login').send({
      email: 'alice@example.com', password: 'secret123',
    });
    expect(login.status).toBe(200);
  });

  it('newPassword too short → 400', async () => {
    const token = await registerAlice();

    const res = await request(app)
      .patch('/auth/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'secret123', newPassword: 'short' });

    expect(res.status).toBe(400);
  });

  it('no token → 401', async () => {
    const res = await request(app)
      .patch('/auth/me/password')
      .send({ currentPassword: 'secret123', newPassword: 'newpass456' });
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me (JWT middleware)', () => {
  it('no token → 401', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('invalid token → 401', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer bad.token.here');
    expect(res.status).toBe(401);
  });

  it('valid token → 200 with user info', async () => {
    await registerUser();
    const login = await request(app).post('/auth/login').send({
      email: 'alice@example.com',
      password: 'secret123',
    });
    const { token } = login.body;

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@example.com');
    expect(res.body.displayName).toBe('Alice');
  });
});
