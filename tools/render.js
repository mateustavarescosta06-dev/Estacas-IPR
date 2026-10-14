// Exporta as imagens da maquete 3D. Uso: node tools/render.js [shot ...]
// Requer playwright e um servidor estático na raiz: python3 -m http.server 8765
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const SHOTS = { hero: [2400, 1350], estacas: [1800, 1200], fundacao: [1800, 1200], central: [1800, 1200],
  protensao: [1800, 1200], logistica: [1800, 1200], aerea: [2400, 1350], pilha: [1800, 1200] };
(async () => {
  const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
  const b = await chromium.launch({ executablePath: process.env.CHROME, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const out = path.join(__dirname, "..", "assets", "img", "3d");
  fs.mkdirSync(out, { recursive: true });
  for (const name of want) {
    const [w, h] = SHOTS[name];
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on("pageerror", e => console.error(name, e.message));
    await p.goto(`http://localhost:8765/tools/render.html?shot=${name}&w=${w}&h=${h}`);
    await p.waitForFunction(() => window.__done, null, { timeout: 180000 });
    const data = await p.evaluate(() => document.getElementById("c").toDataURL("image/jpeg", 0.86));
    fs.writeFileSync(path.join(out, name + ".jpg"), Buffer.from(data.split(",")[1], "base64"));
    console.log("ok", name, w + "x" + h);
    await p.close();
  }
  await b.close();
})();
