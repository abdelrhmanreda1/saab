#!/bin/bash
# Setup automated Firestore backups via cron
# Run this script to set up daily backups

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-firestore.js"

# Add cron job for daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * cd $SCRIPT_DIR && node backup-firestore.js >> /var/log/firestore-backup.log 2>&1") | crontab -

echo "✓ Daily backup scheduled for 2 AM"
echo "Backup logs will be written to /var/log/firestore-backup.log"

