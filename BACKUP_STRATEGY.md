# Backup and Disaster Recovery Strategy

This document outlines the backup strategy for the Valerix Microservices system, including automated backup procedures, restore processes, and disaster recovery plans.

## 📋 Backup Requirements

### Constraints

- **Once-per-day backups** (as specified)
- **Data retention**: 7 days for local, 30 days for cloud
- **Recovery Time Objective (RTO)**: < 1 hour
- **Recovery Point Objective (RPO)**: 24 hours

### What Needs Backup

1. **PostgreSQL Databases**
   - Order Service database (`order_db`)
   - Inventory Service database (`inventory_db`)

2. **Application Configuration** (optional)
   - Environment variables
   - docker-compose.yml
   - Kubernetes manifests

3. **Monitoring Data** (optional)
   - Prometheus metrics (if long-term storage needed)
   - Grafana dashboards

---

## 🔄 Backup Strategy

### Local Environment (Development)

**Automated daily PostgreSQL backups** using `pg_dump` with compression and rotation.

### Cloud Environment (Azure)

**Automated backups** using Azure Database for PostgreSQL built-in backup feature.

---

## 🛠️ Local Backup Implementation

### 1. Backup Script

**File: `scripts/backup-databases.sh`**

Automated backup script that:

- Creates compressed SQL dumps
- Stores backups with timestamps
- Retains last 7 days of backups
- Logs all operations

### 2. Automated Scheduling

**Setup daily backups at 2:00 AM:**

```bash
# Add to crontab
crontab -e

# Add this line:
0 2 * * * /path/to/valerix-microservices/scripts/backup-databases.sh >> /var/log/valerix-backup.log 2>&1
```

**Or use Docker-based scheduling:**

```yaml
# Add to docker-compose.yml
backup-service:
  image: postgres:15-alpine
  container_name: valerix-backup
  volumes:
    - ./scripts:/scripts
    - ./backups:/backups
  environment:
    - BACKUP_SCHEDULE=0 2 * * * # 2 AM daily
  command: sh -c "while true; do /scripts/backup-databases.sh; sleep 86400; done"
  networks:
    - valerix-network
```

### 3. Backup Verification

Daily automated verification ensures backups are valid and restorable.

---

## 📦 Backup Scripts

### Backup Script (`scripts/backup-databases.sh`)

```bash
#!/bin/bash

# Valerix Database Backup Script
# Runs daily to backup both PostgreSQL databases

set -e  # Exit on error

# Configuration
BACKUP_DIR="./backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="./backups/backup.log"

# Database credentials (from docker-compose.yml)
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
PGPASSWORD="$ORDER_DB_PASSWORD" pg_dump \
    -h "$ORDER_DB_HOST" \
    -p "$ORDER_DB_PORT" \
    -U "$ORDER_DB_USER" \
    -d "$ORDER_DB_NAME" \
    --format=custom \
    --file="$BACKUP_DIR/order_db_${TIMESTAMP}.dump"

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
PGPASSWORD="$INVENTORY_DB_PASSWORD" pg_dump \
    -h "$INVENTORY_DB_HOST" \
    -p "$INVENTORY_DB_PORT" \
    -U "$INVENTORY_DB_USER" \
    -d "$INVENTORY_DB_NAME" \
    --format=custom \
    --file="$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump"

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
find "$BACKUP_DIR" -name "*.dump.gz" -type f -mtime +${RETENTION_DAYS} -delete
log "✅ Cleanup complete"

# Calculate backup sizes
ORDER_SIZE=$(du -h "$BACKUP_DIR/order_db_${TIMESTAMP}.dump.gz" | cut -f1)
INVENTORY_SIZE=$(du -h "$BACKUP_DIR/inventory_db_${TIMESTAMP}.dump.gz" | cut -f1)

log "=========================================="
log "Backup Summary:"
log "  Order DB backup: $ORDER_SIZE"
log "  Inventory DB backup: $INVENTORY_SIZE"
log "  Retention: $RETENTION_DAYS days"
log "=========================================="
log "Backup process completed successfully!"

exit 0
```

### Restore Script (`scripts/restore-databases.sh`)

```bash
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
```

### Verify Backup Script (`scripts/verify-backup.sh`)

