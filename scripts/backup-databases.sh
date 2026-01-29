#!/bin/bash

# Valerix Database Backup Script (Docker version)
# Runs daily to backup both PostgreSQL databases using Docker exec

set -e  # Exit on error

# Configuration
BACKUP_DIR="./backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="./backups/backup.log"

# Container names
ORDER_CONTAINER="valerix-postgres-order"
INVENTORY_CONTAINER="valerix-postgres-inventory"

# Database credentials
ORDER_DB_NAME="order_db"
ORDER_DB_USER="order_user"

INVENTORY_DB_NAME="inventory_db"
INVENTORY_DB_USER="inventory_user"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Starting database backup process"
log "=========================================="

# Backup Order Database
log "Backing up Order Database..."
docker exec "$ORDER_CONTAINER" pg_dump \
    -U "$ORDER_DB_USER" \
    -d "$ORDER_DB_NAME" \
    --format=custom \
    > "$BACKUP_DIR/order_db_${TIMESTAMP}.dump"

if [ $? -eq 0 ]; then
    log "✅ Order database backup successful: order_db_${TIMESTAMP}.dump"
    
    # Compress backup
    gzip "$BACKUP_DIR/order_db_${TIMESTAMP}.dump"
    log "✅ Compressed: order_db_${TIMESTAMP}.dump.gz"
else
    log "❌ Order database backup failed!"
    exit 1
fi

# Backup Inventory Database
log "Backing up Inventory Database..."
docker exec "$INVENTORY_CONTAINER" pg_dump \
    -U "$INVENTORY_DB_USER" \
    -d "$INVENTORY_DB_NAME" \
    --format=custom \
    > "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump"

if [ $? -eq 0 ]; then
    log "✅ Inventory database backup successful: inventory_db_${TIMESTAMP}.dump"
    
    # Compress backup
    gzip "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump"
    log "✅ Compressed: inventory_db_${TIMESTAMP}.dump.gz"
else
    log "❌ Inventory database backup failed!"
    exit 1
fi

# Cleanup old backups (keep last 7 days)
log "Cleaning up old backups (keeping last ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "*.dump.gz" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
log "✅ Cleanup complete"

# Calculate backup sizes
ORDER_SIZE=$(du -h "$BACKUP_DIR/order_db_${TIMESTAMP}.dump.gz" 2>/dev/null | cut -f1)
INVENTORY_SIZE=$(du -h "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump.gz" 2>/dev/null | cut -f1)

log "=========================================="
log "Backup Summary:"
log "  Order DB backup: $ORDER_SIZE"
log "  Inventory DB backup: $INVENTORY_SIZE"
log "  Retention: $RETENTION_DAYS days"
log "  Location: $BACKUP_DIR"
log "=========================================="
log "Backup process completed successfully!"

# List recent backups
log ""
log "Recent backups:"
ls -lh "$BACKUP_DIR"/*.dump.gz 2>/dev/null | tail -5 | tee -a "$LOG_FILE"

exit 0
