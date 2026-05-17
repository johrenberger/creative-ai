"""
Playwright configuration for CTI E2E tests.
Run with: pytest tests/e2e/test_cti.py --base-url=https://cti.clawdexter.tech
"""
import urllib.request
import urllib.error
import pytest


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "auth: mark test as requiring authentication")
    config.addinivalue_line("markers", "anon: mark test as anonymous/unauthenticated")
    config.addinivalue_line("markers", "websocket: mark test as checking WebSocket state")


@pytest.fixture(scope="session")
def base_url():
    """Target environment base URL."""
    return "https://cti.clawdexter.tech"


@pytest.fixture(scope="session")
def test_user():
    """Pre-registered test user credentials."""
    return {
        "username": "prodtest",
        "password": "testpass123",
    }


@pytest.fixture(scope="session")
def api_url(base_url):
    """API base URL derived from base_url."""
    return base_url


def _register_test_user(base_url, username, email, password):
    """Register a test user. Idempotent — 409 means already exists."""
    url = f"{base_url}/api/auth/register"
    data = (
        f'{{"username":"{username}","email":"{email}","password":"{password}"}}'
    ).encode()
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status
    except urllib.error.HTTPError as e:
        if e.code == 409:
            return 409  # already registered — this is fine
        raise


@pytest.fixture(scope="session", autouse=True)
def ensure_test_user(base_url, test_user):
    """Ensure test user exists before any tests run (session scope, autouse)."""
    _register_test_user(
        base_url,
        test_user["username"],
        f"{test_user['username']}@test.com",
        test_user["password"],
    )


@pytest.fixture
def logged_in_page(page, base_url, test_user):
    """
    Authenticated page fixture — logs in before test, logs out after.
    Use @pytest.mark.auth to apply. Handles cleanup on logout.
    """
    # Login
    page.goto(base_url)
    page.wait_for_load_state("networkidle")

    # Click login button if shown (may not be visible if auto-showing modal)
    login_btn = page.get_by_role("button", name="Login")
    if login_btn.is_visible():
        login_btn.click()
        page.wait_for_selector("#loginUsername", timeout=5000)

    page.fill("#loginUsername", test_user["username"])
    page.fill("#loginPassword", test_user["password"])
    page.click("button:has-text('Sign In')")

    # Wait for dashboard elements
    page.wait_for_selector("#statTasks", timeout=10000)

    yield page

    # Logout cleanup — best effort
    try:
        page.get_by_role("button", name="Logout").click()
        page.wait_for_timeout(1000)
    except Exception:
        pass