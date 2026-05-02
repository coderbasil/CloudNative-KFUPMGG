#!/bin/bash
set -xe

# Add swap so OOM killer doesn't hit SSM agent during docker pulls
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

dnf install -y docker
systemctl enable --now docker

# Wait for docker daemon to be ready
for i in $(seq 1 30); do
  docker info >/dev/null 2>&1 && break
  echo "Waiting for Docker daemon... ($i/30)"
  sleep 2
done

mkdir -p /usr/local/lib/docker/cli-plugins

# Download docker compose with retry
for i in 1 2 3; do
  curl -fSL "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose && break
  echo "docker-compose download attempt $i failed, retrying in 10s..."
  sleep 10
done

chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

mkdir -p /opt/app

cat > /opt/app/docker-compose.yml << 'COMPOSE'
services:
  api:
    image: ${account_id}.dkr.ecr.${aws_region}.amazonaws.com/${project}-api:latest
    environment:
      DB_HOST: "${db_host}"
      DB_USER: "${db_username}"
      DB_PASSWORD: "${db_password}"
      DB_NAME: "${db_name}"
      AWS_REGION: "${aws_region}"
      AWS_BUCKET: "${aws_bucket}"
      JWT_SECRET: "${jwt_secret}"
      PORT: "5000"
    restart: unless-stopped

  frontend:
    image: ${account_id}.dkr.ecr.${aws_region}.amazonaws.com/${project}-frontend:latest
    environment:
      LAMBDA_API_HOST: "${lambda_api_host}"
    ports:
      - "80:80"
    depends_on:
      - api
    restart: unless-stopped
COMPOSE

cat > /opt/app/ecr-login.sh << 'SCRIPT'
aws ecr get-login-password --region ${aws_region} | \
  docker login --username AWS --password-stdin ${account_id}.dkr.ecr.${aws_region}.amazonaws.com
SCRIPT
chmod +x /opt/app/ecr-login.sh

cd /opt/app

# Retry ECR login
for i in 1 2 3; do
  bash ecr-login.sh && break
  echo "ECR login attempt $i failed, retrying in 10s..."
  sleep 10
done

docker compose pull
docker compose up -d
