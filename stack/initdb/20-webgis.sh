#!/bin/sh
# Runs once, when the PostGIS container initializes an empty data volume.
# The application password comes from the container environment, so no file
# with a credential has to be shared between the host and the container.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_password="$WEBGIS_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE webgis LOGIN PASSWORD %L', :'app_password') \gexec
CREATE DATABASE webgis OWNER webgis;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname webgis \
  -c 'CREATE EXTENSION IF NOT EXISTS postgis'
