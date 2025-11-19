from playwright.sync_api import Page, expect, sync_playwright
import os

def verify_aluno_login_rebranding(page: Page):
  """
  Verifies that the rebranding from 'Moniton' to 'New Nerd' was
  correctly applied to the student login page.
  """
  # 1. Arrange: Navigate to the local student login page.
  file_path = os.path.abspath("aluno-interface/login.html")
  page.goto(f"file://{file_path}")

  # 2. Assert: Check if the main heading reflects the new brand name.
  heading = page.get_by_role("heading", name="🎓 New Nerd Aluno")
  expect(heading).to_be_visible()

  # 3. Screenshot: Capture the result for visual verification.
  page.screenshot(path="verification/aluno_login_rebrand.png")

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      verify_aluno_login_rebranding(page)
      print("Verification script executed successfully.")
    except Exception as e:
      print(f"An error occurred: {e}")
    finally:
      browser.close()