```bash
#!/bin/bash

# Valerix Backup Verification Script
# Verifies that backups are valid and restorable

set -e

BACKUP_DIR="./backups"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "=========================================="
log "Verifying database backups"
log "=========================================="

# Find latest backups
LATEST_ORDER_BACKUP=$(ls -t "$BACKUP_DIR"/order_db_*.dump.gz 2>/dev/null | head -1)
LATEST_INVENTORY_BACKUP=$(ls -t "$BACKUP_DIR"/inventory_db_*.dump.gz 2>/dev/null | head -1)

if [ -z "$LATEST_ORDER_BACKUP" ]; then
    log "❌ No Order database backup found!"
    exit 1
fi

if [ -z "$LATEST_INVENTORY_BACKUP" ]; then
    log "❌ No Inventory database backup found!"
    exit 1
fi

log "Latest Order backup: $LATEST_ORDER_BACKUP"
log "Latest Inventory backup: $LATEST_INVENTORY_BACKUP"

# Test decompression
log "Testing decompression..."
gunzip -t "$LATEST_ORDER_BACKUP" && log "✅ Order backup compression valid"
gunzip -t "$LATEST_INVENTORY_BACKUP" && log "✅ Inventory backup compression valid"

# Test pg_restore --list (validates dump format)
log "Validating dump format..."
gunzip -c "$LATEST_ORDER_BACKUP" | pg_restore --list > /dev/null && log "✅ Order backup format valid"
gunzip -c "$LATEST_INVENTORY_BACKUP" | pg_restore --list > /dev/null && log "✅ Inventory backup format valid"

log "=========================================="
log "All backups verified successfully! ✅"
log "=========================================="
```

---

## ☁️ Azure Backup Strategy

### Azure Database for PostgreSQL Backups

Azure automatically provides:

**Automated Backups:**

- **Frequency**: Continuous (transaction log backups every 5 minutes)
- **Full backups**: Daily
- **Retention**: 7 days (default), configurable up to 35 days
- **Geo-redundancy**: Optional (recommended for production)

**Configuration:**

```bash
# Enable geo-redundant backups
az postgres flexible-server update \
  --resource-group valerix-rg \
  --name valerix-postgres \
  --backup-retention 30 \
  --geo-redundant-backup Enabled
```

### Manual Backup to Azure Storage

For additional safety, store backups in Azure Blob Storage:

```bash
#!/bin/bash
# scripts/backup-to-azure.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
STORAGE_ACCOUNT="valerixbackups"
CONTAINER="database-backups"

# Run local backup
./scripts/backup-databases.sh

# Upload to Azure Blob Storage
az storage blob upload-batch \
  --account-name "$STORAGE_ACCOUNT" \
  --destination "$CONTAINER" \
  --source ./backups \
  --pattern "*.dump.gz"

echo "Backups uploaded to Azure Storage"
```

---

## 🔄 Disaster Recovery Procedures

### Scenario 1: Database Corruption

**Symptoms:** Data inconsistencies, failed queries, corrupted tables

**Recovery Steps:**

```bash
# 1. Stop affected services
docker compose stop order-service inventory-service

# 2. Identify latest valid backup
ls -lh backups/

# 3. Restore from backup
bash scripts/restore-databases.sh 20260129_020000 both

# 4. Restart services
docker compose up -d order-service inventory-service

# 5. Verify data integrity
bash scripts/test-integration.sh
```

**Estimated Recovery Time:** 15-30 minutes

### Scenario 2: Complete System Failure

**Symptoms:** All services down, infrastructure failure

**Recovery Steps:**

```bash
# 1. Set up fresh infrastructure
docker compose down -v
docker compose up -d

# 2. Wait for databases to initialize
sleep 30

# 3. Restore from latest backup
LATEST=$(ls -t backups/*.dump.gz | head -1 | sed 's/.*_\([0-9_]*\)\.dump\.gz/\1/')
bash scripts/restore-databases.sh $LATEST both

# 4. Verify all services
docker compose ps
bash scripts/test-integration.sh
```

**Estimated Recovery Time:** 30-60 minutes

### Scenario 3: Data Loss (Accidental Deletion)

**Symptoms:** Missing orders or inventory data

**Recovery Steps:**

```bash
# 1. Identify when data was last valid
# Check backup timestamps

# 2. Create test database for restoration
docker run -d --name temp-postgres -e POSTGRES_PASSWORD=test postgres:15

# 3. Restore to test database and verify data
# Extract specific records

# 4. Import only needed data to production
# Use pg_dump --table or custom SQL
```

**Estimated Recovery Time:** 1-2 hours

### Scenario 4: Cloud Region Failure (Azure)

**Prerequisites:** Geo-redundant backups enabled

**Recovery Steps:**

```bash
# 1. Restore database to different region
az postgres flexible-server geo-restore \
  --resource-group valerix-rg-secondary \
  --name valerix-postgres-restored \
  --source-server valerix-postgres \
  --location westus

# 2. Update AKS services to point to new database
kubectl set env deployment/order-service \
  DB_HOST=valerix-postgres-restored.postgres.database.azure.com \
  -n valerix

# 3. Verify services
kubectl get pods -n valerix
```

