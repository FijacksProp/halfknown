from django.core.management.base import BaseCommand

from apps.matching.services import match_lock, sweep


class Command(BaseCommand):
    help = "Release expired queue slots, invitations, and disconnected conversations. Run every minute."

    def handle(self, *args, **options):
        with match_lock():
            sweep()
        self.stdout.write("Expired matching leases released.")
