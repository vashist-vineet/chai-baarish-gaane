import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
        
        await page.goto('http://localhost:8765/')
        await page.wait_for_timeout(1000)
        
        await page.click('.entry-button')
        await page.wait_for_timeout(2000)
        
        await page.evaluate("window.CBG.switchEnvironment('spring')")
        print("Switched to spring. Waiting for 4 butterflies...")
        
        count = 0
        while count < 4:
            # wait for .butterfly-wrapper to be added to DOM
            try:
                # Wait for the exact n-th element to appear.
                # Since butterflies are removed when they die, we might just wait for a new one to appear.
                # We'll use page.wait_for_selector but it might match an existing one.
                # Better: Wait for a butterfly to exist, take a screenshot, then wait for it to disappear, repeat.
                await page.wait_for_selector('.butterfly-wrapper')
                print(f"Butterfly #{count+1} spawned!")
                await page.wait_for_timeout(2000) # let it fly a bit
                await page.screenshot(path=f'/Users/luckyali/.gemini/antigravity-ide/brain/61622c6b-029c-4398-9173-2d78ba12dec4/butterfly_{count+1}.png')
                
                # wait for it to be removed
                await page.wait_for_function('document.querySelectorAll(".butterfly-wrapper").length === 0', timeout=60000)
                print(f"Butterfly #{count+1} vanished.")
                count += 1
            except Exception as e:
                print(f"Error waiting for butterfly: {e}")
                break
        
        await browser.close()

asyncio.run(main())
