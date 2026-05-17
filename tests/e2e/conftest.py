"""
Playwright configuration for CTI E2E tests.
Run with: pytest tests/e2e/test_cti.py --base-url=https://cti.clawdexter.tech
"""
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


@pytest.fixture
async def logged_in_page(page, base_url, test_user):
    """
    Authenticated page fixture — logs in before test, logs out after.
    Use @pytest.mark.auth to apply. Handles cleanup on logout.
    """
    # Login
    await page.goto(base_url)
    await page.wait_for_load_state("networkidle")

    # Click login button if shown
    login_btn = page.get_by_role("button", name="Login")
    if login_btn.is_visible():
        await login_btn.click()
        await page.wait_for_selector("#loginUsername", timeout=5000)

    await page.fill("#loginUsername", test_user["username"])
    await page.fill("#loginPassword", test_user["password"])
    await page.click("button:has-text('Sign In')")

    # Wait for dashboard elements
    await page.wait_for_selector("#statTasks", timeout=10000)

    yield page

    # Logout cleanup
    try:
        await page.click("button:has-text('Logout')")
        await page.wait_for_timeout(1000)
    except Exception:
        pass  # best-effort cleanup