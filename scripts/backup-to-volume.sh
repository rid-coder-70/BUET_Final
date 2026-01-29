
set -e

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7


mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting internal backup process..."


PGPASSWORD=$Order_DB_PASSWORD pg_dump -h postgres-order -U $Order_DB_USER -d $Order_DB_NAME --format=custom > "$BACKUP_DIR/order_db_${TIMESTAMP}.dump"
if [ $? -eq 0 ]; then
    gzip "$BACKUP_DIR/order_db_${TIMESTAMP}.dump"
    log "Order DB backed up successfully: order_db_${TIMESTAMP}.dump.gz"
else
    log "Order DB backup failed!"
fi

PGPASSWORD=$Inventory_DB_PASSWORD pg_dump -h postgres-inventory -U $Inventory_DB_USER -d $Inventory_DB_NAME --format=custom > "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump"
if [ $? -eq 0 ]; then
    gzip "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump"
    log "Inventory DB backed up successfully: inventory_db_${TIMESTAMP}.dump.gz"
else
    log "Inventory DB backup failed!"
fi


log "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*.dump.gz" -type f -mtime +${RETENTION_DAYS} -delete
log "Internal backup process complete."
