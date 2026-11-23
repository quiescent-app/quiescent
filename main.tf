terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = local.region
}

variable "staging_web_origins" {
  description = "Exact HTTPS origins allowed for staging browser access once its frontend exists."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for origin in var.staging_web_origins : can(regex("^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$", origin))
    ])
    error_message = "Staging origins must be HTTPS origins without a path or trailing slash."
  }
}

variable "production_web_origins" {
  description = "Exact HTTPS origins allowed for production browser access once its frontend exists."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for origin in var.production_web_origins : can(regex("^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$", origin))
    ])
    error_message = "Production origins must be HTTPS origins without a path or trailing slash."
  }
}

data "aws_caller_identity" "current" {}

locals {
  region = "us-east-2"
  web_origins = {
    development = ["http://localhost:5173"]
    staging     = var.staging_web_origins
    production  = var.production_web_origins
  }
}

resource "aws_s3_bucket" "photos" {
  for_each = local.web_origins

  bucket        = "quiescent-photos-${data.aws_caller_identity.current.account_id}-${each.key}"
  force_destroy = false

  tags = {
    Application = "quiescent"
    Environment = each.key
    Purpose     = "photos"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "photos" {
  for_each = aws_s3_bucket.photos

  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "photos" {
  for_each = aws_s3_bucket.photos

  bucket = each.value.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "photos" {
  for_each = aws_s3_bucket.photos

  bucket = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "photos" {
  for_each = {
    for environment, bucket in aws_s3_bucket.photos : environment => bucket
    if length(local.web_origins[environment]) > 0
  }

  bucket = each.value.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "POST"]
    allowed_origins = local.web_origins[each.key]
    max_age_seconds = 300
  }
}

data "aws_iam_policy_document" "require_tls" {
  for_each = aws_s3_bucket.photos

  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      each.value.arn,
      "${each.value.arn}/*",
    ]

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "require_tls" {
  for_each = aws_s3_bucket.photos

  bucket = each.value.id
  policy = data.aws_iam_policy_document.require_tls[each.key].json

  depends_on = [aws_s3_bucket_public_access_block.photos]
}

data "aws_iam_policy_document" "photo_service" {
  for_each = aws_s3_bucket.photos

  statement {
    sid       = "InspectBucket"
    actions   = ["s3:ListBucket"]
    resources = [each.value.arn]
  }

  statement {
    sid     = "ManagePhotoObjects"
    actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = [
      "${each.value.arn}/pending/*",
      "${each.value.arn}/photos/*",
    ]
  }
}

resource "aws_iam_policy" "photo_service" {
  for_each = aws_s3_bucket.photos

  name        = "quiescent-photo-service-${each.key}"
  description = "Photo service access to the ${each.key} bucket only"
  policy      = data.aws_iam_policy_document.photo_service[each.key].json
}

output "photo_bucket_names" {
  description = "Environment-specific values for S3_PHOTO_BUCKET."
  value       = { for environment, bucket in aws_s3_bucket.photos : environment => bucket.id }
}

output "photo_service_policy_arns" {
  description = "Attach each policy to its environment's backend workload identity."
  value       = { for environment, policy in aws_iam_policy.photo_service : environment => policy.arn }
}

output "photo_region" {
  description = "Value for AWS_REGION in every backend environment."
  value       = local.region
}
