from rest_framework.authentication import SessionAuthentication


class CsrfSessionAuthentication(SessionAuthentication):
    def authenticate(self, request):
        # DRF normally checks CSRF only for authenticated sessions. Login needs it too.
        self.enforce_csrf(request)
        return super().authenticate(request)
