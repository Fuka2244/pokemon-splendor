import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const workspace = process.cwd();
const manifestPath = path.join(workspace, "docs", "assets", "card-inventory.json");
const outputDir = path.join(workspace, "assets", "derived", "contact-sheets");

fs.mkdirSync(outputDir, { recursive: true });

execFileSync("python", [
  "-c",
  [
    "import json, os",
    "from PIL import Image, ImageDraw, ImageFont",
    `workspace=${JSON.stringify(workspace)}`,
    `manifest_path=${JSON.stringify(manifestPath)}`,
    `output_dir=${JSON.stringify(outputDir)}`,
    "data=json.load(open(manifest_path, encoding='utf8'))",
    "groups={}",
    "for item in data['files']:",
    "    groups.setdefault(item['inferredGroup'], []).append(item)",
    "try:",
    "    font=ImageFont.truetype('arial.ttf', 18)",
    "except Exception:",
    "    font=ImageFont.load_default()",
    "thumb_w, thumb_h = 160, 224",
    "label_h, gap = 28, 12",
    "cols = 5",
    "for group, items in groups.items():",
    "    rows=(len(items)+cols-1)//cols",
    "    sheet=Image.new('RGB', (cols*(thumb_w+gap)+gap, rows*(thumb_h+label_h+gap)+gap), 'white')",
    "    draw=ImageDraw.Draw(sheet)",
    "    for idx,item in enumerate(items):",
    "        x=gap+(idx%cols)*(thumb_w+gap)",
    "        y=gap+(idx//cols)*(thumb_h+label_h+gap)",
    "        img=Image.open(os.path.join(workspace, item['normalizedPath'])).convert('RGB')",
    "        img.thumbnail((thumb_w, thumb_h))",
    "        ox=x+(thumb_w-img.width)//2",
    "        oy=y+(thumb_h-img.height)//2",
    "        sheet.paste(img, (ox, oy))",
    "        draw.rectangle([x, y, x+thumb_w, y+thumb_h], outline='#222', width=1)",
    "        draw.text((x, y+thumb_h+4), os.path.splitext(os.path.basename(item['normalizedPath']))[0], fill='#111', font=font)",
    "    sheet.save(os.path.join(output_dir, f'{group}.jpg'), quality=92)",
  ].join("\n"),
], { stdio: "inherit" });

console.log(`Contact sheets written to ${outputDir}`);
