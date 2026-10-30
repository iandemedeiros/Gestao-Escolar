import { INestApplication } from '@nestjs/common';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import document from './public-contract.json' with { type: 'json' };

export function frontendOrigins(
  value = process.env.FRONTEND_ORIGINS ?? '',
): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => {
          try {
            const url = new URL(origin);
            if (
              !['http:', 'https:'].includes(url.protocol) ||
              url.username ||
              url.password ||
              url.pathname !== '/' ||
              url.search ||
              url.hash ||
              url.hostname.includes('*')
            )
              throw new Error();
            return url.origin;
          } catch {
            throw new Error(
              'FRONTEND_ORIGINS deve conter origens HTTP(S) explicitas, separadas por virgula.',
            );
          }
        }),
    ),
  ];
}

export function configureFrontend(app: INestApplication): void {
  const allowed = new Set(frontendOrigins());
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow: boolean) => void,
    ) => callback(null, !origin || allowed.has(origin)),
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
    maxAge: 600,
    optionsSuccessStatus: 204,
  });
  SwaggerModule.setup('api/docs', app, document as unknown as OpenAPIObject, {
    jsonDocumentUrl: '/api/docs-json',
    raw: ['json'],
    customSiteTitle: 'Gestao Escolar - API',
    swaggerOptions: { persistAuthorization: false },
  });
}
