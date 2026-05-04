# KFUPM GeoGuesser — Architecture Diagram

```mermaid
flowchart TD
    Browser["Browser"]

    subgraph EC2["EC2"]
        NGINX["nginx\n(frontend)"]
        API["Express API"]
        NGINX -- "/api/*" --> API
    end

    subgraph Lambdas["Lambda"]
        LGame["game"]
        LUpload["upload"]
    end

    APIGW["API Gateway"]
    RDS[("RDS MySQL")]
    S3["S3\n(photos)"]
    ECR["ECR"]

    Browser --> NGINX
    NGINX -- "/api/game/*\n/api/upload/*" --> APIGW
    APIGW --> LGame
    APIGW --> LUpload
    LGame --> RDS
    LUpload --> S3
    LUpload --> RDS
    API --> RDS
    Browser --> S3
    EC2 --> ECR

    classDef compute fill:#ED7100,color:#fff,stroke:#c25e00
    classDef lambda fill:#FF9900,color:#000,stroke:#b36b00
    classDef storage fill:#3F8624,color:#fff,stroke:#2a5c18
    classDef gateway fill:#8C4FFF,color:#fff,stroke:#6930d4

    class EC2,NGINX,API compute
    class LGame,LUpload lambda
    class RDS,S3,ECR storage
    class APIGW gateway
```

## Request Flow

| Path | Route |
|------|-------|
| `GET /` (React app) | Browser → EC2 nginx → static files |
| `GET /api/game/random` | Browser → EC2 nginx → API Gateway → `game` Lambda → RDS |
| `POST /api/upload/presign` | Browser → EC2 nginx → API Gateway → `upload` Lambda → S3 |
| `GET /api/photos\|auth\|admins` | Browser → EC2 nginx → Express API :5000 → RDS |
| Image fetch | Browser → S3 direct (public URL) |

## Infrastructure Modules

| Module | Resources |
|--------|-----------|
| `networking` | VPC, 2 public subnets, IGW, route table |
| `security` | SG: EC2 (80/22 in), Lambda (egress only), RDS (3306 from EC2+Lambda) |
| `ecr` | 2 ECR repos (api, frontend) |
| `iam` | EC2 instance profile, Lambda VPC+S3 role, GitHub Actions OIDC role |
| `rds` | RDS MySQL t3.micro, subnet group |
| `lambda` | game + upload Lambdas, API Gateway HTTP API, S3 CORS config |
| `ec2` | t3.micro, Elastic IP, user-data bootstrap |
