#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "usage: deploy-release.sh <app-dir> <release>" >&2
  exit 1
fi

app_dir=$1
release=$2
release_dir="$app_dir/releases/$release"
env_file="$app_dir/.env.production"

case "$app_dir" in
  ""|/) echo "invalid app directory" >&2; exit 1 ;;
esac

test -f "$env_file"
test -f "$release_dir/compose.production.yml"
ln -sfn "$env_file" "$release_dir/.env.production"
cd "$release_dir"

compose() {
  docker compose --project-name logmind --env-file "$env_file" -f compose.production.yml "$@"
}

compose config --quiet
compose build --pull
compose run --rm api npx prisma migrate deploy --schema prisma/schema.prisma
compose up -d --remove-orphans --wait --wait-timeout 180
ln -sfn "$release_dir" "$app_dir/current"
compose ps
