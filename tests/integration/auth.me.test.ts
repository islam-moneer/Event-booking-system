import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';

const CREDENTIALS = { email: 'ada@example.com', password: 'secret123' };

describe('GET /me', () => {
  it('GET /me returns 401 when no token is provided', async () => {
    const res = await request(app).get('/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /me returns 401 when the token is malformed', async () => {
    const res = await request(app).get('/me').set('Authorization', 'Bearer not-a-jwt');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /me returns the authenticated user for a valid token', async () => {
    const registered = await request(app).post('/register').send(CREDENTIALS);
    const { body } = await request(app).post('/login').send(CREDENTIALS);

    const res = await request(app).get('/me').set('Authorization', `Bearer ${body.token}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['created_at', 'email', 'id']);
    expect(res.body.id).toBe(registered.body.id);
    expect(res.body.email).toBe(CREDENTIALS.email);
  });

  it('GET /me returns 200 when the bearer scheme is lowercase', async () => {
    await request(app).post('/register').send(CREDENTIALS);
    const { body } = await request(app).post('/login').send(CREDENTIALS);

    const res = await request(app).get('/me').set('Authorization', `bearer ${body.token}`);

    expect(res.status).toBe(200);
  });
});
