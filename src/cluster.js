const cluster = require('cluster');
const os = require('os');
const logger = require('./utils/logger');

class ClusterManager {
  constructor() {
    this.numWorkers = process.env.CLUSTER_WORKERS || os.cpus().length;
  }

  start() {
    if (cluster.isMaster) {
      logger.info(`🎯 Master process ${process.pid} is running`);
      logger.info(`🚀 Starting ${this.numWorkers} workers`);

      // Fork workers
      for (let i = 0; i < this.numWorkers; i++) {
        cluster.fork();
      }

      // Handle worker events
      cluster.on('exit', (worker, code, signal) => {
        logger.error(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
        logger.info('Starting a new worker');
        cluster.fork();
      });

      cluster.on('online', (worker) => {
        logger.info(`Worker ${worker.process.pid} is online`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } else {
      // Worker process
      const HighPerformanceAPI = require('./server');
      const api = new HighPerformanceAPI();
      api.start();
    }
  }

  shutdown() {
    logger.info('Master process shutting down...');
    
    for (const id in cluster.workers) {
      cluster.workers[id].kill('SIGTERM');
    }

    setTimeout(() => {
      logger.error('Forced shutdown of all workers');
      process.exit(1);
    }, 10000);
  }
}

const clusterManager = new ClusterManager();
clusterManager.start();