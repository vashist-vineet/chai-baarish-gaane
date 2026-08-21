from PIL import Image

try:
    img = Image.open('assets/images/spring/veranda-himalayan-spring.jpg')
    width, height = img.size
    
    for grid_y in range(5, 10):
        row = ""
        for grid_x in range(10):
            score = 0
            for y in range(grid_y * (height//10), (grid_y+1) * (height//10), 5):
                for x in range(grid_x * (width//10), (grid_x+1) * (width//10), 5):
                    r, g, b = img.getpixel((x, y))
                    # Any color where g is the dominant channel
                    if g > r and g >= b:
                        score += 1
            row += f"{score:4d} "
        print(f"Y={grid_y*10:02d}%: {row}")
except Exception as e:
    print(e)
