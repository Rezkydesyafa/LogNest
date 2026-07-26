import { Controller, ForbiddenException, Get, Header, Headers, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import { Response } from 'express';
import { MetricsService } from '../../../../../packages/shared/src';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Prometheus scrape endpoint.
   *
   * Kept out of the public OpenAPI document and, when `METRICS_TOKEN` is set, behind a
   * bearer token: metric labels leak route shapes and traffic volumes.
   */
  @Get()
  @ApiExcludeEndpoint()
  @Header('cache-control', 'no-store')
  async scrape(@Headers('authorization') authorization: string | undefined, @Res() response: Response) {
    const expected = this.config.get<string>('METRICS_TOKEN');

    if (expected && !matchesToken(authorization, expected)) {
      throw new ForbiddenException('Invalid metrics token');
    }

    response.setHeader('content-type', this.metrics.contentType);
    response.send(await this.metrics.render());
  }
}

function matchesToken(authorization: string | undefined, expected: string) {
  const provided = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}
