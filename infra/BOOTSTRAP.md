# One-time bootstrap (manual — run before `terraform apply`)

These resources can't be created by Terraform because it needs them to store state.

## 1. S3 bucket for Terraform state

```bash
aws s3api create-bucket --bucket kfupm-geo-tf-state --region eu-north-1 --create-bucket-configuration LocationConstraint=eu-north-1

aws s3api put-bucket-versioning --bucket kfupm-geo-tf-state --versioning-configuration Status=Enabled
```

## 2. DynamoDB table for state locking

```bash
aws dynamodb create-table --table-name kfupm-geo-tf-lock --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH --billing-mode PAY_PER_REQUEST --region eu-north-1
```

## 3. GitHub OIDC provider (one-time per AWS account)

```bash
aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

## 4. Add GitHub secrets

In your repo → Settings → Secrets → Actions:

- `AWS_ACCOUNT_ID` — your 12-digit AWS account ID
- `TF_VAR_db_password` — the MySQL password for RDS

## 5. First deploy

```bash
cd infra && terraform init && terraform apply -var="db_password=<your-password>"
```

Terraform will output `app_url` — that's your live site.

## What's free

| Resource        | Free tier                               |
| --------------- | --------------------------------------- |
| EC2 t3.micro    | 750 hrs/month (12 months)               |
| RDS db.t3.micro | 750 hrs/month (12 months)               |
| S3              | 5 GB storage                            |
| ECR             | 500 MB storage                          |
| Elastic IP      | Free while attached to running instance |
| Data transfer   | 100 GB/month outbound free              |
