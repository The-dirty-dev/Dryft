.PHONY: build run test test-v test-race test-cover test-integration vet lint fmt clean migrate docker-up docker-down tidy ci

# Build the API binary
build:
	go build -o bin/dryft-api ./cmd/dryft-api

# Run the API server locally
run:
	go run ./cmd/dryft-api

# Run all tests
test:
	go test ./... -count=1

# Run tests with verbose output
test-v:
	go test ./... -count=1 -v

# Run tests with race detector
test-race:
	go test ./... -count=1 -race

# Run tests with coverage
test-cover:
	go test ./... -count=1 -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

# Run integration tests (requires Docker)
test-integration:
	go test -tags=integration ./tests/integration/... -count=1 -v -timeout=120s

# Run go vet
vet:
	go vet ./...

# Run golangci-lint (install: https://golangci-lint.run/welcome/install/)
lint:
	golangci-lint run ./...

# Format all Go source files
fmt:
	gofmt -s -w .

# Tidy and verify module dependencies
tidy:
	go mod tidy
	go mod verify

# Run database migrations only
migrate:
	go run ./cmd/dryft-api -migrate


# Full CI check: fmt, vet, lint, build, test
ci: fmt vet lint build test

# Start all services via Docker Compose
docker-up:
	docker compose up -d

# Stop all services
docker-down:
	docker compose down

# Rebuild and restart the API container
docker-rebuild:
	docker compose up -d --build api

# Remove build artifacts
clean:
	rm -rf bin/ coverage.out coverage.html
