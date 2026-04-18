# infra/terraform/main.tf — AWS Infrastructure as Code
# Futura Marketplace v3.0 — Production AWS setup
# terraform init && terraform plan && terraform apply

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "futura-terraform-state"
    key    = "marketplace/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# ─── Variables ──────────────────────────────────────────────
variable "aws_region"       { default = "us-east-1" }
variable "environment"      { default = "production" }
variable "app_name"         { default = "futura-marketplace" }
variable "db_password"      { sensitive = true }
variable "jwt_secret"       { sensitive = true }
variable "mp_access_token"  { sensitive = true }

# ─── VPC ────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = { Name = "${var.app_name}-vpc", Environment = var.environment }
}

resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet("10.0.0.0/16", 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "${var.app_name}-public-${count.index}", Tier = "Public" }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet("10.0.0.0/16", 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = { Name = "${var.app_name}-private-${count.index}", Tier = "Private" }
}

data "aws_availability_zones" "available" { state = "available" }

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.app_name}-igw" }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = "${var.app_name}-nat" }
}

resource "aws_eip" "nat" {
  domain = "vpc"
}

# ─── RDS PostgreSQL (Multi-AZ) ──────────────────────────────
resource "aws_db_instance" "postgres" {
  identifier             = "${var.app_name}-postgres"
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = "db.r6g.xlarge"
  allocated_storage      = 100
  max_allocated_storage  = 1000
  storage_encrypted      = true
  multi_az               = true
  db_name                = "futuradb"
  username               = "postgres"
  password               = var.db_password
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.app_name}-final-snapshot"
  performance_insights_enabled = true
  monitoring_interval    = 60
  monitoring_role_arn    = aws_iam_role.rds_monitoring.arn
  tags = { Name = "${var.app_name}-rds" }
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
}

# RDS Read Replica (for analytics queries)
resource "aws_db_instance" "postgres_replica" {
  identifier            = "${var.app_name}-postgres-replica"
  replicate_source_db   = aws_db_instance.postgres.identifier
  instance_class        = "db.r6g.large"
  storage_encrypted     = true
  publicly_accessible   = false
  vpc_security_group_ids = [aws_security_group.rds.id]
  tags = { Name = "${var.app_name}-rds-replica" }
}

# ─── ElastiCache Redis Cluster ───────────────────────────────
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${var.app_name}-redis"
  description                = "Redis cluster for sessions and cache"
  node_type                  = "cache.r6g.large"
  num_cache_clusters         = 3
  automatic_failover_enabled = true
  multi_az_enabled           = true
  engine_version             = "7.0"
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.jwt_secret
  tags = { Name = "${var.app_name}-redis" }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.app_name}-redis-subnet"
  subnet_ids = aws_subnet.private[*].id
}

# ─── S3 Buckets ─────────────────────────────────────────────
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.app_name}-uploads"
  tags   = { Name = "${var.app_name}-uploads" }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

# ─── CloudFront CDN ──────────────────────────────────────────
resource "aws_cloudfront_distribution" "cdn" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${var.app_name} CDN"

  origin {
    domain_name = aws_s3_bucket.uploads.bucket_regional_domain_name
    origin_id   = "S3-uploads"
    s3_origin_config { origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-uploads"
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate { cloudfront_default_certificate = true }
}

resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "${var.app_name} OAI"
}

# ─── ECS Fargate ────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${var.app_name}-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# ECS Task Definition template (one per service)
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.app_name}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "backend"
    image = "${aws_ecr_repository.backend.repository_url}:latest"
    portMappings = [{ containerPort = 3001, protocol = "tcp" }]
    environment = [
      { name = "NODE_ENV",      value = "production" },
      { name = "REDIS_HOST",    value = aws_elasticache_replication_group.redis.primary_endpoint_address },
    ]
    secrets = [
      { name = "DATABASE_URL",      valueFrom = aws_secretsmanager_secret.db_url.arn },
      { name = "JWT_SECRET",        valueFrom = aws_secretsmanager_secret.jwt.arn },
      { name = "MP_ACCESS_TOKEN",   valueFrom = aws_secretsmanager_secret.mp.arn },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.app_name}"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "backend"
      }
    }
    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:3001/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

