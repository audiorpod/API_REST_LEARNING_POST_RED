const autocannon = require('autocannon');
const logger = require('../src/utils/logger');

class LoadTester {
  constructor() {
    this.baseUrl = process.env.TEST_URL || 'http://localhost:3000';
    this.scenarios = {
      light: { connections: 10, duration: 30 },
      medium: { connections: 50, duration: 60 },
      heavy: { connections: 100, duration: 120 },
      extreme: { connections: 500, duration: 180 }
    };
  }

  async runTest(scenario = 'medium', endpoint = '/health') {
    const config = this.scenarios[scenario];
    if (!config) {
      throw new Error(`Unknown scenario: ${scenario}`);
    }

    logger.info(`Starting ${scenario} load test on ${this.baseUrl}${endpoint}`);
    logger.info(`Config: ${config.connections} connections for ${config.duration}s`);

    const instance = autocannon({
      url: `${this.baseUrl}${endpoint}`,
      connections: config.connections,
      duration: config.duration,
      pipelining: 1,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return new Promise((resolve, reject) => {
      autocannon.track(instance, {
        renderProgressBar: true,
        renderResultsTable: true,
        renderLatencyTable: true
      });

      instance.on('done', (result) => {
        logger.info('Load test completed:', {
          requests: result.requests,
          throughput: result.throughput,
          latency: result.latency,
          errors: result.errors
        });

        // Performance thresholds
        const avgLatency = result.latency.average;
        const p99Latency = result.latency.p99;
        const errorRate = (result.errors / result.requests.total) * 100;

        const analysis = {
          passed: true,
          metrics: {
            requestsPerSecond: result.throughput.average,
            avgLatency: avgLatency,
            p99Latency: p99Latency,
            errorRate: errorRate
          },
          thresholds: {
            avgLatency: { limit: 100, passed: avgLatency < 100 },
            p99Latency: { limit: 500, passed: p99Latency < 500 },
            errorRate: { limit: 1, passed: errorRate < 1 }
          }
        };

        // Check if any threshold failed
        analysis.passed = Object.values(analysis.thresholds).every(t => t.passed);

        if (analysis.passed) {
          logger.info('✅ All performance thresholds passed');
        } else {
          logger.warn('❌ Some performance thresholds failed');
        }

        resolve({ result, analysis });
      });

      instance.on('error', reject);
    });
  }

  async runMultipleEndpoints() {
    const endpoints = [
      '/health',
      '/api/products',
      '/api/users',
      '/api/analytics/performance'
    ];

    const results = {};

    for (const endpoint of endpoints) {
      try {
        logger.info(`Testing endpoint: ${endpoint}`);
        const { result, analysis } = await this.runTest('light', endpoint);
        results[endpoint] = { result, analysis };
        
        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        logger.error(`Error testing ${endpoint}:`, error);
        results[endpoint] = { error: error.message };
      }
    }

    return results;
  }
}

// CLI interface
if (require.main === module) {
  const tester = new LoadTester();
  const scenario = process.argv[2] || 'medium';
  const endpoint = process.argv[3] || '/health';

  if (process.argv[2] === '--all-endpoints') {
    tester.runMultipleEndpoints()
      .then(results => {
        console.log('\n📊 Load Test Summary:');
        Object.entries(results).forEach(([endpoint, data]) => {
          if (data.error) {
            console.log(`❌ ${endpoint}: ${data.error}`);
          } else {
            const { analysis } = data;
            const status = analysis.passed ? '✅' : '❌';
            console.log(`${status} ${endpoint}: ${analysis.metrics.requestsPerSecond.toFixed(2)} req/s, ${analysis.metrics.avgLatency.toFixed(2)}ms avg`);
          }
        });
      })
      .catch(console.error);
  } else {
    tester.runTest(scenario, endpoint)
      .then(({ analysis }) => {
        process.exit(analysis.passed ? 0 : 1);
      })
      .catch(console.error);
  }
}

module.exports = LoadTester;