**Estimated Recovery Time:** 2-4 hours

---

## 📊 Backup Monitoring

### Health Checks

**Daily automated check:**

```bash
# Add to cron (runs 1 hour after backup)
0 3 * * * /path/to/scripts/verify-backup.sh >> /var/log/valerix-verify.log 2>&1
```

### Alerts

**Set up alerts for:**

- ❌ Backup failures
- ⚠️ Backup size anomalies (too large/small)
- ⚠️ Missing backups
- ❌ Verification failures

**Example monitoring script:**

```bash
#!/bin/bash
# scripts/monitor-backups.sh

EXPECTED_BACKUP_AGE_HOURS=25  # Allow 1 hour buffer
LATEST_BACKUP=$(find backups/ -name "*.dump.gz" -type f -mmin -$((EXPECTED_BACKUP_AGE_HOURS * 60)) | wc -l)

if [ "$LATEST_BACKUP" -lt 2 ]; then
    echo "⚠️ WARNING: No recent backups found!"
    # Send alert (email, Slack, etc.)
    exit 1
fi

echo "✅ Backup monitoring: OK"
```

---

## 📝 Backup Best Practices

### Security

✅ **Encrypt backups** at rest and in transit  
✅ **Restrict access** to backup files (chmod 600)  
✅ **Separate storage** from production data  
✅ **Test restores** regularly (monthly recommended)  
✅ **Document procedures** and keep updated

### Storage

✅ **3-2-1 Rule**: 3 copies, 2 different media, 1 offsite  
✅ **Retention policy**: 7 days local, 30 days cloud  
✅ **Compression**: Use gzip to save space  
✅ **Versioning**: Keep multiple backup generations

### Testing

✅ **Monthly restore tests** to validate backups  
✅ **Document restore times** to validate RTO  
✅ **Test disaster recovery** procedures quarterly  
✅ **Update runbooks** based on test results

---

## 🗓️ Backup Schedule Summary

| Task                   | Frequency  | Time           | Retention |
| ---------------------- | ---------- | -------------- | --------- |
| Local database backup  | Daily      | 2:00 AM        | 7 days    |
| Backup verification    | Daily      | 3:00 AM        | N/A       |
| Azure automated backup | Continuous | Automatic      | 30 days   |
| Azure manual backup    | Weekly     | Sunday 1:00 AM | 90 days   |
| Restore test           | Monthly    | 1st Sunday     | N/A       |
| DR drill               | Quarterly  | Schedule       | N/A       |

---

## 📞 Emergency Contacts

**In case of data loss or system failure:**

1. **Database Administrator**: [Contact]
2. **DevOps Lead**: [Contact]
3. **Azure Support**: https://portal.azure.com (open support ticket)
4. **On-call Engineer**: [Contact]

---

## ✅ Backup Checklist

**Initial Setup:**

- [ ] Create backup directory
- [ ] Set up backup script permissions (chmod +x)
- [ ] Configure cron jobs for automated backups
- [ ] Test backup script manually
- [ ] Test restore script with sample data
- [ ] Set up monitoring and alerts
- [ ] Document recovery procedures

**Monthly Maintenance:**

- [ ] Review backup logs
- [ ] Perform restore test
- [ ] Verify backup sizes are reasonable
- [ ] Check available storage space
- [ ] Update documentation if needed

**After Any Restore:**

- [ ] Document what happened
- [ ] Document restore steps taken
- [ ] Review and update procedures
- [ ] Conduct post-mortem if needed

---

## 📚 Additional Resources

- **PostgreSQL Backup Documentation**: https://www.postgresql.org/docs/current/backup.html
- **Azure Backup Documentation**: https://docs.microsoft.com/azure/postgresql/flexible-server/concepts-backup-restore
- **Disaster Recovery Planning**: https://www.ready.gov/business/implementation/IT

---

## Summary

This backup strategy provides:

✅ **Daily automated backups** of all databases  
✅ **7-day local retention** with automatic cleanup  
✅ **30-day cloud retention** for disaster recovery  
✅ **Automated verification** to ensure backup validity  
✅ **Simple restore procedures** with clear documentation  
✅ **Disaster recovery plans** for common scenarios  
✅ **Monitoring and alerting** for backup health

**Next Steps:**

1. Set up automated daily backups
2. Test restore procedures
3. Configure Azure geo-redundant backups
4. Schedule monthly restore tests
5. Document any customizations to procedures
