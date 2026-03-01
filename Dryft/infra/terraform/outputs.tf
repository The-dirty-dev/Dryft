output "vpc_id" {
  value = aws_vpc.this.id
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "postgres_endpoint" {
  value     = aws_db_instance.postgres.address
  sensitive = true
}

output "redis_endpoint" {
  value     = aws_elasticache_cluster.redis.cache_nodes[0].address
  sensitive = true
}

output "assets_bucket" {
  value = aws_s3_bucket.assets.bucket
}

output "api_security_group_id" {
  value = aws_security_group.api.id
}
