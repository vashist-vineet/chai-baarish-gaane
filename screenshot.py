import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
        
        # Capture console errors
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}") if msg.type == "error" else None)
        page.on("pageerror", lambda err: print(f"ERROR: {err}"))
        
        print("Loading page...")
        await page.goto('http://localhost:8765/')
        await page.wait_for_timeout(2000)
        
        print("Clicking enter...")
        await page.click('.entry-button')
        await page.wait_for_timeout(4000)
        
        print("Switching to spring...")
        await page.evaluate("window.CBG.switchEnvironment('spring')")
        
        # Wait a long time to allow butterflies to spawn (nextSpawnIn is 12s-24s, let's artificially trigger it)
        print("Waiting for transition and spawning butterfly...")
        await page.wait_for_timeout(4000)
        await page.evaluate("if (window.CBG) window.CBG.switchEnvironment('spring')") # just in case
        
        # Force a butterfly to spawn immediately by manipulating the system if possible
        # Actually, let's just wait 15 seconds.
        print("Waiting 15 seconds...")
        await page.wait_for_timeout(15000)
        
        screenshot_path = '/Users/luckyali/.gemini/antigravity-ide/brain/61622c6b-029c-4398-9173-2d78ba12dec4/spring_butterfly_test.png'
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")
        
        await browser.close()

asyncio.run(main())
