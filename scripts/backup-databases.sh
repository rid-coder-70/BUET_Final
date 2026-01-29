set -e  


BACKUP_DIR="./backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="./backups/backup.log"


ORDER_CONTAINER="valerix-postgres-order"
INVENTORY_CONTAINER="valerix-postgres-inventory"


ORDER_DB_NAME="order_db"
ORDER_DB_USER="order_user"

INVENTORY_DB_NAME="inventory_db"
INVENTORY_DB_USER="inventory_user"


mkdir -p "$BACKUP_DIR"


log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Starting database backup process"
log "=========================================="


log "Backing up Order Database..."
docker exec "$ORDER_CONTAINER" pg_dump \
    -U "$ORDER_DB_USER" \
    -d "$ORDER_DB_NAME" \
    --format=custom \
    > "$BACKUP_DIR/order_db_${TIMESTAMP}.dump"

if [ $? -eq 0 ]; then
    log "Order database backup successful: order_db_${TIMESTAMP}.dump"
    
    
    gzip "$BACKUP_DIR/order_db_${TIMESTAMP}.dump"
    log "Compressed: order_db_${TIMESTAMP}.dump.gz"
else
    log "Order database backup failed!"
    exit 1
fi


log "Backing up Inventory Database..."
docker exec "$INVENTORY_CONTAINER" pg_dump \
    -U "$INVENTORY_DB_USER" \
    -d "$INVENTORY_DB_NAME" \
    --format=custom \
    > "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump"

if [ $? -eq 0 ]; then
    log "Inventory database backup successful: inventory_db_${TIMESTAMP}.dump"
    
    
    gzip "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump"
    log "Compressed: inventory_db_${TIMESTAMP}.dump.gz"
else
    log "Inventory database backup failed!"
    exit 1
fi


log "Cleaning up old backups (keeping last ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "*.dump.gz" -type f -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
log "Cleanup complete"


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


log ""
log "Recent backups:"
ls -lh "$BACKUP_DIR"/*.dump.gz 2>/dev/null | tail -5 | tee -a "$LOG_FILE"

exit 0
