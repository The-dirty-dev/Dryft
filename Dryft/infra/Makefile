SHELL := /bin/bash

COMPOSE_PROD ?= ../docker-compose.prod.yml
COMPOSE_MON ?= ../docker-compose.monitoring.yml
COMPOSE_DEV ?= ../docker-compose.dev.yml

.PHONY: up down logs backup restore deploy-staging deploy-prod

up:
	docker compose -f $(COMPOSE_PROD) -f $(COMPOSE_MON) up -d

down:
	docker compose -f $(COMPOSE_PROD) -f $(COMPOSE_MON) down

logs:
	docker compose -f $(COMPOSE_PROD) -f $(COMPOSE_MON) logs -f --tail=200

backup:
	./scripts/backup-postgres.sh

restore:
	./scripts/restore-postgres.sh $(BACKUP_FILE)

deploy-staging:
	@echo "TODO: deploy staging (configure target in infra/Makefile)"

deploy-prod:
	@echo "TODO: deploy prod (configure target in infra/Makefile)"
