#!/bin/bash

# Valerix Database Restore Script
# Restores databases from backup files

set -e

# Configuration
BACKUP_DIR="./backups"

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <timestamp> [order|inventory|both]"
    echo ""
    echo "Available backups:"
    ls -lh "$BACKUP_DIR"/*.dump.gz 2>/dev/null | awk '{print $9}' || echo "No backups found"
    exit 1
fi

TIMESTAMP=$1
RESTORE_TARGET=${2:-both}

# Database credentials
ORDER_DB_HOST="localhost"
ORDER_DB_PORT="5432"
ORDER_DB_NAME="order_db"
ORDER_DB_USER="order_user"
ORDER_DB_PASSWORD="order_password"

INVENTORY_DB_HOST="localhost"
INVENTORY_DB_PORT="5433"
INVENTORY_DB_NAME="inventory_db"
INVENTORY_DB_USER="inventory_user"
INVENTORY_DB_PASSWORD="inventory_password"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Restore Order Database
restore_order_db() {
    log "Restoring Order Database from backup: ${TIMESTAMP}..."
    
    # Decompress if needed
    if [ -f "$BACKUP_DIR/order_db_${TIMESTAMP}.dump.gz" ]; then
        gunzip -k "$BACKUP_DIR/order_db_${TIMESTAMP}.dump.gz"
    fi
    
    if [ ! -f "$BACKUP_DIR/order_db_${TIMESTAMP}.dump" ]; then
        log "❌ Backup file not found: order_db_${TIMESTAMP}.dump"
        exit 1
    fi
    
    # Drop existing connections
    PGPASSWORD="$ORDER_DB_PASSWORD" psql -h "$ORDER_DB_HOST" -p "$ORDER_DB_PORT" -U "$ORDER_DB_USER" -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$ORDER_DB_NAME';" 2>/dev/null || true
    
    # Drop and recreate database
    PGPASSWORD="$ORDER_DB_PASSWORD" dropdb -h "$ORDER_DB_HOST" -p "$ORDER_DB_PORT" -U "$ORDER_DB_USER" "$ORDER_DB_NAME" --if-exists
    PGPASSWORD="$ORDER_DB_PASSWORD" createdb -h "$ORDER_DB_HOST" -p "$ORDER_DB_PORT" -U "$ORDER_DB_USER" "$ORDER_DB_NAME"
    
    # Restore backup
    PGPASSWORD="$ORDER_DB_PASSWORD" pg_restore \
        -h "$ORDER_DB_HOST" \
        -p "$ORDER_DB_PORT" \
        -U "$ORDER_DB_USER" \
        -d "$ORDER_DB_NAME" \
        --no-owner \
        --no-privileges \
        "$BACKUP_DIR/order_db_${TIMESTAMP}.dump"
    
    log "✅ Order database restored successfully!"
}

# Restore Inventory Database
restore_inventory_db() {
    log "Restoring Inventory Database from backup: ${TIMESTAMP}..."
    
    # Decompress if needed
    if [ -f "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump.gz" ]; then
        gunzip -k "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump.gz"
    fi
    
    if [ ! -f "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump" ]; then
        log "❌ Backup file not found: inventory_db_${TIMESTAMP}.dump"
        exit 1
    fi
    
    # Drop existing connections
    PGPASSWORD="$INVENTORY_DB_PASSWORD" psql -h "$INVENTORY_DB_HOST" -p "$INVENTORY_DB_PORT" -U "$INVENTORY_DB_USER" -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$INVENTORY_DB_NAME';" 2>/dev/null || true
    
    # Drop and recreate database
    PGPASSWORD="$INVENTORY_DB_PASSWORD" dropdb -h "$INVENTORY_DB_HOST" -p "$INVENTORY_DB_PORT" -U "$INVENTORY_DB_USER" "$INVENTORY_DB_NAME" --if-exists
    PGPASSWORD="$INVENTORY_DB_PASSWORD" createdb -h "$INVENTORY_DB_HOST" -p "$INVENTORY_DB_PORT" -U "$INVENTORY_DB_USER" "$INVENTORY_DB_NAME"
    
    # Restore backup
    PGPASSWORD="$INVENTORY_DB_PASSWORD" pg_restore \
        -h "$INVENTORY_DB_HOST" \
        -p "$INVENTORY_DB_PORT" \
        -U "$INVENTORY_DB_USER" \
        -d "$INVENTORY_DB_NAME" \
        --no-owner \
        --no-privileges \
        "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump"
    
    log "✅ Inventory database restored successfully!"
}

# Execute restore
case "$RESTORE_TARGET" in
    order)
        restore_order_db
        ;;
    inventory)
        restore_inventory_db
        ;;
    both)
        restore_order_db
        restore_inventory_db
        ;;
    *)
        log "❌ Invalid target: $RESTORE_TARGET (use: order, inventory, or both)"
        exit 1
        ;;
esac

log "Restore completed successfully!"
