import { INestApplication, Type, ValidationPipe } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../../src/app.module'; // eslint-disable-line no-restricted-syntax -- AppModule lives at src root; no path alias
import { BaseExceptionFilter } from '@core/filters/base-exception.filter';
import { bootstrapTestDataSource } from './test-data-source';

export interface E2EContext {
  app: INestApplication;
  http: () => ReturnType<typeof request>;
  dataSource: DataSource;
  close: () => Promise<void>;
}

export interface E2EAppOptions {
  /** Extra controllers to add to the root testing module, alongside AppModule. */
  controllers?: Type<unknown>[];
  /** DI tokens to override with a fixed value before compiling the module — e.g. a mocked provider. */
  overrideProviders?: Array<{ token: unknown; useValue: unknown }>;
}

export async function createE2EApp(
  options: E2EAppOptions = {},
): Promise<E2EContext> {
  await bootstrapTestDataSource();

  let builder: TestingModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  });
  for (const { token, useValue } of options.overrideProviders ?? []) {
    builder = builder.overrideProvider(token).useValue(useValue);
  }

  const moduleFixture = await builder.compile();

  const app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api');

  // Mirrors src/main.ts: createNestApplication() doesn't run the real
  // bootstrap() function, so cookie-parser has to be wired here too or
  // req.cookies is undefined for every e2e spec that needs cookies.
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new BaseExceptionFilter());

  await app.init();

  const dataSource = moduleFixture.get<DataSource>(getDataSourceToken());

  return {
    app,
    http: () => request(app.getHttpServer()),
    dataSource,
    close: async () => {
      await app.close();
    },
  };
}
