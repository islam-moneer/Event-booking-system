import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapiSpec } from './docs/openapi.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { authRouter } from './routes/auth.routes.js';

export const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// The raw document, for Postman/codegen imports.
app.get('/docs.json', (_req, res) => {
  res.json(openapiSpec);
});

// persistAuthorization keeps the pasted JWT across page reloads, so "Try it out"
// on /me doesn't need the token re-entered after every refresh.
app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec as unknown as swaggerUi.JsonObject, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Event Booking System API',
  }),
);

app.use(authRouter);

app.use(errorHandler);
