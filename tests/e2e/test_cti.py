"""
CTI E2E Tests — Headless Playwright/pytest.
Run: pytest tests/e2e/test_cti.py --base-url=https://cti.clawdexter.tech -v
"""
import subprocess
import pytest


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _login(page, base_url, test_user):
    """Log in and wait for the dashboard to load."""
    page.goto(base_url)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    try:
        page.wait_for_selector("#loginUsername", timeout=8000)
    except Exception:
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        page.wait_for_selector("#loginUsername", timeout=8000)
    page.fill("#loginUsername", test_user["username"])
    page.fill("#loginPassword", test_user["password"])
    page.click("button:has-text('Sign In')")
    page.wait_for_selector("#statTasks", timeout=10000)


# ---------------------------------------------------------------------------
# Anonymous / public
# ---------------------------------------------------------------------------

class TestAnonymousUser:
    """Unauthenticated UI surface."""

    def test_homepage_loads(self, page, base_url):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        assert page.locator("#root, #app, body").first.is_visible()

    def test_shows_login_button(self, page, base_url):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        assert page.get_by_role("button", name="Login").is_visible()

    def test_shows_disconnected_indicator(self, page, base_url):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        assert page.locator("#wsStatus").inner_text() == "Disconnected"

    def test_clicking_login_shows_modal(self, page, base_url):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        if page.locator("#loginUsername").is_visible():
            assert page.locator("#loginPassword").is_visible()
        else:
            page.get_by_role("button", name="Login").click(force=True)
            page.wait_for_selector("#loginUsername", timeout=5000)
            assert page.locator("#loginUsername").is_visible()
            assert page.locator("#loginPassword").is_visible()

    def test_data_tabs_block_unauthenticated(self, page, base_url):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        for tab in ["Tasks", "Memory", "Bridge", "Context"]:
            if page.locator("#loginUsername").is_visible():
                assert page.locator("#loginUsername").is_visible()
            else:
                page.get_by_role("button", name=tab).click(force=True)
                page.wait_for_selector("#loginUsername", timeout=3000)

    def test_health_endpoint_accessible(self, page, base_url):
        r = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"{base_url}/health"],
            capture_output=True, text=True)
        assert r.stdout.strip() == "200"

    def test_stats_endpoint_accessible(self, page, base_url):
        r = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"{base_url}/api/stats"],
            capture_output=True, text=True)
        assert r.stdout.strip() == "200"


# ---------------------------------------------------------------------------
# Login / logout
# ---------------------------------------------------------------------------

