#!/bin/bash
set -e

dnf install -y docker
systemctl enable --now docker

mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

mkdir -p /opt/app

cat > /opt/app/docker-compose.yml << 'COMPOSE'
services:
  api:
    image: ${account_id}.dkr.ecr.${aws_region}.amazonaws.com/${project}-api:latest
    environment:
      DB_HOST: ${db_host}
      DB_USER: ${db_username}
      DB_PASSWORD: ${db_password}
      DB_NAME: ${db_name}
      AWS_REGION: ${aws_region}
      AWS_BUCKET: ${aws_bucket}
      PORT: "5000"
    restart: unless-stopped

  frontend:
    image: ${account_id}.dkr.ecr.${aws_region}.amazonaws.com/${project}-frontend:latest
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
bash ecr-login.sh
docker compose pull
docker compose up -d
