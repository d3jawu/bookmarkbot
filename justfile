DC := "docker compose"
RUN := DC + " run --rm app"
set dotenv-load := false


default:
    @just -lu

# Create the config file if it doesn't exist
config:
    @([ ! -f config.json ] && cp config.template.json config.json) || true

# Build all containers
build:
	{{ DC }} build

# Spin up all (or the specified) services
up service="": config
	{{ DC }} up -d {{ service }}

# Tear down all services
down *args:
	{{ DC }} down {{ args }}

# Attach logs to all (or the specified) services
logs service="":
	{{ DC }} logs -f {{ service }}

# Run a command using the web image
run +args: config
	{{ RUN }} {{ args }}

# Pull the docker image
pull:
    {{ DC }} pull

# Pull, build, and deploy all services
deploy:
    -git pull
    @just pull
    @just up
