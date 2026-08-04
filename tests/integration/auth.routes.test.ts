import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';

describe('auth routes', () => {
  it('POST /register creates a user and returns 201 without the password', async () => {
    const res = await request(app)
      .post('/register')
      .send({ email: 'ada@example.com', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(['created_at', 'email', 'id']);
    expect(res.body.email).toBe('ada@example.com');
  });

  it('POST /register returns 409 for a duplicate email', async () => {
    await request(app).post('/register').send({ email: 'dup@example.com', password: 'secret123' });

    const res = await request(app)
      .post('/register')
      .send({ email: 'dup@example.com', password: 'secret123' });

    expect(res.status).toBe(409);
  });

  it('POST /login returns 200 with a JWT for valid credentials', async () => {
    await request(app).post('/register').send({ email: 'ada@example.com', password: 'secret123' });

    const res = await request(app)
      .post('/login')
      .send({ email: 'ada@example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });

  it('POST /login returns 401 for invalid credentials', async () => {
    await request(app).post('/register').send({ email: 'ada@example.com', password: 'secret123' });

    const res = await request(app)
      .post('/login')
      .send({ email: 'ada@example.com', password: 'wrong-one' });

    expect(res.status).toBe(401);
  });

  it('POST /login returns 400 for a truncated JSON body', async () => {
    const res = await request(app)
      .post('/login')
      .set('Content-Type', 'application/json')
      .send('{"email":"ada@example.com","password":"hunter2000"');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
