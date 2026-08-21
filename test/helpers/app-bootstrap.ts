import {
  DynamicModule,
  INestApplication,
  Type,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../../src/app.module';
import { BaseExceptionFilter } from '../../src/core/filters/base-exception.filter';
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
  /**
   * Extra modules to import into the root testing module, alongside
   * AppModule — e.g. a non-`@Global()` module (such as `TenancyModule`)
   * whose providers an ad-hoc `controllers` entry needs to inject/guard
   * with, but that AppModule doesn't export to its own scope. Optional and
   * defaults to none, so existing callers that don't pass it are
   * unaffected.
   */
  imports?: Array<Type<unknown> | DynamicModule>;
}

export async function createE2EApp(
  options: E2EAppOptions = {},
): Promise<E2EContext> {
  await bootstrapTestDataSource();

  let builder: TestingModuleBuilder = Test.createTestingModule({
    imports: [AppModule, ...(options.imports ?? [])],
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