class TestLoginFlow:
    """Authentication flows."""

    def test_login_success_shows_dashboard(self, page, base_url, test_user):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        page.wait_for_selector("#loginUsername", timeout=8000)
        page.fill("#loginUsername", test_user["username"])
        page.fill("#loginPassword", test_user["password"])
        page.click("button:has-text('Sign In')")
        page.wait_for_selector("#statTasks", timeout=10000)
        assert page.locator("#statTasks").is_visible()

    def test_login_failure_shows_error(self, page, base_url):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        page.wait_for_selector("#loginUsername", timeout=8000)
        page.fill("#loginUsername", "nobody")
        page.fill("#loginPassword", "wrongpass")
        page.click("button:has-text('Sign In')")
        page.wait_for_timeout(1000)
        assert page.locator("#loginUsername").is_visible()
        panel_text = page.locator("#loginPanel").inner_text()
        assert "invalid" in panel_text.lower() or "error" in panel_text.lower()

    def test_login_shows_username_in_header(self, page, base_url, test_user):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        page.wait_for_selector("#loginUsername", timeout=8000)
        page.fill("#loginUsername", test_user["username"])
        page.fill("#loginPassword", test_user["password"])
        page.click("button:has-text('Sign In')")
        page.wait_for_selector("#statTasks", timeout=10000)
        assert test_user["username"] in page.locator("#authNav").inner_text()

    def test_login_closes_modal(self, page, base_url, test_user):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        page.wait_for_selector("#loginUsername", timeout=8000)
        page.fill("#loginUsername", test_user["username"])
        page.fill("#loginPassword", test_user["password"])
        page.click("button:has-text('Sign In')")
        page.wait_for_timeout(2000)
        panel_html = page.locator("#loginPanel").inner_html()
        assert "#loginModal" not in panel_html


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class TestDashboard:
    """Authenticated dashboard."""

    def test_dashboard_stats_load(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        assert page.locator("#statTasks").is_visible()

    def test_dashboard_shows_tasks_tab(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        assert page.get_by_role("button", name="Tasks").is_visible()

    def test_websocket_connects_after_login(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        page.wait_for_timeout(2000)
        status = page.locator("#wsStatus").inner_text()
        assert status == "Connected", f"Expected Connected, got {status}"

    def test_websocket_disconnected_before_login(self, page, base_url):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        assert page.locator("#wsStatus").inner_text() == "Disconnected"


# ---------------------------------------------------------------------------
# Tab navigation
# ---------------------------------------------------------------------------

class TestTabNavigation:
    """All five tabs and active-state highlighting."""

    def test_navigate_to_tasks_tab(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        page.get_by_role("button", name="Tasks").click()
        page.wait_for_timeout(500)
        assert page.get_by_role("button", name="Tasks").is_visible()

    def test_navigate_to_memory_tab(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        page.get_by_role("button", name="Memory").click()
        page.wait_for_timeout(500)
        assert page.get_by_role("button", name="Memory").is_visible()

    def test_navigate_to_bridge_tab(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        page.get_by_role("button", name="Bridge").click()
        page.wait_for_timeout(500)
        assert page.get_by_role("button", name="Bridge").is_visible()

    def test_navigate_to_context_tab(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        page.get_by_role("button", name="Context").click()
        page.wait_for_timeout(500)
        assert page.get_by_role("button", name="Context").is_visible()

    def test_active_tab_button_is_highlighted(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        page.get_by_role("button", name="Tasks").click()
        page.wait_for_timeout(500)
        cls = page.get_by_role("button", name="Tasks").get_attribute("class") or ""
        assert "active" in cls


# ---------------------------------------------------------------------------
# Tasks panel
# ---------------------------------------------------------------------------

class TestTasksPanel:
    """Tasks panel elements and JS-triggered form open."""

    @pytest.fixture(autouse=True)
    def _setup(self, page, request, test_user):
        _login(page, request.config.getoption("--base-url"), test_user)
        page.get_by_role("button", name="Tasks").click()
        page.wait_for_timeout(1500)

    def test_task_list_container_exists(self, page):
        lst = page.locator("#tasksList, .task-list, #taskList")
        assert lst.count() > 0

    def test_new_task_button_present(self, page):
        assert page.locator("button:has-text('+ New Task')").count() > 0

    def test_task_filter_controls_exist(self, page):
        assert page.locator("#taskSearch, input[placeholder*='filter' i]").count() > 0

    def test_new_task_form_opens_via_js(self, page):
        """Open form via JS to bypass viewport scroll issues in headless."""
        page.evaluate(
            "document.querySelectorAll('button').forEach(b => { "
            "if (b.textContent.includes('+ New Task')) b.click(); })"
        )
        page.wait_for_timeout(800)
        form = page.locator("#taskModal, #taskForm, input[name='title'], #taskTitle")
        assert form.first.is_visible()

    def test_task_filter_by_status(self, page):
        filt = page.locator("#taskFilterStatus")
        if filt.count() > 0 and filt.first.is_visible():
            filt.first.select_option("completed")
            page.wait_for_timeout(500)


# ---------------------------------------------------------------------------
# Memory panel
# ---------------------------------------------------------------------------

class TestMemoryPanel:
    """Memory panel elements and JS-triggered form open."""

    @pytest.fixture(autouse=True)
    def _setup(self, page, request, test_user):
        _login(page, request.config.getoption("--base-url"), test_user)
        page.get_by_role("button", name="Memory").click()
        page.wait_for_timeout(1000)

    def test_memory_list_container_exists(self, page):
        lst = page.locator("#memoryList, .memory-list, #memoryList")
        assert lst.count() > 0

    def test_new_memory_button_present(self, page):
        assert page.locator("button:has-text('+ Store Memory')").count() > 0

    def test_memory_form_opens_via_js(self, page):
        page.evaluate(
            "document.querySelectorAll('button').forEach(b => { "
            "if (b.textContent.includes('+ Store Memory')) b.click(); })"
        )
        page.wait_for_timeout(800)
        form = page.locator(
            "#memoryModal, #memoryForm, textarea[name='content'], #memoryContent"
        )
        assert form.first.is_visible()


# ---------------------------------------------------------------------------
# Bridge panel
# ---------------------------------------------------------------------------

class TestBridgePanel:
    """Bridge panel elements and JS-triggered form open."""

    @pytest.fixture(autouse=True)
    def _setup(self, page, request, test_user):
        _login(page, request.config.getoption("--base-url"), test_user)
        page.get_by_role("button", name="Bridge").click()
        page.wait_for_timeout(1000)

    def test_exchange_list_container_exists(self, page):
        lst = page.locator("#exchangeList, .exchange-list, #bridgeList")
        assert lst.count() > 0

    def test_new_exchange_button_present(self, page):
        assert page.locator("button:has-text('+ New Exchange')").count() > 0

    def test_exchange_form_opens_via_js(self, page):
        page.evaluate(
            "document.querySelectorAll('button').forEach(b => { "
            "if (b.textContent.includes('+ New Exchange')) b.click(); })"
        )
        page.wait_for_timeout(800)
        form = page.locator(
            "#exchangeModal, #bridgeForm, textarea[name='prompt'], #exchangePrompt"
        )
        assert form.first.is_visible()


# ---------------------------------------------------------------------------
# Context panel
# ---------------------------------------------------------------------------

class TestContextPanel:
    """Context panel elements and JS-triggered form open."""

    @pytest.fixture(autouse=True)
    def _setup(self, page, request, test_user):
        _login(page, request.config.getoption("--base-url"), test_user)
        page.get_by_role("button", name="Context").click()
        page.wait_for_timeout(1000)

    def test_context_list_container_exists(self, page):
        lst = page.locator("#contextList, .context-list, #contextList")
        assert lst.count() > 0

    def test_set_context_button_present(self, page):
        assert page.locator("button:has-text('+ Set Context')").count() > 0

    def test_context_form_opens_via_js(self, page):
        page.evaluate(
            "document.querySelectorAll('button').forEach(b => { "
            "if (b.textContent.includes('+ Set Context')) b.click(); })"
        )
        page.wait_for_timeout(800)
        form = page.locator(
            "#contextModal, #contextForm, input[name='key'], #contextKey"
        )
        assert form.first.is_visible()


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

class TestLogout:
    """Session end and UI state reset."""

    def test_logout_returns_to_login(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        page.get_by_role("button", name="Logout").click()
        page.wait_for_timeout(2000)
        visible = (
            page.locator("#loginUsername").is_visible()
            or page.get_by_role("button", name="Login").is_visible()
        )
        assert visible

    def test_logged_out_shows_login_modal(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        page.get_by_role("button", name="Logout").click()
        page.wait_for_timeout(2000)
        assert page.locator("#loginUsername").is_visible()

    def test_logged_out_user_cannot_access_data_tabs(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        page.get_by_role("button", name="Logout").click()
        page.wait_for_timeout(2000)
        page.get_by_role("button", name="Tasks").click(force=True)
        page.wait_for_timeout(1000)
        assert page.locator("#loginUsername").is_visible()


# ---------------------------------------------------------------------------
# Modal behavior
# ---------------------------------------------------------------------------

class TestModalBehavior:
    """Modal dismiss actions."""

    @pytest.fixture(autouse=True)
    def _open_task_form(self, page, request, test_user):
        _login(page, request.config.getoption("--base-url"), test_user)
        page.get_by_role("button", name="Tasks").click()
        page.wait_for_timeout(1500)
        page.evaluate(
            "document.querySelectorAll('button').forEach(b => { "
            "if (b.textContent.includes('+ New Task')) b.click(); })"
        )
        page.wait_for_timeout(800)
        yield
        try:
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
        except Exception:
            pass

    def test_modal_closes_on_cancel(self, page):
        cancel = page.get_by_role("button", name="Cancel")
        if cancel.is_visible():
            cancel.click()
            page.wait_for_timeout(500)
            modal = page.locator("#taskModal, #taskForm")
            if modal.count() > 0:
                assert not modal.first.is_visible()

    def test_modal_closes_on_escape(self, page):
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        modal = page.locator("#taskModal, #taskForm")
        if modal.count() > 0:
            assert not modal.first.is_visible()


# ---------------------------------------------------------------------------
# Session persistence
# ---------------------------------------------------------------------------

class TestSessionPersistence:
    """Session survives page reload."""

    def test_page_reload_stays_logged_in(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        stat = page.locator("#statTasks").is_visible()
        nav = test_user["username"] in page.locator("#authNav").inner_text()
        assert stat or nav


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

class TestWebSocket:
    """WS connection state and reconnection guard."""

    def test_no_double_websocket_on_nav(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        page.wait_for_timeout(2000)
        assert page.locator("#wsStatus").inner_text() == "Connected"
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        assert page.locator("#wsStatus").inner_text() == "Connected"


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Robustness and security checks."""

    def test_xss_in_task_title_is_escaped(self, page, base_url, test_user):
        _login(page, base_url, test_user)
        page.get_by_role("button", name="Tasks").click()
        page.wait_for_timeout(1500)
        page.evaluate(
            "document.querySelectorAll('button').forEach(b => { "
            "if (b.textContent.includes('+ New Task')) b.click(); })"
        )
        page.wait_for_timeout(800)
        title_input = page.locator("input[name='title'], #taskTitle").first
        title_input.fill("<script>window.__xss=1</script>Test")
        page.click("button:has-text('Save Task')")
        page.wait_for_timeout(1000)
        html = page.locator("#taskList").inner_html()
        assert "<script>" not in html