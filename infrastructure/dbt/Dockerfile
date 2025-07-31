# dbt Docker image for Glimmr data transformations
FROM python:3.12-slim

# Set working directory
WORKDIR /usr/app/dbt

# Install system dependencies and security updates
RUN apt-get update && apt-get install -y \
    git \
    curl \
    ca-certificates \
    && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install latest dbt with PostgreSQL adapter
# Using exact latest versions as of July 2025
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir \
    dbt-core==1.10.6 \
    dbt-postgres==1.9.0 \
    && pip cache purge

# Create dbt user
RUN useradd -m -s /bin/bash dbt
RUN chown -R dbt:dbt /usr/app/dbt

# Switch to dbt user
USER dbt

# Copy dbt project files
COPY --chown=dbt:dbt . .

# Set environment variables
ENV DBT_PROFILES_DIR=/usr/app/dbt/profiles

# Default command
CMD ["dbt", "--help"]
