import { Controller, Get, Logger, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { Response } from 'express';

/**
 * Public Prometheus scrape endpoint. Resolves to `GET /api/metrics` (the
 * `@willsoto/nestjs-prometheus` module forces the route path; the global `api`
 * prefix is applied by Nest).
 *
 * Unauthenticated by default — access is expected to be restricted at the
 * network layer. Add an auth guard here once the service has one.
 */
@ApiTags('metrics')
@Controller()
export class MetricsController extends PrometheusController {
  private readonly logger = new Logger(MetricsController.name);

  @Get()
  @ApiOperation({ summary: 'Prometheus metrics exposition' })
  index(@Res({ passthrough: true }) response: Response): Promise<string> {
    this.logger.debug('Metrics scrape requested');
    return super.index(response);
  }
}
