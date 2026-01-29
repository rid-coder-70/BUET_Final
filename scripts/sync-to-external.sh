
set -e

BACKUP_DIR="/backups"
EXTERNAL_SYNC_DIR="/backups/external-sync"
TIMESTAMP=$(date +%Y%m%d)

mkdir -p "$EXTERNAL_SYNC_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting daily external sync (Valerix constraint: 1 call/day)..."


TAR_NAME="daily_backup_bundle_${TIMESTAMP}.tar.gz"


tar --exclude="external-sync" -czf "$EXTERNAL_SYNC_DIR/$TAR_NAME" -C "$BACKUP_DIR" .

log "Created daily bundle: $TAR_NAME"
log "Simulating upload to external Valerix storage..."


sleep 2

log "Upload complete. Daily quota used (1/1)."
