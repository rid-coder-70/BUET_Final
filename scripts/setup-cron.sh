
echo "0 */4 * * * /scripts/backup-to-volume.sh >> /var/log/cron.log 2>&1" > /etc/crontabs/root


echo "0 23 * * * /scripts/sync-to-external.sh >> /var/log/cron.log 2>&1" >> /etc/crontabs/root

touch /var/log/cron.log

crond -f -l 2
