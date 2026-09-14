from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

import pytest
from django.db import close_old_connections, connection

from apps.accounts.services import request_code, verify_code


@pytest.mark.django_db(transaction=True)
def test_same_otp_can_only_be_consumed_once_under_concurrency():
    if connection.vendor != "postgresql":
        pytest.skip("Requires PostgreSQL row locks; run the integration-tests Compose service.")
    with patch("apps.accounts.services.secrets.randbelow", return_value=123456):
        challenge_id = request_code("concurrent@example.com")
    barrier = Barrier(2)

    def consume():
        close_old_connections()
        try:
            barrier.wait(timeout=5)
            return verify_code(challenge_id, "123456") is not None
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: consume(), range(2)))
    assert sorted(results) == [False, True]
