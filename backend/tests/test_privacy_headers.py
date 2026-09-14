import pytest


@pytest.mark.django_db
@pytest.mark.parametrize("path", ["/api/v1/auth/csrf/", "/api/v1/me/", "/api/v1/profile/"])
def test_api_responses_are_not_cacheable(client, path):
    response = client.get(path)
    assert "no-store" in response["Cache-Control"]
    assert "private" in response["Cache-Control"]
