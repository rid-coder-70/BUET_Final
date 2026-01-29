
set -e

BACKUP_DIR="/backups"

if [ "$1" == "" ]; then
    echo "Usage: $0 <timestamp> [order|inventory|both]"
    exit 1
fi

TIMESTAMP=$1
TARGET=${2:-both}



log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

restore_order() {
    log "Restoring Order DB from $TIMESTAMP..."
    if [ ! -f "$BACKUP_DIR/order_db_${TIMESTAMP}.dump.gz" ]; then
        log "File not found: order_db_${TIMESTAMP}.dump.gz"
        return 1
    fi
    
    # Terminate connections
    PGPASSWORD=$Order_DB_PASSWORD psql -h $Order_DB_HOST -U $Order_DB_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$Order_DB_NAME';" >/dev/null 2>&1 || true
    
    # Drop and create
    PGPASSWORD=$Order_DB_PASSWORD dropdb -h $Order_DB_HOST -U $Order_DB_USER $Order_DB_NAME --if-exists
    PGPASSWORD=$Order_DB_PASSWORD createdb -h $Order_DB_HOST -U $Order_DB_USER $Order_DB_NAME
    
    # Restore (streaming gunzip)
    gunzip -c "$BACKUP_DIR/order_db_${TIMESTAMP}.dump.gz" | \
    PGPASSWORD=$Order_DB_PASSWORD pg_restore -h $Order_DB_HOST -U $Order_DB_USER -d $Order_DB_NAME --no-owner --no-privileges
    
    log "Order DB restored."
}

restore_inventory() {
    log "Restoring Inventory DB from $TIMESTAMP..."
    if [ ! -f "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump.gz" ]; then
        log "File not found: inventory_db_${TIMESTAMP}.dump.gz"
        return 1
    fi
    
    # Terminate connections
    PGPASSWORD=$Inventory_DB_PASSWORD psql -h $Inventory_DB_HOST -U $Inventory_DB_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$Inventory_DB_NAME';" >/dev/null 2>&1 || true
    
    # Drop and create
    PGPASSWORD=$Inventory_DB_PASSWORD dropdb -h $Inventory_DB_HOST -U $Inventory_DB_USER $Inventory_DB_NAME --if-exists
    PGPASSWORD=$Inventory_DB_PASSWORD createdb -h $Inventory_DB_HOST -U $Inventory_DB_USER $Inventory_DB_NAME
    
    # Restore (streaming gunzip)
    gunzip -c "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump.gz" | \
    PGPASSWORD=$Inventory_DB_PASSWORD pg_restore -h $Inventory_DB_HOST -U $Inventory_DB_USER -d $Inventory_DB_NAME --no-owner --no-privileges
    
    log "Inventory DB restored."
}

if [ "$TARGET" == "order" ] || [ "$TARGET" == "both" ]; then
    restore_order
fi

if [ "$TARGET" == "inventory" ] || [ "$TARGET" == "both" ]; then
    restore_inventory
fi
