// Hand-written spec rather than generated from JSDoc comments: the route surface
// is small, and one file that reads top-to-bottom is easier to review than
// annotations scattered across routers. Revisit if the endpoint count explodes.

const errorResponse = (description: string, code: string, message: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      example: { error: { code, message } },
    },
  },
});

export const openapiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Event Booking System API',
    version: '0.1.0',
    description:
      'Concurrency-safe multi-seat event booking API. Phase 1 (auth) is implemented; ' +
      'events, seat maps and checkout land in later phases.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'local dev' }],
  tags: [
    { name: 'health', description: 'Liveness' },
    { name: 'auth', description: 'Registration, login, current user' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Credentials: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254 },
          password: {
            type: 'string',
            minLength: 8,
            description: 'At least 8 characters, at most 72 bytes (bcrypt truncates beyond that).',
          },
        },
        example: { email: 'ada@example.com', password: 'correct horse battery' },
      },
      PublicUser: {
        type: 'object',
        description: 'The user as it leaves the API — never carries the password hash.',
        required: ['id', 'email', 'created_at'],
        properties: {
          id: { type: 'integer', example: 1 },
          email: { type: 'string', format: 'email', example: 'ada@example.com' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      LoginResult: {
        type: 'object',
        required: ['token', 'user'],
        properties: {
          token: { type: 'string', description: 'JWT. Send as `Authorization: Bearer <token>`.' },
          user: { $ref: '#/components/schemas/PublicUser' },
        },
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                enum: ['VALIDATION_ERROR', 'UNAUTHORIZED', 'CONFLICT', 'INTERNAL'],
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['health'],
        summary: 'Liveness probe',
        responses: {
          200: {
            description: 'Service is up',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      },
    },
    '/register': {
      post: {
        tags: ['auth'],
        summary: 'Create an account',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Credentials' } },
          },
        },
        responses: {
          201: {
            description: 'Account created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PublicUser' } },
            },
          },
          400: errorResponse(
            'Invalid body',
            'VALIDATION_ERROR',
            'password must be at least 8 characters',
          ),
          409: errorResponse('Email already registered', 'CONFLICT', 'email already registered'),
        },
      },
    },
    '/login': {
      post: {
        tags: ['auth'],
        summary: 'Exchange credentials for a JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Credentials' } },
          },
        },
        responses: {
          200: {
            description: 'Authenticated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/LoginResult' } },
            },
          },
          400: errorResponse(
            'Invalid body',
            'VALIDATION_ERROR',
            'email must be a valid email address',
          ),
          401: errorResponse(
            'Unknown email or wrong password — deliberately the same answer for both, ' +
              'so login is not an account-existence oracle.',
            'UNAUTHORIZED',
            'invalid email or password',
          ),
        },
      },
    },
    '/me': {
      get: {
        tags: ['auth'],
        summary: 'The authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Current user',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PublicUser' } },
            },
          },
          401: errorResponse(
            'Missing, malformed, expired token, or the account behind a still-valid token is gone',
            'UNAUTHORIZED',
            'missing bearer token',
          ),
        },
      },
    },
  },
} as const;