resource "aws_ecs_service" "backend" {
  name            = "${var.app_name}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 3001
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}

# Auto-scaling
resource "aws_appautoscaling_target" "backend" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "${var.app_name}-backend-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# ─── ALB Load Balancer ───────────────────────────────────────
resource "aws_lb" "main" {
  name               = "${var.app_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  enable_deletion_protection = true
  tags = { Name = "${var.app_name}-alb" }
}

resource "aws_lb_target_group" "backend" {
  name        = "${var.app_name}-backend-tg"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    enabled             = true
    path                = "/health"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# ─── Secrets Manager ────────────────────────────────────────
resource "aws_secretsmanager_secret" "db_url" {
  name                    = "${var.app_name}/DATABASE_URL"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "${var.app_name}/JWT_SECRET"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "mp" {
  name                    = "${var.app_name}/MP_ACCESS_TOKEN"
  recovery_window_in_days = 7
}

# ─── ECR Repositories ────────────────────────────────────────
resource "aws_ecr_repository" "backend" {
  name                 = "${var.app_name}/backend"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
}

# ─── CloudWatch Alarms ───────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "backend_cpu_high" {
  alarm_name          = "${var.app_name}-backend-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Backend CPU > 85%"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions = {
    ServiceName = aws_ecs_service.backend.name
    ClusterName = aws_ecs_cluster.main.name
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "${var.app_name}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions          = { DBInstanceIdentifier = aws_db_instance.postgres.id }
}

resource "aws_sns_topic" "alerts" {
  name = "${var.app_name}-alerts"
}

# ─── Security Groups ─────────────────────────────────────────
resource "aws_security_group" "alb" {
  name   = "${var.app_name}-alb-sg"
  vpc_id = aws_vpc.main.id
  ingress { from_port = 443 to_port = 443 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  ingress { from_port = 80  to_port = 80  protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  egress  { from_port = 0   to_port = 0   protocol = "-1"  cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_security_group" "ecs" {
  name   = "${var.app_name}-ecs-sg"
  vpc_id = aws_vpc.main.id
  ingress { from_port = 3001 to_port = 3010 protocol = "tcp" security_groups = [aws_security_group.alb.id] }
  egress  { from_port = 0    to_port = 0    protocol = "-1"  cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_security_group" "rds" {
  name   = "${var.app_name}-rds-sg"
  vpc_id = aws_vpc.main.id
  ingress { from_port = 5432 to_port = 5432 protocol = "tcp" security_groups = [aws_security_group.ecs.id] }
}

resource "aws_security_group" "redis" {
  name   = "${var.app_name}-redis-sg"
  vpc_id = aws_vpc.main.id
  ingress { from_port = 6379 to_port = 6379 protocol = "tcp" security_groups = [aws_security_group.ecs.id] }
}

# ─── IAM Roles ───────────────────────────────────────────────
resource "aws_iam_role" "ecs_execution" {
  name               = "${var.app_name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role" "ecs_task" {
  name               = "${var.app_name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role" "rds_monitoring" {
  name               = "${var.app_name}-rds-monitoring"
  assume_role_policy = data.aws_iam_policy_document.rds_assume.json
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals { type = "Service" identifiers = ["ecs-tasks.amazonaws.com"] }
  }
}

data "aws_iam_policy_document" "rds_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals { type = "Service" identifiers = ["monitoring.rds.amazonaws.com"] }
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ─── Outputs ────────────────────────────────────────────────
output "alb_dns_name" {
  value       = aws_lb.main.dns_name
  description = "DNS name of the Application Load Balancer"
}

output "rds_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
  description = "RDS PostgreSQL primary endpoint"
}

output "redis_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
  description = "ElastiCache Redis primary endpoint"
}

output "cdn_domain" {
  value       = aws_cloudfront_distribution.cdn.domain_name
  description = "CloudFront CDN domain"
}

output "ecr_backend_url" {
  value       = aws_ecr_repository.backend.repository_url
  description = "ECR repository URL for backend"
}
