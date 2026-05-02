#!/bin/bash
set -xe

# Ensure SSM agent is installed and running before heavy Docker work
dnf install -y amazon-ssm-agent || true
systemctl enable --now amazon-ssm-agent || true
systemctl restart amazon-ssm-agent || true

# Add swap so OOM killer doesn't hit SSM agent during docker pulls
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
fi

swapon /swapfile || true

if ! grep -q '^/swapfile ' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Install and start Docker
dnf install -y docker
systemctl enable --now docker

# Wait for docker daemon to be ready
for i in $(seq 1 30); do
  docker info >/dev/null 2>&1 && break
  echo "Waiting for Docker daemon... ($i/30)"
  sleep 2
done

# Install Docker Compose plugin
mkdir -p /usr/local/lib/docker/cli-plugins
mkdir -p /opt/app

# Download docker compose with retry
for i in 1 2 3; do
  curl -fSL "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose && break
  echo "docker-compose download attempt $i failed, retrying in 10s..."
  sleep 10
done

chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Install AWS CLI if not already available
if ! command -v aws >/dev/null 2>&1; then
  dnf install -y awscli
fi


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

# Pull and start containers
docker compose pull
docker compose up -d

# Make sure SSM agent is still running after Docker pulls
systemctl restart amazon-ssm-agent || true
systemctl status amazon-ssm-agent --no-pager || true