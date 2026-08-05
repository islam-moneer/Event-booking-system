import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { openapiSpec } from '../../src/docs/openapi.js';

describe('API docs', () => {
  it('GET /docs.json serves the OpenAPI document', async () => {
    const res = await request(app).get('/docs.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(Object.keys(res.body.paths).sort()).toEqual(['/health', '/login', '/me', '/register']);
  });

  it('GET /docs serves the Swagger UI page', async () => {
    const res = await request(app).get('/docs/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });

  // The point of this one: a documented path that no longer exists would 404
  // here, so the spec can't silently drift away from the routes it describes.
  it.each(
    Object.entries(openapiSpec.paths).flatMap(([path, operations]) =>
      Object.keys(operations).map((method) => [method as 'get' | 'post', path] as const),
    ),
  )('%s %s is a real route, not just a documented one', async (method, path) => {
    const res = await request(app)[method](path);

    expect(res.status).not.toBe(404);
  });
});
