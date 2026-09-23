from django.contrib import admin

from .models import Connection, DirectMessage, Follow, ShowcaseItem, SocialReport

admin.site.register((Follow, Connection, DirectMessage, ShowcaseItem, SocialReport))
