export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Microservices System API Documentation',
    version: '1.0.0',
    description: 'Production-ready Microservices System with API Gateway, User Service, Notification Service, and NATS JetStream Event Broker.',
  },
  servers: [
    {
      url: 'http://localhost:8000',
      description: 'API Gateway (Local)',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid email format' },
            },
          },
          meta: {
            type: 'object',
            properties: {
              correlationId: { type: 'string', example: 'c9bf9e57-1685-4c89-bafb-ff5af830be8a' },
              timestamp: { type: 'string', example: '2026-09-09T14:30:00.000Z' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'System Health Check',
        tags: ['Health'],
        responses: {
          200: { description: 'Gateway and downstream status' },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        summary: 'Register a new user',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'developer@example.com' },
                  password: { type: 'string', minLength: 8, example: 'SecurePassword123!' },
                  name: { type: 'string', example: 'Jane Doe' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User created successfully and user.created event published' },
          400: { description: 'Validation error' },
          409: { description: 'User already exists' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        summary: 'Log in and receive JWT token',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'developer@example.com' },
                  password: { type: 'string', example: 'SecurePassword123!' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Authenticated successfully' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        summary: 'Request password reset (triggers async email event via NATS)',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', example: 'developer@example.com' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Reset instruction event triggered' },
        },
      },
    },
    '/api/v1/users/me': {
      get: {
        summary: 'Get current user profile',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'User profile returned' },
          401: { description: 'Unauthorized' },
        },
      },
      patch: {
        summary: 'Update current user profile (triggers user.updated event)',
        tags: ['User'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Jane Smith' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User updated' },
        },
      },
    },
    '/api/v1/notifications/audit-logs': {
      get: {
        summary: 'Query notification dispatch audit logs',
        tags: ['Notification'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'List of dispatched notifications' },
        },
      },
    },
    '/api/v1/notifications/metrics': {
      get: {
        summary: 'Get notification delivery metrics & stats',
        tags: ['Notification'],
        responses: {
          200: { description: 'Aggregated metrics' },
        },
      },
    },
  },
};
