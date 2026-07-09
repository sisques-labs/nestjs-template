import { MetricsController } from './metrics.controller';

describe('MetricsController', () => {
  it('delegates exposition to the Prometheus base controller', async () => {
    const controller = new MetricsController();
    const header = jest.fn();
    const response = { header } as unknown as Parameters<
      MetricsController['index']
    >[0];

    const body = await controller.index(response);

    // The base PrometheusController returns the registry exposition text and
    // sets the Prometheus content type header.
    expect(typeof body).toBe('string');
    expect(header).toHaveBeenCalledWith(
      'Content-Type',
      expect.stringContaining('text/plain'),
    );
  });
});
