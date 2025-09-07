# High-Performance REST API

A production-ready REST API designed to handle millions of requests per second with optimal performance, caching, and scalability.

## 🚀 Features

- **High Performance**: Optimized for millions of requests per second
- **Multi-level Caching**: Memory + Redis caching for ultra-fast responses
- **Database Optimization**: Connection pooling, optimized queries, and indexing
- **Security**: JWT authentication, rate limiting, and security headers
- **Monitoring**: Comprehensive logging, metrics, and health checks
- **Scalability**: Clustering support and Docker deployment
- **Load Testing**: Built-in load testing utilities

## 📊 Performance Targets

- **Response Time**: < 100ms average, < 500ms P99
- **Throughput**: > 10,000 requests/second per core
- **Error Rate**: < 1%
- **Uptime**: 99.9%

## 🛠 Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js with optimized middleware
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis + Memory cache
- **Process Management**: Cluster module for multi-core usage
- **Load Balancing**: Nginx
- **Containerization**: Docker & Docker Compose

## 📁 Project Structure

```
src/
├── server.js          # Main server setup
├── cluster.js         # Cluster management
├── config/
│   ├── database.js    # Database connection pool
│   └── redis.js       # Redis configuration
├── middleware/
│   ├── auth.js        # JWT authentication
│   ├── cache.js       # Multi-level caching
│   └── errorHandler.js # Error handling
├── routes/
│   ├── users.js       # User management
│   ├── products.js    # Product catalog
│   ├── orders.js      # Order processing
│   ├── analytics.js   # Performance metrics
│   └── health.js      # Health checks
└── utils/
    └── logger.js      # Winston logging
```

## 🚦 Quick Start

### Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**:
   ```bash
   # Create PostgreSQL database and run schema
   psql -d your_db -f database/schema.sql
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

### Production Deployment

1. **Docker Compose** (Recommended):
   ```bash
   docker-compose up -d
   ```

2. **Manual Deployment**:
   ```bash
   npm start          # Single process
   npm run cluster    # Multi-process (recommended)
   ```

## 📋 API Endpoints

### Authentication
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User login

### Users
- `GET /api/users` - List users (cached)
- `GET /api/users/:id` - Get user details (cached)

### Products
- `GET /api/products` - List products with filtering (cached)
- `GET /api/products/:id` - Get product details (cached)
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders (Requires Authentication)
- `POST /api/orders` - Create order
- `GET /api/orders` - List user orders (cached)
- `GET /api/orders/:id` - Get order details (cached)

### Analytics
- `GET /api/analytics/performance` - System metrics (cached)
- `GET /api/analytics/business` - Business analytics (cached)

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system status
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

## 🧪 Load Testing

### Built-in Load Testing
```bash
# Light test (10 connections, 30s)
node tests/load-test.js light

# Medium test (50 connections, 60s) 
node tests/load-test.js medium

# Heavy test (100 connections, 120s)
node tests/load-test.js heavy

# Test all endpoints
node tests/load-test.js --all-endpoints
```

### External Load Testing
```bash
# Install autocannon globally
npm install -g autocannon

# Basic load test
autocannon -c 100 -d 30 http://localhost:3000/health

# Product endpoint test
autocannon -c 50 -d 60 http://localhost:3000/api/products
```

## ⚡ Performance Optimizations

### Database Optimizations
- Connection pooling (10-100 connections)
- Optimized indexes for common queries
- Query timeout and statement timeout
- Materialized views for analytics

### Caching Strategy
- **Level 1**: Memory cache for hottest data
- **Level 2**: Redis for distributed caching
- Cache invalidation on data updates
- Smart cache key generation

### Application Optimizations
- Cluster mode for multi-core usage
- Compression middleware
- Optimized JSON parsing
- Request/response streaming
- Keep-alive connections

### Security & Rate Limiting
- JWT authentication with configurable expiration
- Rate limiting (1000 requests/minute by default)
- Security headers (Helmet.js)
- Input validation and sanitization

## 📊 Monitoring & Observability

### Logging
- Structured JSON logging with Winston
- Request/response logging
- Error tracking with stack traces
- Performance metrics logging

### Metrics
- Response time tracking
- Request count and throughput
- Error rate monitoring
- Database connection pool metrics
- Cache hit/miss ratios

### Health Monitoring
- `/health` - Basic availability check
- `/health/detailed` - Comprehensive system status
- `/health/ready` - Kubernetes readiness probe
- `/health/live` - Kubernetes liveness probe

## 🔧 Configuration

### Environment Variables
```env
# Server
PORT=3000
NODE_ENV=production
CLUSTER_WORKERS=0  # 0 = auto-detect CPU cores

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
DB_POOL_MIN=10
DB_POOL_MAX=100

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Security
JWT_SECRET=your-super-secure-secret
BCRYPT_ROUNDS=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# Caching
CACHE_TTL=300
MEMORY_CACHE_MAX=1000
```

### Performance Tuning

#### Database Connection Pool
- **Min Connections**: Start with CPU cores × 2
- **Max Connections**: Tune based on load testing
- **Idle Timeout**: 30 seconds default

#### Caching TTL
- **Static Data**: 300-600 seconds
- **Dynamic Data**: 60-180 seconds
- **User-specific**: 30-60 seconds

#### Cluster Workers
- **Development**: 1 worker
- **Production**: CPU cores or CPU cores × 2

## 🐳 Docker Deployment

### Single Container
```bash
docker build -t high-perf-api .
docker run -p 3000:3000 high-perf-api
```

### Full Stack with Docker Compose
```bash
# Start all services
docker-compose up -d

# Scale API instances
docker-compose up -d --scale api=4

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

## 🔍 Troubleshooting

### Performance Issues
1. Check database connection pool utilization
2. Monitor cache hit rates
3. Review slow query logs
4. Analyze response time distribution

### Memory Issues
1. Monitor heap usage in `/health/detailed`
2. Check for memory leaks in long-running processes
3. Tune cache size limits
4. Review connection pool settings

### High Error Rates
1. Check application logs for error patterns
2. Verify database connectivity
3. Monitor rate limiting effectiveness
4. Review input validation failures

## 📈 Scaling Strategies

### Vertical Scaling
- Increase CPU cores and memory
- Optimize database configuration
- Tune connection pool sizes

### Horizontal Scaling
- Deploy multiple API instances
- Use load balancer (Nginx/HAProxy)
- Implement session-less architecture
- Scale database with read replicas

### Caching Improvements
- Implement CDN for static content
- Use cache warming strategies
- Implement cache hierarchies
- Consider cache partitioning

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Run load tests (`npm run load-test`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Express.js team for the excellent framework
- PostgreSQL community for the robust database
- Redis team for the blazing-fast cache
- Node.js community for performance insights# API_REST_LEARNING_POST_RED
