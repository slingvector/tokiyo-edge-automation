#!/bin/bash
set -e

echo "🛑 Stopping existing containers..."
docker-compose down -v

echo "🔨 Rebuilding and starting containers in detached mode..."
docker-compose up --build -d

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

echo "🗄️  Pushing Prisma schema to local database..."
docker-compose exec -T orchestrator npx prisma db push

echo "✅ Local testing environment is UP and RUNNING on http://localhost:3000!"
echo "📜 Tailing logs... (Press Ctrl+C to exit logs, the server will keep running)"
docker-compose logs -f orchestrator
