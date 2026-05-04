#!/bin/bash
set -xe

exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1
echo "USER DATA STARTED at $(date)"

mkdir -p /opt/app

dnf install -y amazon-ssm-agent || true
systemctl enable --now amazon-ssm-agent || true
systemctl restart amazon-ssm-agent || true

if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 || true
  chmod 600 /swapfile || true
  mkswap /swapfile || true
fi

swapon /swapfile || true

if ! grep -q '^/swapfile ' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

dnf install -y docker
systemctl enable --now docker

for i in $(seq 1 30); do
  docker info >/dev/null 2>&1 && break
  echo "Waiting for Docker daemon... ($i/30)"
  sleep 2
done

mkdir -p /usr/local/lib/docker/cli-plugins

for i in 1 2 3; do
  curl -fSL "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose && break
  echo "docker-compose download attempt $i failed, retrying in 10s..."
  sleep 10
done

chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

if ! command -v aws >/dev/null 2>&1; then
  dnf install -y awscli
fi

cat > /opt/app/docker-compose.yml << COMPOSE
services:
  api:
    image: ${account_id}.dkr.ecr.${aws_region}.amazonaws.com/${project}-api:latest
    ports:
      - "80:5000"
    environment:
      DB_HOST: "${db_host}"
      DB_USER: "${db_username}"
      DB_PASSWORD: "${db_password}"
      DB_NAME: "${db_name}"
      AWS_REGION: "${aws_region}"
      AWS_BUCKET: "${aws_bucket}"
      JWT_SECRET: "${jwt_secret}"
      FRONTEND_URL: "${frontend_url}"
      PORT: "5000"
    restart: unless-stopped
COMPOSE

cat > /opt/app/ecr-login.sh << 'SCRIPT'
aws ecr get-login-password --region ${aws_region} | \
  docker login --username AWS --password-stdin ${account_id}.dkr.ecr.${aws_region}.amazonaws.com
SCRIPT

chmod +x /opt/app/ecr-login.sh

cd /opt/app

for i in 1 2 3; do
  bash ecr-login.sh && break
  echo "ECR login attempt $i failed, retrying in 10s..."
  sleep 10
done

docker compose pull
docker compose up -d --force-recreate

docker ps -a || true

systemctl restart amazon-ssm-agent || true
systemctl is-active amazon-ssm-agent || true
