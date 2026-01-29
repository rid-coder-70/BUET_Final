
set -e

CONTAINER="valerix-backup-service"


if ! docker ps | grep -q "$CONTAINER"; then
    echo "Error: Backup service container ($CONTAINER) is not running."
    echo "Please start it with: docker-compose up -d backup-service"
    exit 1
fi

if [ $# -lt 1 ]; then
    echo "Usage: $0 <timestamp> [order|inventory|both]"
    echo ""
    echo "Available backups in volume:"
    docker exec "$CONTAINER" find /backups -name "order_db_*.dump.gz" | sed 's/.*order_db_\(.*\)\.dump\.gz/\1/' | sort -r
    exit 1
fi

TIMESTAMP=$1
TARGET=${2:-both}

echo "Triggering restore inside backup container..."
docker exec "$CONTAINER" /scripts/restore-internal.sh "$TIMESTAMP" "$TARGET"

