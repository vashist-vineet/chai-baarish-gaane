from PIL import Image
import sys

try:
    img = Image.open('assets/images/spring/veranda-himalayan-spring.jpg')
    img = img.resize((100, 100)) # resize to 100x100 for easy percentage math
    
    # We are looking for a plant (green) on the balcony (likely bottom half)
    # Let's print out the "greenness" of cells in a 10x10 grid
    
    pixels = img.load()
    
    for y in range(50, 100, 10):
        row = ""
        for x in range(0, 100, 10):
            g_score = 0
            for dy in range(10):
                for dx in range(10):
                    r, g, b = pixels[x+dx, y+dy]
                    if g > r and g > b and g > 80:
                        g_score += 1
            row += f"{g_score:3d} "
        print(f"Y={y}-{y+10}: {row}")
        
except Exception as e:
    print(e)
